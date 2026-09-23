const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Una configuración de Supabase es válida si la URL es HTTPS, o HTTP apuntando a la
 * máquina local (Supabase CLI expone http://127.0.0.1:54321). Nunca HTTP a un host remoto.
 */
export function isSupabaseConfigValid(url: string, anonKey: string): boolean {
  if (anonKey.trim().length <= 20) return false;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  return parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
}
