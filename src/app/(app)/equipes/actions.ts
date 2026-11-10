"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RetornoAcao } from "@/components/app/form-acao";
import { competenciaDe, hojeNoFuso } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { recalcularParcial } from "@/lib/calculo/recalcular";
import { criarClienteServidor } from "@/lib/supabase/server";

const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

export async function criarEquipe(fd: FormData): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const nome = z.string().trim().min(2, "Nome muito curto.").parse(fd.get("nome"));
    const db = await criarClienteServidor();
    const { error } = await db.from("equipes").insert({ nome, descricao: String(fd.get("descricao") ?? "") || null });
    if (error) throw new Error(error.code === "23505" ? "Já existe uma equipe com esse nome." : error.message);
    revalidatePath("/equipes");
    return { ok: true, mensagem: "Equipe criada." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function salvarEquipe(id: string, fd: FormData): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const v = z
      .object({
        nome: z.string().trim().min(2),
        descricao: z.string().max(500).optional(),
        visibilidade_ranking: z.enum(["aberto", "posicoes", "privado"]),
        prazo_contestacao_dias: z.coerce.number().int().min(0).max(31),
        ativo: z.enum(["on"]).optional(),
      })
      .parse(Object.fromEntries(fd));
    const dias = fd.getAll("dias_trabalho").map(Number).filter((n) => n >= 1 && n <= 7);
    if (!dias.length) throw new Error("Escolha pelo menos um dia de trabalho.");
    const ordem = ["contestacao", "lider", "admin"];
    const etapas = ordem.filter((e) => fd.getAll("etapas").includes(e));
    if (!etapas.includes("admin")) etapas.push("admin"); // a aprovação final do admin é obrigatória
    const db = await criarClienteServidor();
    const { error } = await db
      .from("equipes")
      .update({
        nome: v.nome,
        descricao: v.descricao || null,
        visibilidade_ranking: v.visibilidade_ranking,
        prazo_contestacao_dias: v.prazo_contestacao_dias,
        dias_trabalho: dias.sort(),
        etapas_aprovacao: etapas,
        ativo: v.ativo === "on",
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await recalcularParcial(competenciaDe(hojeNoFuso()), [id]);
    revalidatePath(`/equipes/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function adicionarMembro(equipeId: string, fd: FormData): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const v = z
      .object({
        colaborador_id: z.string().uuid("Escolha o colaborador."),
        funcao: z.enum(["lider", "membro"]),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(Object.fromEntries(fd));
    const db = await criarClienteServidor();
    const { error } = await db.from("equipe_membros").insert({ equipe_id: equipeId, ...v });
    if (error) throw new Error(error.code === "23505" ? "Essa pessoa já tem vínculo ativo na equipe." : error.message);
    await recalcularParcial(competenciaDe(hojeNoFuso()), [equipeId]);
    revalidatePath(`/equipes/${equipeId}`);
    return { ok: true, mensagem: "Membro adicionado." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function alterarVinculo(
  equipeId: string,
  vinculoId: string,
  mudanca: { funcao?: "lider" | "membro"; encerrar?: boolean },
): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const db = await criarClienteServidor();
    const patch: Record<string, unknown> = {};
    if (mudanca.funcao) patch.funcao = mudanca.funcao;
    if (mudanca.encerrar) patch.fim = hojeNoFuso();
    const { error } = await db.from("equipe_membros").update(patch).eq("id", vinculoId).eq("equipe_id", equipeId);
    if (error) throw new Error(error.message);
    await recalcularParcial(competenciaDe(hojeNoFuso()), [equipeId]);
    revalidatePath(`/equipes/${equipeId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
