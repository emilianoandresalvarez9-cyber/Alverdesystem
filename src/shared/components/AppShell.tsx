import type { PropsWithChildren } from "react";
import { AuthGate, useCurrentProfile } from "../auth/AuthGate";
import { signOut } from "../auth/session";
import type { AppRole } from "../auth/roles";

export type ShellSection = "catalog" | "pos" | "admin";

type AppShellProps = PropsWithChildren<{
  active: ShellSection;
  title: string;
  /** Rol mínimo para ver la página. Sin valor: cualquier usuario logueado. */
  requiredRole?: AppRole;
}>;

export function AppShell({ active, title, requiredRole, children }: AppShellProps) {
  return (
    <AuthGate requiredRole={requiredRole}>
      <ShellLayout active={active} title={title}>{children}</ShellLayout>
    </AuthGate>
  );
}

function ShellLayout({ active, title, children }: PropsWithChildren<{ active: ShellSection; title: string }>) {
  const profile = useCurrentProfile();
  const isAdmin = profile.role === "administrator";

  return (
    <main className="app-shell">
      <header className="topbar glass">
        <a className="brand" href="/catalog.html" aria-label="Alverde, catálogo">
          <span className="brand-mark">A</span>
          <span>Alverde</span>
        </a>
        <nav aria-label="Navegación principal">
          <a className={active === "catalog" ? "active" : ""} href="/catalog.html">Catálogo</a>
          <a className={active === "pos" ? "active" : ""} href="/pos.html">Caja</a>
          {isAdmin && <a className={active === "admin" ? "active" : ""} href="/admin.html">Administración</a>}
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
  );
}
