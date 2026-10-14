export type Vaga = {
  id: string;
  limite: number;
  inscritos: number;
  restantes: number;
  lotado: boolean;
};

// Participante aprovado da "Lista de participantes". workshopId é null se ainda não
// escolheu, ou "?" se WORKSHOP_1 tem um valor que não bate com nenhum workshop.
// checkin é a data/hora ISO da entrada no dia, ou null.
export type Participante = {
  codigo: string;
  nome: string;
  email: string;
  workshopId: string | null;
  checkin: string | null;
};

// Check-ins feitos (feitos) entre os ingressos de um grupo (total).
export type Presenca = { total: number; feitos: number };

export type CodigoErro =
  | "REQUISICAO_INVALIDA"
  | "NAO_AUTORIZADO"
  | "NOME_INVALIDO"
  | "EMAIL_INVALIDO"
  | "OCUPADO"
  | "WORKSHOP_INEXISTENTE"
  | "FORA_DA_LISTA"
  | "EMAIL_COMPARTILHADO"
  | "INGRESSO_PENDENTE"
  | "JA_INSCRITO"
  | "LOTADO"
  | "INDISPONIVEL"
  | "CODIGO_OK_INVALIDO"
  | "JA_FEZ_CHECKIN"
  | "SEM_WORKSHOP";

export type RespostaInscricao =
  | { ok: true; vagas: Vaga[] }
  | { ok: false; codigo: CodigoErro; mensagem: string; vagas?: Vaga[] };

export type RespostaCheckin =
  | { ok: true; checkin: string }
  | { ok: false; codigo: CodigoErro; mensagem: string; checkin?: string };
