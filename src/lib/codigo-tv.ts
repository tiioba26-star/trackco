import { createHmac } from "node:crypto";
import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Código de 4 dígitos que identifica cada pessoa na TV sem mostrar nome, foto ou iniciais.
 * Muda TODO DIA (ninguém decora o código da colega): a pessoa vê o código do dia no próprio Painel.
 * Sai de um HMAC (segredo do servidor + dia + id); colisões resolvidas pela ordem de cadastro.
 */
export function gerarCodigos(pessoas: { id: string; criado_em: string }[], dia: string, segredo = process.env.SUPABASE_SECRET_KEY ?? "trackco"): Map<string, string> {
  const usados = new Set<string>();
  const out = new Map<string, string>();
  const ordem = [...pessoas].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id));
  for (const p of ordem) {
    let n = 1000 + (parseInt(createHmac("sha256", segredo).update(`trackco-tv|${dia}|${p.id}`).digest("hex").slice(0, 8), 16) % 9000);
    while (usados.has(String(n))) n = n === 9999 ? 1000 : n + 1;
    usados.add(String(n));
    out.set(p.id, String(n));
  }
  return out;
}

/** Códigos do dia de todo mundo (inclui inativos, para ninguém "herdar" o código de outra pessoa). */
export async function codigosTv(dia: string): Promise<Map<string, string>> {
  const db = criarClienteAdmin();
  const { data } = await db.from("colaboradores").select("id, criado_em");
  return gerarCodigos((data ?? []) as { id: string; criado_em: string }[], dia);
}
