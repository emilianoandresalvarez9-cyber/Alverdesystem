import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../supabase/client";
import { parseRole, type Profile } from "./roles";

const PROFILE_CACHE_PREFIX = "alverde.profile.";

export async function currentSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const session = await currentSession().catch(() => null);
  if (session) localStorage.removeItem(PROFILE_CACHE_PREFIX + session.user.id);
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

/**
 * Perfil del usuario logueado. Filtra por id: un administrador puede leer todos los perfiles
 * por RLS, así que `.single()` sin filtro fallaba en cuanto había dos usuarios.
 * Sin conexión usa la última copia conocida; el control real de permisos sigue siendo RLS.
 */
export async function currentProfile(session: Session): Promise<Profile> {
  const cacheKey = PROFILE_CACHE_PREFIX + session.user.id;
  try {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("id, role, active")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ProfileMissingError();
    const profile: Profile = { id: data.id, role: parseRole(data.role), active: Boolean(data.active) };
    localStorage.setItem(cacheKey, JSON.stringify(profile));
    return profile;
  } catch (error) {
    if (error instanceof ProfileMissingError) throw error;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as Partial<Profile>;
      return { id: session.user.id, role: parseRole(parsed.role), active: parsed.active !== false };
    }
    return { id: session.user.id, role: "employee", active: true };
  }
}

export class ProfileMissingError extends Error {
  constructor() {
    super("Tu usuario no tiene perfil en Alverde. Pedile a la administradora que lo cree.");
  }
}
