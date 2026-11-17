"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RetornoAcao } from "@/components/app/form-acao";
import { sessaoAcao } from "@/lib/auth";
import { loginParaEmail } from "@/lib/env";
import { cadastrarDoKlingo } from "@/lib/dados/cadastro-klingo";
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
        papel: z.enum(["admin", "gestor", "leitura", "colaborador"]),
        senha: z.string().optional(),
      })
      .parse(Object.fromEntries(fd));
    const admin = criarClienteAdmin();
    const email = loginParaEmail(v.login);

    let authId = await authIdPorEmail(email);
    let mensagem = "Colaborador cadastrado com o login que já existia (a senha continua a mesma).";
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
        papel: z.enum(["admin", "gestor", "leitura", "colaborador"]),
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

/** Data de nascimento: o administrador lança para qualquer pessoa; o líder, para quem está nas equipes que lidera. */
export async function salvarNascimento(id: string, fd: FormData): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ lider: true });
    const texto = String(fd.get("nascimento") ?? "").trim();
    const hoje = new Date().toISOString().slice(0, 10);
    if (texto && (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || texto < "1920-01-01" || texto > hoje)) {
      throw new Error("Informe uma data de nascimento válida.");
    }
    const admin = criarClienteAdmin();
    if (!s.vêTudo) {
      const { data } = await admin.from("equipe_membros").select("equipe_id, fim").eq("colaborador_id", id);
      const lidera = (data ?? []).some((m) => (!m.fim || String(m.fim) >= hoje) && s.lidera.includes(String(m.equipe_id)));
      if (!lidera) throw new Error("Você só pode lançar o aniversário de quem está na sua equipe.");
    }
    const { error } = await admin.from("colaboradores").update({ nascimento: texto || null }).eq("id", id);
    if (error) {
      throw new Error(/nascimento/.test(error.message) ? "Falta aplicar a migração de aniversários no banco (20261115000013)." : error.message);
    }
    revalidatePath("/colaboradores");
    return { ok: true, mensagem: texto ? "Aniversário salvo." : "Aniversário apagado." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Administrador redefine a de qualquer pessoa; o líder, só a dos colaboradores das equipes que lidera. */
export async function redefinirSenha(id: string, fd: FormData): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ lider: true });
    const senha = SenhaZ.parse(fd.get("senha"));
    const admin = criarClienteAdmin();
    const { data: c } = await admin.from("colaboradores").select("auth_id, papel").eq("id", id).single();
    if (!s.ehAdmin) {
      if (id === s.colaborador.id) throw new Error("Para trocar a sua própria senha, use “Trocar senha” no menu.");
      if (c?.papel !== "colaborador") throw new Error("Só um administrador pode redefinir a senha de gestores e administradores.");
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await admin.from("equipe_membros").select("equipe_id, fim").eq("colaborador_id", id);
      const lidera = (data ?? []).some((m) => (!m.fim || String(m.fim) >= hoje) && s.lidera.includes(String(m.equipe_id)));
      if (!lidera) throw new Error("Você só pode redefinir a senha de quem está na sua equipe.");
    }
    if (!c?.auth_id) throw new Error("Este colaborador não tem login vinculado.");
    const { error } = await admin.auth.admin.updateUserById(c.auth_id, { password: senha });
    if (error) throw new Error(error.message);
    return { ok: true, mensagem: "Senha redefinida. Passe a nova senha para a pessoa." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

const FALTA_MIGRACAO = "Falta aplicar no banco a migração 20261118000018_trackco_acesso.sql.";

/**
 * Liga ou desliga o ACESSO ao Trackco (o botão deslizante). Desligado, a pessoa só não entra no sistema:
 * continua nas equipes, nos relatórios, na Gestão e no ranking. Nada é apagado.
 */
export async function definirAcesso(id: string, ligar: boolean): Promise<RetornoAcao> {
  try {
    const s = await sessaoAcao({ admin: true });
    if (id === s.colaborador.id && !ligar) throw new Error("Você não pode tirar o seu próprio acesso.");
    const admin = criarClienteAdmin();
    if (ligar) {
      const { data: c } = await admin.from("colaboradores").select("auth_id").eq("id", id).single();
      if (!c?.auth_id) throw new Error("Essa pessoa ainda não tem usuário e senha: crie o acesso primeiro.");
    }
    const { error } = await admin.from("colaboradores").update({ acesso: ligar }).eq("id", id);
    if (error) throw new Error(/acesso/.test(error.message) ? FALTA_MIGRACAO : error.message);
    revalidatePath("/colaboradores");
    return { ok: true, mensagem: ligar ? "Acesso liberado." : "Acesso desligado. A pessoa continua nas equipes e nos relatórios." };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/**
 * Cria o acesso (usuário e senha) de quem ainda não entra no Trackco. `alvo` é o id do colaborador ou "klingo:<login>"
 * (pessoa só do Klingo: o cadastro é criado na hora). Se o usuário de acesso já existir, ele é aproveitado.
 */
export async function darAcesso(alvo: string, fd: FormData): Promise<RetornoAcao> {
  try {
    await sessaoAcao({ admin: true });
    const v = z
      .object({
        nome: z.string().trim().min(3, "Informe o nome completo."),
        login: LoginZ,
        papel: z.enum(["admin", "gestor", "leitura", "colaborador"]),
        senha: z.string().optional(),
      })
      .parse(Object.fromEntries(fd));
    const id = alvo.startsWith("klingo:") ? await cadastrarDoKlingo(alvo.slice("klingo:".length)) : z.string().uuid().parse(alvo);
    const admin = criarClienteAdmin();
    const email = loginParaEmail(v.login);
    let authId = await authIdPorEmail(email);
    let mensagem = "Acesso criado com o usuário que já existia (a senha continua a mesma).";
    if (!authId) {
      const senha = SenhaZ.parse(v.senha ?? "");
      const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (error) throw new Error(error.message);
      authId = data.user.id;
      mensagem = "Acesso criado. Passe o usuário e a senha inicial para a pessoa.";
    }
    const { error } = await admin
      .from("colaboradores")
      .update({ auth_id: authId, login: v.login, nome: v.nome, papel: v.papel, acesso: true })
      .eq("id", id);
    if (error) {
      if (/acesso/.test(error.message)) throw new Error(FALTA_MIGRACAO);
      throw new Error(error.code === "23505" ? "Esse usuário de acesso já pertence a outra pessoa." : error.message);
    }
    revalidatePath("/colaboradores");
    return { ok: true, mensagem };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}
