import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";
import { hasSupabaseConfig } from "../config/env";
import { currentProfile, currentSession } from "./session";
import { canAccess, homeFor, type AppRole, type Profile } from "./roles";

const ProfileContext = createContext<Profile | null>(null);

/** Perfil del usuario dentro de una página protegida por AuthGate. */
export function useCurrentProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("useCurrentProfile se usa dentro de <AuthGate>.");
  return profile;
}

type AuthGateProps = PropsWithChildren<{ requiredRole?: AppRole }>;

export function AuthGate({ requiredRole, children }: AuthGateProps) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      location.replace("/");
      return;
    }

    void currentSession()
      .then(async (session) => {
        if (!session) return location.replace("/");
        const found = await currentProfile(session);
        if (!found.active) return location.replace("/");
        if (!canAccess(found.role, requiredRole)) return location.replace(homeFor(found.role));
        setProfile(found);
      })
      .catch(() => location.replace("/"));
  }, [requiredRole]);

  if (!profile) {
    return <main className="login-page"><p className="glass loading-card">Comprobando acceso…</p></main>;
  }

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}
