// Controle remoto da TV: o celular/PC e a TV conversam por um canal do Supabase Realtime (Broadcast,
// WebSocket). Medido neste projeto: ~150 ms ida e volta (~75 ms de um lado ao outro).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type ComandoTv = { acao: "anterior" | "proxima" | "alternar" } | { acao: "ir"; indice: number };

export interface EstadoTv {
  atual: number;
  total: number;
  pausado: boolean;
  titulo: string;
  periodo: string | null;
  telas: string[];
}

let cliente: SupabaseClient | null = null;

/** Cliente só para o Realtime, no navegador (a TV não tem login; o canal é secreto). */
export function clienteRealtime(): SupabaseClient {
  if (!cliente)
    cliente = createClient(env.supabaseUrl(), env.supabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  return cliente;
}
