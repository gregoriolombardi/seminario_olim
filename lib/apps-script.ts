import "server-only";

import type { InscricaoExistente, RespostaInscricao, Vaga } from "./tipos";
import { workshops } from "./workshops";

const URL_SCRIPT = process.env.APPS_SCRIPT_URL;
const TOKEN = process.env.APPS_SCRIPT_TOKEN;
const SIMULAR = !URL_SCRIPT && process.env.NODE_ENV !== "production";

function urlScript(): string {
  if (!URL_SCRIPT) throw new Error("APPS_SCRIPT_URL não definida.");
  return URL_SCRIPT;
}

// Cada visitante consulta as vagas a cada ~15s. Este cache segura as chamadas ao
// Apps Script (que tem cota e concorrência limitadas) em no máximo uma a cada 5s.
const TTL_MS = 5_000;
let cache: { vagas: Vaga[]; em: number } | null = null;

function guardar(vagas: Vaga[]) {
  cache = { vagas, em: Date.now() };
}

export async function buscarVagas(): Promise<Vaga[]> {
  if (cache && Date.now() - cache.em < TTL_MS) return cache.vagas;

  if (SIMULAR) {
    guardar(simulacao.vagas());
    return cache!.vagas;
  }

  const res = await fetch(urlScript(), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Apps Script respondeu ${res.status}`);
  const dados = (await res.json()) as { ok: boolean; vagas: Vaga[] };
  if (!dados.ok) throw new Error("Apps Script não retornou vagas");

  guardar(dados.vagas);
  return dados.vagas;
}

export async function buscarInscricao(email: string): Promise<InscricaoExistente | null> {
  if (SIMULAR) return simulacao.buscarInscricao(email);

  const url = new URL(urlScript());
  url.searchParams.set("email", email);
  url.searchParams.set("token", TOKEN ?? "");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Apps Script respondeu ${res.status}`);
  const dados = (await res.json()) as { ok: boolean; inscricao?: InscricaoExistente | null; codigo?: string };
  if (!dados.ok) throw new Error(`Apps Script recusou a consulta: ${dados.codigo}`);
  return dados.inscricao ?? null;
}

export async function inscrever(entrada: {
  workshopId: string;
  nome: string;
  email: string;
}): Promise<RespostaInscricao> {
  let resposta: RespostaInscricao;

  if (SIMULAR) {
    resposta = simulacao.inscrever(entrada);
  } else {
    // O Apps Script responde o POST com um 302; o fetch segue como GET e recebe o JSON.
    const res = await fetch(urlScript(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...entrada, token: TOKEN }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Apps Script respondeu ${res.status}`);
    resposta = (await res.json()) as RespostaInscricao;
  }

  if (resposta.vagas) guardar(resposta.vagas);
  return resposta;
}

// Sem APPS_SCRIPT_URL em desenvolvimento, roda com uma planilha em memória.
const simulacao = (() => {
  const limites: Record<string, number> = {
    "eca-digital": 130,
    "projetos-educacao-infantil": 80,
    "quando-o-corpo-aprende": 80,
    "quintalizar-os-espacos": 80,
    "linguagem-da-comida": 40,
  };
  // Em globalThis porque a página e as rotas de API rodam em bundles separados.
  const g = globalThis as { __inscricoesSimuladas?: { workshopId: string; email: string }[] };
  const inscricoes = (g.__inscricoesSimuladas ??= []);

  function vagas(): Vaga[] {
    return workshops.map(({ id }) => {
      const limite = limites[id] ?? 0;
      const inscritos = inscricoes.filter((i) => i.workshopId === id).length;
      const restantes = Math.max(0, limite - inscritos);
      return { id, limite, inscritos, restantes, lotado: restantes === 0 };
    });
  }

  function inscrever({ workshopId, email }: { workshopId: string; email: string }): RespostaInscricao {
    const existente = inscricoes.find((i) => i.email === email);
    if (existente) {
      const titulo = workshops.find((w) => w.id === existente.workshopId)?.titulo;
      return { ok: false, codigo: "JA_INSCRITO", mensagem: `Este e-mail já está inscrito no workshop "${titulo}".`, vagas: vagas() };
    }
    if (vagas().find((v) => v.id === workshopId)?.lotado) {
      return { ok: false, codigo: "LOTADO", mensagem: "As vagas deste workshop acabaram. Escolha outro.", vagas: vagas() };
    }
    inscricoes.push({ workshopId, email });
    return { ok: true, vagas: vagas() };
  }

  function buscarInscricao(email: string): InscricaoExistente | null {
    const existente = inscricoes.find((i) => i.email === email);
    return existente ? { workshopId: existente.workshopId } : null;
  }

  return { vagas, inscrever, buscarInscricao };
})();
