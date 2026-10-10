import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, EmptyState, Message, TextField } from "../../shared/ui";
import { formatDayTime } from "../../shared/format/date";
import { formatAmount } from "./format";
import { formatMoney } from "../pos/money";
import type { Database } from "../../shared/supabase/database.types";
import { useBranch } from "../../shared/branch/BranchContext";

type WarningRow = Database["public"]["Functions"]["stock_warnings_for_review"]["Returns"][number];

const when = (iso: string | null) => formatDayTime(iso);

/**
 * RF-38: muestra faltantes aceptados (hasta 10 unidades agregadas por presentación y
 * sucursal) y ventas registradas sin lotes cargados para que administración los revise.
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
    <section className="carta carta--sin-relleno" aria-labelledby="revision-stock">
      <div className="carta__cabecera">
        <h3 className="titulo-seccion" id="revision-stock">Revisión de stock negativo</h3>
        <div className="fila">
          <Badge tone={pending > 0 ? "aviso" : "exito"}>{pending} pendiente{pending === 1 ? "" : "s"}</Badge>
          <label className="casilla">
            <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
            Ver resueltos
          </label>
        </div>
      </div>
      <p className="cuerpo-s suave relleno">
        Faltantes aceptados de hasta 10 unidades agregadas por presentación y sucursal, y ventas registradas sin lotes cargados. Ajustá el lote desde Stock si hace falta y marcá el caso como revisado.
      </p>
      {error && <div className="relleno"><Message tone="error">{error}</Message></div>}

      {rows && rows.length === 0 && (
        <EmptyState title="No hay casos para revisar" icon="check_circle">Cuando una venta deje un faltante permitido o se registre sin lotes cargados, va a aparecer acá.</EmptyState>
      )}

      {rows && rows.length > 0 && (
        <ul className="lista lista--plana">
          {rows.map((r) => (
            <li key={r.id} className="revision__caso">
              <div className="lista__principal">
                <span className="lista__titulo">
                  {r.product_name ?? "Producto sin lote"}{r.presentation_name ? ` · ${r.presentation_name}` : ""}
                  {showBranch && r.branch_name ? <span className="suave"> · {r.branch_name}</span> : null}
                </span>
                <span className="lista__meta">{r.message}</span>
                <span className="lista__meta">
                  {r.lot_id ? <>Lote actual: <span className="cifra">{formatAmount(Number(r.lot_current_quantity))}</span> · </> : null}
                  {r.sale_id ? <>Venta <span className="cifra">{when(r.sale_occurred_at)}</span> por <span className="cifra">{formatMoney(Number(r.sale_total ?? 0))}</span></> : "Sin venta asociada"}
                  {r.register_name ? ` · ${r.register_name}` : ""}{r.sold_by ? ` · ${r.sold_by}` : ""}
                </span>
                {r.resolved_at ? (
                  <Message tone="exito">Revisado el {when(r.resolved_at)} por {r.resolved_by_name}: {r.resolution}</Message>
                ) : (
                  <div className="form-fila revision__acciones">
                    <TextField label="Qué se hizo" placeholder="Ej.: conteo físico, se ajustó el lote" value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                    <div className="fila">
                      <Button variant="secundario" icon="check" onClick={() => void resolve(r.id)} loading={busy === r.id} disabled={busy !== null}>
                        Marcar como revisado
                      </Button>
                      {r.lot_id && <a className="boton boton--fantasma" href="/stock.html">Ajustar en Stock</a>}
                    </div>
                  </div>
                )}
              </div>
              <span className="lista__valor"><small>{when(r.created_at)}</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
