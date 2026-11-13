"use server";

import { revalidatePath } from "next/cache";
import { hojeNoFuso } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { obterFormulario } from "@/lib/dados/formularios";
import { noPublico, rodadaAtual, validarRespostas } from "@/lib/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Grava a resposta da rodada aberta. As respostas são conferidas aqui; envio + resposta são gravados juntos no banco. */
export async function responderFormulario(
  formularioId: string,
  rodada: string,
  bruto: Record<string, unknown>,
): Promise<{ ok: boolean; erro?: string; faltando?: string[] }> {
  try {
    const s = await sessaoAcao();
    const db = await criarClienteServidor();
    const f = await obterFormulario(db, formularioId);
    if (!f || !f.ativo) return { ok: true }; // foi desligado enquanto a pessoa respondia: libera
    if (!noPublico(f.publico, s.equipes) || rodadaAtual(f, hojeNoFuso()) !== rodada) return { ok: true };
    const { respostas, faltando } = validarRespostas(f.perguntas, bruto);
    if (faltando.length) return { ok: false, erro: "Responda as perguntas marcadas.", faltando };
    const { error } = await db.rpc("responder_formulario", { p_formulario: f.id, p_rodada: rodada, p_respostas: respostas });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
