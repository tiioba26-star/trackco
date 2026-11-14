import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hojeNoFuso } from "@/engine/datas";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Papel = "admin" | "gestor" | "colaborador";

export interface EquipeDoUsuario {
  equipe_id: string;
  nome: string;
  funcao: "lider" | "membro";
}

export interface Sessao {
  authId: string;
  colaborador: {
    id: string;
    nome: string;
    login: string | null;
    login_klingo: string | null;
    papel: Papel;
  };
  equipes: EquipeDoUsuario[];
  /** equipes que o usuário lidera hoje */
  lidera: string[];
  ehAdmin: boolean;
  /** admin ou gestor: vê tudo */
  vêTudo: boolean;
}

/** `sub` (id do usuário) de um token do Supabase, sem conferir a assinatura (quem confere é o banco, ver abaixo). */
function idDoToken(token: string | undefined): string | null {
  try {
    const corpo = token?.split(".")[1];
    if (!corpo) return null;
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    if (typeof dados.sub !== "string") return null;
    if (typeof dados.exp === "number" && dados.exp * 1000 < Date.now()) return null;
    return dados.sub;
  } catch {
    return null;
  }
}

/**
 * Sessão do usuário (memoizada por request). null = não logado ou sem cadastro ativo no Trackco.
 *
 * Rápida de propósito: lê o token do cookie (sem ida ao servidor de login) e faz UMA consulta.
 * É segura porque a consulta passa pelo banco com o token do usuário: o banco confere a assinatura e a validade
 * em toda requisição (RLS). Token falso ou vencido → o banco recusa → nenhuma linha → sem sessão.
 */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authId = idDoToken(session?.access_token);
  if (!authId) return null;

  const { data: colab } = await supabase
    .from("colaboradores")
    .select("id, nome, login, login_klingo, papel, ativo, equipe_membros(equipe_id, funcao, fim, equipes(nome))")
    .eq("auth_id", authId)
    .maybeSingle();
  if (!colab || !colab.ativo) return null;

  const hoje = hojeNoFuso();
  type Vinculo = { equipe_id: string; funcao: "lider" | "membro"; fim: string | null; equipes: { nome: string } | null };
  const vinculos = ((colab.equipe_membros ?? []) as unknown as Vinculo[]).filter((v) => !v.fim || v.fim >= hoje);
  const equipes: EquipeDoUsuario[] = vinculos.map((v) => ({
    equipe_id: v.equipe_id,
    funcao: v.funcao,
    nome: v.equipes?.nome ?? "",
  }));
  const papel = colab.papel as Papel;
  return {
    authId,
    colaborador: {
      id: colab.id,
      nome: colab.nome,
      login: colab.login,
      login_klingo: colab.login_klingo,
      papel,
    },
    equipes,
    lidera: equipes.filter((e) => e.funcao === "lider").map((e) => e.equipe_id),
    ehAdmin: papel === "admin",
    vêTudo: papel === "admin" || papel === "gestor",
  };
});

export async function exigirSessao(): Promise<Sessao> {
  const s = await obterSessao();
  if (!s) redirect("/login?erro=sem-acesso");
  return s;
}

export async function exigirAdmin(): Promise<Sessao> {
  const s = await exigirSessao();
  if (!s.ehAdmin) redirect("/?erro=restrito");
  return s;
}

/** Admin, gestor ou líder de alguma equipe. */
export async function exigirGestaoOuLider(): Promise<Sessao> {
  const s = await exigirSessao();
  if (!s.vêTudo && s.lidera.length === 0) redirect("/?erro=restrito");
  return s;
}

/** Para Server Actions: lança erro em vez de redirecionar. */
export async function sessaoAcao(opcoes: { admin?: boolean; lider?: boolean } = {}): Promise<Sessao> {
  const s = await obterSessao();
  if (!s) throw new Error("Sessão expirada. Entre novamente.");
  if (opcoes.admin && !s.ehAdmin) throw new Error("Apenas administradores podem fazer isso.");
  if (opcoes.lider && !s.vêTudo && s.lidera.length === 0) throw new Error("Apenas líderes e gestores podem fazer isso.");
  return s;
}

export function podeVerColaborador(s: Sessao, colaboradorId: string, equipesDoColaborador: string[]): boolean {
  return (
    s.vêTudo ||
    s.colaborador.id === colaboradorId ||
    equipesDoColaborador.some((e) => s.lidera.includes(e))
  );
}
