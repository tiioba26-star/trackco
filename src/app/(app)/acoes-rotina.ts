"use server";

import { z } from "zod";
import { sessaoAcao } from "@/lib/auth";
import { criarClienteServidor } from "@/lib/supabase/server";

const Entrada = z.object({
  chaves: z.array(z.string().min(1).max(200)).min(1).max(20),
  resultado: z.enum(["confirmado", "sem_contato"]).nullable(),
});

/** Marca (ou desmarca) a confirmação das consultas de um paciente. A função do banco confere se a consulta é de quem marca. */
export async function marcarConfirmacao(chaves: string[], resultado: "confirmado" | "sem_contato" | null): Promise<{ ok: boolean; erro?: string }> {
  try {
    await sessaoAcao();
    const e = Entrada.parse({ chaves, resultado });
    const db = await criarClienteServidor();
    for (const chave of e.chaves) {
      const { error } = await db.rpc("marcar_confirmacao", { p_chave: chave, p_resultado: e.resultado });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
