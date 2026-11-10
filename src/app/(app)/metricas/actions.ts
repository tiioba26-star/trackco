"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apurarEquipe } from "@/engine/apuracao";
import { DefinicaoMetricaZ, MetricaZ } from "@/engine/esquemas";
import type { DefinicaoPlano, Metrica } from "@/engine/tipos";
import { sessaoAcao } from "@/lib/auth";
import { equipesAtivas, montarEntrada } from "@/lib/calculo/carregar";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

function erro(e: unknown) {
  return e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message;
}

export async function salvarMetrica(dados: unknown): Promise<{ ok: boolean; id?: string; erro?: string }> {
  try {
    await sessaoAcao({ admin: true });
    const m = MetricaZ.parse(dados);
    const db = await criarClienteServidor();
    const linha = {
      codigo: m.codigo,
      nome: m.nome,
      descricao: m.descricao ?? null,
      tipo: m.tipo,
      unidade: m.unidade,
      ativo: m.ativo,
      definicao: m.definicao,
    };
    const { data, error } = m.id
      ? await db.from("metricas").update(linha).eq("id", m.id).select("id").single()
      : await db.from("metricas").insert(linha).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "Já existe uma métrica com esse código." : error.message);
    revalidatePath("/metricas");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, erro: erro(e) };
  }
}

export interface ResultadoTeste {
  equipe: string;
  linhas: { nome: string; valor: number; numerador?: number; denominador?: number; registros: number }[];
}

/** Aplica a métrica (mesmo sem salvar) aos membros de cada equipe ativa na competência escolhida. */
export async function testarMetrica(
  definicao: unknown,
  unidade: Metrica["unidade"],
  competencia: string,
): Promise<{ ok: boolean; resultados?: ResultadoTeste[]; erro?: string }> {
  try {
    await sessaoAcao({ admin: true });
    const def = DefinicaoMetricaZ.parse(definicao);
    if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Competência inválida.");
    const db = criarClienteAdmin();
    const metricaTeste: Metrica = {
      id: "00000000-0000-0000-0000-000000000000",
      codigo: "teste",
      nome: "Teste",
      tipo: "quantitativa",
      unidade,
      definicao: def,
    };
    const plano: DefinicaoPlano = {
      indicadores: [
        { id: "t", metrica_id: metricaTeste.id, escopo: "individual", aplica_a: "todos", peso: 1, teto_pct: 1000, meta_proporcional: false },
      ],
      faixas: [],
      condicoes: [],
    };
    const resultados: ResultadoTeste[] = [];
    for (const equipe of await equipesAtivas(db)) {
      const m = await montarEntrada(db, equipe, {
        competencia,
        definicao: plano,
        metricasExtras: { [metricaTeste.id]: metricaTeste },
      });
      if (!m) continue;
      const res = apurarEquipe(m.entrada);
      resultados.push({
        equipe: equipe.nome,
        linhas: res.map((r) => ({
          nome: r.nome,
          valor: r.indicadores[0]?.realizado ?? 0,
          numerador: r.indicadores[0]?.numerador,
          denominador: r.indicadores[0]?.denominador,
          registros: r.itens.length,
        })),
      });
    }
    return { ok: true, resultados };
  } catch (e) {
    return { ok: false, erro: erro(e) };
  }
}
