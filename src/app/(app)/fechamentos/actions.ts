"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { RetornoAcao } from "@/components/app/form-acao";
import { somarDias, hojeNoFuso, inicioCompetencia } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { calcularFechamento } from "@/lib/calculo/recalcular";
import { proximo, quemAvanca, ROTULO_STATUS, type StatusFechamento } from "@/lib/fechamento";
import { criarClienteAdmin } from "@/lib/supabase/admin";

const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

export async function criarFechamento(fd: FormData) {
  const s = await sessaoAcao({ admin: true });
  const v = z
    .object({ equipe_id: z.string().uuid(), competencia: z.string().regex(/^\d{4}-\d{2}$/) })
    .parse(Object.fromEntries(fd));
  const db = criarClienteAdmin();
  const { data: existente } = await db
    .from("fechamentos")
    .select("id")
    .eq("equipe_id", v.equipe_id)
    .eq("competencia", inicioCompetencia(v.competencia))
    .maybeSingle();
  if (existente) redirect(`/fechamentos/${existente.id}`);
  const { data, error } = await db
    .from("fechamentos")
    .insert({
      equipe_id: v.equipe_id,
      competencia: inicioCompetencia(v.competencia),
      log: [{ em: new Date().toISOString(), por: s.colaborador.nome, acao: "Fechamento aberto" }],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/fechamentos");
  redirect(`/fechamentos/${data.id}`);
}

async function contestacoesAbertas(equipeId: string, competencia: string): Promise<number> {
  const db = criarClienteAdmin();
  const { data: membros } = await db.from("equipe_membros").select("colaborador_id").eq("equipe_id", equipeId);
  const ids = Array.from(new Set((membros ?? []).map((m) => m.colaborador_id as string)));
  if (!ids.length) return 0;
  const { count } = await db
    .from("contestacoes")
    .select("id", { count: "exact", head: true })
    .eq("competencia", competencia)
    .in("status", ["aberta", "em_analise"])
    .in("colaborador_id", ids);
  return count ?? 0;
}

async function registrar(id: string, patch: Record<string, unknown>, por: string, acao: string) {
  const db = criarClienteAdmin();
  const { data: f } = await db.from("fechamentos").select("log").eq("id", id).single();
  const log = [...((f?.log as unknown[]) ?? []), { em: new Date().toISOString(), por, acao }];
  const { error } = await db.from("fechamentos").update({ ...patch, log }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function calcular(id: string): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ admin: true });
    const db = criarClienteAdmin();
    const { data: f } = await db.from("fechamentos").select("status").eq("id", id).single();
    if (!f) throw new Error("Fechamento não encontrado.");
    const n = await calcularFechamento(id);
    await registrar(
      id,
      f.status === "aberto" ? { status: "calculado" } : {},
      s.colaborador.nome,
      `Cálculo executado (${n} pessoa(s))`,
    );
    revalidatePath(`/fechamentos/${id}`);
    return { ok: true, mensagem: `Calculado para ${n} pessoa(s).` };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function avancar(id: string): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ lider: true });
    const db = criarClienteAdmin();
    const { data: f } = await db
      .from("fechamentos")
      .select("id, status, equipe_id, competencia, equipes(etapas_aprovacao, prazo_contestacao_dias)")
      .eq("id", id)
      .single();
    if (!f) throw new Error("Fechamento não encontrado.");
    const equipe = f.equipes as unknown as { etapas_aprovacao: string[]; prazo_contestacao_dias: number };
    const atual = f.status as StatusFechamento;
    const prox = proximo(atual, equipe.etapas_aprovacao);
    if (!prox) throw new Error("Este fechamento já está na última etapa.");

    const quem = quemAvanca(atual);
    if (!quem) throw new Error("Calcule o fechamento antes de avançar.");
    if (quem === "admin" && !s.ehAdmin) throw new Error("Esta etapa é do administrador.");
    if (quem === "lider_ou_admin" && !s.ehAdmin && !s.lidera.includes(f.equipe_id))
      throw new Error("Só o líder desta equipe ou o administrador podem conferir.");

    if (prox === "aprovado") {
      const count = await contestacoesAbertas(f.equipe_id, f.competencia);
      if (count) throw new Error(`Há ${count} contestação(ões) em aberto. Responda antes de aprovar.`);
    }

    const patch: Record<string, unknown> = { status: prox };
    if (prox === "em_contestacao") patch.prazo_contestacao = somarDias(hojeNoFuso(), equipe.prazo_contestacao_dias);
    await registrar(id, patch, s.colaborador.nome, `${ROTULO_STATUS[atual]} → ${ROTULO_STATUS[prox]}`);
    revalidatePath(`/fechamentos/${id}`);
    revalidatePath("/fechamentos");
    return { ok: true, mensagem: `Etapa: ${ROTULO_STATUS[prox]}.` };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function reabrir(id: string): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ admin: true });
    const db = criarClienteAdmin();
    const { data: f } = await db.from("fechamentos").select("status").eq("id", id).single();
    if (!f) throw new Error("Fechamento não encontrado.");
    if (f.status === "entregue") throw new Error("Fechamento entregue não pode ser reaberto.");
    await registrar(id, { status: "calculado" }, s.colaborador.nome, `Reaberto (estava em ${ROTULO_STATUS[f.status as StatusFechamento]})`);
    revalidatePath(`/fechamentos/${id}`);
    return { ok: true, mensagem: "Fechamento reaberto para revisão." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
