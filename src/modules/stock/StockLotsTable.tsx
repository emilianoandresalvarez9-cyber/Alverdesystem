import { useState } from "react";
import { GlassCard, Button, Badge, EmptyState } from "../../shared/ui";
import { LotStatusBadge } from "./LotStatusBadge";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import { TransferModal } from "./TransferModal";
import type { StockLot } from "./types";
import { useBranch } from "../../shared/branch/BranchContext";

interface StockLotsTableProps {
  lots: StockLot[];
  loading: boolean;
  onRefresh: () => void;
  onOpenLot: (lotId: string) => void;
  hasActiveOpenBag?: (productId: string, branchId?: string | null) => boolean;
  enableFractioning?: boolean;
  onFraction?: (lot: StockLot) => void;
}

export function StockLotsTable({
  lots,
  loading,
  onRefresh,
  onOpenLot,
  hasActiveOpenBag,
  enableFractioning = false,
  onFraction
}: StockLotsTableProps) {
  const [selectedLotForAdjustment, setSelectedLotForAdjustment] = useState<StockLot | null>(null);
  const [lotToTransfer, setLotToTransfer] = useState<StockLot | null>(null);
  // Con "Todas las sucursales" cada lote dice de qué sucursal es (RF-65/66).
  const { isAdmin, filterId, branches } = useBranch();
  const showBranch = isAdmin && filterId === null && branches.length > 1;

  if (loading) {
    return (
      <div className="stock-skeletons">
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
      <div className="table-wrap glass stock-table">
        <table>
          <thead>
            <tr>
              <th>Producto / Presentación</th>
              <th>Remanente</th>
              <th>Ingreso</th>
              <th>Vencimiento efectivo</th>
              <th>Apertura</th>
              <th className="stock-table__actions-head">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const isClosed = lot.status === "closed";
              const isPending = lot.id.startsWith("pending:");
              const canOpen = !isPending && !isClosed && !lot.opened_at;
              const hasActiveBag = hasActiveOpenBag ? hasActiveOpenBag(lot.product_id, lot.branch_id) : false;
              const share = lot.initial_quantity > 0 ? Math.max(0, Math.min(1, lot.current_quantity / lot.initial_quantity)) : 0;

              return (
                <tr key={lot.id} className={isClosed ? "stock-row stock-row--closed" : "stock-row"} data-expiry={lot.expiry_status}>
                  <td>
                    <div className="stock-row__name">{lot.product_name}</div>
                    <div className="stock-row__meta">
                      {lot.presentation_name}
                      {lot.sold_by_weight ? <Badge tone="neutro">Granel</Badge> : null}
                      {lot.supplier_name && <span>Prov: {lot.supplier_name}</span>}
                      {showBranch && lot.branch_name && <Badge tone="neutro">{lot.branch_name}</Badge>}
                      {isPending && <Badge tone="aviso">Pendiente de sincronización</Badge>}
                    </div>
                  </td>

                  <td>
                    <div className="stock-qty">
                      <span className="stock-qty__now pos-num">{lot.current_quantity}</span>{" "}
                      <span className="stock-qty__of pos-num">/ {lot.initial_quantity} {lot.base_unit}</span>
                    </div>
                    <div className="stock-bar" aria-hidden="true"><span style={{ width: `${Math.round(share * 100)}%` }} /></div>
                    {isClosed && <Badge tone="neutro">Cerrado</Badge>}
                  </td>

                  <td className="stock-row__date pos-num">{new Date(lot.received_at).toLocaleDateString("es-AR")}</td>

                  <td>
                    <LotStatusBadge
                      status={lot.expiry_status}
                      daysUntilExpiry={lot.days_until_expiry}
                      effectiveDate={lot.effective_expiry_date ? new Date(lot.effective_expiry_date).toLocaleDateString("es-AR") : null}
                    />
                  </td>

                  <td>
                    {lot.opened_at ? (
                      <span className="stock-row__date">Abierto: {new Date(lot.opened_at).toLocaleDateString("es-AR")}</span>
                    ) : canOpen ? (
                      <div className="stock-open">
                        <Button
                          variant="secundario"
                          onClick={() => onOpenLot(lot.id)}
                          disabled={hasActiveBag}
                          title={hasActiveBag ? "Ya existe una bolsa abierta para este producto" : "Abrir bolsa (RF-11)"}
                        >
                          Abrir bolsa
                        </Button>
                        {hasActiveBag && <span className="stock-open__warn">Ya hay una bolsa abierta (RF-12)</span>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>
                    <div className="stock-actions">
                      {enableFractioning && !isPending && lot.sold_by_weight && !isClosed && (
                        <Button variant="primario" onClick={() => onFraction && onFraction(lot)}>Fraccionar</Button>
                      )}
                      {!isPending && !isClosed && (
                        <Button variant="fantasma" onClick={() => setSelectedLotForAdjustment(lot)}>Ajustar</Button>
                      )}
                      {isAdmin && branches.length > 1 && !isPending && !isClosed && lot.current_quantity > 0 && (
                        <Button variant="fantasma" onClick={() => setLotToTransfer(lot)} title="Pasar a otra sucursal (RF-68)">Traspasar</Button>
                      )}
                    </div>
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
      {lotToTransfer && (
        <TransferModal key={lotToTransfer.id} lot={lotToTransfer} onClose={() => setLotToTransfer(null)} onDone={onRefresh} />
      )}
    </>
  );
}

