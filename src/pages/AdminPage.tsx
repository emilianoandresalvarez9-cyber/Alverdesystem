import { Fragment, useEffect, useState, type ReactNode } from "react";
import { AppShell } from "../shared/components/AppShell";
import { BackupCenter } from "../modules/admin/BackupCenter";
import { StockWarningsReview } from "../modules/stock/StockWarningsReview";
import { ClassifierManager } from "../modules/admin/ClassifierManager";
import { RepositionList } from "../modules/restock/RepositionList";
import { BarcodeDashboard } from "../modules/barcodes";
import { BulkDashboard } from "../modules/fractioning";
import { Icon, SelectField, SubTabs } from "../shared/ui";
import { ReportsDashboard } from "../modules/reports/ReportsDashboard";
import { AuditHistoryPage } from "../modules/audit/AuditHistoryPage";
import { BranchesManager } from "../modules/admin/BranchesManager";
import { ScalePresentations } from "../modules/admin/ScalePresentations";
import { ProductsManager } from "../modules/admin/ProductsManager";
import { BulkPriceUpdate } from "../modules/admin/BulkPriceUpdate";
import { PriceMultiplierSettings } from "../modules/admin/PriceMultiplierSettings";
import { SuppliersManager } from "../modules/admin/SuppliersManager";
import { MarginDashboard } from "../modules/reports/MarginDashboard";
import {
  ADMIN_GROUPS, sectionFromHash, sectionLabel, type AdminSectionId
} from "../modules/admin/adminSections";
import "../styles/admin.css";

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/** Cambiar de sección con la misma transición que entre páginas (sólo título y contenido). */
function withTransition(update: () => void) {
  const doc = document as ViewTransitionDocument;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(update);
  else update();
}

export function AdminPage() {
  const [section, setSection] = useState<AdminSectionId>(() => sectionFromHash(location.hash));

  useEffect(() => {
    const onHash = () => withTransition(() => setSection(sectionFromHash(location.hash)));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: AdminSectionId) => {
    if (id !== section) location.hash = id;
  };

  return (
    <AppShell active="admin" title="Administración" requiredRole="administrator">
      <div className="admin">
        <nav className="nav-sec" aria-label="Secciones de Administración">
          {ADMIN_GROUPS.map((group) => (
            <Fragment key={group.label}>
              <p className="nav-sec__grupo">{group.label}</p>
              {group.sections.map((item) => (
                <a key={item.id} href={`#${item.id}`} aria-current={item.id === section ? "page" : undefined}>
                  <Icon name={item.icon} />
                  {item.label}
                </a>
              ))}
            </Fragment>
          ))}
        </nav>

        <div className="pila pila--l admin__contenido">
          <SelectField inline label="Sección" className="admin__seccion-movil" value={section}
            onChange={(e) => go(e.target.value as AdminSectionId)}>
            {ADMIN_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.sections.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </optgroup>
            ))}
          </SelectField>
          <h2 className="titulo-modal">{sectionLabel(section)}</h2>
          <AdminSectionView section={section} />
        </div>
      </div>
    </AppShell>
  );
}

function AdminSectionView({ section }: { section: AdminSectionId }): ReactNode {
  switch (section) {
    case "reportes": return <ReportsDashboard />;
    case "margenes": return <MarginDashboard />;
    case "lotes": return (
      <>
        <StockWarningsReview />
        <GoTo href="/stock.html" icon="package_2" text="La tabla de lotes, el ingreso rápido y los traspasos están en Stock y reposición.">
          Ir a Stock y reposición
        </GoTo>
      </>
    );
    case "fraccionamiento": return <BulkDashboard />;
    case "faltantes": return (
      <>
        <GoTo href="/stock.html" icon="add" text="La mercadería que llega se ingresa desde Stock y reposición.">Ingreso rápido</GoTo>
        <RepositionList />
      </>
    );
    case "proveedores": return <SuppliersManager />;
    case "productos": return <ProductsManager />;
    case "precios": return (
      <>
        <PriceMultiplierSettings />
        <BulkPriceUpdate />
      </>
    );
    case "clasificadores": return <Classifiers />;
    case "balanza": return <ScalePresentations />;
    case "sucursales": return <BranchesManager />;
    case "trazabilidad": return <AuditHistoryPage />;
    case "codigos": return <BarcodeDashboard />;
    case "configuracion": return (
      <>
        <BackupCenter />
        <p className="meta fila"><Icon name="lock" size="s" />Sólo administración entra a esta sección. Los costos y márgenes no llegan a los equipos de empleados.</p>
      </>
    );
  }
}

/** Una sola copia de cada herramienta: desde Administración, un acceso a donde vive. */
function GoTo({ href, icon, text, children }: { href: string; icon: "package_2" | "add"; text: string; children: ReactNode }) {
  return (
    <div className="fila fila--entre carta admin__acceso">
      <p className="cuerpo-s suave">{text}</p>
      <a className="boton boton--secundario" href={href}><Icon name={icon} />{children}</a>
    </div>
  );
}

function Classifiers() {
  const [type, setType] = useState<"brand" | "category" | "label">("brand");
  return (
    <>
      <SubTabs label="Clasificadores" value={type} onChange={setType}
        tabs={[{ value: "brand", label: "Marcas" }, { value: "category", label: "Rubros" }, { value: "label", label: "Etiquetas" }]} />
      <ClassifierManager type={type} />
    </>
  );
}
