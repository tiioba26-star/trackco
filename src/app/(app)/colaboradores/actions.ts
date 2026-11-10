"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RetornoAcao } from "@/components/app/form-acao";
import { sessaoAcao } from "@/lib/auth";
import { loginParaEmail } from "@/lib/env";
import { criarClienteAdmin } from "@/lib/supabase/admin";

const msg = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" · ") : (e as Error).message);
const LoginZ = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{2,40}$/, "Login: use letras minúsculas, números, ponto, hífen ou _ (2 a 40).");
const SenhaZ = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72);

/** Procura um usuário do Supabase Auth pelo e-mail (base pequena: percorre as páginas). */
async function authIdPorEmail(email: string): Promise<string | null> {
  const admin = criarClienteAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function criarColaborador(fd: FormData): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const v = z
      .object({
        nome: z.string().trim().min(3, "Informe o nome completo."),
        login: LoginZ,
        login_klingo: z.string().trim().max(60).optional(),
        papel: z.enum(["admin", "gestor", "colaborador"]),
        senha: z.string().optional(),
      })
      .parse(Object.fromEntries(fd));
    const admin = criarClienteAdmin();
    const email = loginParaEmail(v.login);

    let authId = await authIdPorEmail(email);
    let mensagem = "Colaborador vinculado ao login existente (mesma senha do relatório).";
    if (!authId) {
      const senha = SenhaZ.parse(v.senha ?? "");
      const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (error) throw new Error(error.message);
      authId = data.user.id;
      mensagem = "Colaborador criado. Passe o usuário e a senha inicial para a pessoa.";
    }
    const { error } = await admin.from("colaboradores").insert({
      auth_id: authId,
      nome: v.nome,
      login: v.login,
      login_klingo: v.login_klingo?.toLowerCase() || null,
      papel: v.papel,
    });
    if (error) {
      throw new Error(error.code === "23505" ? "Já existe colaborador com esse login, login do Klingo ou acesso." : error.message);
    }
    revalidatePath("/colaboradores");
    return { ok: true, mensagem };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function atualizarColaborador(id: string, fd: FormData): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ admin: true });
    const v = z
      .object({
        nome: z.string().trim().min(3),
        login_klingo: z.string().trim().max(60).optional(),
        papel: z.enum(["admin", "gestor", "colaborador"]),
        ativo: z.enum(["on"]).optional(),
      })
      .parse(Object.fromEntries(fd));
    if (id === s.colaborador.id && (v.papel !== "admin" || v.ativo !== "on")) {
      throw new Error("Você não pode tirar o próprio acesso de administrador.");
    }
    const admin = criarClienteAdmin();
    const { error } = await admin
      .from("colaboradores")
      .update({ nome: v.nome, login_klingo: v.login_klingo?.toLowerCase() || null, papel: v.papel, ativo: v.ativo === "on" })
      .eq("id", id);
    if (error) throw new Error(error.code === "23505" ? "Esse login do Klingo já está ligado a outra pessoa." : error.message);
    revalidatePath("/colaboradores");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export async function redefinirSenha(id: string, fd: FormData): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const senha = SenhaZ.parse(fd.get("senha"));
    const admin = criarClienteAdmin();
    const { data: c } = await admin.from("colaboradores").select("auth_id").eq("id", id).single();
    if (!c?.auth_id) throw new Error("Este colaborador não tem login vinculado.");
    const { error } = await admin.auth.admin.updateUserById(c.auth_id, { password: senha });
    if (error) throw new Error(error.message);
    return { ok: true, mensagem: "Senha redefinida (vale também para o sistema de relatórios)." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
