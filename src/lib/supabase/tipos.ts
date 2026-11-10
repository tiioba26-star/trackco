import type { SupabaseClient } from "@supabase/supabase-js";

/** Qualquer cliente Supabase do Trackco (usuário via RLS ou admin), já apontado para o schema trackco. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;
