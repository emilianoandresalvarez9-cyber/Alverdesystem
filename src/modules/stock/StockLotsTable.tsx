import { useState } from "react";
import { GlassCard, Button, Badge, EmptyState } from "../../shared/ui";
import { LotStatusBadge } from "./LotStatusBadge";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import type { StockLot } from "./types";

interface StockLotsTableProps {
  lots: StockLot[];
  loading: boolean;
  onRefresh: () => void;
  onOpenLot: (lotId: string) => void;
}

export function StockLotsTable({
  lots,
  loading,
  onRefresh,
  onOpenLot,
}: StockLotsTableProps) {
  const [selectedLotForAdjustment, setSelectedLotForAdjustment] = useState<StockLot | null>(null);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-s)" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <GlassCard key={i} className="skeleton" style={{ minHeight: 64 }} />
        ))}
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <EmptyState title="Sin lotes que coincidan con los filtros">
        Probá cambiando los filtros de estado o búsqueda.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="table-wrap glass">
        <table>
          <thead>
            <tr>
              <th>Producto / Presentación</th>
              <th>Stock</th>
              <th>Ingreso</th>
              <th>Venc. Fabricante</th>
              <th>Venc. Efectivo (RF-08)</th>
              <th>Apertura</th>
              <th style={{ textAlign: "right" }}>Acciones (RF-57)</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const isClosed = lot.status === "closed";
              return (
                <tr key={lot.id} style={{ opacity: isClosed ? 0.6 : 1 }}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{lot.product_name}</div>
                    <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-suave)" }}>
                      {lot.presentation_name}
                      {lot.supplier_name && ` • Prov: ${lot.supplier_name}`}
                    </div>
                  </td>

                  <td>
                    <span style={{ fontWeight: 800 }}>{lot.current_quantity}</span>{" "}
                    <span style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-apagada)" }}>
                      / {lot.initial_quantity} {lot.base_unit}
                    </span>
                    {isClosed && (
                      <div style={{ marginTop: 2 }}>
                        <Badge tone="neutro">Cerrado</Badge>
                      </div>
                    )}
                  </td>

                  <td style={{ fontSize: "var(--texto-xs)" }}>
                    {new Date(lot.received_at).toLocaleDateString("es-AR")}
                  </td>

                  <td style={{ fontSize: "var(--texto-xs)" }}>
                    {lot.manufacturer_expiry_date
                      ? new Date(lot.manufacturer_expiry_date).toLocaleDateString("es-AR")
                      : "—"}
                  </td>

                  <td>
                    <LotStatusBadge
                      status={lot.expiry_status}
                      daysUntilExpiry={lot.days_until_expiry}
                      effectiveDate={
                        lot.effective_expiry_date
                          ? new Date(lot.effective_expiry_date).toLocaleDateString("es-AR")
                          : null
                      }
                    />
                  </td>

                  <td>
                    {lot.opened_at ? (
                      <span style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-suave)" }}>
                        Abierto: {new Date(lot.opened_at).toLocaleDateString("es-AR")}
                      </span>
                    ) : lot.status === "open" ? (
                      <Button variant="secundario" onClick={() => onOpenLot(lot.id)}>
                        Abrir bolsa
                      </Button>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    {lot.status === "open" && (
                      <Button
                        variant="fantasma"
                        onClick={() => setSelectedLotForAdjustment(lot)}
                      >
                        Ajustar / Descartar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <StockAdjustmentModal
        lot={selectedLotForAdjustment}
        open={Boolean(selectedLotForAdjustment)}
        onClose={() => setSelectedLotForAdjustment(null)}
        onSuccess={onRefresh}
      />
    </>
  );
}
