import { connection } from "next/server";

import { buscarVagas } from "@/lib/apps-script";

export async function GET() {
  await connection();
  try {
    const vagas = await buscarVagas();
    return Response.json({ ok: true, vagas }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Falha ao buscar vagas:", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}
