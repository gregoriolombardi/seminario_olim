"use client";

import { useRef, useState, type FormEvent } from "react";

import type { Participante, Presenca, RespostaCheckin, RespostaInscricao, Vaga } from "@/lib/tipos";
import { workshops } from "@/lib/workshops";

// O código de OK fica guardado no aparelho do organizador para não digitar a cada pessoa.
// Quem confere é o Apps Script; se estiver errado, sai daqui.
const CHAVE_CODIGO_OK = "olim-codigo-ok";

type Envio =
  | { estado: "ocioso" }
  | { estado: "enviando" }
  | { estado: "erro"; mensagem: string }
  | { estado: "feito"; checkin: string };

type Props = {
  codigo: string;
  participante: Participante | null;
  exigeCodigo: boolean;
  // Para escolher workshop na hora, se a pessoa ainda não escolheu.
  vagas: Vaga[];
  // Check-ins já feitos por workshop e no seminário.
  presenca: { porWorkshop: Record<string, Presenca>; geral: Presenca };
};

export default function CheckIn({ codigo, participante, exigeCodigo, vagas, presenca }: Props) {
  const [checkin, setCheckin] = useState(participante?.checkin ?? null);
  const [workshopId, setWorkshopId] = useState(participante?.workshopId ?? null);
  const [envio, setEnvio] = useState<Envio>({ estado: "ocioso" });
  const campoOk = useRef<HTMLInputElement | null>(null);

  // Preenche o código guardado quando o campo aparece (também depois de escolher o workshop).
  function prepararCampoOk(campo: HTMLInputElement | null) {
    campoOk.current = campo;
    if (!campo || campo.value) return;
    try {
      campo.value = localStorage.getItem(CHAVE_CODIGO_OK) ?? "";
    } catch {
      // Sem acesso ao armazenamento: digita o código a cada check-in.
    }
  }

  if (!participante) {
    return (
      <>
        <div role="alert" className="rounded-3xl border border-roxo-200 bg-branco p-6">
          <p className="eyebrow text-roxo">Ingresso {codigo}</p>
          <h1 className="font-display mt-1 text-2xl font-semibold text-roxo-900">Não encontrado</h1>
          <p className="mt-2 text-tinta/80">
            Este código não está na lista de participantes ou o ingresso não está aprovado no Sympla. Confira o
            código ou encaminhe a pessoa ao credenciamento.
          </p>
        </div>
        <OutroIngresso />
      </>
    );
  }

  const workshop = workshops.find((w) => w.id === workshopId);
  const enviando = envio.estado === "enviando";
  // O que foi feito nesta tela ainda não está na contagem que veio do servidor.
  const agora = envio.estado === "feito" ? 1 : 0;
  const escolheuAgora = workshopId !== participante.workshopId;
  const base = workshop ? presenca.porWorkshop[workshop.id] : undefined;
  const doWorkshop = base && {
    total: base.total + (escolheuAgora ? 1 : 0),
    feitos: base.feitos + ((escolheuAgora ? Boolean(checkin) : agora === 1) ? 1 : 0),
  };

  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    const codigoOk = exigeCodigo ? (campoOk.current?.value ?? "").trim() : "";
    setEnvio({ estado: "enviando" });

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, codigoOk }),
      });
      const dados = (await res.json()) as RespostaCheckin;
      if (dados.checkin) setCheckin(dados.checkin);

      if (dados.ok) {
        if (exigeCodigo) guardarCodigoOk(codigoOk);
        setEnvio({ estado: "feito", checkin: dados.checkin });
      } else {
        if (dados.codigo === "CODIGO_OK_INVALIDO") guardarCodigoOk("");
        setEnvio(dados.codigo === "JA_FEZ_CHECKIN" ? { estado: "ocioso" } : { estado: "erro", mensagem: dados.mensagem });
      }
    } catch {
      setEnvio({ estado: "erro", mensagem: "Sem conexão. Confira a internet e tente novamente." });
    }
  }

  return (
    <>
      <article className="rounded-3xl border border-roxo-200 bg-branco p-6 shadow-[0_18px_50px_-30px_rgba(46,31,77,0.6)]">
        <p className="eyebrow text-roxo">Ingresso {codigo}</p>
        <h1 className="font-display mt-1 text-3xl font-semibold leading-tight text-roxo-900">{participante.nome}</h1>
        <p className="mt-1 break-all text-sm text-tinta/60">{participante.email}</p>

        <div className="mt-5 rounded-2xl bg-lilas p-4">
          <p className="eyebrow text-roxo">Workshop</p>
          {workshop ? (
            <>
              <p className="mt-1 font-semibold leading-snug text-roxo-900">{workshop.titulo}</p>
              <p className="mt-0.5 text-sm text-tinta/70">{workshop.palestrante}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-roxo-200 pt-3 text-sm">
                <div>
                  <dt className="eyebrow text-roxo">Horário</dt>
                  <dd className="mt-0.5 font-semibold text-roxo-900">{workshop.horario ?? "A definir"}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-roxo">Sala</dt>
                  <dd className="mt-0.5 font-semibold text-roxo-900">{workshop.sala ?? "A definir"}</dd>
                </div>
              </dl>
            </>
          ) : workshopId === "?" ? (
            <p className="mt-1 font-semibold text-roxo-900">
              Valor na planilha não bate com nenhum workshop — confira a coluna WORKSHOP_1.
            </p>
          ) : (
            <EscolherWorkshop codigo={codigo} vagasIniciais={vagas} onEscolhido={setWorkshopId} />
          )}
        </div>
      </article>

      {checkin ? (
        <div
          role="status"
          className={[
            "mt-4 rounded-3xl p-6",
            envio.estado === "feito" ? "bg-roxo-900 text-branco" : "border-2 border-roxo bg-lilas text-roxo-900",
          ].join(" ")}
        >
          <p className={`eyebrow ${envio.estado === "feito" ? "text-roxo-300" : "text-roxo"}`}>
            {envio.estado === "feito" ? "Check-in confirmado" : "Atenção: entrada já registrada"}
          </p>
          <p className="font-display mt-1 text-2xl font-semibold">{formatarHora(checkin)}</p>
          {envio.estado !== "feito" && (
            <p className="mt-1 text-sm">Este ingresso já fez check-in. Não libere uma segunda entrada.</p>
          )}
        </div>
      ) : !workshop ? (
        <p role="status" className="mt-4 rounded-3xl border-2 border-dashed border-roxo-200 bg-branco p-6 text-center font-semibold text-roxo-900">
          {workshopId === "?"
            ? "Check-in bloqueado até corrigir o workshop na planilha."
            : "Escolha o workshop acima para liberar o check-in."}
        </p>
      ) : (
        <form onSubmit={confirmar} className="mt-4 rounded-3xl border border-roxo-200 bg-branco p-6">
          {exigeCodigo && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Código de OK</span>
              <input
                type="password"
                name="codigoOk"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={40}
                ref={prepararCampoOk}
                className="w-full rounded-xl border border-roxo-200 bg-papel px-4 py-3 text-lg tracking-widest text-tinta outline-none transition focus:border-roxo focus:ring-2 focus:ring-roxo/25"
              />
            </label>
          )}

          {envio.estado === "erro" && (
            <p role="alert" className="mt-4 rounded-xl bg-lilas px-4 py-3 text-sm font-semibold text-roxo-900">
              {envio.mensagem}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className={[
              "w-full rounded-xl bg-roxo px-6 py-4 text-lg font-semibold text-branco transition hover:bg-roxo-700 disabled:cursor-not-allowed disabled:bg-esgotado",
              exigeCodigo ? "mt-4" : "",
            ].join(" ")}
          >
            {enviando ? "Registrando…" : "OK — confirmar entrada"}
          </button>
        </form>
      )}

      <section className="mt-4 rounded-3xl border border-roxo-200 bg-branco p-6">
        <p className="eyebrow text-roxo">Presença</p>
        <div className="mt-3 space-y-5">
          {doWorkshop && <Placar rotulo="Neste workshop" total={doWorkshop.total} feitos={doWorkshop.feitos} />}
          <Placar rotulo="Seminário (todos os ingressos)" total={presenca.geral.total} feitos={presenca.geral.feitos + agora} />
        </div>
      </section>

      <OutroIngresso />
    </>
  );
}

