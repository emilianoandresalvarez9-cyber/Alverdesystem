import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { AuthGate, useCurrentProfile } from "../auth/AuthGate";
import { signOut } from "../auth/session";
import type { AppRole } from "../auth/roles";
import { ThemeToggle } from "../theme/ThemeToggle";
import { OfflineIndicator } from "./OfflineIndicator";
import { BranchProvider } from "../branch/BranchContext";
import { BranchSelector } from "../branch/BranchSelector";
import { Icon, type IconName } from "../ui/Icon";

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

type NavItem = { id: ShellSection; href: string; label: string; short?: string; icon: IconName; adminOnly?: boolean };

const NAV: NavItem[] = [
  { id: "pos", href: "/pos.html", label: "Caja", icon: "point_of_sale" },
  { id: "catalog", href: "/catalog.html", label: "Catálogo", icon: "inventory_2" },
  { id: "stock", href: "/stock.html", label: "Stock", icon: "package_2" },
  { id: "customers", href: "/customers.html", label: "Clientes", icon: "group" },
  { id: "admin", href: "/admin.html", label: "Administración", short: "Admin", icon: "admin_panel_settings", adminOnly: true }
];

const leave = () => void signOut().then(() => location.assign("/"));

/**
 * Marco de todas las páginas (RNF-06/RNF-08): barra lateral de 240 px, cabecera de vidrio
 * y contenido. Cada bloque declara su view-transition-name en design-system.css
 * (app-sidebar, nav-activo, app-header, app-titulo, app-content): al cambiar de página la
 * barra queda quieta, la pastilla del ítem activo se desliza y sólo el título y el
 * contenido cambian. En celular la barra pasa abajo y sucursal, tema y Salir van al
 * menú de la cabecera.
 */
export function ShellLayout({ active, title, children }: PropsWithChildren<{ active: ShellSection; title: string }>) {
  const profile = useCurrentProfile();
  const isAdmin = profile.role === "administrator";
  const items = NAV.filter((item) => !item.adminOnly || isAdmin);
  const roleLabel = ROLE_LABELS[profile.role];

  return (
    <BranchProvider isAdmin={isAdmin}>
      <div className="app">
        <aside className="app-sidebar" aria-label="Navegación principal">
          <div className="marca">
            <span className="marca__nombre">alverde</span>
            <span className="marca__bajada">Dietética natural</span>
          </div>
          <BranchSelector />
          <nav className="nav" aria-label="Secciones">
            {items.map((item) => {
              const current = active === item.id;
              return (
                <a key={item.id} className="nav__item" href={item.href} aria-current={current ? "page" : undefined}>
                  {current ? <span className="nav__indicador" aria-hidden="true" /> : null}
                  <Icon name={item.icon} />
                  {item.short ? (
                    <>
                      <span className="nav__larga">{item.label}</span>
                      <span className="nav__corta">{item.short}</span>
                    </>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </a>
              );
            })}
          </nav>
          <div className="app-sidebar__pie">
            <ThemeToggle />
            <button type="button" className="boton boton--fantasma" onClick={leave}>
              <Icon name="logout" />
              Salir
            </button>
          </div>
        </aside>

        <div className="app-main">
          <header className="app-header">
            <h1 className="app-titulo">{title}</h1>
            <OfflineIndicator />
            <span className="app-header__sep" aria-hidden="true" />
            <span className="estado estado--neutro rol-insignia" title="Rol de la sesión">
              <Icon name="person" size="s" />
              {roleLabel}
            </span>
            <HeaderMenu roleLabel={roleLabel} />
          </header>
          <main className="app-content">{children}</main>
        </div>
      </div>
    </BranchProvider>
  );
}

/** Celular: el botón de menú de la cabecera abre rol, sucursal, tema y Salir. */
function HeaderMenu({ roleLabel }: { roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref}>
      <button
        type="button"
        className="boton boton--fantasma boton--icono app-header__menu"
        aria-label="Menú: sucursal, tema y salir"
        aria-expanded={open}
        aria-controls="menu-cabecera"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? "close" : "menu"} />
      </button>
      {open ? (
        <div className="app-header__panel" id="menu-cabecera">
          <p className="rol"><Icon name="person" />{roleLabel}</p>
          <BranchSelector />
          <ThemeToggle />
          <button type="button" className="boton boton--fantasma" onClick={leave}>
            <Icon name="logout" />
            Salir
          </button>
        </div>
      ) : null}
    </div>
  );
}
