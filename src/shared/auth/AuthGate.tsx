import { type PropsWithChildren, useEffect, useState } from "react";
import { hasSupabaseConfig } from "../config/env";
import { currentSession } from "./session";

export function AuthGate({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      location.replace("/");
      return;
    }

    void currentSession()
      .then((session) => {
        if (!session) location.replace("/");
        else setReady(true);
      })
      .catch(() => location.replace("/"));
  }, []);

  if (!ready) {
    return <main className="login-page"><p className="glass loading-card">Comprobando acceso…</p></main>;
  }

  return <>{children}</>;
}
