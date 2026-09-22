import { AppShell } from "../shared/components/AppShell";
import { OfflineIndicator } from "../shared/components/OfflineIndicator";

export function CatalogPage() {
  return (
    <AppShell active="catalog" title="Catálogo">
      <div className="dashboard-grid">
        <section className="glass feature-card">
          <OfflineIndicator />
          <h2>Base de catálogo lista</h2>
          <p>La pantalla de consulta de productos se construye en la Fase 1 sobre esta base segura y disponible sin conexión.</p>
        </section>
        <section className="glass feature-card">
          <h2>Próximo módulo</h2>
          <p>Filtros por marca, rubro y etiquetas; búsqueda rápida; y botón de faltantes para el equipo.</p>
        </section>
      </div>
    </AppShell>
  );
}
