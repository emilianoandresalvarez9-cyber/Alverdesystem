import { useState } from "react";
import { AppShell } from "../shared/components/AppShell";
import { BackupSettings } from "../shared/components/BackupSettings";
import { BackupManager } from "../modules/admin/BackupManager";
import { OfflineIndicator } from "../shared/components/OfflineIndicator";
import { StockDashboard } from "../modules/stock";
import { ClassifierManager } from "../modules/admin/ClassifierManager";
import { QuickRestock } from "../modules/restock/QuickRestock";
import { RepositionList } from "../modules/restock/RepositionList";
import { BarcodeDashboard } from "../modules/barcodes";
import { BulkDashboard } from "../modules/fractioning";
import { Button, GlassCard } from "../shared/ui";
import { ReportsDashboard } from "../modules/admin/ReportsDashboard";

type AdminTab = "reports" | "stock" | "fractioning" | "classifiers" | "restock" | "barcodes" | "settings";

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("reports");
  const [classifierType, setClassifierType] = useState<"brand" | "category" | "label">("brand");

  return (
    <AppShell active="admin" title="Administración">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
        <header className="page-heading">
          <h1 style={{ margin: 0 }}>Panel de Administración</h1>
        </header>

        {/* Barra de pestañas */}
        <div style={{ display: "flex", gap: "var(--esp-s)", flexWrap: "wrap", borderBottom: "1px solid var(--glass-borde)", paddingBottom: "var(--esp-s)" }}>
          <Button
            variant={activeTab === "reports" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("reports")}
          >
            📊 Reportes (Fase 4)
          </Button>
          <Button
            variant={activeTab === "stock" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("stock")}
          >
            📦 Lotes (FEFO)
          </Button>

          <Button
            variant={activeTab === "fractioning" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("fractioning")}
          >
            ⚖️ Fraccionamiento y Granel
          </Button>

          <Button
            variant={activeTab === "restock" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("restock")}
          >
            ⚡ Faltantes e Ingresos
          </Button>

          <Button
            variant={activeTab === "classifiers" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("classifiers")}
          >
            🏷️ Marcas / Rubros / Etiquetas
          </Button>

          <Button
            variant={activeTab === "barcodes" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("barcodes")}
          >
            🖨️ Códigos y Planilla
          </Button>

          <Button
            variant={activeTab === "settings" ? "primario" : "fantasma"}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Configuración y Respaldos
          </Button>
        </div>

        {/* Tab 0: Reportes */}
        {activeTab === "reports" && <ReportsDashboard />}

        {/* Tab 1: Lotes y Vencimientos (Agente E) */}
        {activeTab === "stock" && <StockDashboard />}

        {/* Tab 1.5: Fraccionamiento (Agente F) */}
        {activeTab === "fractioning" && <BulkDashboard />}

        {/* Tab 1.8: Códigos de Barra (Agente G) */}
        {activeTab === "barcodes" && <BarcodeDashboard />}

        {/* Tab 2: Faltantes e Ingreso Rápido (Agente C) */}
        {activeTab === "restock" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-l)" }}>
            <QuickRestock />
            <div>
              <h2 style={{ marginBottom: "var(--esp-m)" }}>Lista de Reposición (por Proveedor)</h2>
              <RepositionList />
            </div>
          </div>
        )}

        {/* Tab 3: Clasificadores (Agente B) */}
        {activeTab === "classifiers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
            <div style={{ display: "flex", gap: "var(--esp-xs)" }}>
              <Button
                variant={classifierType === "brand" ? "secundario" : "fantasma"}
                onClick={() => setClassifierType("brand")}
              >
                Marcas
              </Button>
              <Button
                variant={classifierType === "category" ? "secundario" : "fantasma"}
                onClick={() => setClassifierType("category")}
              >
                Rubros
              </Button>
              <Button
                variant={classifierType === "label" ? "secundario" : "fantasma"}
                onClick={() => setClassifierType("label")}
              >
                Etiquetas
              </Button>
            </div>
            <ClassifierManager type={classifierType} />
          </div>
        )}

        {/* Tab 4: Configuración y Respaldos */}
        {activeTab === "settings" && (
          <div className="dashboard-grid">
            <section className="glass feature-card">
              <OfflineIndicator />
              <h2>Acceso protegido</h2>
              <p>
                La base de datos separa los costos y márgenes del catálogo operativo. Un empleado no puede obtenerlos ni cambiando una URL.
              </p>
            </section>
            <section className="glass feature-card">
              <h2>Fundación técnica</h2>
              <p>
                Esquema relacional, auditoría reactiva de cambios y cola offline idempotente instalados.
              </p>
            </section>
            <BackupSettings />
            <div style={{ gridColumn: "1 / -1" }}>
              <BackupManager />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
