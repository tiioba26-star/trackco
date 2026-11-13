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
  | "destaques_mes";

export const BLOCOS_TV: { bloco: BlocoTv; rotulo: string; descricao: string; segundos: number }[] = [
  {
    bloco: "ranking_particular",
    rotulo: "Ranking · Agendamentos Particular",
    descricao: "Quem mais marcou pacientes válidos (sem remarcações), pessoa por pessoa, com o total ao lado. Uma tela por período.",
    segundos: 30,
  },
  { bloco: "ranking_sus", rotulo: "Ranking · Agendamentos SUS", descricao: "Mesma coisa para o SUS (só acompanhamento).", segundos: 25 },
  {
    bloco: "melhorou",
    rotulo: "Quem mais melhorou",
    descricao: "Crescimento de agendamentos válidos contra o mesmo ponto do período anterior. Só aparece quem cresceu.",
    segundos: 20,
  },
  {
    bloco: "comparecimento",
    rotulo: "Melhor comparecimento",
    descricao: "De cada 100 consultas marcadas, quantas aconteceram (só dias que já passaram, mínimo de 10 consultas).",
    segundos: 20,
  },
  { bloco: "pessoas", rotulo: "Marcadas × realizadas por pessoa", descricao: "Uma tela por pessoa, do 1º ao último do ranking do mês.", segundos: 12 },
  { bloco: "equipe", rotulo: "Equipe por período", descricao: "Particular e SUS lado a lado: agendamentos e consultas realizadas × total da clínica.", segundos: 25 },
  {
    bloco: "participacao",
    rotulo: "Comercial × outras equipes (pizza)",
    descricao: "Que fatia de todas as marcações da clínica cada equipe fez: hoje, 7 dias, mês e mês passado.",
    segundos: 25,
  },
  { bloco: "destaques_mes", rotulo: "Destaques do mês passado", descricao: "Fechamento do mês anterior com os destaques de cada categoria. Fica o mês inteiro.", segundos: 30 },
];

/** Blocos que entraram depois: painéis antigos ganham estes automaticamente (podem desmarcar). */
const BLOCOS_NOVOS_V3: BlocoTv[] = ["melhorou", "comparecimento", "participacao", "destaques_mes"];

export type ModoTv = { tipo: "bloco"; bloco: BlocoTv };

export interface ConfigTv {
  versao?: 2 | 3;
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
  versao: 3,
  intervalo: 30,
  tempos: Object.fromEntries(BLOCOS_TV.map((b) => [b.bloco, b.segundos])),
  modos: BLOCOS_TV.map((b) => ({ tipo: "bloco", bloco: b.bloco })),
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
  if (bruta?.versao !== 2 && bruta?.versao !== 3) {
    cfg.modos = CONFIG_TV_PADRAO.modos;
    cfg.periodos = CONFIG_TV_PADRAO.periodos;
  } else if (bruta.versao === 2) {
    const tem = new Set((cfg.modos ?? []).map((m) => m.bloco));
    cfg.modos = [...(cfg.modos ?? []), ...BLOCOS_NOVOS_V3.filter((b) => !tem.has(b)).map((bloco) => ({ tipo: "bloco" as const, bloco }))];
  }
  cfg.versao = 3;
  cfg.tempos = { ...CONFIG_TV_PADRAO.tempos, ...(bruta?.versao === 3 ? (bruta.tempos ?? {}) : {}) };
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
