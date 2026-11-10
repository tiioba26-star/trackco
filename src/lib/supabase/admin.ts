import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente com a secret key (ignora RLS). Só no servidor, e só depois de checar a permissão
 * de quem pediu (requireAdmin etc.). Usado no cálculo, no modo TV e na gestão de logins.
 */
export function criarClienteAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    db: { schema: "trackco" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
