import { useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { enqueueOperation } from "../../shared/offline/queue";
import { AppShell } from "../../shared/components/AppShell";
import { Button, GlassCard } from "../../shared/ui";
import { QuickRestock } from "./QuickRestock";
import { RepositionList } from "./RepositionList";

export function FaltantesPage() {
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const reportMissingItem = async (productId: string, productName: string) => {
    try {
      if (navigator.onLine) {
        const supabase = getSupabase();
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("No autenticado");

        const { error } = await supabase.from("missing_items").insert({
          product_id: productId,
          reported_by: userId,
          note: "Reportado manualmente",
        });
        if (error) throw error;
      } else {
        await enqueueOperation({
          kind: "stock_movement",
          payload: {
            movementKind: "adjustment",
            productId: productId,
            reason: `Faltante reportado offline: ${productName}`,
          },
        });
      }

      alert(`Faltante reportado para: ${productName}`);
      setRefreshKey((prev) => prev + 1);
    } catch (err: unknown) {
      console.error("Error al reportar:", err);
      alert("Error al reportar faltante.");
    }
  };

  return (
    <AppShell active="admin" title="Reposición y Faltantes">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-l)" }}>
        <header className="page-heading">
          <h1 style={{ margin: 0 }}>Gestión de Faltantes e Ingresos</h1>
        </header>

        {/* RF-51: Ingreso rápido de mercadería con lector de barras */}
        <QuickRestock onSuccess={() => setRefreshKey((k) => k + 1)} />

        {/* RF-50: Lista de reposición agrupada por proveedor */}
        <div>
          <h2 style={{ marginBottom: "var(--esp-m)" }}>Lista de Reposición por Proveedor (RF-50)</h2>
          <RepositionList key={refreshKey} onResolve={() => setRefreshKey((k) => k + 1)} />
        </div>

        {/* RF-49: Simulador de botón de catálogo */}
        <GlassCard style={{ border: "1px dashed var(--glass-borde)" }}>
          <h3 style={{ margin: "0 0 var(--esp-s)" }}>Acción Rápida de Faltante (RF-49)</h3>
          <p style={{ margin: "0 0 var(--esp-s)", color: "var(--color-tinta-suave)" }}>
            Este botón simula la acción disponible en cada tarjeta de producto del catálogo para reportar faltante (con soporte offline).
          </p>
          <Button
            variant="secundario"
            onClick={() => reportMissingItem("11111111-1111-1111-1111-111111111111", "Producto Demo")}
          >
            Marcar Producto Demo como faltante
          </Button>
        </GlassCard>
      </div>
    </AppShell>
  );
}
