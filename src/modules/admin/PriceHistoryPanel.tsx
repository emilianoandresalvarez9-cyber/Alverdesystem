import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, EmptyState } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import type { Presentation } from "../../shared/types";
import { accumulatedChange, formatPercent, toPriceHistory, type PriceHistoryEntry, type PriceHistoryRow } from "./priceHistory";

const DATE = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

/**
 * RF-27: historial de precios del producto, por presentación, con la variación de cada
 * cambio y la acumulada. Los datos ya se guardaban (trigger de product_price_history);
 * faltaba poder consultarlos.
 */
export function PriceHistoryPanel({ presentations }: { presentations: Presentation[] }) {
  const [entries, setEntries] = useState<PriceHistoryEntry[] | null>(null);
  const [error, setError] = useState("");
  const ids = presentations.map((p) => p.id).join(",");

  useEffect(() => {
    if (!ids) return setEntries([]);
    void getSupabase()
      .from("product_price_history")
      .select("id, presentation_id, sale_price, previous_price, changed_at, changed_by, batch_id, profile:profiles(display_name)")
      .in("presentation_id", ids.split(","))
      .order("changed_at", { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        setEntries(toPriceHistory((data ?? []) as PriceHistoryRow[]));
      });
  }, [ids]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!entries) return <p className="field-help">Cargando historial de precios…</p>;
  if (entries.length === 0) return <EmptyState title="Sin cambios de precio registrados" />;

  return (
    <div style={{ display: "grid", gap: "var(--esp-m)" }}>
      {presentations.map((presentation) => {
        const own = entries.filter((e) => e.presentationId === presentation.id);
        if (own.length === 0) return null;
        const total = accumulatedChange(own);
        return (
          <div key={presentation.id}>
            <div style={{ display: "flex", gap: "var(--esp-s)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--esp-xs)" }}>
              <strong>{presentation.name}</strong>
              {total !== null && (
                <Badge tone={total > 0 ? "aviso" : "exito"}>acumulado {formatPercent(total)} en {own.length} cambio{own.length === 1 ? "" : "s"}</Badge>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cuándo</th><th>Quién</th><th>Anterior</th><th>Nuevo</th><th>Variación</th></tr></thead>
                <tbody>
                  {own.map((e) => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{DATE.format(new Date(e.changedAt))}</td>
                      <td>{e.changedBy}{e.fromBulkUpdate ? <span className="field-help"> · masiva</span> : null}</td>
                      <td style={{ color: "var(--color-tinta-apagada)" }}>{e.previousPrice === null ? "—" : formatMoney(e.previousPrice)}</td>
                      <td><strong>{formatMoney(e.price)}</strong></td>
                      <td>{formatPercent(e.change)}</td>
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
}
