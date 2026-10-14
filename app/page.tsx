import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";

import Inscricao from "@/components/inscricao";
import { buscarParticipante, buscarVagas } from "@/lib/apps-script";

// Link de convite: /?c=CODIGO_DO_INGRESSO. Nome e e-mail vêm da planilha.
async function InscricaoComVagas({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const { c } = await searchParams;
  const codigo = typeof c === "string" ? c.trim().toUpperCase().slice(0, 40) : "";

  // Falhas aqui não derrubam a página: o cliente busca as vagas de novo sozinho, e quem já
  // escolheu ainda é barrado pelo Apps Script na hora de confirmar.
  const [vagas, participante] = await Promise.all([
    buscarVagas().catch((err) => {
      console.error("Falha ao buscar vagas:", err);
      return null;
    }),
    codigo
      ? buscarParticipante(codigo).catch((err) => {
          // undefined = não deu para consultar; null = código não existe na lista.
          console.error("Falha ao consultar participante:", err);
          return undefined;
        })
      : undefined,
  ]);

  return (
    <Inscricao
      initialVagas={vagas}
      convite={participante ?? undefined}
      conviteInvalido={participante === null}
    />
  );
}

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <div className="relative min-h-dvh">
      <div className="barra-lateral fixed inset-y-0 left-0 z-20 w-2 sm:w-3" aria-hidden="true" />

      <header className="grao relative overflow-hidden bg-roxo-900 text-branco">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-roxo/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-roxo-700/50 blur-3xl" aria-hidden="true" />

        <div className="grao-conteudo mx-auto w-full max-w-5xl px-6 pb-14 pt-8 sm:pt-10">
          <div className="sobe flex items-center gap-3">
            <Image src="/logo-olim.webp" alt="Olim" width={500} height={208} priority className="h-11 w-auto" />
            <span className="h-7 w-px bg-branco/30" />
            <span className="eyebrow text-roxo-300">II Seminário Internacional de Educação</span>
          </div>

          <h1
            className="font-display sobe mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            Escolha o workshop que vai <span className="brush text-roxo-300">marcar</span> o seu dia.
          </h1>
          <p className="sobe mt-5 max-w-xl text-lg text-branco/80" style={{ animationDelay: "140ms" }}>
            Você já garantiu sua inscrição no Sympla. Agora reserve seu lugar em um dos workshops — as vagas são
            limitadas e por ordem de chegada.
          </p>

          <dl className="sobe mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm" style={{ animationDelay: "200ms" }}>
            <div>
              <dt className="eyebrow text-roxo-300">Data</dt>
              <dd className="mt-1 font-semibold">07 de novembro</dd>
            </div>
            <div>
              <dt className="eyebrow text-roxo-300">Local</dt>
              <dd className="mt-1 font-semibold">Auditório do CEJAS</dd>
            </div>
            <div>
              <dt className="eyebrow text-roxo-300">Cidade</dt>
              <dd className="mt-1 font-semibold">Jaraguá do Sul · SC</dd>
            </div>
          </dl>

          <a
            href="#inscricao"
            className="sobe mt-10 inline-flex items-center gap-2 rounded-full bg-branco px-6 py-3 text-base font-semibold text-roxo-900 transition hover:bg-roxo-200"
            style={{ animationDelay: "260ms" }}
          >
            Escolher meu workshop
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </header>

      <main className="pt-14">
        <Suspense fallback={<Inscricao initialVagas={null} carregando />}>
          <InscricaoComVagas searchParams={searchParams} />
        </Suspense>
      </main>

      <footer className="border-t border-roxo-200 bg-lilas">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-12 sm:grid-cols-3">
          <div>
            <p className="eyebrow text-roxo">Evento</p>
            <p className="mt-2 text-sm text-tinta/80">II Seminário Internacional de Educação — Olim</p>
          </div>
          <div>
            <p className="eyebrow text-roxo">Quando &amp; Onde</p>
            <p className="mt-2 text-sm text-tinta/80">07 de novembro · Auditório do CEJAS · Jaraguá do Sul (SC)</p>
          </div>
          <div>
            <p className="eyebrow text-roxo">Dúvidas</p>
            <p className="mt-2 text-sm text-tinta/80">Fale com a organização pelos canais oficiais do evento.</p>
          </div>
        </div>
        <div className="border-t border-roxo-200/60 py-5 text-center text-xs text-tinta/60">Olim · Grupo Educacional</div>
      </footer>
    </div>
  );
}
