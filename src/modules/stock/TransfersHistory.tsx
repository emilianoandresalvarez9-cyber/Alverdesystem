import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { useBranch } from "../../shared/branch/BranchContext";
import type { Database } from "../../shared/supabase/database.types";
import { EmptyState, Message, useCompact } from "../../shared/ui";
import { formatDayTime, formatQuantity } from "./format";

type Row = Database["public"]["Functions"]["stock_transfers_list"]["Returns"][number];

/** RF-68: quién traspasó qué, cuánto, de dónde y a dónde. Solo administradora. */
export function TransfersHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { filterId, branches, isAdmin } = useBranch();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const compact = useCompact();

  useEffect(() => {
    if (!isAdmin) return;
    void getSupabase().rpc("stock_transfers_list", { ...(filterId ? { p_branch_id: filterId } : {}), p_limit: 50 })
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        setRows(data ?? []);
      });
  }, [filterId, isAdmin, refreshKey]);

  if (!isAdmin || branches.length < 2) return null;
  const when = formatDayTime;
  return (
    <section className="carta carta--sin-relleno" aria-labelledby="traspasos-titulo">
      <div className="carta__cabecera"><h2 className="titulo-seccion" id="traspasos-titulo">Traspasos entre sucursales</h2></div>
      {error && <div className="lotes__mensaje"><Message tone="error">{error}</Message></div>}
      {rows && rows.length === 0 && <EmptyState title="Todavía no hubo traspasos" icon="swap_horiz" />}
      {rows && rows.length > 0 && (compact ? (
        <ul className="lista lista--plana">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="lista__principal">
                <span className="lista__titulo">{r.product_name} · {r.presentation_name}</span>
                <span className="lista__meta">{r.from_branch_name} → {r.to_branch_name} · {r.user_name} · <span className="cifra">{when(r.created_at)}</span></span>
                {r.note && <span className="lista__meta">{r.note}</span>}
              </div>
              <span className="lista__valor">{formatQuantity(Number(r.quantity), r.base_unit)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla--compacta">
            <thead><tr><th>Cuándo</th><th>Producto</th><th className="num">Cantidad</th><th>Desde → hacia</th><th>Quién</th><th>Nota</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cifra">{when(r.created_at)}</td>
                  <td>{r.product_name} · {r.presentation_name}</td>
                  <td className="num">{formatQuantity(Number(r.quantity), r.base_unit)}</td>
                  <td className="nowrap">{r.from_branch_name} → {r.to_branch_name}</td>
                  <td>{r.user_name}</td>
                  <td className="suave">{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
