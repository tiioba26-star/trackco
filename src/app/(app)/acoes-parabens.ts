"use server";

import { hojeNoFuso } from "@/engine/datas";
import { sessaoAcao } from "@/lib/auth";
import { marcarParabensVistos } from "@/lib/dados/aniversarios";

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
