import { useState } from "react";
import { useStockLots } from "./useStockLots";
import { StockLotsTable } from "./StockLotsTable";
import { Button, Icon, Message, SelectField, TextField, type IconName } from "../../shared/ui";
import { FractioningModal } from "../fractioning/FractioningModal";
import type { StockLot, StockLotFilters } from "./types";
import "../../styles/stock.css";

interface StockDashboardProps {
  enableFractioning?: boolean;
  /** Sólo lotes a granel (Administración → Fraccionamiento y granel). */
  onlyBulk?: boolean;
}

type Kpi = { label: string; value: number; icon: IconName; tone?: "error" | "aviso" | "exito" };

/**
 * Control de stock y lotes (RF-07 a RF-10): resumen de vencimientos de los lotes abiertos,
 * filtros y la tabla. El resumen sale de los mismos lotes que se ven: no hay números inventados.
 */
export function StockDashboard({ enableFractioning = false, onlyBulk = false }: StockDashboardProps) {
  const { lots, loading, error, filters, setFilters, stats, refreshLots, markLotOpened, hasActiveOpenBag } = useStockLots();
  const [lotToFraction, setLotToFraction] = useState<StockLot | null>(null);

  const kpis: Kpi[] = [
    { label: "Lotes abiertos", value: stats.totalOpen, icon: "inventory_2" },
    { label: "Vencidos", value: stats.expired, icon: "block", ...(stats.expired > 0 ? { tone: "error" as const } : {}) },
    { label: "Críticos (≤ 7 días)", value: stats.critical, icon: "warning", ...(stats.critical > 0 ? { tone: "aviso" as const } : {}) },
    { label: "Por vencer (≤ 30 días)", value: stats.warning, icon: "schedule" },
    { label: "En regla", value: stats.good, icon: "check_circle", tone: "exito" }
  ];

  return (
    <>
      {!onlyBulk && <div className="kpis" aria-label="Vencimientos de los lotes abiertos">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={kpi.tone ? `kpi kpi--${kpi.tone}` : "kpi"}>
            <span className="kpi__etiqueta"><Icon name={kpi.icon} />{kpi.label}</span>
            <span className="kpi__valor">{loading ? "—" : kpi.value}</span>
          </div>
        ))}
      </div>}

      <section className="carta carta--sin-relleno" aria-labelledby="lotes-titulo">
        <div className="carta__cabecera">
          <h2 className="titulo-seccion" id="lotes-titulo">{onlyBulk ? "Lotes a granel" : "Control de stock y lotes"}</h2>
          <Button variant="fantasma" size="compacto" icon="refresh" onClick={refreshLots}>Actualizar</Button>
        </div>

        <div className="form-fila lotes__filtros">
          <TextField
            label="Buscar producto o proveedor"
            type="search"
            icon="search"
            placeholder="Producto o proveedor"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
          <SelectField label="Estado del lote" value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as StockLotFilters["status"] })}>
            <option value="open">Solo abiertos</option>
            <option value="closed">Solo cerrados</option>
            <option value="all">Todos los lotes</option>
          </SelectField>
          <SelectField label="Vencimiento" value={filters.expiryStatus}
            onChange={(e) => setFilters({ expiryStatus: e.target.value as StockLotFilters["expiryStatus"] })}>
            <option value="all">Cualquiera</option>
            <option value="expired">Vencidos</option>
            <option value="critical">Críticos (≤ 7 días)</option>
            <option value="warning">Por vencer (≤ 30 días)</option>
            <option value="good">En regla</option>
          </SelectField>
          <SelectField label="Ordenar por" value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as StockLotFilters["sortBy"] })}>
            <option value="effective_expiry">Vence primero</option>
            <option value="received_at">Más recientes</option>
            <option value="name">Nombre</option>
          </SelectField>
        </div>

        {error && <div className="lotes__mensaje"><Message tone="error">{error}</Message></div>}

        <StockLotsTable
          lots={onlyBulk ? lots.filter((lot) => lot.sold_by_weight) : lots}
          loading={loading}
          onRefresh={refreshLots}
          onOpenLot={markLotOpened}
          hasActiveOpenBag={hasActiveOpenBag}
          enableFractioning={enableFractioning}
          onFraction={(lot) => setLotToFraction(lot)}
        />
      </section>

      <FractioningModal
        originLot={lotToFraction}
        open={Boolean(lotToFraction)}
        onClose={() => setLotToFraction(null)}
        onSuccess={refreshLots}
      />
    </>
  );
}
