"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessaoAcao } from "@/lib/auth";
import { recalcularParcial } from "@/lib/calculo/recalcular";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

const Esquema = z.object({
  id: z.string().uuid(),
  decisao: z.enum(["em_analise", "aceita", "recusada"]),
  resposta: z.string().trim().min(3, "Escreva uma resposta para o colaborador.").max(2000),
  delta: z.number().finite().optional(),
  metrica_id: z.string().uuid().optional(),
});

export async function responderContestacao(dados: z.input<typeof Esquema>): Promise<{ ok: boolean; erro?: string }> {
  try {
    const s = await sessaoAcao({ lider: true });
    const v = Esquema.parse(dados);
    const db = await criarClienteServidor();
    const { data: c, error: e1 } = await db
      .from("contestacoes")
      .select("id, colaborador_id, competencia, metrica_id, origem_chave, status")
      .eq("id", v.id)
      .single();
    if (e1 || !c) throw new Error("Contestação não encontrada.");
    if (c.colaborador_id === s.colaborador.id && !s.ehAdmin) throw new Error("Você não pode responder a própria contestação.");

    let ajusteId: string | null = null;
    if (v.decisao === "aceita" && v.delta) {
      if (!s.ehAdmin) throw new Error("Somente o administrador lança ajustes. Aceite sem ajuste ou peça ao admin.");
      const metrica = v.metrica_id ?? c.metrica_id;
      if (!metrica) throw new Error("Escolha a métrica que receberá o ajuste.");
      const { data: aj, error: e2 } = await db
        .from("ajustes")
        .insert({
          colaborador_id: c.colaborador_id,
          competencia: c.competencia,
          metrica_id: metrica,
          delta: v.delta,
          justificativa: `Contestação aceita: ${v.resposta}`,
          origem_chave: c.origem_chave,
          contestacao_id: c.id,
          criado_por: s.colaborador.id,
        })
        .select("id")
        .single();
      if (e2) throw new Error(e2.message);
      ajusteId = aj.id;
    }

    const { error: e3 } = await db
      .from("contestacoes")
      .update({
        status: v.decisao,
        resposta: v.resposta,
        respondido_por: s.colaborador.id,
        respondido_em: new Date().toISOString(),
      })
      .eq("id", v.id);
    if (e3) throw new Error(e3.message);

    if (ajusteId) {
      const admin = criarClienteAdmin();
      const { data: eqs } = await admin.from("equipe_membros").select("equipe_id").eq("colaborador_id", c.colaborador_id);
      await recalcularParcial(String(c.competencia).slice(0, 7), (eqs ?? []).map((e) => e.equipe_id as string));
    }
    revalidatePath("/contestacoes");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
    return { ok: false, erro: msg };
  }
}
