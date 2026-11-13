// Configuração dos painéis de TV (usada no servidor e no editor da tela Painéis de TV).
import { PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";

/** Blocos de telas. Cada bloco vira uma tela por período escolhido (ou uma por pessoa). */
export type BlocoTv = "ranking_particular" | "ranking_sus" | "pessoas" | "equipe";

export const BLOCOS_TV: { bloco: BlocoTv; rotulo: string; descricao: string }[] = [
  { bloco: "ranking_particular", rotulo: "Ranking · Agendamentos Particular", descricao: "Quem mais marcou pacientes válidos (sem remarcações), pessoa por pessoa, com o total ao lado. Uma tela por período." },
  { bloco: "ranking_sus", rotulo: "Ranking · Agendamentos SUS", descricao: "Mesma coisa para o SUS (só acompanhamento)." },
  { bloco: "pessoas", rotulo: "Marcadas × realizadas por pessoa", descricao: "Uma tela por pessoa, do 1º ao último do ranking do mês." },
  { bloco: "equipe", rotulo: "Equipe por período", descricao: "Totais da equipe e consultas realizadas × total da clínica." },
];

export type ModoTv = { tipo: "bloco"; bloco: BlocoTv };

export interface ConfigTv {
  versao?: 2;
  intervalo: number;
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
  versao: 2,
  intervalo: 30,
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
  if (bruta?.versao !== 2) {
    cfg.versao = 2;
    cfg.modos = CONFIG_TV_PADRAO.modos;
    cfg.periodos = CONFIG_TV_PADRAO.periodos;
  }
  cfg.modos = (cfg.modos ?? []).filter((m) => m.tipo === "bloco" && BLOCOS_TV.some((b) => b.bloco === m.bloco));
  cfg.periodos = (cfg.periodos ?? PERIODOS_RAPIDOS).filter((p) => PERIODOS_RAPIDOS.includes(p));
  if (!cfg.periodos.length) cfg.periodos = [...PERIODOS_RAPIDOS];
  return cfg;
}

