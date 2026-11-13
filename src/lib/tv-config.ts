// Configuração dos painéis de TV (usada no servidor e no editor da tela Painéis de TV).
import { PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";

/** Blocos de telas. Cada bloco vira uma tela por período escolhido (ou uma por pessoa). */
export type BlocoTv =
  | "ranking_particular"
  | "ranking_sus"
  | "melhorou"
  | "comparecimento"
  | "pessoas"
  | "equipe"
  | "participacao"
  | "mes_dia_a_dia"
  | "semanas"
  | "comparecimento_semanas"
  | "dia_semana"
  | "consultas_dia_a_dia"
  | "doze_meses"
  | "destaques_mes";

/** padrao = já vem ligado em painel novo (os outros ficam disponíveis para ligar no editar). */
export const BLOCOS_TV: { bloco: BlocoTv; rotulo: string; descricao: string; segundos: number; padrao: boolean }[] = [
  {
    bloco: "ranking_particular",
    rotulo: "Ranking · Agendamentos Particular",
    descricao: "Quem mais marcou pacientes válidos (sem remarcações), pessoa por pessoa, com o total ao lado. Uma tela por período.",
    segundos: 30,
    padrao: true,
  },
  { bloco: "ranking_sus", rotulo: "Ranking · Agendamentos SUS", descricao: "Uma tela só, com todos os períodos lado a lado (só acompanhamento).", segundos: 25, padrao: true },
  {
    bloco: "melhorou",
    rotulo: "Quem mais melhorou",
    descricao: "Crescimento de agendamentos válidos contra o mesmo ponto do período anterior. Uma tela só, com os períodos lado a lado; só aparece quem cresceu.",
    segundos: 20,
    padrao: true,
  },
  {
    bloco: "comparecimento",
    rotulo: "Melhor comparecimento",
    descricao: "De cada 100 consultas marcadas, quantas aconteceram (mínimo de 10). Uma tela só, com os períodos lado a lado.",
    segundos: 20,
    padrao: true,
  },
  { bloco: "pessoas", rotulo: "Marcadas × realizadas por pessoa", descricao: "Uma tela por pessoa, do 1º ao último do ranking do mês.", segundos: 12, padrao: true },
  {
    bloco: "equipe",
    rotulo: "Equipe por período",
    descricao: "Particular e SUS lado a lado: agendamentos, consultas realizadas × total da clínica e a linha dos últimos 14 dias.",
    segundos: 25,
    padrao: true,
  },
  {
    bloco: "participacao",
    rotulo: "Comercial × outras equipes (pizza)",
    descricao: "Que fatia de todas as marcações da clínica cada equipe fez: hoje, 7 dias, mês e mês passado.",
    segundos: 25,
    padrao: true,
  },
  {
    bloco: "mes_dia_a_dia",
    rotulo: "Gráfico · mês dia a dia",
    descricao: "Agendamentos válidos por dia: este mês × mês passado, e o calendário por semana (que dia da semana rende mais).",
    segundos: 25,
    padrao: true,
  },
  { bloco: "semanas", rotulo: "Gráfico · últimas 26 semanas", descricao: "Agendamentos válidos Particular e SUS, semana a semana (cerca de 6 meses).", segundos: 20, padrao: true },
  {
    bloco: "comparecimento_semanas",
    rotulo: "Gráfico · comparecimento por semana",
    descricao: "Taxa de comparecimento Particular nas últimas 26 semanas, com a média como referência.",
    segundos: 20,
    padrao: true,
  },
  { bloco: "dia_semana", rotulo: "Gráfico · melhor dia da semana", descricao: "Média de agendamentos válidos por dia da semana nos últimos 3 meses.", segundos: 20, padrao: true },
  {
    bloco: "consultas_dia_a_dia",
    rotulo: "Gráfico · consultas do mês dia a dia",
    descricao: "Pela data da consulta: marcadas × compareceram, com os dias que ainda vão chegar.",
    segundos: 20,
    padrao: false,
  },
  { bloco: "doze_meses", rotulo: "Gráfico · 12 meses × meta", descricao: "Agendamentos válidos da equipe mês a mês, com a linha da meta.", segundos: 20, padrao: false },
  { bloco: "destaques_mes", rotulo: "Destaques do mês passado", descricao: "Fechamento do mês anterior com os destaques de cada categoria. Fica o mês inteiro.", segundos: 30, padrao: true },
];

/** Blocos que entraram depois: painéis antigos ganham estes automaticamente (podem desmarcar). */
const BLOCOS_NOVOS: Record<3 | 4, BlocoTv[]> = {
  3: ["melhorou", "comparecimento", "participacao", "destaques_mes"],
  4: ["mes_dia_a_dia", "semanas", "comparecimento_semanas", "dia_semana"],
};

export type ModoTv = { tipo: "bloco"; bloco: BlocoTv };

export interface ConfigTv {
  versao?: 2 | 3 | 4;
  /** tempo padrão de cada tela (s), para blocos sem tempo próprio */
  intervalo: number;
  /** tempo de cada tipo de tela (s) */
  tempos?: Partial<Record<BlocoTv, number>>;
  modos: ModoTv[];
  periodos?: PeriodoRapido[];
  limites: { feliz: number; mega_feliz: number };
  frases_rodape?: string[];
  subtitulos?: string[];
  mensagens_barra?: {
    meta_batida?: string[];
    quase_la?: string[];
    evoluindo?: string[];
  };
}

export const CONFIG_TV_PADRAO: ConfigTv = {
  versao: 4,
  intervalo: 30,
  tempos: Object.fromEntries(BLOCOS_TV.map((b) => [b.bloco, b.segundos])),
  modos: BLOCOS_TV.filter((b) => b.padrao).map((b) => ({ tipo: "bloco", bloco: b.bloco })),
  periodos: [...PERIODOS_RAPIDOS],
  limites: { feliz: 80, mega_feliz: 100 },
  frases_rodape: [
    "Grandes conquistas começam com uma equipe unida.",
    "Cada agendamento aproxima a nossa equipe da superação.",
    "Consistência e dedicação transformam metas em grandes conquistas.",
    "Estamos evoluindo juntos, com foco e alta performance.",
    "Cada conquista importa para o sucesso de todos nós.",
    "Seguimos crescendo e construindo o nosso melhor resultado.",
  ],
  subtitulos: [
    "Ritmo contínuo, consistência e excelência em cada atendimento",
    "Evolução diária da equipe rumo à superação de metas",
    "Foco no paciente, agilidade e resultados de alto impacto",
    "Dedicação diária construindo grandes realizações",
  ],
};

/** Painéis criados antes dos blocos (versão 1) passam a usar os blocos novos, mantendo textos e limites. */
export function normalizarConfig(bruta: Partial<ConfigTv> | null | undefined): ConfigTv {
  const cfg = { ...CONFIG_TV_PADRAO, ...(bruta ?? {}) } as ConfigTv;
  const v = bruta?.versao;
  if (v !== 2 && v !== 3 && v !== 4) {
    cfg.modos = CONFIG_TV_PADRAO.modos;
    cfg.periodos = CONFIG_TV_PADRAO.periodos;
  } else {
    const novos = [...(v < 3 ? BLOCOS_NOVOS[3] : []), ...(v < 4 ? BLOCOS_NOVOS[4] : [])];
    const tem = new Set((cfg.modos ?? []).map((m) => m.bloco));
    cfg.modos = [...(cfg.modos ?? []), ...novos.filter((b) => !tem.has(b)).map((bloco) => ({ tipo: "bloco" as const, bloco }))];
  }
  cfg.versao = 4;
  cfg.tempos = { ...CONFIG_TV_PADRAO.tempos, ...(v === 3 || v === 4 ? (bruta?.tempos ?? {}) : {}) };
  cfg.modos = (cfg.modos ?? []).filter((m) => m.tipo === "bloco" && BLOCOS_TV.some((b) => b.bloco === m.bloco));
  cfg.periodos = (cfg.periodos ?? PERIODOS_RAPIDOS).filter((p) => PERIODOS_RAPIDOS.includes(p));
  if (!cfg.periodos.length) cfg.periodos = [...PERIODOS_RAPIDOS];
  return cfg;
}

/** Quantos segundos uma tela deste bloco fica na TV. */
export function segundosDoBloco(cfg: ConfigTv, bloco: BlocoTv): number {
  const s = cfg.tempos?.[bloco] ?? BLOCOS_TV.find((b) => b.bloco === bloco)?.segundos ?? cfg.intervalo;
  return Math.min(300, Math.max(5, Math.round(s)));
}
