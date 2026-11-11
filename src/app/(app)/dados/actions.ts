"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RetornoAcao } from "@/components/app/form-acao";
import { competenciaDe } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { recalcularParcial, recalcularRecentes } from "@/lib/calculo/recalcular";
import { criarClienteServidor } from "@/lib/supabase/server";

const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);

export async function recalcularAgora(): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const r = await recalcularRecentes();
    revalidatePath("/", "layout");
    const pessoas = r.flatMap((x) => x.equipes).reduce((s, e) => s + e.pessoas, 0);
    return { ok: true, mensagem: `Recalculado: ${pessoas} apuração(ões) no mês atual e no anterior.` };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

const LancZ = z.object({
  colaborador_id: z.string().uuid("Escolha a pessoa."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  tipo: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{2,40}$/, "Tipo: letras minúsculas, números e _ (ex.: avaliacao_lider)."),
  valor: z.coerce.number().finite(),
  descricao: z.string().max(300).optional(),
});

async function recalcularEquipesDe(colaboradores: string[], competencias: string[]) {
  const db = await criarClienteServidor();
  const { data } = await db.from("equipe_membros").select("equipe_id").in("colaborador_id", colaboradores);
  const equipes = Array.from(new Set((data ?? []).map((d) => d.equipe_id as string)));
  for (const c of new Set(competencias)) await recalcularParcial(c, equipes);
}

export async function lancar(fd: FormData): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ lider: true });
    const v = LancZ.parse(Object.fromEntries(fd));
    const db = await criarClienteServidor();
    const { error } = await db.from("lancamentos").insert({ ...v, descricao: v.descricao || null, criado_por: s.colaborador.id });
    if (error) throw new Error(error.message.includes("row-level") ? "Sem permissão para lançar para essa pessoa." : error.message);
    await recalcularEquipesDe([v.colaborador_id], [competenciaDe(v.data)]);
    revalidatePath("/dados");
    return { ok: true, mensagem: "Lançamento registrado." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Importa linhas "login;data;tipo;valor;descricao" (data em AAAA-MM-DD ou DD/MM/AAAA). */
export async function importarCsv(fd: FormData): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ admin: true });
    const texto = String(fd.get("csv") ?? "").trim();
    if (!texto) throw new Error("Cole as linhas do CSV.");
    const db = await criarClienteServidor();
    const { data: colabs } = await db.from("colaboradores").select("id, login, login_klingo");
    const porLogin = new Map<string, string>();
    for (const c of colabs ?? []) {
      if (c.login) porLogin.set(c.login.toLowerCase(), c.id);
      if (c.login_klingo) porLogin.set(c.login_klingo.toLowerCase(), c.id);
    }
    const linhas = texto.split(/\r?\n/).filter((l) => l.trim() && !/^login\s*[;,]/i.test(l));
    const registros = linhas.map((l, i) => {
      const [login, dataBr, tipo, valor, descricao] = l.split(/[;\t]/).map((x) => x?.trim() ?? "");
      const colaborador_id = porLogin.get(login.toLowerCase());
      if (!colaborador_id) throw new Error(`Linha ${i + 1}: login "${login}" não encontrado.`);
      const data = /^\d{2}\/\d{2}\/\d{4}$/.test(dataBr) ? dataBr.split("/").reverse().join("-") : dataBr;
      return { ...LancZ.parse({ colaborador_id, data, tipo, valor: valor.replace(",", "."), descricao }), criado_por: s.colaborador.id };
    });
    const { error } = await db.from("lancamentos").insert(registros);
    if (error) throw new Error(error.message);
    await recalcularEquipesDe(
      Array.from(new Set(registros.map((r) => r.colaborador_id))),
      registros.map((r) => competenciaDe(r.data)),
    );
    revalidatePath("/dados");
    return { ok: true, mensagem: `${registros.length} lançamento(s) importado(s).` };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function excluirLancamento(id: string): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ lider: true });
    const db = await criarClienteServidor();
    const { data, error } = await db.from("lancamentos").delete().eq("id", id).select("colaborador_id, data").single();
    if (error) throw new Error(error.message);
    await recalcularEquipesDe([data.colaborador_id], [competenciaDe(data.data)]);
    revalidatePath("/dados");
    return { ok: true, mensagem: "Lançamento excluído." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Recalcula um único mês (a tela chama mês a mês para não estourar o tempo da Vercel). */
export async function recalcularMes(competencia: string): Promise<RetornoAcao & { pessoas?: number }> {
  try {
    await sessaoAcao({ admin: true });
    if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Mês inválido.");
    const r = await recalcularParcial(competencia);
    return { ok: true, pessoas: r.equipes.reduce((s, e) => s + e.pessoas, 0) };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