/** Inscreve na hora quem chegou sem workshop — mesmo fluxo da página de inscrição, com
 *  limite de vagas conferido na planilha. */
function EscolherWorkshop({
  codigo,
  vagasIniciais,
  onEscolhido,
}: {
  codigo: string;
  vagasIniciais: Vaga[];
  onEscolhido: (id: string) => void;
}) {
  const [vagas, setVagas] = useState(vagasIniciais);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function inscrever(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selecionado || enviando) return;
    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, workshopId: selecionado }),
      });
      const dados = (await res.json()) as RespostaInscricao;
      if (dados.vagas) setVagas(dados.vagas);
      if (dados.ok) {
        onEscolhido(selecionado);
        return;
      }
      setErro(
        dados.codigo === "JA_INSCRITO" ? `${dados.mensagem} Recarregue a página para ver o workshop.` : dados.mensagem,
      );
      if (dados.codigo === "LOTADO") setSelecionado(null);
    } catch {
      setErro("Sem conexão. Confira a internet e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={inscrever}>
      <p className="mt-1 font-semibold text-roxo-900">Não escolheu workshop. Escolha agora:</p>
      <fieldset className="mt-3 space-y-2" disabled={enviando}>
        <legend className="sr-only">Workshops</legend>
        {workshops.map((w) => {
          const vaga = vagas.find((v) => v.id === w.id);
          const lotado = vaga?.lotado ?? false;
          return (
            <label
              key={w.id}
              className={[
                "flex items-start gap-3 rounded-xl border bg-branco p-3 transition",
                selecionado === w.id ? "border-roxo ring-2 ring-roxo/25" : "border-roxo-200",
                lotado ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              ].join(" ")}
            >
              <input
                type="radio"
                name="workshop"
                value={w.id}
                disabled={lotado}
                checked={selecionado === w.id}
                onChange={() => setSelecionado(w.id)}
                className="mt-1 accent-roxo"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-roxo-900">{w.titulo}</span>
                <span className="mt-0.5 block text-xs text-tinta/70">
                  {[w.horario, w.sala].filter(Boolean).join(" · ") || w.palestrante}
                </span>
              </span>
              <span className={`shrink-0 text-xs font-semibold ${lotado ? "text-tinta/60" : "text-roxo"}`}>
                {!vaga ? "" : lotado ? "Esgotado" : `${vaga.restantes} ${vaga.restantes === 1 ? "vaga" : "vagas"}`}
              </span>
            </label>
          );
        })}
      </fieldset>

      {erro && (
        <p role="alert" className="mt-3 rounded-xl bg-branco px-4 py-3 text-sm font-semibold text-roxo-900">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={!selecionado || enviando}
        className="mt-3 w-full rounded-xl border border-roxo bg-branco px-5 py-3 font-semibold text-roxo transition hover:bg-lilas disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Inscrevendo…" : "Inscrever neste workshop"}
      </button>
    </form>
  );
}

function Placar({ rotulo, total, feitos }: { rotulo: string; total: number; feitos: number }) {
  const faltam = Math.max(0, total - feitos);
  return (
    <div>
      <p className="text-sm font-semibold text-tinta">{rotulo}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl font-semibold text-roxo-900">
          {feitos} <span className="text-base font-medium text-tinta/60">de {total} entraram</span>
        </p>
        <p className="text-sm font-semibold text-roxo">
          {faltam} {faltam === 1 ? "falta" : "faltam"}
        </p>
      </div>
      <span className="trilho mt-2 block h-2 w-full overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full bg-roxo transition-[width] duration-500"
          style={{ width: `${total ? Math.min(100, (feitos / total) * 100) : 0}%` }}
        />
      </span>
    </div>
  );
}

/** Digitar um código à mão (QR ilegível, pessoa sem o link). */
export function OutroIngresso({ destaque = false }: { destaque?: boolean }) {
  return (
    <form action="/check-in" method="get" className={destaque ? "rounded-3xl border border-roxo-200 bg-branco p-6" : "mt-8"}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-tinta">
          {destaque ? "Código do ingresso" : "Próximo ingresso"}
        </span>
        <span className="flex gap-2">
          <input
            type="text"
            name="c"
            required
            minLength={4}
            maxLength={40}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="AAAQ-C0-XWY8"
            className="min-w-0 flex-1 rounded-xl border border-roxo-200 bg-papel px-4 py-3 uppercase text-tinta outline-none transition focus:border-roxo focus:ring-2 focus:ring-roxo/25"
          />
          <button
            type="submit"
            className="rounded-xl border border-roxo px-5 py-3 font-semibold text-roxo transition hover:bg-lilas"
          >
            Buscar
          </button>
        </span>
      </label>
    </form>
  );
}

function guardarCodigoOk(valor: string) {
  try {
    if (valor) localStorage.setItem(CHAVE_CODIGO_OK, valor);
    else localStorage.removeItem(CHAVE_CODIGO_OK);
  } catch {
    // Sem armazenamento: só não lembra o código.
  }
}

function formatarHora(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
