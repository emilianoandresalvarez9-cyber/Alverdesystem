import { useState } from "react";
import { useStockLots } from "./useStockLots";
import { StockLotsTable } from "./StockLotsTable";
import { Button, Tag, TextField, SelectField } from "../../shared/ui";
import { FractioningModal } from "../fractioning/FractioningModal";
import { useBranch } from "../../shared/branch/BranchContext";
import type { StockLot, StockLotFilters } from "./types";

interface StockDashboardProps {
  enableFractioning?: boolean;
}

type Expiry = StockLotFilters["expiryStatus"];

/**
 * Lotes y vencimientos (RF-07 a RF-10, RF-65). Las tarjetas cuentan lotes abiertos por
 * vencimiento efectivo y, al tocarlas, filtran la tabla. Todo sale de los lotes reales.
 */
export function StockDashboard({ enableFractioning = false }: StockDashboardProps) {
  const { lots, loading, error, filters, setFilters, stats, refreshLots, markLotOpened, hasActiveOpenBag } = useStockLots();
  const { label: branchLabel } = useBranch();
  const [lotToFraction, setLotToFraction] = useState<StockLot | null>(null);

  const toggleExpiry = (value: Expiry) => setFilters({ expiryStatus: filters.expiryStatus === value ? "all" : value, status: "open" });

  const tiles: { key: Expiry; label: string; value: number; tone: "error" | "aviso" | "exito" | "neutro"; help: string }[] = [
    { key: "expired", label: "Vencidos", value: stats.expired, tone: "error", help: "Retirar de góndola" },
    { key: "critical", label: "Vencen en 7 días", value: stats.critical, tone: "error", help: "Vender primero" },
    { key: "warning", label: "Vencen en 30 días", value: stats.warning, tone: "aviso", help: "Atención" },
    { key: "good", label: "En fecha", value: stats.good, tone: "exito", help: "Más de 30 días" }
  ];

  return (
    <div className="stock-page">
      <div className="stock-head">
        <div>
          <p className="pos-micro">{branchLabel}</p>
          <h2>Lotes y vencimientos</h2>
          <p className="field-help">Vencimiento efectivo: el más próximo entre el de fábrica y el de apertura (RF-08). Se vende primero lo que vence antes (RF-09).</p>
        </div>
        <Button variant="secundario" onClick={refreshLots}>Actualizar</Button>
      </div>

      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="stock-kpis">
        <div className="stock-kpi stock-kpi--total">
          <span className="pos-micro">Lotes abiertos</span>
          <strong className="pos-num">{stats.totalOpen}</strong>
          <span className="stock-kpi__help">{stats.openBags} bolsa{stats.openBags === 1 ? "" : "s"} de granel abierta{stats.openBags === 1 ? "" : "s"}</span>
        </div>
        {tiles.map((tile) => (
          <button key={tile.key} type="button" className="stock-kpi" data-tone={tile.tone}
            aria-pressed={filters.expiryStatus === tile.key} onClick={() => toggleExpiry(tile.key)}
            title={filters.expiryStatus === tile.key ? "Quitar filtro" : `Ver solo: ${tile.label.toLowerCase()}`}>
            <span className="pos-micro">{tile.label}</span>
            <strong className="pos-num">{tile.value}</strong>
            <span className="stock-kpi__help">{tile.help}</span>
          </button>
        ))}
      </div>

      <div className="stock-filters glass">
        <TextField label="" aria-label="Buscar producto o proveedor" placeholder="Buscar producto o proveedor…"
          value={filters.search} onChange={(e) => setFilters({ search: e.target.value })} className="stock-filters__search" />
        <div className="stock-filters__row">
          <div className="stock-chips" role="group" aria-label="Tipo">
            <Tag active={filters.kind === "all"} onClick={() => setFilters({ kind: "all" })}>Todos</Tag>
            <Tag active={filters.kind === "bulk"} onClick={() => setFilters({ kind: "bulk" })}>Granel</Tag>
            <Tag active={filters.kind === "packed"} onClick={() => setFilters({ kind: "packed" })}>Envasados</Tag>
          </div>
          <div className="stock-chips" role="group" aria-label="Estado del lote">
            <Tag active={filters.status === "open"} onClick={() => setFilters({ status: "open" })}>Abiertos</Tag>
            <Tag active={filters.status === "closed"} onClick={() => setFilters({ status: "closed" })}>Cerrados</Tag>
            <Tag active={filters.status === "all"} onClick={() => setFilters({ status: "all" })}>Todos los lotes</Tag>
          </div>
          <SelectField label="Ordenar por" value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as StockLotFilters["sortBy"] })}>
            <option value="effective_expiry">Vence antes (FEFO)</option>
            <option value="received_at">Ingreso más reciente</option>
            <option value="name">Nombre</option>
          </SelectField>
        </div>
      </div>

      <StockLotsTable
        lots={lots}
        loading={loading}
        onRefresh={refreshLots}
        onOpenLot={markLotOpened}
        hasActiveOpenBag={hasActiveOpenBag}
        enableFractioning={enableFractioning}
        onFraction={(lot) => setLotToFraction(lot)}
      />

      <FractioningModal originLot={lotToFraction} open={Boolean(lotToFraction)} onClose={() => setLotToFraction(null)} onSuccess={refreshLots} />
    </div>
  );
}
