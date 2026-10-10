import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { exportToExcel } from "../../shared/export/excel";
import { Badge, Button, EmptyState, GlassCard, SelectField, TextField } from "../../shared/ui";
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
    <div style={{ display: "grid", gap: "var(--esp-m)" }}>
      <GlassCard>
        <h2>Actualización masiva de precios</h2>
        <p className="field-help">
          Primero se muestra qué cambiaría; nada se guarda hasta que confirmes. Los precios se aplican todos juntos:
          si algo falla, no cambia ninguno.
        </p>

        <div style={{ display: "flex", gap: "var(--esp-m)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <SelectField label="Aplicar a" value={scope}
            onChange={(e) => { setScope(e.target.value as PriceScope); setScopeId(""); setPreview(null); }}>
            {(Object.keys(SCOPE_LABELS) as PriceScope[]).map((s) => <option key={s} value={s}>{SCOPE_LABELS[s]}</option>)}
          </SelectField>
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
          <TextField label="Porcentaje (%)" inputMode="decimal" value={percentage}
            onChange={(e) => { setPercentage(e.target.value); setPreview(null); }} help="Negativo para bajar" />
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", paddingBottom: ".6rem" }}>
            <input type="checkbox" checked={roundTo100} onChange={(e) => { setRoundTo100(e.target.checked); setPreview(null); }} />
            Redondear a múltiplo de $100 (RF-29)
          </label>
          <Button variant="secundario" onClick={() => void run(false)} loading={busy === "preview"} disabled={busy !== null}>
            Ver qué cambiaría
          </Button>
        </div>
        {error && <p className="form-error" role="alert" style={{ marginTop: "var(--esp-s)" }}>{error}</p>}
      </GlassCard>

      {preview && summary && (
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--esp-m)", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Revisá antes de confirmar</h3>
            <Badge tone={summary.count ? "aviso" : "neutro"}>
              {summary.count} cambio{summary.count === 1 ? "" : "s"} · {summary.increases} suben · {summary.decreases} bajan
            </Badge>
          </div>
          <p className="field-help">
            {priceBranchName ? `Precios de ${priceBranchName}` : "Precio base"} · {SCOPE_LABELS[scope]}{scopeName ? ` · ${scopeName}` : ""} · {percentage.replace(".", ",")} %
            {roundTo100 ? " · redondeado a $100" : ""}
          </p>
          {summary.count === 0 ? (
            <EmptyState title="Ningún precio cambiaría">Con ese porcentaje y redondeo, todos quedan igual.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th>Presentación</th><th>Anterior</th><th>Nuevo</th><th>Diferencia</th></tr></thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.presentation_id}>
                        <td>{row.product_name}</td>
                        <td>{row.presentation_name}</td>
                        <td>{formatPrice(row.old_price, row.sold_by_weight)}</td>
                        <td><strong>{formatPrice(row.new_price, row.sold_by_weight)}</strong></td>
                        <td>{formatDiff(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: "var(--esp-s)", marginTop: "var(--esp-m)", flexWrap: "wrap" }}>
                <Button onClick={() => void run(true)} loading={busy === "apply"} disabled={busy !== null}>
                  Confirmar {summary.count} cambio{summary.count === 1 ? "" : "s"}
                </Button>
                <Button variant="fantasma" onClick={() => setPreview(null)} disabled={busy !== null}>Cancelar</Button>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {applied && (
        <p className="notice" role="status">
          Listo: se actualizaron {applied.count} precio{applied.count === 1 ? "" : "s"} en una sola operación.
          La lista para reetiquetar está abajo.
        </p>
      )}

      <RetagList highlightBatchId={applied?.batchId ?? null} />
    </div>
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
    `${new Date(b.created_at).toLocaleString("es-AR")} · ${b.branch_id ? branches.find((x) => x.id === b.branch_id)?.name ?? "Sucursal" : "Base"} · ${b.percent > 0 ? "+" : ""}${b.percent} % · ${SCOPE_LABELS[b.scope as PriceScope] ?? b.scope} · ${b.changed_count} cambio${b.changed_count === 1 ? "" : "s"}`;

  return (
    <GlassCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--esp-m)", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>Para reetiquetar (RF-30)</h3>
          <p className="field-help">Solo los productos cuyo precio cambió en la actualización elegida.</p>
        </div>
        {batches.length > 0 && (
          <SelectField label="Actualización" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {batches.map((b) => <option key={b.id} value={b.id}>{batchLabel(b)}</option>)}
          </SelectField>
        )}
        <Button variant="secundario" disabled={!rows || rows.length === 0}
          onClick={() => rows && exportToExcel(RETAG_HEADERS, retagMatrix(rows), "reetiquetar")}>
          Exportar a Excel
        </Button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {batches.length === 0 && <EmptyState title="Todavía no hubo actualizaciones masivas" />}
      {rows && rows.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "var(--esp-m)" }}>
          <table>
            <thead><tr><th>Producto</th><th>Presentación</th><th>Código interno</th><th>Anterior</th><th>Nuevo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.presentation_id}>
                  <td>{r.product_name}</td><td>{r.presentation_name}</td>
                  <td><code>{r.internal_barcode ?? "—"}</code></td>
                  <td>{formatPrice(r.old_price, r.sold_by_weight)}</td><td><strong>{formatPrice(r.new_price, r.sold_by_weight)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
