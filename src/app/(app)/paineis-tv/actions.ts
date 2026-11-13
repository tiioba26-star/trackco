"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessaoAcao } from "@/lib/auth";
import { PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";
import { BLOCOS_TV, gerarToken, type ConfigTv, type ModoTv } from "@/lib/dados/tv";
import { criarClienteAdmin } from "@/lib/supabase/admin";

type Ret = { ok: boolean; erro?: string; token?: string; mensagem?: string };
const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

function extrairLinhas(valor: FormDataEntryValue | null): string[] | undefined {
  if (!valor || typeof valor !== "string") return undefined;
  const linhas = valor
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return linhas.length ? linhas : undefined;
}

/** Blocos e períodos marcados no formulário, na ordem da tela. */
function lerModos(fd: FormData): { modos: ModoTv[]; periodos: PeriodoRapido[] } {
  const blocos = fd.getAll("blocos").map(String);
  const modos: ModoTv[] = BLOCOS_TV.filter((b) => blocos.includes(b.bloco)).map((b) => ({ tipo: "bloco", bloco: b.bloco }));
  if (!modos.length) throw new Error("Escolha pelo menos um tipo de tela.");
  const marcados = fd.getAll("periodos").map(String);
  const periodos = PERIODOS_RAPIDOS.filter((p) => marcados.includes(p));
  if (!periodos.length) throw new Error("Escolha pelo menos um período.");
  return { modos, periodos };
}

export async function criarPainel(fd: FormData): Promise<Ret> {
  try {
    const s = await sessaoAcao({ lider: true });
    const nome = z.string().trim().min(2, "Dê um nome ao painel.").parse(fd.get("nome"));
    const equipes = fd.getAll("equipes").map(String);
    if (!equipes.length) throw new Error("Escolha pelo menos uma equipe.");
    const intervalo = z.coerce.number().int().min(10).max(300).parse(fd.get("intervalo") ?? 30);
    const feliz = z.coerce.number().min(0).max(500).parse(fd.get("feliz") ?? 80);
    const mega = z.coerce.number().min(0).max(500).parse(fd.get("mega_feliz") ?? 100);
    if (mega < feliz) throw new Error("O limite de 'mega feliz' deve ser maior que o de 'feliz'.");
    const { modos, periodos } = lerModos(fd);

    const frases_rodape = extrairLinhas(fd.get("frases_rodape"));
    const subtitulos = extrairLinhas(fd.get("subtitulos"));
    const meta_batida = extrairLinhas(fd.get("msg_meta_batida"));
    const quase_la = extrairLinhas(fd.get("msg_quase_la"));
    const evoluindo = extrairLinhas(fd.get("msg_evoluindo"));

    const config: ConfigTv = {
      versao: 2,
      intervalo,
      modos,
      periodos,
      limites: { feliz, mega_feliz: mega },
      ...(frases_rodape ? { frases_rodape } : {}),
      ...(subtitulos ? { subtitulos } : {}),
      ...(meta_batida || quase_la || evoluindo
        ? {
            mensagens_barra: {
              ...(meta_batida ? { meta_batida } : {}),
              ...(quase_la ? { quase_la } : {}),
              ...(evoluindo ? { evoluindo } : {}),
            },
          }
        : {}),
    };

    const { token, hash } = gerarToken();
    const db = criarClienteAdmin();
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

export async function atualizarPainel(id: string, fd: FormData): Promise<Ret> {
  try {
    await sessaoAcao({ lider: true });
    const nome = z.string().trim().min(2, "Dê um nome ao painel.").parse(fd.get("nome"));
    const equipes = fd.getAll("equipes").map(String);
    if (!equipes.length) throw new Error("Escolha pelo menos uma equipe.");
    const intervalo = z.coerce.number().int().min(10).max(300).parse(fd.get("intervalo") ?? 30);
    const feliz = z.coerce.number().min(0).max(500).parse(fd.get("feliz") ?? 80);
    const mega = z.coerce.number().min(0).max(500).parse(fd.get("mega_feliz") ?? 100);
    if (mega < feliz) throw new Error("O limite de 'mega feliz' deve ser maior que o de 'feliz'.");
    const { modos, periodos } = lerModos(fd);

    const frases_rodape = extrairLinhas(fd.get("frases_rodape"));
    const subtitulos = extrairLinhas(fd.get("subtitulos"));
    const meta_batida = extrairLinhas(fd.get("msg_meta_batida"));
    const quase_la = extrairLinhas(fd.get("msg_quase_la"));
    const evoluindo = extrairLinhas(fd.get("msg_evoluindo"));

    const config: ConfigTv = {
      versao: 2,
      intervalo,
      modos,
      periodos,
      limites: { feliz, mega_feliz: mega },
      ...(frases_rodape ? { frases_rodape } : {}),
      ...(subtitulos ? { subtitulos } : {}),
      ...(meta_batida || quase_la || evoluindo
        ? {
            mensagens_barra: {
              ...(meta_batida ? { meta_batida } : {}),
              ...(quase_la ? { quase_la } : {}),
              ...(evoluindo ? { evoluindo } : {}),
            },
          }
        : {}),
    };

    const db = criarClienteAdmin();
    const { error } = await db
      .from("paineis_tv")
      .update({ nome, equipes, config })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/paineis-tv");
    return { ok: true, mensagem: "Painel atualizado com sucesso." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function regenerarToken(id: string): Promise<Ret> {
  try {
    await sessaoAcao({ lider: true });
    const { token, hash } = gerarToken();
    const db = criarClienteAdmin();
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
    await sessaoAcao({ lider: true });
    const db = criarClienteAdmin();
    const { error } = await db.from("paineis_tv").update({ ativo }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/paineis-tv");
    return { ok: true, mensagem: ativo ? "Painel ativado." : "Painel desativado: o link parou de funcionar." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function excluirPainel(id: string): Promise<Ret> {
  try {
    const s = await sessaoAcao({ lider: true });
    const db = criarClienteAdmin();
    const { data: painel } = await db.from("paineis_tv").select("equipes").eq("id", id).maybeSingle();
    if (!painel) throw new Error("Painel não encontrado.");
    // líder só exclui painéis das equipes que lidera
    if (!s.vêTudo && !(painel.equipes as string[]).every((e) => s.lidera.includes(e)))
      throw new Error("Você só pode excluir painéis das equipes que lidera.");
    const { error } = await db.from("paineis_tv").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/paineis-tv");
    return { ok: true, mensagem: "Painel excluído: o link parou de funcionar." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
