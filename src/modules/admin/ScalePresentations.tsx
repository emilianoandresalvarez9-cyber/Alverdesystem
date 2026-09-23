import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, EmptyState, GlassCard, TextField } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { pricePerKiloFromGram, validatePricePerKilo } from "../catalog/scalePricing";

type Row = {
  id: string;
  name: string;
  base_quantity: number;
  sale_price: number;
  sold_by_weight: boolean;
  product: { name: string; base_unit: string };
};

/**
 * Qué presentaciones se venden con balanza (ADR-001). Marcada: la caja pide los gramos al
 * escanear y el stock se lleva en gramos. Sin marcar: se vende por unidad (por ejemplo, bolsitas).
 */
export function ScalePresentations() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await getSupabase()
      .from("product_presentations")
      .select("id, name, base_quantity, sale_price, sold_by_weight, product:products!inner(name, base_unit, active)")
      .eq("active", true)
      .in("products.base_unit", ["gram", "millilitre"])
      .order("name");
    if (err) return setError(err.message);
    setRows((data ?? []).map((raw) => {
      const product = Array.isArray(raw.product) ? raw.product[0] : raw.product;
      return {
        id: raw.id as string,
        name: raw.name as string,
        base_quantity: Number(raw.base_quantity),
        sale_price: Number(raw.sale_price),
        sold_by_weight: Boolean(raw.sold_by_weight),
        product: { name: String(product?.name ?? ""), base_unit: String(product?.base_unit ?? "") }
      };
    }).sort((a, b) => a.product.name.localeCompare(b.product.name)));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const needle = filter.trim().toLowerCase();
  const visible = (rows ?? []).filter((r) => !needle || `${r.product.name} ${r.name}`.toLowerCase().includes(needle));

  return (
    <div className="pos-setup" style={{ maxWidth: "none" }}>
      <GlassCard className="pos-panel">
        <h2 style={{ marginTop: 0 }}>Venta con balanza</h2>
        <p className="field-help">
          Marcá "Balanza" en lo que se vende suelto (lentejas, arroz): al escanearlo, la caja pide los gramos.
          Las bolsitas armadas (por ejemplo, palitos de 150 g o 250 g) quedan sin marcar y se venden por unidad.
        </p>
        <TextField label="Buscar" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Producto o presentación" />
      </GlassCard>
      {error && <p className="form-error" role="alert">{error}</p>}
      {rows && visible.length === 0 && <EmptyState title="Sin presentaciones">No hay productos en gramos o mililitros que coincidan.</EmptyState>}
      <ul className="pos-lines">
        {visible.map((row) => <ScaleRow key={row.id} row={row} onSaved={load} />)}
      </ul>
    </div>
  );
}

function ScaleRow({ row, onSaved }: { row: Row; onSaved: () => Promise<void> }) {
  const [price, setPrice] = useState(row.sold_by_weight ? String(pricePerKiloFromGram(row.sale_price)) : "");
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const unit = row.product.base_unit === "millilitre" ? "ml" : "g";
  const fixedSize = row.base_quantity !== 1;

  async function save(enable: boolean, convert = false) {
    const pricePerKg = Number(price.replace(/\./g, "").replace(",", "."));
    if (enable) {
      const invalid = validatePricePerKilo(pricePerKg);
      if (invalid) return setMessage({ tone: "error", text: invalid });
      if (fixedSize && !convert) return setConfirmConvert(true);
    }
    setBusy(true);
    const { error } = await getSupabase().rpc("set_presentation_scale", {
      p_presentation_id: row.id,
      p_sold_by_weight: enable,
      p_price_per_kg: enable ? pricePerKg : null,
      p_convert: convert
    });
    setBusy(false);
    setConfirmConvert(false);
    if (error) return setMessage({ tone: "error", text: error.message });
    setMessage({ tone: "ok", text: enable ? `Guardado: ${formatMoney(pricePerKg)} por kilo.` : "Se vende por unidad." });
    await onSaved();
  }

  return (
    <li className="pos-line" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(9rem,12rem) auto" }}>
      <div>
        <p className="pos-line-name">{row.product.name} · {row.name} {row.sold_by_weight && <Badge tone="exito">Balanza</Badge>}</p>
        <p className="pos-line-detail">
          {row.sold_by_weight
            ? `${formatMoney(pricePerKiloFromGram(row.sale_price))} por kilo · stock en ${unit}`
            : `${row.base_quantity} ${unit} fijos · ${formatMoney(row.sale_price)} c/u`}
        </p>
        {confirmConvert && (
          <p className="form-error" role="alert">
            Esta presentación es de {row.base_quantity} {unit} fijos. Si la marcás con Balanza deja de ser un paquete y pasa a venderse por gramo.
            {" "}Si es una bolsita armada, no la conviertas.
          </p>
        )}
        {message && <p className="pos-feedback" data-tone={message.tone} role="status">{message.text}</p>}
      </div>
      <TextField label="Precio por kilo" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div className="pos-qty">
        {confirmConvert ? (
          <>
            <Button variant="peligro" onClick={() => void save(true, true)} loading={busy}>Sí, convertir</Button>
            <Button variant="fantasma" onClick={() => setConfirmConvert(false)}>Cancelar</Button>
          </>
        ) : row.sold_by_weight ? (
          <>
            <Button variant="secundario" onClick={() => void save(true)} loading={busy}>Guardar precio</Button>
            <Button variant="fantasma" onClick={() => void save(false)} disabled={busy}>Quitar balanza</Button>
          </>
        ) : (
          <Button onClick={() => void save(true)} loading={busy}>Marcar balanza</Button>
        )}
      </div>
    </li>
  );
}
