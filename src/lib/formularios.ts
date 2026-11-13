// Formulários obrigatórios (pesquisas curtas): perguntas, agenda e pontuação.
// Sem acesso a banco: usado no servidor (quem precisa responder) e nas telas.
import { z } from "zod";
import { competenciaAnterior, competenciaDe } from "@/engine/datas";

export type TipoPergunta = "escala5" | "escala10" | "texto" | "escolha";

export interface Pergunta {
  id: string;
  tipo: TipoPergunta;
  texto: string;
  obrigatoria: boolean;
  /** só para "escolha" */
  opcoes?: string[];
}

export interface Agenda {
  recorrencia: "mensal" | "unica";
  /** mensal: dia do mês em que abre (1 a 28) */
  dia_mes: number | null;
  /** mensal: 1 = todo mês, 3 = a cada 3 meses… */
  a_cada_meses: number;
  /** única: data em que abre */
  data_unica: string | null;
  /** não pede rodadas que abriram antes disso */
  inicio: string;
}

export interface Publico {
  /** vazio = todas as equipes */
  equipes: string[];
  funcoes: ("membro" | "lider")[];
}

export interface Formulario extends Agenda {
  id: string;
  titulo: string;
  descricao: string | null;
  perguntas: Pergunta[];
  modelo: "sus" | null;
  publico: Publico;
  anonimo: boolean;
  ativo: boolean;
}

export const ROTULOS_ESCALA5 = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"] as const;
export const ROTULO_TIPO: Record<TipoPergunta, string> = {
  escala5: "Concordo/discordo (1 a 5)",
  escala10: "Nota de 0 a 10",
  texto: "Resposta escrita",
  escolha: "Escolha uma opção",
};

// ------------------------------------------------------------------ agenda

const pad = (n: number) => String(n).padStart(2, "0");
const abertura = (comp: string, dia: number) => `${comp}-${pad(dia)}`;
/** meses entre duas competências AAAA-MM (b − a) */
const mesesEntre = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const proximaComp = (c: string) => {
  const m = Number(c.slice(5, 7));
  return m === 12 ? `${Number(c.slice(0, 4)) + 1}-01` : `${c.slice(0, 4)}-${pad(m + 1)}`;
};

/** Primeira competência em que a agenda mensal abre (a partir de "inicio"). */
function ancora(a: Agenda): string {
  const c = competenciaDe(a.inicio);
  return abertura(c, a.dia_mes ?? 1) >= a.inicio ? c : proximaComp(c);
}

/**
 * Rodada que está aberta hoje: "AAAA-MM" (mensal) ou "AAAA-MM-DD" (única). null = nada a pedir.
 * Quem não respondeu uma rodada responde na próxima vez que abrir o site, mesmo dias depois.
 */
export function rodadaAtual(a: Agenda, hoje: string): string | null {
  if (a.recorrencia === "unica") return a.data_unica && a.data_unica <= hoje ? a.data_unica : null;
  const dia = a.dia_mes ?? 1;
  const ini = ancora(a);
  let c = competenciaDe(hoje);
  if (abertura(c, dia) > hoje) c = competenciaAnterior(c);
  const passo = Math.max(1, a.a_cada_meses);
  while (c >= ini) {
    if (mesesEntre(ini, c) % passo === 0) return c;
    c = competenciaAnterior(c);
  }
  return null;
}

