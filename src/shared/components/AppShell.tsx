import type { PropsWithChildren } from "react";
import { AuthGate, useCurrentProfile } from "../auth/AuthGate";
import { signOut } from "../auth/session";
import type { AppRole } from "../auth/roles";
import { ThemeToggle } from "../theme/ThemeToggle";

export type ShellSection = "catalog" | "pos" | "customers" | "stock" | "admin";

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
      <header className="topbar glass" style={{ viewTransitionName: "app-header" }}>
        <a className="brand" href="/catalog.html" aria-label="Alverde, catálogo">
          <span className="brand-mark">A</span>
          <span>Alverde</span>
        </a>
        <nav aria-label="Navegación principal" style={{ viewTransitionName: "app-nav" }}>
          <a className={active === "catalog" ? "active" : ""} href="/catalog.html">Catálogo</a>
          <a className={active === "pos" ? "active" : ""} href="/pos.html">Caja</a>
          <a className={active === "customers" ? "active" : ""} href="/customers.html">Clientes</a>
          <a className={active === "stock" ? "active" : ""} href="/stock.html">Stock</a>
          {isAdmin && <a className={active === "admin" ? "active" : ""} href="/admin.html">Administración</a>}
        </nav>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <ThemeToggle />
          <button className="button button-secondary" onClick={() => void signOut().then(() => location.assign("/"))}>
            Salir
          </button>
        </div>
      </header>
      <section className="page-heading" style={{ viewTransitionName: "app-title" }}>
        <p className="eyebrow">Alverde · sistema de gestión</p>
        <h1>{title}</h1>
      </section>
      <div style={{ viewTransitionName: "app-content" }}>
        {children}
      </div>
    </main>
  );
}
