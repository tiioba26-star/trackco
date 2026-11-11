"use server";

import { redirect } from "next/navigation";
import { loginParaEmail } from "@/lib/env";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro?: string;
}

function destinoSeguro(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  // só caminhos internos (evita open redirect)
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const usuario = String(form.get("usuario") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!usuario || !senha) return { erro: "Informe usuário e senha." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginParaEmail(usuario), password: senha });
  if (error || !data.user) {
    await new Promise((r) => setTimeout(r, 500)); // mesmo atraso do relatorio contra tentativa e erro
    return { erro: "Usuário ou senha inválidos." };
  }

  const { data: colab, error: erroColab } = await supabase
    .from("colaboradores")
    .select("id, ativo")
    .eq("auth_id", data.user.id)
    .maybeSingle();
  if (erroColab) {
    // senha certa, mas o banco do Trackco não respondeu (ex.: schema "trackco" não exposto na Data API, migrations pendentes)
    console.error("[login] falha ao consultar trackco.colaboradores:", erroColab.code, erroColab.message);
    await supabase.auth.signOut();
    return {
      erro: `Usuário e senha conferem, mas o banco do Trackco ainda não está configurado (${erroColab.code ?? "erro"}). Avise o administrador.`,
    };
  }
  if (!colab || !colab.ativo) {
    await supabase.auth.signOut();
    return { erro: "Seu usuário ainda não tem acesso ao Trackco. Fale com o administrador." };
  }
  redirect(destinoSeguro(form.get("next")));
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
