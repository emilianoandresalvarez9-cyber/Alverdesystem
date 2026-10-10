import { Fragment, useState } from "react";
import { ActionsMenu, Badge, Button, EmptyState, useCompact, type MenuAction } from "../../shared/ui";
import type { IconName } from "../../shared/ui";
import { LotStatusBadge } from "./LotStatusBadge";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import { TransferModal } from "./TransferModal";
import { formatAmount, formatDay, remaining, unitLabel } from "./format";
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

type LotAction = MenuAction & { key: "open" | "fraction" | "adjust" | "transfer" };

/**
 * Acciones de un lote. Todas están en «Más acciones»; la que corresponde al estado va además
 * a la vista: Fraccionar si es una bolsa de granel abierta, Abrir bolsa si se puede abrir,
 * Ajustar si no aplica ninguna. Abrir bolsa deshabilitado dice por qué (RF-12).
 */
export function lotActions(lot: StockLot, opts: {
  hasActiveBag: boolean; canFraction: boolean; canTransfer: boolean;
  onOpen: () => void; onFraction: () => void; onAdjust: () => void; onTransfer: () => void;
}): { primary: LotAction | null; all: LotAction[] } {
  const isClosed = lot.status === "closed";
  const isPending = lot.id.startsWith("pending:");
  const all: LotAction[] = [];
  if (!isPending && !isClosed && !lot.opened_at) {
    all.push({ key: "open", label: "Abrir bolsa", icon: "unarchive", onSelect: opts.onOpen,
      disabled: opts.hasActiveBag, reason: opts.hasActiveBag ? "Ya hay una bolsa abierta de este producto." : undefined });
  }
  if (opts.canFraction && !isPending && !isClosed && lot.sold_by_weight) {
    all.push({ key: "fraction", label: "Fraccionar", icon: "call_split", onSelect: opts.onFraction });
  }
  if (!isPending && !isClosed) all.push({ key: "adjust", label: "Ajustar", icon: "edit", onSelect: opts.onAdjust });
  if (opts.canTransfer && !isPending && !isClosed && lot.current_quantity > 0) {
    all.push({ key: "transfer", label: "Traspasar", icon: "swap_horiz", onSelect: opts.onTransfer });
  }
  const find = (key: LotAction["key"]) => all.find((a) => a.key === key && !a.disabled);
  const primary = (lot.opened_at ? find("fraction") : undefined) ?? find("open") ?? find("adjust") ?? null;
  return { primary, all };
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [lotToAdjust, setLotToAdjust] = useState<StockLot | null>(null);
  const [lotToTransfer, setLotToTransfer] = useState<StockLot | null>(null);
  const compact = useCompact();
  // Con "Todas las sucursales" cada lote dice de qué sucursal es (RF-65/66).
  const { isAdmin, filterId, branches } = useBranch();
  const showBranch = isAdmin && filterId === null && branches.length > 1;

  if (loading) {
    return (
      <div className="pila pila--s tabla-cargando" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => <span key={i} className="esqueleto" />)}
      </div>
    );
  }

  if (lots.length === 0) {
    return <EmptyState title="Sin lotes que coincidan con los filtros">Probá cambiando el estado, el vencimiento o la búsqueda.</EmptyState>;
  }

  const actionsFor = (lot: StockLot) => lotActions(lot, {
    hasActiveBag: hasActiveOpenBag ? hasActiveOpenBag(lot.product_id, lot.branch_id) : false,
    canFraction: enableFractioning && Boolean(onFraction),
    canTransfer: isAdmin && branches.length > 1,
    onOpen: () => onOpenLot(lot.id),
    onFraction: () => onFraction?.(lot),
    onAdjust: () => setLotToAdjust(lot),
    onTransfer: () => setLotToTransfer(lot)
  });

  const meta = (lot: StockLot) => [lot.presentation_name, lot.supplier_name, showBranch ? lot.branch_name : null].filter(Boolean).join(" · ");
  const badges = (lot: StockLot) => (
    <>
      {lot.status === "closed" && <Badge tone="neutro" icon="lock">Cerrado</Badge>}
      {lot.id.startsWith("pending:") && <Badge tone="aviso" icon="sync">Pendiente de sincronización</Badge>}
    </>
  );
  const stock = (lot: StockLot) => `${formatAmount(lot.current_quantity)} / ${formatAmount(lot.initial_quantity)} ${unitLabel(lot.base_unit)}`;

  const groups = Array.from(lots.reduce((map, lot) => {
    const key = `${lot.branch_id ?? "sin-sucursal"}:${lot.presentation_id}`;
    const group = map.get(key) ?? { key, lots: [] as StockLot[] };
    group.lots.push(lot);
    map.set(key, group);
    return map;
  }, new Map<string, { key: string; lots: StockLot[] }>()).values());
  const toggleGroup = (key: string) => setExpandedGroups((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const groupedStock = (group: { lots: StockLot[] }) => {
    const current = group.lots.reduce((sum, lot) => sum + lot.current_quantity, 0);
    const initial = group.lots.reduce((sum, lot) => sum + lot.initial_quantity, 0);
    return `${formatAmount(current)} / ${formatAmount(initial)} ${unitLabel(group.lots[0]!.base_unit)}`;
  };

  return (
    <>
      {compact ? (
        <ul className="lista lista--plana">
          {groups.map((group) => {
            const first = group.lots[0]!;
            const expanded = expandedGroups.has(group.key);
            const earliestExpiry = group.lots.map((lot) => lot.effective_expiry_date).filter((date): date is string => Boolean(date)).sort()[0];
            return (
              <li key={group.key}>
                <div className="lista__principal">
                  <span className="lista__titulo">{first.product_name}</span>
                  <span className="lista__meta">{meta(first)} · <span className="cifra">{groupedStock(group)}</span> · {group.lots.length} lotes
                    {earliestExpiry ? <> · próximo vence <span className="cifra">{formatDay(earliestExpiry)}</span></> : null}
                  </span>
                </div>
                <Button variant="fantasma" size="compacto" aria-expanded={expanded} onClick={() => toggleGroup(group.key)}>
                  {expanded ? "Ocultar lotes" : "Ver lotes"}
                </Button>
                {expanded && <ul className="lista lista--plana">
                  {group.lots.map((lot) => {
                    const { all } = actionsFor(lot);
                    return <li key={lot.id} className={lot.status === "closed" ? "lote--cerrado" : undefined}>
                      <div className="lista__principal">
                        <span className="lista__meta">{lot.supplier_name ?? "Sin proveedor"} · <span className="cifra">{stock(lot)}</span>
                          {lot.effective_expiry_date ? <> · vence <span className="cifra">{formatDay(lot.effective_expiry_date)}</span></> : null}
                        </span>
                        <span className="fila lote__estados"><LotStatusBadge status={lot.expiry_status} daysUntilExpiry={lot.days_until_expiry} />{badges(lot)}</span>
                      </div>
                      <ActionsMenu label={`Más acciones para ${lot.product_name}`} actions={all} />
                    </li>;
                  })}
                </ul>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto · presentación</th>
                <th>Stock actual / inicial</th>
                <th>Ingreso</th>
                <th>Vencimiento</th>
                <th>Apertura</th>
                <th className="acciones"><span className="sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const first = group.lots[0]!;
                const expanded = expandedGroups.has(group.key);
                const expiries = group.lots.filter((lot) => lot.effective_expiry_date).sort((a, b) => a.effective_expiry_date!.localeCompare(b.effective_expiry_date!));
                const nextExpiry = expiries[0];
                const left = remaining(group.lots.reduce((sum, lot) => sum + lot.current_quantity, 0), group.lots.reduce((sum, lot) => sum + lot.initial_quantity, 0));
                return <Fragment key={group.key}>
                  <tr>
                    <td><div className="celda"><span className="celda__titulo">{first.product_name}</span><span className="suave">{meta(first)}</span></div></td>
                    <td><div className="celda"><span className="cifra">{groupedStock(group)}</span>
                      <span className={left.tone === "normal" ? "medidor lote__medidor" : `medidor medidor--${left.tone} lote__medidor`}
                        style={{ "--v": `${left.percent}%` } as React.CSSProperties} aria-hidden="true"><span /></span></div></td>
                    <td className="cifra">{group.lots.length} lotes</td>
                    <td>{nextExpiry ? <div className="celda"><span className="cifra">{formatDay(nextExpiry.effective_expiry_date!)}</span>
                      <LotStatusBadge status={nextExpiry.expiry_status} daysUntilExpiry={nextExpiry.days_until_expiry} /></div> : <span className="apagada">Sin vencimiento</span>}</td>
                    <td><span className="apagada">—</span></td>
                    <td className="acciones"><Button variant="secundario" size="compacto" aria-expanded={expanded} onClick={() => toggleGroup(group.key)}>
                      {expanded ? "Ocultar lotes" : `Ver ${group.lots.length} lotes`}
                    </Button></td>
                  </tr>
                  {expanded && group.lots.map((lot) => {
                    const { primary, all } = actionsFor(lot);
                    return <tr key={lot.id} className={lot.status === "closed" ? "lote--cerrado" : undefined}>
                      <td><div className="celda"><span className="suave">↳ {lot.supplier_name ?? "Sin proveedor"} · ingreso {formatDay(lot.received_at)}</span>
                        {(lot.status === "closed" || lot.id.startsWith("pending:")) && <span className="fila lote__estados">{badges(lot)}</span>}</div></td>
                      <td className="cifra">{stock(lot)}</td><td className="cifra">{formatDay(lot.received_at)}</td>
                      <td><div className="celda">{lot.effective_expiry_date && <span className="cifra">{formatDay(lot.effective_expiry_date)}</span>}
                        <LotStatusBadge status={lot.expiry_status} daysUntilExpiry={lot.days_until_expiry} /></div></td>
                      <td className="cifra">{lot.opened_at ? formatDay(lot.opened_at) : <span className="apagada">—</span>}</td>
                      <td className="acciones"><div className="fila lote__acciones">
                        {primary && <Button variant="secundario" size="compacto" icon={primary.icon as IconName} onClick={primary.onSelect}>{primary.label}</Button>}
                        <ActionsMenu label={`Más acciones para ${lot.product_name}`} actions={all} />
                      </div></td>
                    </tr>;
                  })}
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>
      )}

      <StockAdjustmentModal
        lot={lotToAdjust}
        open={Boolean(lotToAdjust)}
        onClose={() => setLotToAdjust(null)}
        onSuccess={onRefresh}
      />
      {lotToTransfer && (
        <TransferModal key={lotToTransfer.id} lot={lotToTransfer} onClose={() => setLotToTransfer(null)} onDone={onRefresh} />
      )}
    </>
  );
}
