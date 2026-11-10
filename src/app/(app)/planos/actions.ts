"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apurarEquipe, descreverRecompensa } from "@/engine/apuracao";
import { competenciaDe, hojeNoFuso } from "@/engine/datas";
import { DefinicaoPlanoZ } from "@/engine/esquemas";
import type { DefinicaoPlano } from "@/engine/tipos";
import { sessaoAcao } from "@/lib/auth";
import { equipesAtivas, montarEntrada } from "@/lib/calculo/carregar";
import { recalcularParcial } from "@/lib/calculo/recalcular";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

type Ret = { ok: boolean; erro?: string };
const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

const MODALIDADES = ["reconhecimento", "premio", "dinheiro", "pontos", "misto"] as const;

export async function criarPlano(form: FormData) {
  await sessaoAcao({ admin: true });
  const v = z
    .object({ nome: z.string().trim().min(3), equipe_id: z.string().uuid(), modalidade: z.enum(MODALIDADES) })
    .parse(Object.fromEntries(form));
  const db = await criarClienteServidor();
  const { data, error } = await db.from("planos").insert({ ...v, status: "rascunho" }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/planos");
  redirect(`/planos/${data.id}`);
}

export async function salvarRascunho(
  id: string,
  dados: { nome: string; descricao: string; modalidade: string; definicao: DefinicaoPlano },
): Promise<Ret> {
  try {
    await sessaoAcao({ admin: true });
    const v = z
      .object({ nome: z.string().trim().min(3), descricao: z.string().max(1000), modalidade: z.enum(MODALIDADES) })
      .parse(dados);
    // rascunho pode estar incompleto, mas precisa ser estruturalmente válido
    const def = DefinicaoPlanoZ.safeParse(dados.definicao);
    const db = await criarClienteServidor();
    const { error } = await db
      .from("planos")
      .update({ ...v, rascunho: def.success ? def.data : dados.definicao })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/planos/${id}`);
    return def.success ? { ok: true } : { ok: true, erro: `Rascunho salvo, mas ainda não pode ser publicado: ${msg(def.error)}` };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function publicarVersao(id: string, vigenteDesde: string, observacao: string): Promise<Ret> {
  try {
    const s = await sessaoAcao({ admin: true });
    if (!/^\d{4}-\d{2}$/.test(vigenteDesde)) throw new Error("Informe o mês de início.");
    const db = await criarClienteServidor();
    const { data: plano, error } = await db.from("planos").select("id, equipe_id, rascunho, status").eq("id", id).single();
    if (error || !plano) throw new Error("Plano não encontrado.");
    const def = DefinicaoPlanoZ.parse(plano.rascunho);
    const { data: ult } = await db
      .from("plano_versoes")
      .select("numero")
      .eq("plano_id", id)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error: e2 } = await db.from("plano_versoes").insert({
      plano_id: id,
      numero: (ult?.numero ?? 0) + 1,
      definicao: def,
      vigente_desde: `${vigenteDesde}-01`,
      observacao: observacao || null,
      publicado_por: s.colaborador.id,
    });
    if (e2) throw new Error(e2.message);
    if (plano.status === "ativo") {
      const atual = competenciaDe(hojeNoFuso());
      await recalcularParcial(atual, [plano.equipe_id]);
    }
    revalidatePath(`/planos/${id}`);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function alterarStatusPlano(id: string, status: "ativo" | "arquivado" | "rascunho"): Promise<Ret> {
  try {
    await sessaoAcao({ admin: true });
    const db = await criarClienteServidor();
    const { data: plano } = await db.from("planos").select("equipe_id").eq("id", id).single();
    if (!plano) throw new Error("Plano não encontrado.");
    if (status === "ativo") {
      const { count } = await db.from("plano_versoes").select("id", { count: "exact", head: true }).eq("plano_id", id);
      if (!count) throw new Error("Publique uma versão antes de ativar o plano.");
      await db.from("planos").update({ status: "arquivado" }).eq("equipe_id", plano.equipe_id).eq("status", "ativo").neq("id", id);
    }
    const { error } = await db.from("planos").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    if (status === "ativo") await recalcularParcial(competenciaDe(hojeNoFuso()), [plano.equipe_id]);
    revalidatePath("/planos");
    revalidatePath(`/planos/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export interface LinhaSimulacao {
  nome: string;
  funcao: string;
  nota: number | null;
  nivel: string | null;
  recompensa: string;
  notaAtual: number | null;
  nivelAtual: string | null;
}

export async function simularPlano(
  equipeId: string,
  definicao: DefinicaoPlano,
  competencia: string,
): Promise<{ ok: boolean; linhas?: LinhaSimulacao[]; erro?: string }> {
  try {
    await sessaoAcao({ admin: true });
    const def = DefinicaoPlanoZ.parse(definicao);
    const db = criarClienteAdmin();
    const [equipe] = await equipesAtivas(db, [equipeId]);
    if (!equipe) throw new Error("Equipe inativa.");
    const [simulado, atual] = await Promise.all([
      montarEntrada(db, equipe, { competencia, definicao: def }),
      montarEntrada(db, equipe, { competencia }),
    ]);
    if (!simulado) throw new Error("Não foi possível montar a simulação.");
    const resSim = apurarEquipe(simulado.entrada);
    const resAtual = atual ? apurarEquipe(atual.entrada) : [];
    return {
      ok: true,
      linhas: resSim.map((r) => {
        const a = resAtual.find((x) => x.colaborador_id === r.colaborador_id);
        return {
          nome: r.nome,
          funcao: r.funcao,
          nota: r.nota_pct,
          nivel: r.faixa?.nivel ?? null,
          recompensa: descreverRecompensa(r.recompensa),
          notaAtual: a?.nota_pct ?? null,
          nivelAtual: a?.faixa?.nivel ?? null,
        };
      }),
    };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
