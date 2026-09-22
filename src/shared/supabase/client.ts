import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "../config/env";

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!hasSupabaseConfig) {
    throw new Error("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
  }

  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  return client;
}
