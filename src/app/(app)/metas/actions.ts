"use server";

import { revalidatePath } from "next/cache";
import { competenciaAnterior, inicioCompetencia } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { recalcularParcial } from "@/lib/calculo/recalcular";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface LinhaMeta {
  metrica_id: string;
  colaborador_id: string | null;
  valor: number | null;
}

export async function salvarMetas(
  equipeId: string,
  competencia: string,
  metricas: string[],
  linhas: LinhaMeta[],
): Promise<{ ok: boolean; erro?: string }> {
  try {
    await sessaoAcao({ admin: true });
    if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Competência inválida.");
    if (linhas.some((l) => l.valor !== null && (!Number.isFinite(l.valor) || l.valor < 0)))
      throw new Error("Metas precisam ser números positivos.");
    const db = await criarClienteServidor();
    const { error } = await db.rpc("salvar_metas", {
      p_equipe: equipeId,
      p_competencia: inicioCompetencia(competencia),
      p_metricas: metricas,
      p_linhas: linhas,
    });
    if (error) throw new Error(error.message);
    await recalcularParcial(competencia, [equipeId]);
    revalidatePath("/metas");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Valores do mês anterior para preencher a grade (o admin revisa e salva). */
export async function metasDoMesAnterior(
  equipeId: string,
  competencia: string,
  metricas: string[],
): Promise<{ ok: boolean; linhas?: LinhaMeta[]; erro?: string }> {
  try {
    await sessaoAcao({ admin: true });
    const db = await criarClienteServidor();
    const ant = inicioCompetencia(competenciaAnterior(competencia));
    const { data, error } = await db
      .from("metas")
      .select("metrica_id, colaborador_id, equipe_id, valor")
      .eq("competencia", ant)
      .in("metrica_id", metricas);
    if (error) throw new Error(error.message);
    return {
      ok: true,
      linhas: (data ?? [])
        .filter((m) => m.colaborador_id || m.equipe_id === equipeId)
        .map((m) => ({ metrica_id: m.metrica_id, colaborador_id: m.colaborador_id, valor: Number(m.valor) })),
    };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
