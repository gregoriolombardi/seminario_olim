import "server-only";

import { after } from "next/server";

import type { Participante, Presenca, RespostaCheckin, RespostaInscricao, Vaga } from "./tipos";
import { workshops } from "./workshops";

const URL_SCRIPT = process.env.APPS_SCRIPT_URL;
const TOKEN = process.env.APPS_SCRIPT_TOKEN;
const SIMULAR = !URL_SCRIPT && process.env.NODE_ENV !== "production";

function urlScript(): string {
  if (!URL_SCRIPT) throw new Error("APPS_SCRIPT_URL não definida.");
  return URL_SCRIPT;
}

// checkinExigeCodigo: liga/desliga da aba Config — só decide se a página mostra o campo;
// quem confere o código de OK é o Apps Script.
type Estado = { vagas: Vaga[]; participantes: Participante[]; checkinExigeCodigo: boolean };

// O Apps Script leva 1–4s por chamada (às vezes 10s+). Para a página nunca esperar por
// ele, o estado fica em memória e é servido na hora: o servidor renova a cada RENOVAR_MS
// mesmo sem visitas, e passado FRESCO_MS a próxima leitura dispara uma atualização em
// segundo plano. Só espera o Apps Script se ainda não houver nada em memória ou se um
// código de convite não estiver nela. Vagas um pouco atrasadas não furam o limite: a
// inscrição sempre confere na planilha, sob lock.
const FRESCO_MS = 5_000;
const RENOVAR_MS = 30_000;

// Em globalThis porque a página e as rotas de API rodam em bundles separados — assim uma
// inscrição feita pela API já aparece para a página.
type Cache = { estado: Estado | null; em: number; pendente: Promise<Estado> | null };
const g = globalThis as { __estadoOlim?: Cache };
const cache = (g.__estadoOlim ??= { estado: null, em: 0, pendente: null });

