"use server";

import { sessaoAcao } from "@/lib/auth";
import { loginParaEmail } from "@/lib/env";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function trocarSenha(fd: FormData): Promise<{ ok: boolean; erro?: string }> {
  try {
    const s = await sessaoAcao();
    const atual = String(fd.get("atual") ?? "");
    const nova = String(fd.get("nova") ?? "");
    if (nova.length < 8 || nova.length > 72) throw new Error("A nova senha deve ter de 8 a 72 caracteres.");
    if (nova !== String(fd.get("confirmacao") ?? "")) throw new Error("A confirmação não confere.");
    if (nova === atual) throw new Error("A nova senha deve ser diferente da atual.");
    if (!s.colaborador.login) throw new Error("Seu cadastro não tem usuário de acesso.");
    const db = await criarClienteServidor();
    // confere a senha atual antes de trocar
    const { error: e1 } = await db.auth.signInWithPassword({ email: loginParaEmail(s.colaborador.login), password: atual });
    if (e1) throw new Error("Senha atual incorreta.");
    const { error } = await db.auth.updateUser({ password: nova });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
