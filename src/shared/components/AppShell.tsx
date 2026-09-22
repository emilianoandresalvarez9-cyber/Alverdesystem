import type { PropsWithChildren } from "react";
import { AuthGate } from "../auth/AuthGate";
import { signOut } from "../auth/session";

type AppShellProps = PropsWithChildren<{
  active: "catalog" | "admin";
  title: string;
}>;

export function AppShell({ active, title, children }: AppShellProps) {
  return (
    <AuthGate>
      <main className="app-shell">
        <header className="topbar glass">
          <a className="brand" href="/catalog.html" aria-label="Alverde, catálogo">
            <span className="brand-mark">A</span>
            <span>Alverde</span>
          </a>
          <nav aria-label="Navegación principal">
            <a className={active === "catalog" ? "active" : ""} href="/catalog.html">Catálogo</a>
            <a className={active === "admin" ? "active" : ""} href="/admin.html">Administración</a>
          </nav>
          <button className="button button-secondary" onClick={() => void signOut().then(() => location.assign("/"))}>
            Salir
          </button>
        </header>
        <section className="page-heading">
          <p className="eyebrow">Alverde · sistema de gestión</p>
          <h1>{title}</h1>
        </section>
        {children}
      </main>
    </AuthGate>
  );
}
