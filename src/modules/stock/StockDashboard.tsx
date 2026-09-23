import { useState } from "react";
import { useStockLots } from "./useStockLots";
import { StockLotsTable } from "./StockLotsTable";
import { GlassCard, TextField, SelectField, Button } from "../../shared/ui";
import { FractioningModal } from "../fractioning/FractioningModal";
import type { StockLot } from "./types";

interface StockDashboardProps {
  enableFractioning?: boolean;
}

export function StockDashboard({ enableFractioning = false }: StockDashboardProps) {
  const {
    lots,
    loading,
    error,
    filters,
    setFilters,
    stats,
    refreshLots,
    markLotOpened,
    hasActiveOpenBag,
  } = useStockLots();

  const [lotToFraction, setLotToFraction] = useState<StockLot | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--esp-s)" }}>
        <div>
          <h2 style={{ margin: 0 }}>Control de Stock y Lotes (RF-07 a RF-10)</h2>
          <p style={{ margin: "var(--esp-xs) 0 0", color: "var(--color-tinta-suave)", fontSize: "var(--texto-s)" }}>
            Supervisión de lotes abiertos, fechas de vencimiento efectivo y descartes.
          </p>
        </div>
        <Button variant="secundario" onClick={refreshLots}>
          Actualizar
        </Button>
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>
          {error}
        </p>
      )}

      {/* KPI Cards / Semáforo resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--esp-s)" }}>
        <GlassCard padding="compact" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-apagada)", textTransform: "uppercase" }}>
            Lotes Abiertos
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats.totalOpen}</div>
        </GlassCard>

        <GlassCard
          padding="compact"
          style={{
            textAlign: "center",
            borderLeft: stats.expired > 0 ? "3px solid var(--color-error)" : undefined,
          }}
        >
          <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-error)", textTransform: "uppercase", fontWeight: 700 }}>
            Vencidos
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: stats.expired > 0 ? "var(--color-error)" : undefined }}>
            {stats.expired}
          </div>
        </GlassCard>

        <GlassCard
          padding="compact"
          style={{
            textAlign: "center",
            borderLeft: stats.critical > 0 ? "3px solid var(--color-aviso)" : undefined,
          }}
        >
          <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-aviso)", textTransform: "uppercase", fontWeight: 700 }}>
            Vence en ≤ 7d
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: stats.critical > 0 ? "var(--color-aviso)" : undefined }}>
            {stats.critical}
          </div>
        </GlassCard>

        <GlassCard padding="compact" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-tinta-suave)", textTransform: "uppercase" }}>
            Vence en ≤ 30d
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats.warning}</div>
        </GlassCard>

        <GlassCard padding="compact" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--texto-xs)", color: "var(--color-exito)", textTransform: "uppercase", fontWeight: 700 }}>
            En Regla
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--color-exito)" }}>
            {stats.good}
          </div>
        </GlassCard>
      </div>

      {/* Toolbar de Filtros */}
      <GlassCard padding="compact">
        <div style={{ display: "flex", gap: "var(--esp-s)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField
            label="Buscar producto o proveedor"
            placeholder="Ej. Nueces, Arcor..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            style={{ minWidth: 200 }}
          />

          <SelectField
            label="Estado del lote"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as "all" | "open" | "closed" })}
          >
            <option value="open">Solo Abiertos</option>
            <option value="closed">Solo Cerrados</option>
            <option value="all">Todos los lotes</option>
          </SelectField>

          <SelectField
            label="Semáforo vencimiento"
            value={filters.expiryStatus}
            onChange={(e) =>
              setFilters({
                expiryStatus: e.target.value as "all" | "expired" | "critical" | "warning" | "good",
              })
            }
          >
            <option value="all">Cualquier vencimiento</option>
            <option value="expired">🚨 Vencidos</option>
            <option value="critical">⚠️ Críticos (≤ 7 días)</option>
            <option value="warning">Por vencer (≤ 30 días)</option>
            <option value="good">En regla</option>
          </SelectField>

          <SelectField
            label="Ordenar por"
            value={filters.sortBy}
            onChange={(e) =>
              setFilters({ sortBy: e.target.value as "effective_expiry" | "received_at" | "name" })
            }
          >
            <option value="effective_expiry">Cercanía de vencimiento (FEFO)</option>
            <option value="received_at">Más recientes (Ingreso)</option>
            <option value="name">Nombre de producto</option>
          </SelectField>
        </div>
      </GlassCard>

      {/* Tabla de lotes */}
      <StockLotsTable
        lots={lots}
        loading={loading}
        onRefresh={refreshLots}
        onOpenLot={markLotOpened}
        hasActiveOpenBag={hasActiveOpenBag}
        enableFractioning={enableFractioning}
        onFraction={(lot) => setLotToFraction(lot)}
      />

      <FractioningModal 
        originLot={lotToFraction}
        open={Boolean(lotToFraction)}
        onClose={() => setLotToFraction(null)}
        onSuccess={refreshLots}
      />
    </div>
  );
}