async function carregarEstado(): Promise<Estado> {
  if (SIMULAR) return simulacao.estado();

  const url = new URL(urlScript());
  url.searchParams.set("token", TOKEN ?? "");
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Apps Script respondeu ${res.status}`);
  const dados = (await res.json()) as { ok: boolean; codigo?: string } & Partial<Estado>;
  if (!dados.ok) throw new Error(`Apps Script recusou a consulta: ${dados.codigo}`);
  if (!dados.vagas || !dados.participantes) {
    throw new Error("Apps Script respondeu sem participantes — a implantação está desatualizada (npm run gas:deploy).");
  }
  return {
    vagas: dados.vagas,
    participantes: dados.participantes,
    checkinExigeCodigo: dados.checkinExigeCodigo !== false,
  };
}

function atualizar(): Promise<Estado> {
  cache.pendente ??= carregarEstado()
    .then((estado) => {
      cache.estado = estado;
      cache.em = Date.now();
      return estado;
    })
    .finally(() => {
      cache.pendente = null;
    });
  return cache.pendente;
}

function atualizarAoFundo() {
  const pendente = atualizar().catch((err) => {
    // Timeout é comum logo após uma implantação nova (partida a frio do Apps Script); com estado
    // em memória, só segue com o anterior até a próxima rodada. Sem despejar o DOMException inteiro.
    const tempo = err instanceof Error && err.name === "TimeoutError";
    console.error("Falha ao atualizar estado:", tempo ? "Apps Script não respondeu em 20s" : err);
  });
  // Em serverless (Vercel) a função congela quando a resposta termina; after() a mantém viva até
  // a atualização chegar. Fora de uma requisição (o setInterval do servidor próprio) after() lança
  // e não faz falta: o processo continua de pé.
  try {
    after(() => pendente);
  } catch {}
}

async function obterEstado(): Promise<Estado> {
  if (!cache.estado) return atualizar();
  if (Date.now() - cache.em >= FRESCO_MS) atualizarAoFundo();
  return cache.estado;
}

/** Aquece o cache ao subir o servidor e o mantém renovado, para nenhum visitante esperar. */
export function aquecer() {
  atualizarAoFundo();
  setInterval(atualizarAoFundo, RENOVAR_MS).unref();
}

export async function buscarVagas(): Promise<Vaga[]> {
  return (await obterEstado()).vagas;
}

/** Participante aprovado pelo código do ingresso (link de convite). */
export async function buscarParticipante(codigo: string): Promise<Participante | null> {
  const alvo = codigo.trim().toUpperCase();
  const achar = (estado: Estado) => estado.participantes.find((p) => p.codigo === alvo) ?? null;
  // Fora da memória: pode ter sido aprovado no Sympla depois da última leitura.
  return achar(await obterEstado()) ?? achar(await atualizar());
}

/** Para a página de check-in: o participante, se o código de OK está ligado, as vagas (para
 *  escolher workshop na hora, se ainda não escolheu) e a presença (check-ins feitos) por
 *  workshop e no seminário todo. */
export async function buscarCheckin(codigo: string) {
  const participante = await buscarParticipante(codigo);
  const { participantes, vagas, checkinExigeCodigo } = await obterEstado();

  const contar = (lista: Participante[]): Presenca => ({
    total: lista.length,
    feitos: lista.filter((p) => p.checkin).length,
  });
  const porWorkshop = Object.fromEntries(
    workshops.map((w) => [w.id, contar(participantes.filter((p) => p.workshopId === w.id))]),
  );

  return {
    participante,
    exigeCodigo: checkinExigeCodigo,
    vagas,
    presenca: { porWorkshop, geral: contar(participantes) },
  };
}

export async function fazerCheckin(codigo: string, codigoOk: string): Promise<RespostaCheckin> {
  let resposta: RespostaCheckin;

  if (SIMULAR) {
    resposta = simulacao.fazerCheckin(codigo, codigoOk);
  } else {
    const res = await fetch(urlScript(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: TOKEN, acao: "checkin", codigo, codigoOk }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Apps Script respondeu ${res.status}`);
    resposta = (await res.json()) as RespostaCheckin;
  }

  // OK ou JA_FEZ_CHECKIN: a página já mostra a entrada sem esperar a próxima leitura.
  const checkin = resposta.checkin;
  if (checkin && cache.estado) {
    cache.estado = {
      ...cache.estado,
      participantes: cache.estado.participantes.map((p) => (p.codigo === codigo ? { ...p, checkin } : p)),
    };
  }
  return resposta;
}

