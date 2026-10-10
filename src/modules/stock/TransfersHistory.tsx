import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { useBranch } from "../../shared/branch/BranchContext";
import type { Database } from "../../shared/supabase/database.types";
import { EmptyState, GlassCard } from "../../shared/ui";

type Row = Database["public"]["Functions"]["stock_transfers_list"]["Returns"][number];
const DATE = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const UNIT: Record<string, string> = { gram: "g", millilitre: "ml", unit: "u." };

/** RF-68: quién traspasó qué, cuánto, de dónde y a dónde. Solo administradora. */
export function TransfersHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { filterId, branches, isAdmin } = useBranch();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    void getSupabase().rpc("stock_transfers_list", { ...(filterId ? { p_branch_id: filterId } : {}), p_limit: 50 })
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        setRows(data ?? []);
      });
  }, [filterId, isAdmin, refreshKey]);

  if (!isAdmin || branches.length < 2) return null;
  return (
    <GlassCard>
      <h3 style={{ marginTop: 0 }}>Traspasos entre sucursales (RF-68)</h3>
      {error && <p className="form-error" role="alert">{error}</p>}
      {rows && rows.length === 0 && <EmptyState title="Todavía no hubo traspasos" />}
      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cuándo</th><th>Producto</th><th>Cantidad</th><th>Desde → Hacia</th><th>Quién</th><th>Nota</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{DATE.format(new Date(r.created_at))}</td>
                  <td>{r.product_name}<br /><span className="field-help">{r.presentation_name}</span></td>
                  <td>{Number(r.quantity)} {UNIT[r.base_unit] ?? r.base_unit}</td>
                  <td>{r.from_branch_name} → <strong>{r.to_branch_name}</strong></td>
                  <td>{r.user_name}</td>
                  <td>{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
