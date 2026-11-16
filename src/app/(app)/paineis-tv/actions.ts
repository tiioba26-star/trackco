"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessaoAcao } from "@/lib/auth";
import { PERIODOS_RAPIDOS, type PeriodoRapido } from "@/engine/periodos";
import { BLOCOS_TV, gerarToken, hashToken, type ConfigTv, type ModoTv } from "@/lib/dados/tv";
import { cifrarLink, decifrarLink, tokenDoLink } from "@/lib/link-tv";
import { criarClienteAdmin } from "@/lib/supabase/admin";

type Ret = { ok: boolean; erro?: string; token?: string; mensagem?: string; semLink?: boolean };

/** Guarda o link cifrado para poder mostrar de novo (se a migração 14 ainda não foi aplicada, só não guarda). */
async function guardarCifrado(db: ReturnType<typeof criarClienteAdmin>, id: string, token: string) {
  await db.from("paineis_tv").update({ token_cifrado: cifrarLink(token) }).eq("id", id);
}
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
function lerModos(fd: FormData): { modos: ModoTv[]; periodos: PeriodoRapido[]; tempos: NonNullable<ConfigTv["tempos"]> } {
  const blocos = fd.getAll("blocos").map(String);
  const modos: ModoTv[] = BLOCOS_TV.filter((b) => blocos.includes(b.bloco)).map((b) => ({ tipo: "bloco", bloco: b.bloco }));
  if (!modos.length) throw new Error("Escolha pelo menos um tipo de tela.");
  const marcados = fd.getAll("periodos").map(String);
  const periodos = PERIODOS_RAPIDOS.filter((p) => marcados.includes(p));
  if (!periodos.length) throw new Error("Escolha pelo menos um período.");
  // tempo de cada tipo de tela (s); vazio = padrão do tipo
  const tempos: NonNullable<ConfigTv["tempos"]> = {};
  for (const b of BLOCOS_TV) {
    const v = fd.get(`tempo_${b.bloco}`);
    if (v === null || v === "") continue;
    tempos[b.bloco] = z.coerce.number().int().min(5, "Cada tela fica pelo menos 5 segundos.").max(300, "Cada tela fica no máximo 300 segundos.").parse(v);
  }
  return { modos, periodos, tempos };
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
    const { modos, periodos, tempos } = lerModos(fd);

    const frases_rodape = extrairLinhas(fd.get("frases_rodape"));
    const subtitulos = extrairLinhas(fd.get("subtitulos"));
    const meta_batida = extrairLinhas(fd.get("msg_meta_batida"));
    const quase_la = extrairLinhas(fd.get("msg_quase_la"));
    const evoluindo = extrairLinhas(fd.get("msg_evoluindo"));

    const config: ConfigTv = {
      versao: 4,
      intervalo,
      tempos,
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
    const { data: novo } = await db.from("paineis_tv").select("id").eq("token_hash", hash).maybeSingle();
    if (novo) await guardarCifrado(db, String(novo.id), token);
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
    const { modos, periodos, tempos } = lerModos(fd);

    const frases_rodape = extrairLinhas(fd.get("frases_rodape"));
    const subtitulos = extrairLinhas(fd.get("subtitulos"));
    const meta_batida = extrairLinhas(fd.get("msg_meta_batida"));
    const quase_la = extrairLinhas(fd.get("msg_quase_la"));
    const evoluindo = extrairLinhas(fd.get("msg_evoluindo"));

    const config: ConfigTv = {
      versao: 4,
      intervalo,
      tempos,
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
    await guardarCifrado(db, id, token);
    revalidatePath("/paineis-tv");
    return { ok: true, token };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Mostra o link atual do painel, sem trocar (a TV continua funcionando). */
export async function verLinkPainel(id: string): Promise<Ret> {
  try {
    await sessaoAcao({ lider: true });
    const db = criarClienteAdmin();
    const { data, error } = await db.from("paineis_tv").select("token_hash, token_cifrado").eq("id", id).maybeSingle();
    if (error) {
      if (/token_cifrado/.test(error.message)) throw new Error("Falta aplicar no banco a migração 20261116000014 (link da TV).");
      throw new Error(error.message);
    }
    const token = data?.token_cifrado ? decifrarLink(String(data.token_cifrado)) : null;
    if (!token || hashToken(token) !== data?.token_hash) return { ok: false, semLink: true };
    return { ok: true, token };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/**
 * Para painéis criados antes de o link ser guardado: a pessoa cola o link que está na TV, o sistema
 * confere que é o link certo deste painel e passa a guardá-lo. Nada muda na TV.
 */
export async function guardarLinkAtual(id: string, fd: FormData): Promise<Ret> {
  try {
    await sessaoAcao({ lider: true });
    const token = tokenDoLink(String(fd.get("link") ?? ""));
    if (!token) throw new Error("Cole o link inteiro da TV (https://…/tv/…).");
    const db = criarClienteAdmin();
    const { data } = await db.from("paineis_tv").select("token_hash").eq("id", id).maybeSingle();
    if (!data || hashToken(token) !== data.token_hash) throw new Error("Esse não é o link atual deste painel.");
    const { error } = await db.from("paineis_tv").update({ token_cifrado: cifrarLink(token) }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true, token, mensagem: "Link guardado. Agora ele pode ser visto sempre aqui." };
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
