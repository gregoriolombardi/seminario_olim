import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";

import CheckIn, { OutroIngresso } from "@/components/check-in";
import { buscarCheckin } from "@/lib/apps-script";

export const metadata: Metadata = {
  title: "Check-in · II Seminário Internacional de Educação — Olim",
  robots: { index: false, follow: false },
};

// Link de check-in (organização): /check-in?c=CODIGO_DO_INGRESSO.
async function Conteudo({ searchParams }: { searchParams: PageProps<"/check-in">["searchParams"] }) {
  await connection();
  const { c } = await searchParams;
  const codigo = typeof c === "string" ? c.trim().toUpperCase().slice(0, 40) : "";
  if (!codigo) return <OutroIngresso destaque />;

  const consulta = await buscarCheckin(codigo).catch((err) => {
    console.error("Falha ao consultar check-in:", err);
    return null;
  });
  if (!consulta) {
    return (
      <p role="alert" className="rounded-2xl bg-lilas px-5 py-4 font-semibold text-roxo-900">
        Não foi possível consultar a planilha agora. Recarregue a página em instantes.
      </p>
    );
  }

  // key: ao trocar de ingresso, o estado do componente (envio, erro) recomeça.
  return <CheckIn key={codigo} codigo={codigo} {...consulta} />;
}

export default function Page({ searchParams }: PageProps<"/check-in">) {
  return (
    <div className="min-h-dvh bg-papel">
      <header className="bg-roxo-900 text-branco">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-4">
          <Image src="/logo-olim.webp" alt="Olim" width={500} height={208} priority className="h-8 w-auto" />
          <span className="h-6 w-px bg-branco/30" />
          <span className="eyebrow text-roxo-300">Check-in · Organização</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4 py-6">
        <Suspense fallback={<p className="text-tinta/60">Consultando ingresso…</p>}>
          <Conteudo searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
