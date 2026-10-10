import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, EmptyState, Message } from "../../shared/ui";
import { formatDayTime } from "../../shared/format/date";
import { formatMoney } from "../pos/money";
import type { Presentation } from "../../shared/types";
import { accumulatedChange, formatPercent, groupByBranch, toPriceHistory, type PriceHistoryEntry, type PriceHistoryRow } from "./priceHistory";
import { useBranch } from "../../shared/branch/BranchContext";


/**
 * RF-27: historial de precios del producto, por presentación, con la variación de cada
 * cambio y la acumulada. Los datos ya se guardaban (trigger de product_price_history);
 * faltaba poder consultarlos.
 */
export function PriceHistoryPanel({ presentations }: { presentations: Presentation[] }) {
  const [entries, setEntries] = useState<PriceHistoryEntry[] | null>(null);
  const [error, setError] = useState("");
  const { branches } = useBranch();
  const ids = presentations.map((p) => p.id).join(",");

  useEffect(() => {
    if (!ids) return setEntries([]);
    void getSupabase()
      .from("product_price_history")
      .select("id, presentation_id, sale_price, previous_price, changed_at, changed_by, batch_id, branch_id, profile:profiles(display_name)")
      .in("presentation_id", ids.split(","))
      .order("changed_at", { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        setEntries(toPriceHistory((data ?? []) as PriceHistoryRow[]));
      });
  }, [ids]);

  if (error) return <Message tone="error">{error}</Message>;
  if (!entries) return <span className="esqueleto" aria-label="Cargando historial de precios…" />;
  if (entries.length === 0) return <EmptyState title="Sin cambios de precio registrados" icon="history" />;

  const branchName = (id: string | null) => (id === null ? "Precio base" : branches.find((b) => b.id === id)?.name ?? "Sucursal");
  // Balanza (ADR-001): el precio se guarda por gramo; se muestra por kilo.
  const money = (value: number, soldByWeight: boolean) =>
    soldByWeight ? `${formatMoney(Math.round(value * 100000) / 100)}/kg` : formatMoney(value);

  return (
    <div className="pila">
      {presentations.map((presentation) => {
        const ownRows = entries.filter((e) => e.presentationId === presentation.id);
        if (ownRows.length === 0) return null;
        return (
          <div key={presentation.id} className="pila pila--s">
            <strong className="fuerte">{presentation.name}</strong>
            {groupByBranch(ownRows).map((group) => {
              const total = accumulatedChange(group.entries);
              return (
                <div key={group.branchId ?? "base"}>
                  <div className="fila">
                    <span className="meta">{branchName(group.branchId)}</span>
                    {total !== null && (
                      <Badge tone={total > 0 ? "aviso" : "exito"}>acumulado {formatPercent(total)} en {group.entries.length} cambio{group.entries.length === 1 ? "" : "s"}</Badge>
                    )}
                  </div>
                  <div className="tabla-marco">
                    <table className="tabla tabla--compacta">
                      <thead><tr><th>Cuándo</th><th>Quién</th><th className="num">Anterior</th><th className="num">Nuevo</th><th className="num">Variación</th></tr></thead>
                      <tbody>
                        {group.entries.map((e) => (
                          <tr key={e.id}>
                            <td className="cifra">{formatDayTime(e.changedAt)}</td>
                            <td>{e.changedBy}{e.fromBulkUpdate ? <span className="meta"> · masiva</span> : null}</td>
                            <td className="num apagada">{e.previousPrice === null ? "—" : money(e.previousPrice, presentation.sold_by_weight)}</td>
                            <td className="num fuerte">{money(e.price, presentation.sold_by_weight)}</td>
                            <td className="num">{formatPercent(e.change)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
