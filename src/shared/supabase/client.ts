import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "../config/env";
import type { Database } from "./database.types";

/**
 * Cliente tipado contra el esquema real (database.types.ts, generado con `npm run gen:types`).
 * Una columna o relación mal escrita en un `.select()` es un error de compilación.
 */
export type AppSupabaseClient = SupabaseClient<Database>;

let client: AppSupabaseClient | undefined;

export function getSupabase(): AppSupabaseClient {
  if (!hasSupabaseConfig) {
    throw new Error("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
  }

  client ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  return client;
}

/**
 * `null` para argumentos de RPC que la función SQL acepta nulos pero que el generador marca como
 * obligatorios (misma limitación que `supabase gen types`).
 */
export const SQL_NULL = null as unknown as never;
