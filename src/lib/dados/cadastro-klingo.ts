import "server-only";
import { titulo } from "@/engine/classificacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Garante que a pessoa do Klingo tenha cadastro no Trackco (sem login: não entra no sistema, mas pode estar em equipes,
 * relatórios, Gestão e ranking). Devolve o id do colaborador; se já existir alguém com esse login do Klingo, usa ele.
 * Só chamar depois de conferir que quem pediu é administrador.
 */
export async function cadastrarDoKlingo(loginKlingo: string): Promise<string> {
  const login = loginKlingo.trim().toLowerCase();
  if (!login) throw new Error("Login do Klingo vazio.");
  const db = criarClienteAdmin();
  const { data: existe } = await db.from("colaboradores").select("id").ilike("login_klingo", login).maybeSingle();
  if (existe) return existe.id as string;
  const { data: ku } = await db.from("klingo_usuarios").select("nome").eq("login", login).maybeSingle();
  if (!ku) throw new Error("Esse usuário não está na lista do Klingo.");
  const { data, error } = await db
    .from("colaboradores")
    .insert({ nome: titulo(String(ku.nome)), login_klingo: login, papel: "colaborador" })
    .select("id")
    .single();
  if (error) throw new Error(error.code === "23505" ? "Essa pessoa do Klingo já tem cadastro." : error.message);
  return data.id as string;
}
