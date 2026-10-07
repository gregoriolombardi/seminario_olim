export type Vaga = {
  id: string;
  limite: number;
  inscritos: number;
  restantes: number;
  lotado: boolean;
};

export type InscricaoExistente = { workshopId: string };

export type CodigoErro =
  | "REQUISICAO_INVALIDA"
  | "NAO_AUTORIZADO"
  | "NOME_INVALIDO"
  | "EMAIL_INVALIDO"
  | "OCUPADO"
  | "WORKSHOP_INEXISTENTE"
  | "FORA_DO_SYMPLA"
  | "JA_INSCRITO"
  | "LOTADO"
  | "INDISPONIVEL";

export type RespostaInscricao =
  | { ok: true; vagas: Vaga[] }
  | { ok: false; codigo: CodigoErro; mensagem: string; vagas?: Vaga[] };
