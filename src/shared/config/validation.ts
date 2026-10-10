import { isSecretSupabaseKey } from "./secretKeys";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Una configuración de Supabase es válida si la URL es HTTPS, o HTTP apuntando a la
 * máquina local (Supabase CLI expone http://127.0.0.1:54321). Nunca HTTP a un host remoto.
 */
export function isSupabaseConfigValid(url: string, anonKey: string): boolean {
  if (anonKey.trim().length <= 20) return false;
  // Una clave secreta (service_role / sb_secret_) saltea RLS: en el navegador nunca es válida.
  if (isSecretSupabaseKey(anonKey)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  return parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
}

/** true si la URL apunta a la máquina local (Supabase CLI), nunca a un proyecto en la nube. */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url.trim()).hostname);
  } catch {
    return false;
  }
}
