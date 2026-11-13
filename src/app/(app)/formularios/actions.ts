"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { competenciaDe, hojeNoFuso, inicioCompetencia } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { type DadosFormulario, FormularioZ } from "@/lib/formularios";
import { criarClienteServidor } from "@/lib/supabase/server";

type Ret = { ok: boolean; erro?: string; id?: string };
const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

/**
 * Cria ou atualiza. "pedirAgora": a rodada deste mês também vale (mesmo se o dia já passou),
 * então quem entrar no site depois de salvar já responde.
 */
export async function salvarFormulario(id: string | null, dados: Omit<DadosFormulario, "inicio"> & { pedirAgora: boolean }): Promise<Ret> {
  try {
    const s = await sessaoAcao({ admin: true });
    const hoje = hojeNoFuso();
    const db = await criarClienteServidor();
    let inicio = hoje;
    if (id) {
      const { data } = await db.from("formularios").select("inicio").eq("id", id).maybeSingle();
      if (!data) throw new Error("Formulário não encontrado.");
      inicio = String(data.inicio);
    }
    if (dados.pedirAgora) inicio = inicioCompetencia(competenciaDe(hoje));
    const { pedirAgora: _, ...resto } = dados;
    const f = FormularioZ.parse({ ...resto, inicio });
    const ids = f.perguntas.map((p) => p.id);
    if (new Set(ids).size !== ids.length) throw new Error("Há perguntas repetidas.");
    const linha = {
      ...f,
      dia_mes: f.recorrencia === "mensal" ? f.dia_mes : null,
      data_unica: f.recorrencia === "unica" ? f.data_unica : null,
      perguntas: f.perguntas.map((p) => (p.tipo === "escolha" ? p : { id: p.id, tipo: p.tipo, texto: p.texto, obrigatoria: p.obrigatoria })),
    };
    if (id) {
      const { error } = await db.from("formularios").update(linha).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await db
        .from("formularios")
        .insert({ ...linha, criado_por: s.colaborador.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = String(data.id);
    }
    revalidatePath("/formularios");
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function alternarFormulario(id: string, ativo: boolean): Promise<Ret> {
  try {
    await sessaoAcao({ admin: true });
    const db = await criarClienteServidor();
    const { error } = await db.from("formularios").update({ ativo }).eq("id", z.string().uuid().parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/formularios");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function excluirFormulario(id: string): Promise<Ret> {
  try {
    await sessaoAcao({ admin: true });
    const db = await criarClienteServidor();
    const { error } = await db.from("formularios").delete().eq("id", z.string().uuid().parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/formularios");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
