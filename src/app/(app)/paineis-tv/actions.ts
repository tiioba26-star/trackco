"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessaoAcao } from "@/lib/auth";
import { CONFIG_TV_PADRAO, gerarToken, type ConfigTv, type ModoTv } from "@/lib/dados/tv";
import { criarClienteServidor } from "@/lib/supabase/server";

type Ret = { ok: boolean; erro?: string; token?: string; mensagem?: string };
const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

export async function criarPainel(fd: FormData): Promise<Ret> {
  try {
    const s = await sessaoAcao({ admin: true });
    const nome = z.string().trim().min(2, "Dê um nome ao painel.").parse(fd.get("nome"));
    const equipes = fd.getAll("equipes").map(String);
    if (!equipes.length) throw new Error("Escolha pelo menos uma equipe.");
    const intervalo = z.coerce.number().int().min(10).max(300).parse(fd.get("intervalo") ?? 30);
    const feliz = z.coerce.number().min(0).max(500).parse(fd.get("feliz") ?? 80);
    const mega = z.coerce.number().min(0).max(500).parse(fd.get("mega_feliz") ?? 100);
    if (mega < feliz) throw new Error("O limite de 'mega feliz' deve ser maior que o de 'feliz'.");
    const escolhidos = fd.getAll("modos").map(String);
    const modos: ModoTv[] = CONFIG_TV_PADRAO.modos.filter((m) =>
      escolhidos.includes(m.tipo === "barras" ? m.metrica : "geral"),
    );
    if (!modos.length) throw new Error("Escolha pelo menos um modo de exibição.");
    const config: ConfigTv = { intervalo, modos, limites: { feliz, mega_feliz: mega } };
    const { token, hash } = gerarToken();
    const db = await criarClienteServidor();
    const { error } = await db
      .from("paineis_tv")
      .insert({ nome, equipes, config, token_hash: hash, criado_por: s.colaborador.id });
    if (error) throw new Error(error.message);
    revalidatePath("/paineis-tv");
    return { ok: true, token };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function regenerarToken(id: string): Promise<Ret> {
  try {
    await sessaoAcao({ admin: true });
    const { token, hash } = gerarToken();
    const db = await criarClienteServidor();
    const { error } = await db.from("paineis_tv").update({ token_hash: hash }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/paineis-tv");
    return { ok: true, token };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function alternarPainel(id: string, ativo: boolean): Promise<Ret> {
  try {
    await sessaoAcao({ admin: true });
    const db = await criarClienteServidor();
    const { error } = await db.from("paineis_tv").update({ ativo }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/paineis-tv");
    return { ok: true, mensagem: ativo ? "Painel ativado." : "Painel desativado: o link parou de funcionar." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