/** Próxima data em que o formulário vai abrir (para mostrar na tela). */
export function proximaAbertura(a: Agenda, hoje: string): string | null {
  if (a.recorrencia === "unica") return a.data_unica && a.data_unica > hoje ? a.data_unica : null;
  const dia = a.dia_mes ?? 1;
  const ini = ancora(a);
  const passo = Math.max(1, a.a_cada_meses);
  let c = ini;
  for (let i = 0; i < 400 && abertura(c, dia) <= hoje; i++) for (let k = 0; k < passo; k++) c = proximaComp(c);
  return abertura(c, dia);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "nov/2026" ou "13/11/2026" */
export function nomeRodada(r: string): string {
  if (r.length === 7) return `${MESES[Number(r.slice(5, 7)) - 1]}/${r.slice(0, 4)}`;
  return `${r.slice(8, 10)}/${r.slice(5, 7)}/${r.slice(0, 4)}`;
}

export function textoAgenda(a: Agenda): string {
  if (a.recorrencia === "unica") return a.data_unica ? `Uma vez, a partir de ${nomeRodada(a.data_unica)}` : "Uma vez";
  const cada = a.a_cada_meses <= 1 ? "Todo mês" : `A cada ${a.a_cada_meses} meses`;
  return `${cada}, no dia ${a.dia_mes ?? 1}`;
}

/** A pessoa faz parte do público do formulário? */
export function noPublico(p: Publico, equipes: { equipe_id: string; funcao: "lider" | "membro" }[]): boolean {
  return equipes.some((e) => p.funcoes.includes(e.funcao) && (!p.equipes.length || p.equipes.includes(e.equipe_id)));
}

// ------------------------------------------------------------------ respostas

export type Respostas = Record<string, number | string>;

/** Confere as respostas contra as perguntas; devolve só o que vale guardar. */
export function validarRespostas(perguntas: Pergunta[], bruto: Record<string, unknown>): { respostas: Respostas; faltando: string[] } {
  const respostas: Respostas = {};
  const faltando: string[] = [];
  for (const p of perguntas) {
    const v = bruto[p.id];
    let ok: number | string | null = null;
    if (p.tipo === "escala5" || p.tipo === "escala10") {
      const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
      const [min, max] = p.tipo === "escala5" ? [1, 5] : [0, 10];
      if (Number.isInteger(n) && n >= min && n <= max) ok = n;
    } else if (p.tipo === "escolha") {
      if (typeof v === "string" && p.opcoes?.includes(v)) ok = v;
    } else if (typeof v === "string" && v.trim()) ok = v.trim().slice(0, 2000);
    if (ok === null) {
      if (p.obrigatoria) faltando.push(p.id);
    } else respostas[p.id] = ok;
  }
  return { respostas, faltando };
}

/**
 * System Usability Scale (Brooke, 1996): 10 afirmações de 1 a 5, alternando positivas (ímpares) e negativas (pares).
 * Resultado de 0 a 100. Só calcula com as 10 respondidas.
 */
export function pontuacaoSus(perguntas: Pergunta[], r: Respostas): number | null {
  const escalas = perguntas.filter((p) => p.tipo === "escala5").slice(0, 10);
  if (escalas.length < 10) return null;
  let soma = 0;
  for (let i = 0; i < 10; i++) {
    const v = r[escalas[i].id];
    if (typeof v !== "number") return null;
    soma += i % 2 === 0 ? v - 1 : 5 - v;
  }
  return soma * 2.5;
}

/** Leitura da nota SUS (Bangor, Kortum & Miller, 2009; média de mercado ≈ 68). */
export function faixaSus(nota: number): { rotulo: string; texto: string; tom: "ruim" | "ok" | "bom" | "otimo" } {
  if (nota >= 80.3) return { rotulo: "Excelente", texto: "Entre os melhores sistemas: as pessoas usam com facilidade e confiança.", tom: "otimo" };
  if (nota >= 68) return { rotulo: "Bom", texto: "Acima da média de mercado (68). Ainda há pontos a melhorar.", tom: "bom" };
  if (nota >= 51) return { rotulo: "OK", texto: "Abaixo da média (68): as pessoas usam, mas com atrito. Leia os comentários.", tom: "ok" };
  return { rotulo: "Ruim", texto: "As pessoas estão com dificuldade. Priorize as queixas mais citadas.", tom: "ruim" };
}

// ------------------------------------------------------------------ validação do cadastro

export const PerguntaZ = z
  .object({
    id: z.string().min(1).max(40),
    tipo: z.enum(["escala5", "escala10", "texto", "escolha"]),
    texto: z.string().trim().min(3, "Toda pergunta precisa de um texto.").max(300),
    obrigatoria: z.boolean(),
    opcoes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  })
  .refine((p) => p.tipo !== "escolha" || (p.opcoes?.length ?? 0) >= 2, "Perguntas de escolha precisam de pelo menos 2 opções.");

export const FormularioZ = z
  .object({
    titulo: z.string().trim().min(3, "Dê um título ao formulário.").max(120),
    descricao: z.string().trim().max(600).nullable(),
    perguntas: z.array(PerguntaZ).min(1, "Coloque pelo menos uma pergunta.").max(25, "No máximo 25 perguntas: formulário curto é respondido com atenção."),
    modelo: z.enum(["sus"]).nullable(),
    recorrencia: z.enum(["mensal", "unica"]),
    dia_mes: z.number().int().min(1).max(28).nullable(),
    a_cada_meses: z.number().int().min(1).max(12),
    data_unica: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    publico: z.object({
      equipes: z.array(z.string().uuid()),
      funcoes: z.array(z.enum(["membro", "lider"])).min(1, "Escolha quem responde (atendentes e/ou líderes)."),
    }),
    anonimo: z.boolean(),
    ativo: z.boolean(),
  })
  .refine((f) => (f.recorrencia === "mensal" ? f.dia_mes !== null : f.data_unica !== null), "Escolha quando o formulário abre.");

export type DadosFormulario = z.infer<typeof FormularioZ>;

// ------------------------------------------------------------------ modelos prontos

const p = (id: string, texto: string, tipo: TipoPergunta = "escala5", obrigatoria = true): Pergunta => ({ id, tipo, texto, obrigatoria });

export interface Modelo {
  id: "sus" | "pulso" | "branco";
  titulo: string;
  resumo: string;
  porque: string;
  dados: Omit<DadosFormulario, "inicio" | "ativo" | "publico">;
}

export const MODELOS: Modelo[] = [
  {
    id: "sus",
    titulo: "Facilidade de uso do Trackco (SUS)",
    resumo: "10 afirmações + 1 comentário · ~2 minutos · a cada 3 meses",
    porque:
      "System Usability Scale (Brooke, 1996): o questionário de usabilidade mais usado no mundo, com versão validada em português. Gera uma nota de 0 a 100; a média de mercado é 68. Repetir a cada 3 meses mostra se as melhorias funcionaram sem cansar a equipe.",
    dados: {
      titulo: "Como está sendo usar o Trackco?",
      descricao: "São 10 frases rápidas. Responda pensando no seu dia a dia com o Trackco. As respostas são anônimas e servem para melhorar o sistema.",
      modelo: "sus",
      recorrencia: "mensal",
      dia_mes: 2,
      a_cada_meses: 3,
      data_unica: null,
      anonimo: true,
      perguntas: [
        p("sus1", "Eu gostaria de usar o Trackco com frequência."),
        p("sus2", "Eu achei o Trackco desnecessariamente complicado."),
        p("sus3", "Eu achei o Trackco fácil de usar."),
        p("sus4", "Eu precisaria da ajuda de alguém para conseguir usar o Trackco."),
        p("sus5", "As partes do Trackco funcionam bem juntas."),
        p("sus6", "O Trackco tem muitas coisas que não combinam entre si."),
        p("sus7", "A maioria das pessoas aprenderia a usar o Trackco rapidamente."),
        p("sus8", "Eu achei o Trackco muito trabalhoso de usar."),
        p("sus9", "Eu me senti confiante usando o Trackco."),
        p("sus10", "Eu precisei aprender muitas coisas antes de conseguir usar o Trackco."),
        p("comentario", "Se pudesse mudar uma coisa no Trackco, o que seria?", "texto", false),
      ],
    },
  },
  {
    id: "pulso",
    titulo: "Pulso do mês",
    resumo: "4 perguntas · ~1 minuto · todo mês",
    porque:
      "Mede o que mais pesa na motivação com metas: entender a regra (clareza), achar a regra justa (justiça percebida, Adams e Colquitt) e saber o que fazer para melhorar (retorno sobre a tarefa, Kluger e DeNisi). Curto de propósito para ser respondido com atenção todo mês.",
    dados: {
      titulo: "Pulso do mês",
      descricao: "4 perguntas, menos de 1 minuto. Anônimo: ninguém vê o que você respondeu.",
      modelo: null,
      recorrencia: "mensal",
      dia_mes: 2,
      a_cada_meses: 1,
      data_unica: null,
      anonimo: true,
      perguntas: [
        p("clareza", "Eu entendo como os meus números são contados."),
        p("justica", "Acho justa a forma como o meu desempenho é medido."),
        p("acao", "O Trackco me ajuda a saber o que fazer para melhorar."),
        p("comentario", "O que mais te atrapalhou no mês passado?", "texto", false),
      ],
    },
  },
  {
    id: "branco",
    titulo: "Em branco",
    resumo: "Monte as suas perguntas",
    porque: "Dica: até 5 perguntas, uma ideia por pergunta, e pelo menos uma aberta para a pessoa explicar.",
    dados: {
      titulo: "",
      descricao: null,
      modelo: null,
      recorrencia: "mensal",
      dia_mes: 2,
      a_cada_meses: 1,
      data_unica: null,
      anonimo: true,
      perguntas: [p("p1", "")],
    },
  },
];
