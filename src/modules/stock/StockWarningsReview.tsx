import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, EmptyState, GlassCard, TextField } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import type { Database } from "../../shared/supabase/database.types";
import { useBranch } from "../../shared/branch/BranchContext";

type WarningRow = Database["public"]["Functions"]["stock_warnings_for_review"]["Returns"][number];

const DATE = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const when = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");

/**
 * RF-38: ventas que dejaron stock negativo o se hicieron sin lotes cargados. La venta
 * no se bloqueó; acá la administradora ve cada caso y lo cierra con una nota de qué hizo
 * (ajustar el lote desde Stock, contar, etc.).
 */
export function StockWarningsReview() {
  const sb = getSupabase();
  const [rows, setRows] = useState<WarningRow[] | null>(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // RF-70: casos de la sucursal elegida, o de todas.
  const { filterId, branches } = useBranch();
  const showBranch = filterId === null && branches.length > 1;

  const load = useCallback(async () => {
    const { data, error: err } = await sb.rpc("stock_warnings_for_review", {
      p_include_resolved: includeResolved,
      ...(filterId ? { p_branch_id: filterId } : {})
    });
    if (err) return setError(err.message);
    setRows(data ?? []);
  }, [sb, includeResolved, filterId]);

  useEffect(() => { void load(); }, [load]);

  async function resolve(id: string) {
    const note = (notes[id] ?? "").trim();
    if (!note) return setError("Escribí qué se hizo con el caso antes de marcarlo como revisado.");
    setBusy(id);
    setError("");
    const { error: err } = await sb.rpc("resolve_stock_warning", { p_warning_id: id, p_resolution: note });
    setBusy(null);
    if (err) return setError(err.message);
    setNotes((n) => ({ ...n, [id]: "" }));
    await load();
  }

  const pending = rows?.filter((r) => !r.resolved_at).length ?? 0;

  return (
    <GlassCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--esp-m)", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Revisión de stock negativo (RF-38)</h2>
          <p className="field-help">
            Ventas que no se bloquearon aunque no alcanzaba el stock (por ejemplo dos cajas vendieron el mismo último lote sin conexión).
            Ajustá el lote desde Stock si hace falta y marcá el caso como revisado.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--esp-s)", alignItems: "center" }}>
          <Badge tone={pending > 0 ? "aviso" : "exito"}>{pending} pendiente{pending === 1 ? "" : "s"}</Badge>
          <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontWeight: 600 }}>
            <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
            Ver resueltos
          </label>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      {rows && rows.length === 0 && (
        <EmptyState title="No hay casos para revisar">Cuando una venta deje stock negativo va a aparecer acá.</EmptyState>
      )}

      {rows && rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: "var(--esp-m) 0 0", padding: 0, display: "grid", gap: "var(--esp-s)" }}>
          {rows.map((r) => (
            <li key={r.id} className="glass-lite" style={{ padding: "var(--esp-m)", borderRadius: "var(--radio-control)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--esp-m)", flexWrap: "wrap", alignItems: "baseline" }}>
                <strong>
                  {r.product_name ?? "Producto sin lote"}{r.presentation_name ? ` · ${r.presentation_name}` : ""}
                  {showBranch && r.branch_name ? <> <Badge tone="neutro">{r.branch_name}</Badge></> : null}
                </strong>
                <span className="field-help">{when(r.created_at)}</span>
              </div>
              <p style={{ margin: ".3rem 0" }}>{r.message}</p>
              <p className="field-help" style={{ margin: 0 }}>
                {r.lot_id ? `Lote actual: ${Number(r.lot_current_quantity)} · ` : ""}
                {r.sale_id ? `Venta ${when(r.sale_occurred_at)} por ${formatMoney(Number(r.sale_total ?? 0))}` : "Sin venta asociada"}
                {r.register_name ? ` · ${r.register_name}` : ""}{r.sold_by ? ` · ${r.sold_by}` : ""}
              </p>
              {r.resolved_at ? (
                <p className="notice" style={{ marginTop: "var(--esp-s)" }}>
                  Revisado el {when(r.resolved_at)} por {r.resolved_by_name}: {r.resolution}
                </p>
              ) : (
                <div style={{ display: "flex", gap: "var(--esp-s)", alignItems: "flex-end", flexWrap: "wrap", marginTop: "var(--esp-s)" }}>
                  <TextField label="Qué se hizo" placeholder="Ej.: conteo físico, se ajustó el lote" value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} style={{ minWidth: "18rem" }} />
                  <Button variant="secundario" onClick={() => void resolve(r.id)} loading={busy === r.id} disabled={busy !== null}>
                    Marcar como revisado
                  </Button>
                  {r.lot_id && <a className="button button-ghost" href="/stock.html">Ajustar en Stock</a>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
