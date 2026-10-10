import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import { hasSupabaseConfig } from "../config/env";
import { currentProfile, currentSession, readLastProfile, storeLastProfile } from "./session";
import { canAccess, homeFor, type AppRole, type Profile } from "./roles";

/** Exportado para que los tests rendericen el shell sin pasar por Supabase. */
export const ProfileContext = createContext<Profile | null>(null);

/** Perfil del usuario dentro de una página protegida por AuthGate. */
export function useCurrentProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("useCurrentProfile se usa dentro de <AuthGate>.");
  return profile;
}

type AuthGateProps = PropsWithChildren<{ requiredRole?: AppRole }>;

/**
 * Perfil para el primer cuadro: el último verificado en este equipo, si alcanza para esta
 * página. Así la página nueva ya muestra el marco y la transición entre páginas (RNF-08)
 * no pasa por «Comprobando acceso…». No da acceso a datos (RLS) y se verifica enseguida.
 */
export function optimisticProfile(requiredRole?: AppRole, last: Profile | null = readLastProfile()): Profile | null {
  return last && last.active && canAccess(last.role, requiredRole) ? last : null;
}

export function AuthGate({ requiredRole, children }: AuthGateProps) {
  const [profile, setProfile] = useState<Profile | null>(() => optimisticProfile(requiredRole));

  useEffect(() => {
    const leave = (to: string) => { storeLastProfile(null); location.replace(to); };
    if (!hasSupabaseConfig) {
      leave("/");
      return;
    }

    void currentSession()
      .then(async (session) => {
        if (!session) return leave("/");
        const found = await currentProfile(session);
        if (!found.active) return leave("/");
        storeLastProfile(found);
        if (!canAccess(found.role, requiredRole)) return location.replace(homeFor(found.role));
        setProfile((shown) => (shown && shown.id === found.id && shown.role === found.role ? shown : found));
      })
      .catch(() => leave("/"));
  }, [requiredRole]);

  if (!profile) {
    return <main className="login-page"><p className="glass loading-card">Comprobando acceso…</p></main>;
  }

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}
