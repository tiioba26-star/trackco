// Tipos do motor de cálculo do Trackco.
// Tudo aqui é serializável em JSON: definições de métricas e planos ficam em colunas jsonb no Supabase.

export type Unidade = "un" | "%" | "R$" | "pts";
export type FonteId = "klingo_agendamentos" | "lancamentos";

export type OperadorFiltro =
  | "igual"
  | "diferente"
  | "em"
  | "nao_em"
  | "contem"
  | "verdadeiro"
  | "falso"
  | "preenchido"
  | "vazio";

export interface Filtro {
  campo: string;
  op: OperadorFiltro;
  valor?: string | string[];
}

/** Até quando a competência corrente é contada: hoje (inclui o dia) ou ontem (dia fechado). */
export type Corte = "hoje" | "ontem";

/** Uma contagem/soma sobre uma fonte de dados, num campo de data. */
export interface Contagem {
  fonte: FonteId;
  agregacao: "contar" | "somar";
  campo_data: string;
  campo_valor?: string;
  filtros: Filtro[];
}

export type DefinicaoMetrica = (
  | ({ tipo_calculo: "simples"; corte?: Corte } & Contagem)
  | {
      tipo_calculo: "taxa";
      corte?: Corte;
      numerador: Contagem;
      denominador: Contagem;
    }
) & {
  /** Só para análise/visualização (ex.: SUS): nunca entra em metas, nota, prêmios, comissão ou pontos. */
  somente_analise?: boolean;
};

export interface Metrica {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  tipo: "quantitativa" | "qualitativa";
  unidade: Unidade;
  definicao: DefinicaoMetrica;
  ativo?: boolean;
}

/** Linha de uma fonte já atribuída a um colaborador (ou null se ninguém do Trackco). */
export interface Linha {
  chave: string;
  colaborador_id: string | null;
  [campo: string]: unknown;
}

// ---------------- Planos (regras) ----------------

export type TipoRecompensa =
  | "reconhecimento"
  | "premio"
  | "valor_fixo"
  | "percentual"
  | "pontos";

export interface Recompensa {
  tipo: TipoRecompensa;
  valor?: number;
  premio_id?: string;
  descricao?: string;
}

export interface Faixa {
  id: string;
  /** Limite inferior em % de atingimento (inclusivo). */
  de_pct: number;
  /** Limite superior em % (exclusivo). null = sem limite. */
  ate_pct: number | null;
  nivel: string;
  cor?: string;
  recompensa?: Recompensa | null;
}

export type Escopo = "individual" | "equipe";
export type AplicaA = "membros" | "lider" | "todos";

export interface Indicador {
  id: string;
  metrica_id: string;
  nome?: string;
  /** individual = produção da própria pessoa; equipe = agregado dos membros da equipe. */
  escopo: Escopo;
  aplica_a: AplicaA;
  peso: number;
  /** Teto de atingimento considerado na nota (ex.: 150). */
  teto_pct: number;
  /** Meta proporcional aos dias trabalhados (ausências, entrada no meio do mês). */
  meta_proporcional: boolean;
  /** No escopo equipe: incluir a produção do líder no agregado. */
  incluir_lider?: boolean;
  /** Faixas próprias do indicador (opcional; ex.: R$ por faixa no futuro). */
  faixas?: Faixa[];
}

export type OperadorCondicao = ">=" | ">" | "<=" | "<";

export interface Condicao {
  id: string;
  descricao: string;
  indicador_id: string;
  base: "realizado" | "atingimento";
  operador: OperadorCondicao;
  valor: number;
  /** O que acontece se a condição NÃO for atendida. */
  efeito: "bloquear_recompensa" | "limitar_nivel";
  /** Para limitar_nivel: id da faixa máxima permitida. */
  faixa_maxima_id?: string;
}

export interface DefinicaoPlano {
  indicadores: Indicador[];
  faixas: Faixa[];
  condicoes: Condicao[];
}

// ---------------- Entrada / saída da apuração ----------------

export interface MembroEquipe {
  colaborador_id: string;
  nome: string;
  funcao: "lider" | "membro";
  inicio: string; // YYYY-MM-DD
  fim: string | null;
}

export interface MetaRegistro {
  metrica_id: string;
  colaborador_id?: string | null;
  equipe_id?: string | null;
  valor: number;
}

export interface Ausencia {
  colaborador_id: string;
  inicio: string;
  fim: string;
  tipo?: string;
}

export interface Ajuste {
  id: string;
  colaborador_id: string;
  metrica_id: string;
  delta: number;
  justificativa: string;
}

export interface EntradaApuracao {
  competencia: string; // YYYY-MM
  hoje: string; // YYYY-MM-DD (fuso America/Bahia)
  equipe: { id: string; nome: string; dias_trabalho: number[] };
  membros: MembroEquipe[];
  plano: { versao_id: string | null; definicao: DefinicaoPlano };
  metricas: Record<string, Metrica>;
  metas: MetaRegistro[];
  ausencias: Ausencia[];
  feriados: string[];
  ajustes: Ajuste[];
  linhas: Partial<Record<FonteId, Linha[]>>;
}

export interface ItemMemorial {
  metrica_id: string;
  chave: string;
  papel: "realizado" | "numerador" | "denominador";
  colaborador_id: string | null;
}

export interface ResultadoIndicador {
  indicador_id: string;
  metrica_id: string;
  nome: string;
  unidade: Unidade;
  escopo: Escopo;
  peso: number;
  realizado: number;
  numerador?: number;
  denominador?: number;
  ajuste_total: number;
  meta: number | null;
  meta_ajustada: number | null;
  atingimento_pct: number | null;
  atingimento_considerado_pct: number | null;
  projecao: number | null;
  ritmo_necessario_dia: number | null;
  faixa: { id: string; nivel: string; cor?: string } | null;
  recompensa: Recompensa | null;
  sem_meta: boolean;
}

export interface ResultadoCondicao {
  id: string;
  descricao: string;
  ok: boolean;
  efeito: Condicao["efeito"];
}

export interface DiasCompetencia {
  uteis_total: number;
  uteis_decorridos: number;
  uteis_restantes: number;
  disponiveis_total: number;
  ausentes: number;
  fator_proporcional: number;
}

export interface ResultadoApuracao {
  competencia: string;
  colaborador_id: string;
  nome: string;
  equipe_id: string;
  funcao: "lider" | "membro";
  plano_versao_id: string | null;
  indicadores: ResultadoIndicador[];
  nota_pct: number | null;
  faixa: { id: string; nivel: string; cor?: string } | null;
  recompensa: Recompensa | null;
  condicoes: ResultadoCondicao[];
  dias: DiasCompetencia;
  memorial: string[];
  itens: ItemMemorial[];
}
