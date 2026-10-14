import { inscrever } from "@/lib/apps-script";
import type { RespostaInscricao } from "@/lib/tipos";
import { workshops } from "@/lib/workshops";

const STATUS: Record<string, number> = {
  REQUISICAO_INVALIDA: 400,
  NOME_INVALIDO: 400,
  EMAIL_INVALIDO: 400,
  WORKSHOP_INEXISTENTE: 400,
  FORA_DA_LISTA: 403,
  INGRESSO_PENDENTE: 403,
  EMAIL_COMPARTILHADO: 409,
  JA_INSCRITO: 409,
  LOTADO: 409,
  OCUPADO: 503,
};

function falha(resposta: Extract<RespostaInscricao, { ok: false }>, status = STATUS[resposta.codigo] ?? 502) {
  return Response.json(resposta, { status });
}

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return falha({ ok: false, codigo: "REQUISICAO_INVALIDA", mensagem: "Requisição inválida." });
  }

  const { workshopId, codigo, nome, email } = (corpo ?? {}) as Record<string, unknown>;
  const entrada = {
    workshopId: String(workshopId ?? "").trim(),
    codigo: String(codigo ?? "").trim().toUpperCase() || undefined,
    nome: String(nome ?? "").trim().replace(/\s+/g, " "),
    email: String(email ?? "").trim().toLowerCase(),
  };

  if (!workshops.some((w) => w.id === entrada.workshopId)) {
    return falha({ ok: false, codigo: "WORKSHOP_INEXISTENTE", mensagem: "Workshop não encontrado." });
  }
  if (entrada.codigo) {
    // Com código do ingresso, nome e e-mail vêm da planilha; os do formulário são ignorados.
    if (!/^[A-Z0-9-]{4,40}$/.test(entrada.codigo)) {
      return falha({ ok: false, codigo: "FORA_DA_LISTA", mensagem: "Link de convite inválido. Confira o link recebido." });
    }
  } else {
    if (entrada.nome.length < 3 || entrada.nome.length > 120) {
      return falha({ ok: false, codigo: "NOME_INVALIDO", mensagem: "Informe seu nome completo." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entrada.email) || entrada.email.length > 254) {
      return falha({ ok: false, codigo: "EMAIL_INVALIDO", mensagem: "Informe um e-mail válido." });
    }
  }

  try {
    const resposta = await inscrever(entrada);
    if (!resposta.ok) {
      // Erro de configuração (token) não é culpa do visitante — não expõe o detalhe.
      if (resposta.codigo === "NAO_AUTORIZADO") {
        console.error("Apps Script recusou o token. Confira APPS_SCRIPT_TOKEN.");
        return falha({ ok: false, codigo: "INDISPONIVEL", mensagem: "Inscrições indisponíveis no momento. Tente novamente em instantes." }, 502);
      }
      return falha(resposta);
    }
    return Response.json(resposta);
  } catch (err) {
    console.error("Falha ao inscrever:", err);
    return falha({ ok: false, codigo: "INDISPONIVEL", mensagem: "Não foi possível concluir agora. Tente novamente em instantes." }, 502);
  }
}
