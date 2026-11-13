"use server";

import { hojeNoFuso } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { carregarRetrospectiva, type Retrospectiva } from "@/lib/dados/retrospectiva";

/** Carrega só quando a pessoa abre a retrospectiva (não pesa no Painel). */
export async function obterRetrospectiva(): Promise<{ ok: boolean; dados?: Retrospectiva | null; erro?: string }> {
  try {
    const s = await sessaoAcao();
    return { ok: true, dados: await carregarRetrospectiva(s, hojeNoFuso()) };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
