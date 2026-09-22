import { AppShell } from "../shared/components/AppShell";
import { BackupSettings } from "../shared/components/BackupSettings";
import { OfflineIndicator } from "../shared/components/OfflineIndicator";

export function AdminPage() {
  return (
    <AppShell active="admin" title="Administración">
      <div className="dashboard-grid">
        <section className="glass feature-card">
          <OfflineIndicator />
          <h2>Acceso protegido</h2>
          <p>La base de datos separa los costos y márgenes del catálogo operativo. Un empleado no puede obtenerlos ni cambiando una URL.</p>
        </section>
        <section className="glass feature-card">
          <h2>Fundación técnica</h2>
          <p>Esquema relacional, auditoría de cambios, autenticación y cola de sincronización instalados en la Fase 0.</p>
        </section>
        <BackupSettings />
      </div>
    </AppShell>
  );
}
