import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { useBranch } from "../../shared/branch/BranchContext";
import { Button } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { pricePerKiloFromGram, validatePricePerKilo } from "../catalog/scalePricing";
import type { Presentation } from "../../shared/types";

type Key = `${string}:${string}`; // sucursal:presentación

/**
 * RF-69: precio propio de cada sucursal. Vacío = usa el precio base. En balanza se carga por
 * kilo (múltiplo de $10) y se guarda por gramo (ADR-001). Solo administración (set_branch_price).
 */
export function BranchPricesPanel({ presentations }: { presentations: Presentation[] }) {
  const { branches } = useBranch();
  const [own, setOwn] = useState<Record<Key, number>>({});
  const [draft, setDraft] = useState<Record<Key, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = presentations.map((p) => p.id).join(",");

  const load = useCallback(async () => {
    if (!ids) return;
    const { data, error: err } = await getSupabase().from("branch_prices")
      .select("branch_id, presentation_id, sale_price").in("presentation_id", ids.split(","));
    if (err) return setError(err.message);
    const next: Record<Key, number> = {};
    for (const row of data ?? []) next[`${row.branch_id}:${row.presentation_id}`] = Number(row.sale_price);
    setOwn(next);
    setDraft({});
  }, [ids]);

  useEffect(() => { void load(); }, [load]);

  if (branches.length < 2) {
    return <p className="field-help">Con una sola sucursal rige el precio base. Al crear otra sucursal vas a poder darle precios propios acá.</p>;
  }

  const shown = (p: Presentation, value: number) => (p.sold_by_weight ? pricePerKiloFromGram(value) : value);
  const valueOf = (key: Key, p: Presentation) =>
    draft[key] ?? (own[key] !== undefined ? String(shown(p, own[key])) : "");

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      let changes = 0;
      for (const [key, raw] of Object.entries(draft) as [Key, string][]) {
        const [branchId, presentationId] = key.split(":") as [string, string];
        const presentation = presentations.find((p) => p.id === presentationId);
        if (!presentation) continue;
        const text = raw.trim().replace(",", ".");
        let price: number | null = null;
        if (text !== "") {
          const value = Number(text);
          if (!Number.isFinite(value) || value < 0) throw new Error(`Precio inválido en ${presentation.name}.`);
          if (presentation.sold_by_weight) {
            const problem = validatePricePerKilo(value);
            if (problem) throw new Error(`${presentation.name}: ${problem}`);
            price = Math.round(value * 100) / 100000;
          } else {
            price = Math.round(value * 100) / 100;
          }
        }
        if (price === null && own[key] === undefined) continue;
        if (price !== null && own[key] === price) continue;
        const { error: err } = await getSupabase().rpc("set_branch_price", {
          p_presentation_id: presentationId, p_branch_id: branchId, p_price: price as number
        });
        if (err) throw new Error(err.message);
        changes++;
      }
      setSaved(changes ? `Se guardaron ${changes} precio${changes === 1 ? "" : "s"} por sucursal.` : "No había cambios.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--esp-s)" }}>
      <p className="field-help" style={{ margin: 0 }}>
        Dejá vacío para usar el precio base. En productos de balanza el precio es por kilo.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Presentación</th>
              <th>Base</th>
              {branches.map((b) => <th key={b.id}>{b.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {presentations.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.sold_by_weight ? " (por kg)" : ""}</td>
                <td>{formatMoney(shown(p, Number(p.sale_price)))}</td>
                {branches.map((b) => {
                  const key: Key = `${b.id}:${p.id}`;
                  return (
                    <td key={b.id}>
                      <input
                        aria-label={`Precio de ${p.name} en ${b.name}`}
                        inputMode="decimal"
                        placeholder="base"
                        value={valueOf(key, p)}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        style={{ width: "7.5rem" }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="notice" role="status">{saved}</p>}
      <div><Button variant="secundario" onClick={() => void save()} loading={busy} disabled={Object.keys(draft).length === 0}>Guardar precios por sucursal</Button></div>
    </div>
  );
}
