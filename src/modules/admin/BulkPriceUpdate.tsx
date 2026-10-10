import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { exportToExcel } from "../../shared/export/excel";
import { Button, EmptyState, Icon, Message, Options, SelectField, TextField } from "../../shared/ui";
import { formatDayTime } from "../../shared/format/date";
import { formatMoney } from "../pos/money";
import { useBranch } from "../../shared/branch/BranchContext";
import {
  RETAG_HEADERS, SCOPE_LABELS, formatDiff, formatPrice, parsePercent, retagMatrix, summarizePreview,
  type PriceChange, type PriceScope, type RetagRow
} from "./bulkPrices";

type Option = { id: string; name: string };
type Batch = { id: string; created_at: string; percent: number; scope: string; changed_count: number; branch_id: string | null };

/**
 * RF-28: actualización masiva de precios con vista previa, por porcentaje y por marca,
 * rubro o proveedor. Todo lo calcula y aplica la base (RPC bulk_update_prices), en una
 * sola transacción. RF-30: después de aplicar queda la lista de lo que cambió, para
 * reetiquetar, y se puede volver a ver cualquier lote anterior.
 */
export function BulkPriceUpdate() {
  const sb = getSupabase();
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);

  const [scope, setScope] = useState<PriceScope>("all");
  const [scopeId, setScopeId] = useState("");
  const [percentage, setPercentage] = useState("10");
  const [roundTo100, setRoundTo100] = useState(true);
  // RF-69: "" = precio base (rige en las sucursales sin precio propio); un id = precios propios de esa sucursal.
  const { branches } = useBranch();
  const [priceBranch, setPriceBranch] = useState("");
  const priceBranchName = branches.find((b) => b.id === priceBranch)?.name;

  const [preview, setPreview] = useState<PriceChange[] | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<{ batchId: string; count: number } | null>(null);

  useEffect(() => {
    void Promise.all([
      sb.from("brands").select("id, name").is("archived_at", null).order("name"),
      sb.from("categories").select("id, name").is("archived_at", null).order("name"),
      sb.from("suppliers").select("id, name").eq("active", true).order("name")
    ]).then(([b, c, s]) => {
      setBrands(b.data ?? []);
      setCategories(c.data ?? []);
      setSuppliers(s.data ?? []);
    });
  }, [sb]);

  const scopeOptions = scope === "brand" ? brands : scope === "category" ? categories : scope === "supplier" ? suppliers : [];
  const scopeName = scopeOptions.find((o) => o.id === scopeId)?.name;

  async function run(apply: boolean) {
    const parsed = parsePercent(percentage);
    if (!parsed.ok) return setError(parsed.reason);
    if (scope !== "all" && !scopeId) return setError("Elegí la marca, el rubro o el proveedor.");
    setBusy(apply ? "apply" : "preview");
    setError("");
    try {
      const { data, error: rpcError } = await sb.rpc("bulk_update_prices", {
        p_percent: parsed.percent,
        p_scope: scope,
        ...(scope !== "all" ? { p_scope_id: scopeId } : {}),
        p_apply: apply,
        ...(roundTo100 ? { p_round_to: 100 } : {}),
        ...(priceBranch ? { p_branch_id: priceBranch } : {})
      });
      if (rpcError) throw new Error(rpcError.message);
      const rows = (data ?? []).map((row) => ({ ...row, old_price: Number(row.old_price), new_price: Number(row.new_price) }));
      if (apply) {
        setApplied({ batchId: rows[0]?.batch_id ?? "", count: rows.length });
        setPreview(null);
      } else {
        setPreview(rows);
        setApplied(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const summary = preview ? summarizePreview(preview) : null;

  return (
    <>
      <section className="carta pila" aria-labelledby="actualizacion-masiva">
        <h3 className="titulo-seccion" id="actualizacion-masiva">Actualización masiva de precios</h3>
        <p className="cuerpo-s suave">
          Primero se muestra qué cambiaría; nada se guarda hasta que confirmes. Los precios se aplican todos juntos:
          si algo falla, no cambia ninguno.
        </p>

        <Options name="alcance" legend="Aplicar a" showLegend variant="segmento" value={scope}
          onChange={(value) => { setScope(value); setScopeId(""); setPreview(null); }}
          options={[{ value: "all", label: "Todo" }, { value: "brand", label: "Marca" }, { value: "category", label: "Rubro" }, { value: "supplier", label: "Proveedor" }]} />

        <div className="form-fila">
          {scope !== "all" && (
            <SelectField label={SCOPE_LABELS[scope].replace("Un ", "").replace("Una ", "")} value={scopeId}
              onChange={(e) => { setScopeId(e.target.value); setPreview(null); }}>
              <option value="">Elegí…</option>
              {scopeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </SelectField>
          )}
          {branches.length > 1 && (
            <SelectField label="Precios de" value={priceBranch} onChange={(e) => { setPriceBranch(e.target.value); setPreview(null); }}>
              <option value="">Base (sucursales sin precio propio)</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </SelectField>
          )}
          <TextField label="Porcentaje" inputMode="decimal" numeric suffix="%" value={percentage}
            onChange={(e) => { setPercentage(e.target.value); setPreview(null); }} help="Negativo para bajar." />
        </div>
        <div className="fila fila--entre">
          <label className="casilla">
            <input type="checkbox" checked={roundTo100} onChange={(e) => { setRoundTo100(e.target.checked); setPreview(null); }} />
            Redondear a múltiplo de $100
          </label>
          <Button variant="secundario" icon="visibility" onClick={() => void run(false)} loading={busy === "preview"} disabled={busy !== null}>
            Ver qué cambiaría
          </Button>
        </div>
        {error && <Message tone="error">{error}</Message>}
      </section>

      {preview && summary && (
        <section className="carta pila" aria-labelledby="revisar-cambios">
          <h3 className="titulo-seccion" id="revisar-cambios">Revisá antes de confirmar</h3>
          <p className="meta">
            {priceBranchName ? `Precios de ${priceBranchName}` : "Precio base"} · {SCOPE_LABELS[scope]}{scopeName ? ` · ${scopeName}` : ""} · {percentage.replace(".", ",")} %
            {roundTo100 ? " · redondeado a $100" : ""}
          </p>
          <div className="kpis" aria-label="Resumen de la actualización">
            <div className="kpi"><span className="kpi__etiqueta"><Icon name="arrow_forward" />Suben</span><span className="kpi__valor">{summary.increases}</span></div>
            <div className="kpi"><span className="kpi__etiqueta"><Icon name="remove" />Bajan</span><span className="kpi__valor">{summary.decreases}</span></div>
            <div className="kpi"><span className="kpi__etiqueta"><Icon name="price_change" />Total de cambios</span><span className="kpi__valor">{summary.count}</span></div>
          </div>
          {summary.count === 0 ? (
            <EmptyState title="Ningún precio cambiaría" icon="price_change">Con ese porcentaje y redondeo, todos quedan igual.</EmptyState>
          ) : (
            <>
              <div className="tabla-marco">
                <table className="tabla tabla--compacta">
                  <thead><tr><th>Producto</th><th>Presentación</th><th className="num">Precio actual</th><th className="num">Precio nuevo</th><th className="num">Variación</th></tr></thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.presentation_id}>
                        <td>{row.product_name}</td>
                        <td className="suave">{row.presentation_name}</td>
                        <td className="num">{formatPrice(row.old_price, row.sold_by_weight)}</td>
                        <td className="num fuerte">{formatPrice(row.new_price, row.sold_by_weight)}</td>
                        <td className="num">{formatDiff(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="acciones-fila">
                <Button variant="fantasma" onClick={() => setPreview(null)} disabled={busy !== null}>Cancelar</Button>
                <Button onClick={() => void run(true)} loading={busy === "apply"} disabled={busy !== null}>
                  Confirmar {summary.count} cambio{summary.count === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {applied && (
        <Message tone="exito">
          Listo: se actualizaron {applied.count} precio{applied.count === 1 ? "" : "s"} en una sola operación.
          La lista para reetiquetar está abajo.
        </Message>
      )}

      <RetagList highlightBatchId={applied?.batchId ?? null} />
    </>
  );
}

/** RF-30: lista de lo que cambió en un lote, para reetiquetar; exportable a Excel. */
function RetagList({ highlightBatchId }: { highlightBatchId: string | null }) {
  const sb = getSupabase();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<RetagRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void sb.from("price_update_batches").select("id, created_at, percent, scope, changed_count, branch_id")
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        const list = (data ?? []).map((b) => ({ ...b, percent: Number(b.percent) }));
        setBatches(list);
        setSelected(highlightBatchId || list[0]?.id || "");
      });
  }, [sb, highlightBatchId]);

  useEffect(() => {
    if (!selected) return setRows(null);
    void sb.rpc("price_batch_changes", { p_batch_id: selected }).then(({ data, error: err }) => {
      if (err) return setError(err.message);
      setRows((data ?? []).map((r) => ({ ...r, old_price: Number(r.old_price), new_price: Number(r.new_price) })));
    });
  }, [sb, selected]);

  const { branches } = useBranch();
  const batchLabel = (b: Batch) =>
    `${formatDayTime(b.created_at)} · ${b.branch_id ? branches.find((x) => x.id === b.branch_id)?.name ?? "Sucursal" : "Base"} · ${b.percent > 0 ? "+" : ""}${b.percent} % · ${SCOPE_LABELS[b.scope as PriceScope] ?? b.scope} · ${b.changed_count} cambio${b.changed_count === 1 ? "" : "s"}`;

  return (
    <section className="carta pila" aria-labelledby="reetiquetar">
      <div className="fila fila--entre">
        <h3 className="titulo-seccion" id="reetiquetar">Para reetiquetar</h3>
        <Button variant="secundario" icon="download" disabled={!rows || rows.length === 0}
          onClick={() => rows && exportToExcel(RETAG_HEADERS, retagMatrix(rows), "reetiquetar")}>
          Exportar a Excel
        </Button>
      </div>
      <p className="meta">Sólo los productos cuyo precio cambió en la actualización elegida.</p>
      {batches.length > 0 && (
        <SelectField label="Actualización" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {batches.map((b) => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}
        </SelectField>
      )}
      {error && <Message tone="error">{error}</Message>}
      {batches.length === 0 && <EmptyState title="Todavía no hubo actualizaciones masivas" icon="price_change" />}
      {rows && rows.length > 0 && (
        <div className="tabla-marco">
          <table className="tabla tabla--compacta">
            <thead><tr><th>Producto</th><th>Presentación</th><th>Código interno</th><th className="num">Anterior</th><th className="num">Nuevo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.presentation_id}>
                  <td>{r.product_name}</td><td className="suave">{r.presentation_name}</td>
                  <td className="codigo">{r.internal_barcode ?? "—"}</td>
                  <td className="num">{formatPrice(r.old_price, r.sold_by_weight)}</td><td className="num fuerte">{formatPrice(r.new_price, r.sold_by_weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