export async function inscrever(entrada: {
  workshopId: string;
  codigo?: string;
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

  const participante = entrada.codigo && cache.estado?.participantes.find((p) => p.codigo === entrada.codigo);
  if (resposta.ok && cache.estado && participante) {
    cache.estado = {
      ...cache.estado,
      vagas: resposta.vagas,
      participantes: cache.estado.participantes.map((p) =>
        p === participante ? { ...p, workshopId: entrada.workshopId } : p,
      ),
    };
    cache.em = Date.now();
  } else if (resposta.ok || resposta.vagas) {
    // Inscrição sem código (não sabemos qual linha foi) ou JA_INSCRITO/LOTADO (cache
    // atrasado): a próxima leitura busca de novo.
    cache.em = 0;
  }
  return resposta;
}

// Sem APPS_SCRIPT_URL em desenvolvimento, roda com uma lista em memória.
// Códigos de teste: ANA123 · BRUNO1 e CARLA1 (e-mail compartilhado) · DIEGO1 (não pago).
// Código de OK do check-in: 1234.
const simulacao = (() => {
  const limites: Record<string, number> = {
    "eca-digital": 130,
    "projetos-educacao-infantil": 80,
    "quando-o-corpo-aprende": 80,
    "quintalizar-os-espacos": 80,
    "linguagem-da-comida": 40,
  };
  type Linha = Participante & { aprovado: boolean };
  // Em globalThis porque a página e as rotas de API rodam em bundles separados.
  const g = globalThis as { __listaSimulada?: Linha[] };
  const lista = (g.__listaSimulada ??= [
    { codigo: "ANA123", nome: "Ana Júlia Conceição", email: "ana@escola.com", workshopId: null, checkin: null, aprovado: true },
    { codigo: "BRUNO1", nome: "Bruno Lima", email: "secretaria@escola.com", workshopId: null, checkin: null, aprovado: true },
    { codigo: "CARLA1", nome: "Carla Souza", email: "secretaria@escola.com", workshopId: null, checkin: null, aprovado: true },
    { codigo: "DIEGO1", nome: "Diego Alves", email: "diego@escola.com", workshopId: null, checkin: null, aprovado: false },
  ]);

  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

  function vagas(): Vaga[] {
    return workshops.map(({ id }) => {
      const limite = limites[id] ?? 0;
      const inscritos = lista.filter((p) => p.workshopId === id).length;
      const restantes = Math.max(0, limite - inscritos);
      return { id, limite, inscritos, restantes, lotado: restantes === 0 };
    });
  }

  function estado(): Estado {
    return {
      vagas: vagas(),
      participantes: lista
        .filter((p) => p.aprovado)
        .map(({ codigo, nome, email, workshopId, checkin }) => ({ codigo, nome, email, workshopId, checkin })),
      checkinExigeCodigo: true,
    };
  }

  function inscrever(entrada: { workshopId: string; codigo?: string; nome: string; email: string }): RespostaInscricao {
    let candidatos = entrada.codigo
      ? lista.filter((p) => p.codigo === entrada.codigo)
      : lista.filter((p) => p.email === entrada.email);
    if (candidatos.length === 0) {
      return { ok: false, codigo: "FORA_DA_LISTA", mensagem: "Não encontramos este e-mail entre os inscritos do seminário." };
    }
    if (candidatos.length > 1) {
      candidatos = candidatos.filter((p) => normalizar(p.nome) === normalizar(entrada.nome));
      if (candidatos.length !== 1) {
        return { ok: false, codigo: "EMAIL_COMPARTILHADO", mensagem: "Este e-mail está ligado a mais de um ingresso. Use o link individual que você recebeu ou digite seu nome exatamente como no ingresso." };
      }
    }
    const p = candidatos[0];
    if (!p.aprovado) {
      return { ok: false, codigo: "INGRESSO_PENDENTE", mensagem: "Seu ingresso ainda não está aprovado no Sympla. Fale com a organização." };
    }
    if (p.workshopId) {
      const titulo = workshops.find((w) => w.id === p.workshopId)?.titulo;
      return { ok: false, codigo: "JA_INSCRITO", mensagem: `Você já está inscrito no workshop "${titulo}".`, vagas: vagas() };
    }
    if (vagas().find((v) => v.id === entrada.workshopId)?.lotado) {
      return { ok: false, codigo: "LOTADO", mensagem: "As vagas deste workshop acabaram. Escolha outro.", vagas: vagas() };
    }
    p.workshopId = entrada.workshopId;
    return { ok: true, vagas: vagas() };
  }

  function fazerCheckin(codigo: string, codigoOk: string): RespostaCheckin {
    if (codigoOk !== "1234") return { ok: false, codigo: "CODIGO_OK_INVALIDO", mensagem: "Código de OK incorreto." };
    const p = lista.find((x) => x.codigo === codigo);
    if (!p) return { ok: false, codigo: "FORA_DA_LISTA", mensagem: `Ingresso ${codigo} não está na lista de participantes.` };
    if (!p.aprovado) return { ok: false, codigo: "INGRESSO_PENDENTE", mensagem: `Ingresso ${codigo} não está aprovado no Sympla.` };
    if (p.checkin) return { ok: false, codigo: "JA_FEZ_CHECKIN", mensagem: "Este ingresso já fez check-in.", checkin: p.checkin };
    if (!p.workshopId) return { ok: false, codigo: "SEM_WORKSHOP", mensagem: "Escolha um workshop antes de fazer o check-in." };
    p.checkin = new Date().toISOString();
    return { ok: true, checkin: p.checkin };
  }

  return { inscrever, estado, fazerCheckin };
})();
