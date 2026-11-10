"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RetornoAcao } from "@/components/app/form-acao";
import { competenciaDe } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { recalcularParcial } from "@/lib/calculo/recalcular";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

async function recalcularDoColaborador(colaboradorId: string, inicio: string, fim: string) {
  const admin = criarClienteAdmin();
  const { data } = await admin.from("equipe_membros").select("equipe_id").eq("colaborador_id", colaboradorId);
  const equipes = Array.from(new Set((data ?? []).map((d) => d.equipe_id as string)));
  for (const comp of new Set([competenciaDe(inicio), competenciaDe(fim)])) await recalcularParcial(comp, equipes);
}

export async function lancarAusencia(fd: FormData): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ lider: true });
    const v = z
      .object({
        colaborador_id: z.string().uuid("Escolha a pessoa."),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tipo: z.enum(["ferias", "atestado", "folga", "afastamento", "outro"]),
        observacao: z.string().max(300).optional(),
      })
      .parse(Object.fromEntries(fd));
    if (v.fim < v.inicio) throw new Error("A data final deve ser depois da inicial.");
    const db = await criarClienteServidor();
    const { error } = await db.from("ausencias").insert({ ...v, observacao: v.observacao || null, criado_por: s.colaborador.id });
    if (error) throw new Error(error.message.includes("row-level") ? "Você só pode lançar ausências da sua equipe." : error.message);
    await recalcularDoColaborador(v.colaborador_id, v.inicio, v.fim);
    revalidatePath("/ausencias");
    return { ok: true, mensagem: "Ausência lançada; meta recalculada." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function removerAusencia(id: string): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ lider: true });
    const db = await criarClienteServidor();
    const { data, error } = await db.from("ausencias").delete().eq("id", id).select("colaborador_id, inicio, fim").single();
    if (error) throw new Error(error.message);
    await recalcularDoColaborador(data.colaborador_id, data.inicio, data.fim);
    revalidatePath("/ausencias");
    return { ok: true, mensagem: "Ausência removida." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
