import { fazerCheckin } from "@/lib/apps-script";
import type { RespostaCheckin } from "@/lib/tipos";

const STATUS: Record<string, number> = {
  REQUISICAO_INVALIDA: 400,
  CODIGO_OK_INVALIDO: 403,
  FORA_DA_LISTA: 404,
  INGRESSO_PENDENTE: 403,
  JA_FEZ_CHECKIN: 409,
  SEM_WORKSHOP: 409,
  OCUPADO: 503,
};

function falha(resposta: Extract<RespostaCheckin, { ok: false }>, status = STATUS[resposta.codigo] ?? 502) {
  return Response.json(resposta, { status });
}

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return falha({ ok: false, codigo: "REQUISICAO_INVALIDA", mensagem: "Requisição inválida." });
  }

  const { codigo, codigoOk } = (corpo ?? {}) as Record<string, unknown>;
  const ingresso = String(codigo ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(ingresso)) {
    return falha({ ok: false, codigo: "FORA_DA_LISTA", mensagem: "Código de ingresso inválido." });
  }

  // O código de OK é conferido pelo Apps Script (aba Config), não aqui.
  try {
    const resposta = await fazerCheckin(ingresso, String(codigoOk ?? "").trim().slice(0, 40));
    if (!resposta.ok) {
      if (resposta.codigo === "NAO_AUTORIZADO") {
        console.error("Apps Script recusou o token. Confira APPS_SCRIPT_TOKEN.");
        return falha({ ok: false, codigo: "INDISPONIVEL", mensagem: "Check-in indisponível no momento." }, 502);
      }
      return falha(resposta);
    }
    return Response.json(resposta);
  } catch (err) {
    console.error("Falha no check-in:", err);
    return falha({ ok: false, codigo: "INDISPONIVEL", mensagem: "Não foi possível registrar agora. Tente novamente." }, 502);
  }
}
