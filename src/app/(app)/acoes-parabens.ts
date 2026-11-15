"use server";

import { hojeNoFuso } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { type Parabens, marcarParabensVistos, meusParabens, previaDosParabens } from "@/lib/dados/aniversarios";

/** A pessoa viu (ou fechou) os parabéns: não abrem de novo neste aniversário. */
export async function marcarParabensVisto(): Promise<{ ok: boolean }> {
  try {
    const s = await sessaoAcao();
    await marcarParabensVistos(s, hojeNoFuso());
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

type Resposta = { ok: boolean; dados?: Parabens | null; erro?: string };

/** Os parabéns do último aniversário de quem está logado (pode rever quantas vezes quiser). */
export async function verMeusParabens(): Promise<Resposta> {
  try {
    const s = await sessaoAcao();
    const dados = await meusParabens(s, hojeNoFuso());
    return dados ? { ok: true, dados } : { ok: false, erro: "Sua data de aniversário ainda não foi cadastrada. Peça ao seu líder." };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Prévia de como a pessoa vai ver os parabéns no próximo aniversário (administrador, gestor ou líder dela). */
export async function verPreviaDosParabens(id: string): Promise<Resposta> {
  try {
    const s = await sessaoAcao({ lider: true });
    const dados = await previaDosParabens(s, id, hojeNoFuso());
    return dados ? { ok: true, dados } : { ok: false, erro: "Cadastre a data de nascimento para ver a prévia." };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
