import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, TextField } from "../../shared/ui";
import { KIND_LABELS, selectableProducts, type AssignKind, type AssignableProduct } from "./bulkAssign";

interface BulkAssignPanelProps {
  kind: AssignKind;
  id: string;
  name: string;
  onDone: (message: string) => void;
}

/**
 * RF-03: asignar una marca, rubro o etiqueta a varios productos a la vez. Lista los
 * productos activos con buscador y casillas; marca los que ya la tienen. La escritura
 * va por la RPC assign_classifier, en una sola operación.
 */
export function BulkAssignPanel({ kind, id, name, onDone }: BulkAssignPanelProps) {
  const sb = getSupabase();
  const [products, setProducts] = useState<AssignableProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"assign" | "remove" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void sb.from("products")
      .select("id, name, brand_id, category_id, product_labels(label_id)")
      .eq("active", true)
      .order("name")
      .then(({ data, error: err }) => {
        if (err) return setError(err.message);
        setProducts((data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          brand_id: p.brand_id,
          category_id: p.category_id,
          label_ids: (p.product_labels ?? []).map((l) => l.label_id)
        })));
      });
  }, [sb]);

  const visible = useMemo(() => (products ? selectableProducts(products, query) : []), [products, query]);
  const has = (p: AssignableProduct) =>
    kind === "brand" ? p.brand_id === id : kind === "category" ? p.category_id === id : p.label_ids.includes(id);

  const toggle = (productId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };
  const selectVisible = () => setSelected(new Set(visible.map((p) => p.id)));

  async function run(remove: boolean) {
    if (selected.size === 0) return;
    setBusy(remove ? "remove" : "assign");
    setError("");
    const { data, error: err } = await sb.rpc("assign_classifier", {
      p_kind: kind, p_id: id, p_product_ids: [...selected], p_remove: remove
    });
    setBusy(null);
    if (err) return setError(err.message);
    const n = data ?? 0;
    onDone(remove
      ? `Se quitó ${KIND_LABELS[kind]} "${name}" de ${n} producto${n === 1 ? "" : "s"}.`
      : `${KIND_LABELS[kind]} "${name}" asignada a ${n} producto${n === 1 ? "" : "s"} (los que ya la tenían no cuentan).`);
  }

  return (
    <div style={{ display: "grid", gap: "var(--esp-s)" }}>
      <div style={{ display: "flex", gap: "var(--esp-s)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <TextField label={`Asignar ${KIND_LABELS[kind]} "${name}" a`} placeholder="Buscar producto" value={query}
          onChange={(e) => setQuery(e.target.value)} style={{ minWidth: "16rem" }} />
        <Button variant="fantasma" onClick={selectVisible} disabled={visible.length === 0}>Marcar los {visible.length} visibles</Button>
        <Button variant="fantasma" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Desmarcar</Button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {products && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "16rem", overflowY: "auto", display: "grid", gap: ".15rem" }}>
          {visible.map((p) => (
            <li key={p.id}>
              <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontWeight: 500, padding: ".2rem .4rem", borderRadius: "var(--radio-control)" }}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <span style={{ flex: 1 }}>{p.name}</span>
                {has(p) && <Badge tone="exito">ya la tiene</Badge>}
              </label>
            </li>
          ))}
          {visible.length === 0 && <li className="field-help">Ningún producto coincide.</li>}
        </ul>
      )}
      <div style={{ display: "flex", gap: "var(--esp-s)", flexWrap: "wrap" }}>
        <Button onClick={() => void run(false)} disabled={selected.size === 0 || busy !== null} loading={busy === "assign"}>
          Asignar a {selected.size} producto{selected.size === 1 ? "" : "s"}
        </Button>
        <Button variant="secundario" onClick={() => void run(true)} disabled={selected.size === 0 || busy !== null} loading={busy === "remove"}>
          Quitar de los marcados
        </Button>
      </div>
    </div>
  );
}
