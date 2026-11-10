"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessaoAcao } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

const Esquema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  metrica_id: z.string().uuid().optional().or(z.literal("")),
  origem_chave: z.string().max(200).optional().or(z.literal("")),
  descricao: z.string().trim().min(5, "Descreva o problema com pelo menos 5 caracteres.").max(2000),
});

export async function abrirContestacao(dados: z.input<typeof Esquema>): Promise<{ ok: boolean; erro?: string }> {
  try {
    const s = await sessaoAcao();
    const v = Esquema.parse(dados);
    const db = await criarClienteServidor();
    const { error } = await db.from("contestacoes").insert({
      colaborador_id: s.colaborador.id,
      competencia: `${v.competencia}-01`,
      metrica_id: v.metrica_id || null,
      origem_chave: v.origem_chave || null,
      descricao: v.descricao,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/contestacoes");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
    return { ok: false, erro: msg };
  }
}
