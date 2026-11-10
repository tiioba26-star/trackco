import { z } from "zod";
import { campoDaFonte, FONTES } from "./fontes";

// Validação das definições gravadas em jsonb (métricas e planos).

export const FiltroZ = z.object({
  campo: z.string().min(1),
  op: z.enum(["igual", "diferente", "em", "nao_em", "contem", "verdadeiro", "falso", "preenchido", "vazio"]),
  valor: z.union([z.string(), z.array(z.string())]).optional(),
});

export const ContagemZ = z
  .object({
    fonte: z.enum(["klingo_agendamentos", "lancamentos"]),
    agregacao: z.enum(["contar", "somar"]),
    campo_data: z.string().min(1),
    campo_valor: z.string().optional(),
    filtros: z.array(FiltroZ).default([]),
  })
  .superRefine((c, ctx) => {
    if (!FONTES[c.fonte]) return;
    const cd = campoDaFonte(c.fonte, c.campo_data);
    if (!cd || cd.tipo !== "data") ctx.addIssue({ code: "custom", message: `Campo de data inválido: ${c.campo_data}` });
    if (c.agregacao === "somar") {
      const cv = campoDaFonte(c.fonte, c.campo_valor ?? "");
      if (!cv || cv.tipo !== "numero") ctx.addIssue({ code: "custom", message: "Escolha um campo numérico para somar." });
    }
    for (const f of c.filtros) {
      if (!campoDaFonte(c.fonte, f.campo)) ctx.addIssue({ code: "custom", message: `Campo de filtro inválido: ${f.campo}` });
    }
  });

export const DefinicaoMetricaZ = z.union([
  ContagemZ.and(z.object({ tipo_calculo: z.literal("simples"), corte: z.enum(["hoje", "ontem"]).optional() })),
  z.object({
    tipo_calculo: z.literal("taxa"),
    corte: z.enum(["hoje", "ontem"]).optional(),
    numerador: ContagemZ,
    denominador: ContagemZ,
  }),
]);

export const MetricaZ = z.object({
  id: z.string().uuid().optional(),
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use só letras minúsculas, números e _"),
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().max(500).optional().nullable(),
  tipo: z.enum(["quantitativa", "qualitativa"]),
  unidade: z.enum(["un", "%", "R$", "pts"]),
  ativo: z.boolean().default(true),
  definicao: DefinicaoMetricaZ,
});

const RecompensaZ = z
  .object({
    tipo: z.enum(["reconhecimento", "premio", "valor_fixo", "percentual", "pontos"]),
    valor: z.number().finite().optional(),
    premio_id: z.string().optional(),
    descricao: z.string().max(200).optional(),
  })
  .nullable()
  .optional();

const FaixaZ = z.object({
  id: z.string().min(1),
  de_pct: z.number().finite().min(0),
  ate_pct: z.number().finite().nullable(),
  nivel: z.string().trim().min(1).max(60),
  cor: z.string().max(30).optional(),
  recompensa: RecompensaZ,
});

const IndicadorZ = z.object({
  id: z.string().min(1),
  metrica_id: z.string().uuid("Escolha a métrica do indicador."),
  nome: z.string().max(80).optional(),
  escopo: z.enum(["individual", "equipe"]),
  aplica_a: z.enum(["membros", "lider", "todos"]),
  peso: z.number().finite().min(0).max(1000),
  teto_pct: z.number().finite().min(1).max(10000),
  meta_proporcional: z.boolean(),
  incluir_lider: z.boolean().optional(),
  faixas: z.array(FaixaZ).optional(),
});

const CondicaoZ = z.object({
  id: z.string().min(1),
  descricao: z.string().trim().min(3).max(200),
  indicador_id: z.string().min(1),
  base: z.enum(["realizado", "atingimento"]),
  operador: z.enum([">=", ">", "<=", "<"]),
  valor: z.number().finite(),
  efeito: z.enum(["bloquear_recompensa", "limitar_nivel"]),
  faixa_maxima_id: z.string().optional(),
});

export const DefinicaoPlanoZ = z
  .object({
    indicadores: z.array(IndicadorZ).min(1, "Inclua pelo menos um indicador."),
    faixas: z.array(FaixaZ),
    condicoes: z.array(CondicaoZ).default([]),
  })
  .superRefine((d, ctx) => {
    const ord = [...d.faixas].sort((a, b) => a.de_pct - b.de_pct);
    for (let i = 0; i < ord.length; i++) {
      const f = ord[i];
      if (f.ate_pct !== null && f.ate_pct <= f.de_pct)
        ctx.addIssue({ code: "custom", message: `Faixa "${f.nivel}": o limite superior deve ser maior que o inferior.` });
      const prox = ord[i + 1];
      if (prox && f.ate_pct !== null && prox.de_pct < f.ate_pct)
        ctx.addIssue({ code: "custom", message: `As faixas "${f.nivel}" e "${prox.nivel}" se sobrepõem.` });
      if (prox && f.ate_pct === null)
        ctx.addIssue({ code: "custom", message: `Só a última faixa pode ficar sem limite superior.` });
    }
    const ids = new Set(d.indicadores.map((i) => i.id));
    for (const c of d.condicoes)
      if (!ids.has(c.indicador_id)) ctx.addIssue({ code: "custom", message: `Condição "${c.descricao}" aponta para indicador inexistente.` });
  });
