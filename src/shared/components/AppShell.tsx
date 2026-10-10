import type { PropsWithChildren } from "react";
import { AuthGate, useCurrentProfile } from "../auth/AuthGate";
import { signOut } from "../auth/session";
import type { AppRole } from "../auth/roles";
import { ThemeToggle } from "../theme/ThemeToggle";
import { OfflineIndicator } from "./OfflineIndicator";
import { BranchProvider } from "../branch/BranchContext";
import { BranchSelector } from "../branch/BranchSelector";

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

const ROLE_LABELS: Record<AppRole, string> = { administrator: "Administrador", employee: "Empleado" };

type NavItem = { id: ShellSection; href: string; label: string; adminOnly?: boolean };

const NAV: NavItem[] = [
  { id: "pos", href: "/pos.html", label: "Caja" },
  { id: "catalog", href: "/catalog.html", label: "Catálogo" },
  { id: "stock", href: "/stock.html", label: "Stock" },
  { id: "customers", href: "/customers.html", label: "Clientes" },
  { id: "admin", href: "/admin.html", label: "Administración", adminOnly: true }
];

/**
 * Barra lateral + cabecera + panel central, cada bloque con su propio
 * view-transition-name (RNF-08): al cambiar de página se anima cada sección
 * por separado en vez de toda la página como un solo bloque.
 */
export function ShellLayout({ active, title, children }: PropsWithChildren<{ active: ShellSection; title: string }>) {
  const profile = useCurrentProfile();
  const isAdmin = profile.role === "administrator";
  const items = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <BranchProvider isAdmin={isAdmin}>
    <div className="app-shell">
      <aside className="app-sidebar glass" style={{ viewTransitionName: "app-sidebar" }}>
        <a className="brand" href="/catalog.html" aria-label="Alverde, catálogo">
          <span className="brand-mark">A</span>
          <span className="brand-text">Alverde<small>Sistema de gestión</small></span>
        </a>
        <nav className="app-nav" aria-label="Navegación principal">
          <p className="app-nav-label">Secciones</p>
          {items.map((item) => (
            <a key={item.id} className={active === item.id ? "active" : ""} href={item.href}
              aria-current={active === item.id ? "page" : undefined}>
              <NavIcon section={item.id} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <BranchSelector />
        <div className="app-sidebar-foot">
          <ThemeToggle />
          <button className="button button-ghost" onClick={() => void signOut().then(() => location.assign("/"))}>
            Salir
          </button>
        </div>
      </aside>

      <header className="app-header glass" style={{ viewTransitionName: "app-header" }}>
        <div className="page-heading app-heading">
          <p className="eyebrow">Alverde · sistema de gestión</p>
          <h1>{title}</h1>
        </div>
        <div className="app-header-status">
          <OfflineIndicator />
          <span className="badge app-role" title="Rol de la sesión">{ROLE_LABELS[profile.role]}</span>
        </div>
      </header>

      <main className="app-content" style={{ viewTransitionName: "app-content" }}>
        {children}
      </main>
    </div>
    </BranchProvider>
  );
}

/** Iconos de línea, inline para que funcionen sin conexión (nada externo). */
function NavIcon({ section }: { section: ShellSection }) {
  const paths: Record<ShellSection, string> = {
    pos: "M3 7h18v10H3zM3 11h18M7 15h3",
    catalog: "M4 5h16v14H4zM8 5v14M4 10h16",
    stock: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
    customers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
    admin: "M4 6h16M4 12h16M4 18h16M8 4v4M14 10v4M10 16v4"
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[section]} />
    </svg>
  );
}
