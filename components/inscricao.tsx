"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import type { RespostaInscricao, Vaga } from "@/lib/tipos";
import { workshops } from "@/lib/workshops";

const INTERVALO_MS = 15_000;

type Envio =
  | { estado: "ocioso" }
  | { estado: "enviando" }
  | { estado: "erro"; mensagem: string }
  | { estado: "sucesso"; workshopId: string; nome: string };

export default function Inscricao({ initialVagas }: { initialVagas: Vaga[] | null }) {
  const [vagas, setVagas] = useState(initialVagas);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [envio, setEnvio] = useState<Envio>({ estado: "ocioso" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/vagas", { cache: "no-store" });
        const dados = (await res.json()) as { ok: boolean; vagas?: Vaga[] };
        if (ativo && dados.ok && dados.vagas) setVagas(dados.vagas);
      } catch {
        // Mantém os números atuais e tenta no próximo ciclo.
      }
    }

    if (!initialVagas) atualizar();
    const id = setInterval(atualizar, INTERVALO_MS);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      ativo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [initialVagas]);

  const vagaDe = (id: string) => vagas?.find((v) => v.id === id);
  const escolhido = workshops.find((w) => w.id === selecionado);
  const escolhidoLotado = selecionado ? vagaDe(selecionado)?.lotado : false;
  const confirmado = envio.estado === "sucesso";
  const enviando = envio.estado === "enviando";

  function escolher(id: string) {
    setSelecionado(id);
    if (envio.estado === "erro") setEnvio({ estado: "ocioso" });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selecionado || enviando) return;
    setEnvio({ estado: "enviando" });

    try {
      const res = await fetch("/api/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId: selecionado, nome, email }),
      });
      const dados = (await res.json()) as RespostaInscricao;
      if (dados.vagas) setVagas(dados.vagas);
      setEnvio(
        dados.ok
          ? { estado: "sucesso", workshopId: selecionado, nome: nome.trim().split(/\s+/)[0] }
          : { estado: "erro", mensagem: dados.mensagem },
      );
    } catch {
      setEnvio({ estado: "erro", mensagem: "Sem conexão. Confira sua internet e tente novamente." });
    }
  }

  return (
    <section id="inscricao" className="mx-auto w-full max-w-5xl px-6 pb-24">
      <header className="mb-8 max-w-2xl">
        <p className="eyebrow text-roxo">Passo 1 — Escolha seu workshop</p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-roxo-900 sm:text-3xl">
          São {workshops.length} workshops simultâneos. Você participa de <span className="brush text-roxo">um</span>.
        </h2>
        <p className="mt-2 text-tinta/80">As vagas são limitadas e travam ao lotar — escolha logo a sua.</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {workshops.map((w, i) => {
          const vaga = vagaDe(w.id);
          const ativo = selecionado === w.id;
          const lotado = vaga?.lotado ?? false;
          const preenchido = vaga && vaga.limite > 0 ? (vaga.inscritos / vaga.limite) * 100 : 0;
          const ultimas = vaga && !lotado && vaga.restantes <= 10;

          return (
            <li key={w.id} className="sobe" style={{ animationDelay: `${i * 60}ms` }}>
              <button
                type="button"
                aria-pressed={ativo}
                disabled={lotado || confirmado}
                onClick={() => escolher(w.id)}
                className={[
                  "group relative flex h-full w-full flex-col rounded-3xl border p-5 text-left transition",
                  ativo
                    ? "border-roxo bg-lilas shadow-[0_18px_40px_-26px_rgba(46,31,77,0.55)] ring-2 ring-roxo/30"
                    : "border-roxo-200 bg-branco",
                  lotado
                    ? "cursor-not-allowed opacity-60"
                    : confirmado
                      ? "cursor-default"
                      : "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(46,31,77,0.55)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
                    ativo ? "border-roxo bg-roxo text-branco" : "border-roxo-200 text-transparent",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>

                <span className="font-display block pr-8 text-lg font-semibold leading-tight text-roxo-900">{w.titulo}</span>
                <span className="mt-1 block text-sm font-semibold text-roxo">{w.palestrante}</span>
                <span className="mt-2 block text-sm text-tinta/80">{w.descricao}</span>

                <span className="mt-auto block pt-5">
                  <span className="trilho block h-2 w-full overflow-hidden rounded-full">
                    <span
                      className={`block h-full rounded-full transition-[width] duration-500 ${lotado ? "bg-esgotado" : "bg-roxo"}`}
                      style={{ width: `${preenchido}%` }}
                    />
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-3 text-xs">
                    <span className={lotado ? "font-semibold text-tinta/70" : ultimas ? "font-semibold text-roxo" : "text-tinta/70"}>
                      {!vaga
                        ? "Carregando vagas…"
                        : lotado
                          ? "Esgotado"
                          : `${vaga.restantes} de ${vaga.limite} ${vaga.restantes === 1 ? "vaga restante" : "vagas restantes"}`}
                    </span>
                    {w.sala && <span className="text-tinta/50">{w.sala}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {confirmado ? (
        <div
          role="status"
          className="sobe mt-10 rounded-3xl border border-roxo bg-roxo-900 p-6 text-branco shadow-[0_18px_50px_-30px_rgba(46,31,77,0.6)] sm:p-8"
        >
          <p className="eyebrow text-roxo-300">Inscrição confirmada</p>
          <h3 className="font-display mt-1 text-2xl font-semibold">Tudo certo, {envio.nome}!</h3>
          <p className="mt-3 max-w-2xl text-branco/80">
            Seu lugar está garantido no workshop{" "}
            <strong className="text-branco">{workshops.find((w) => w.id === envio.workshopId)?.titulo}</strong>. Nos vemos
            em 07 de novembro, no Auditório do CEJAS.
          </p>
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={enviar}
          className="mt-10 scroll-mt-6 rounded-3xl border border-roxo-200 bg-branco p-6 shadow-[0_18px_50px_-30px_rgba(46,31,77,0.6)] sm:p-8"
        >
          <p className="eyebrow text-roxo">Passo 2 — Seus dados</p>
          <h3 className="font-display mt-1 text-xl font-semibold text-roxo-900">
            {escolhido ? `Workshop escolhido: ${escolhido.titulo}` : "Selecione um workshop acima para continuar"}
          </h3>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Nome completo</span>
              <input
                type="text"
                name="nome"
                required
                minLength={3}
                maxLength={120}
                placeholder="Seu nome"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-roxo-200 bg-papel px-4 py-3 text-tinta outline-none transition focus:border-roxo focus:ring-2 focus:ring-roxo/25"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">E-mail (o mesmo da inscrição no Sympla)</span>
              <input
                type="email"
                name="email"
                required
                maxLength={254}
                placeholder="voce@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-roxo-200 bg-papel px-4 py-3 text-tinta outline-none transition focus:border-roxo focus:ring-2 focus:ring-roxo/25"
              />
            </label>
          </div>

          {escolhidoLotado && (
            <p role="alert" className="mt-4 text-sm font-semibold text-roxo-700">
              As vagas deste workshop acabaram enquanto você preenchia. Escolha outro acima.
            </p>
          )}
          {envio.estado === "erro" && (
            <p role="alert" className="mt-4 rounded-xl bg-lilas px-4 py-3 text-sm font-semibold text-roxo-900">
              {envio.mensagem}
            </p>
          )}

          <button
            type="submit"
            disabled={!selecionado || escolhidoLotado || enviando}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-roxo px-6 py-3.5 text-base font-semibold text-branco transition hover:bg-roxo-700 disabled:cursor-not-allowed disabled:bg-esgotado sm:w-auto"
          >
            {enviando ? "Confirmando…" : "Confirmar inscrição"}
          </button>
        </form>
      )}
    </section>
  );
}
