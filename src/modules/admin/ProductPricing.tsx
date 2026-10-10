import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { formatMoney } from "../pos/money";
import { getEffectiveMultiplier, suggestPresentationPrice, type PriceCategory, type PriceCategoryMultiplier } from "../catalog/priceSuggestion";
import type { Product, Presentation } from "../../shared/types";
import { Badge, Button, Message, SelectField, TextField } from "../../shared/ui";
import { PriceHistoryPanel } from "./PriceHistoryPanel";
import { BranchPricesPanel } from "./BranchPricesPanel";

type Supplier = { id: string; name: string };
type SupplierCost = {
  product_id: string;
  supplier_id: string;
  supplier_product_code: string | null;
  cost: number;
  purchase_quantity: number | null;
  last_purchase_at: string | null;
  is_primary: boolean;
  supplier: { name: string } | { name: string }[] | null;
};

export function ProductPricing({ product, presentations, onPricesSaved }: {
  product: Product;
  presentations: Presentation[];
  onPricesSaved: () => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCosts, setSupplierCosts] = useState<SupplierCost[]>([]);
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [categoryMultipliers, setCategoryMultipliers] = useState<PriceCategoryMultiplier[]>([]);
  const [defaultMultiplier, setDefaultMultiplier] = useState(2);
  const [supplierId, setSupplierId] = useState("");
  const [cost, setCost] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: suppliersData, error: suppliersError }, { data: costsData, error: costsError },
      { data: settingsData, error: settingsError }, { data: categoriesData, error: categoriesError },
      { data: multipliersData, error: multipliersError }] = await Promise.all([
      sb.from("suppliers").select("id, name").eq("active", true).order("name"),
      sb.from("supplier_products").select("product_id, supplier_id, supplier_product_code, cost, purchase_quantity, last_purchase_at, is_primary, supplier:suppliers(name)")
        .eq("product_id", product.id),
      sb.from("pricing_settings").select("default_multiplier").eq("id", 1).single(),
      sb.from("categories").select("id, parent_id"),
      sb.from("category_price_multipliers").select("category_id, multiplier")
    ]);
    const queryError = suppliersError ?? costsError ?? settingsError ?? categoriesError ?? multipliersError;
    if (queryError) { setError(queryError.message); return; }
    if (!settingsData) { setError("No se encontró la configuración general de precios."); return; }
    setSuppliers((suppliersData ?? []) as Supplier[]);
    setSupplierCosts((costsData ?? []) as SupplierCost[]);
    setDefaultMultiplier(Number(settingsData.default_multiplier));
    setCategories((categoriesData ?? []) as PriceCategory[]);
    setCategoryMultipliers((multipliersData ?? []) as PriceCategoryMultiplier[]);
  }, [product.id]);

  useEffect(() => { void load(); }, [load]);

  const selectedCost = supplierCosts.find(row => row.supplier_id === supplierId);
  const usableCost = useMemo(() => supplierCosts
    .filter(row => Number(row.cost) >= 0 && Number(row.purchase_quantity) > 0 && row.last_purchase_at)
    .sort((a, b) => Date.parse(b.last_purchase_at!) - Date.parse(a.last_purchase_at!))[0], [supplierCosts]);
  const multiplier = getEffectiveMultiplier({
    productMultiplier: product.price_multiplier,
    categoryId: product.category_id,
    categories,
    categoryMultipliers,
    defaultMultiplier
  });

  function selectSupplier(nextId: string) {
    setSupplierId(nextId);
    const row = supplierCosts.find(item => item.supplier_id === nextId);
    setCost(row ? String(row.cost) : "");
    setPurchaseQuantity(row?.purchase_quantity ? String(row.purchase_quantity) : "");
    setSupplierCode(row?.supplier_product_code ?? "");
    setIsPrimary(row?.is_primary ?? supplierCosts.length === 0);
  }

  async function saveSupplierCost(event: React.FormEvent) {
    event.preventDefault();
    const costValue = Number(cost);
    const quantityValue = Number(purchaseQuantity);
    if (!supplierId || !Number.isFinite(costValue) || costValue < 0 || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      setError("Elegí un proveedor, ingresá un costo válido y la cantidad de unidades base del envase.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    const { error: saveError } = await getSupabase().rpc("save_supplier_product_cost", {
      p_product_id: product.id,
      p_supplier_id: supplierId,
      p_cost: costValue,
      p_purchase_quantity: quantityValue,
      p_supplier_product_code: supplierCode.trim() || undefined,
      p_is_primary: isPrimary
    });
    if (saveError) setError(saveError.message);
    else {
      setMessage("Costo del proveedor guardado; ya se puede usar para sugerir precios.");
      await load();
    }
    setSaving(false);
  }

  async function applySuggestedPrice(presentation: Presentation, salePrice: number) {
    setSaving(true); setError(""); setMessage("");
    const { error: updateError } = await getSupabase().from("product_presentations")
      .update({ sale_price: salePrice }).eq("id", presentation.id);
    if (updateError) setError(updateError.message);
    else {
      setMessage(`Precio de ${presentation.name} actualizado a ${formatMoney(salePrice)}.`);
      onPricesSaved();
    }
    setSaving(false);
  }

  const baseUnitLabel = product.base_unit === "gram" ? "g" : product.base_unit === "millilitre" ? "ml" : "unidad/es";

  return (
    <>
      <section className="carta pila" aria-labelledby="costo-sugerido">
        <h3 className="titulo-seccion" id="costo-sugerido">Costo y precio sugerido</h3>
        <p className="cuerpo-s suave">El costo se registra por envase. Indicá cuántos {baseUnitLabel} contiene para calcular el costo de cada presentación.</p>
        {error && <Message tone="error">{error}</Message>}
        {message && <Message tone="exito">{message}</Message>}
        {suppliers.length === 0 ? <Message>Primero creá un proveedor en la sección Proveedores.</Message> : (
          <form onSubmit={saveSupplierCost} className="pila">
            <div className="form-fila">
              <SelectField label="Proveedor" value={supplierId} onChange={event => selectSupplier(event.target.value)} required>
                <option value="">Elegí un proveedor</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </SelectField>
              <TextField label="Costo total del envase" type="number" numeric min="0" step="0.01" value={cost}
                onChange={event => setCost(event.target.value)} required />
              <TextField label="Contenido" type="number" numeric suffix={baseUnitLabel} min="0.001" step="0.001" value={purchaseQuantity}
                onChange={event => setPurchaseQuantity(event.target.value)} required
                help={`Ejemplo: una bolsa de 25 kg se carga como 25.000 ${baseUnitLabel}.`} />
              <TextField label="Código del proveedor (opcional)" value={supplierCode} onChange={event => setSupplierCode(event.target.value)} />
            </div>
            <div className="fila fila--entre">
              <label className="casilla">
                <input type="checkbox" checked={isPrimary} onChange={event => setIsPrimary(event.target.checked)} />
                Proveedor principal
              </label>
              <Button type="submit" variant="secundario" disabled={saving || !supplierId}>{selectedCost ? "Actualizar costo y fecha de compra" : "Registrar costo"}</Button>
            </div>
          </form>
        )}

        {supplierCosts.length > 0 && (
          <div className="tabla-marco">
            <table className="tabla tabla--compacta">
              <thead><tr><th>Proveedor</th><th className="num">Costo del envase</th><th className="num">Contenido</th><th>Principal</th><th className="acciones"><span className="sr">Editar</span></th></tr></thead>
              <tbody>
                {supplierCosts.map(row => {
                  const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
                  return (
                    <tr key={row.supplier_id}>
                      <td>{supplier?.name ?? "Proveedor"}</td>
                      <td className="num">{formatMoney(Number(row.cost))}</td>
                      <td className="num">{row.purchase_quantity ?? "pendiente"} {row.purchase_quantity ? baseUnitLabel : ""}</td>
                      <td>{row.is_primary ? <Badge tone="exito" icon="check">Principal</Badge> : null}</td>
                      <td className="acciones"><Button variant="fantasma" size="compacto" icon="edit" onClick={() => selectSupplier(row.supplier_id)}>Editar</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="rotulo-seccion">Sugerencias por presentación</p>
        <p className="meta">
          Último costo registrado × multiplicador efectivo, redondeado hacia arriba al próximo múltiplo de $100.
          {usableCost ? <> Base: <span className="cifra">{formatMoney(Number(usableCost.cost))}</span> / {usableCost.purchase_quantity} {baseUnitLabel} · {multiplier}×.</> : " Registrá costo y contenido de compra para generar sugerencias."}
        </p>
        {usableCost && presentations.length > 0 && (
          <div className="tabla-marco">
            <table className="tabla tabla--compacta">
              <thead><tr><th>Presentación</th><th className="num">Precio actual</th><th className="num">Sugerido</th><th className="acciones"><span className="sr">Aplicar</span></th></tr></thead>
              <tbody>
                {presentations.map(presentation => {
                  const suggestion = suggestPresentationPrice({
                    packageCost: Number(usableCost.cost),
                    packageQuantity: Number(usableCost.purchase_quantity),
                    presentationQuantity: Number(presentation.base_quantity ?? 1),
                    multiplier,
                    soldByWeight: presentation.sold_by_weight
                  });
                  return (
                    <tr key={presentation.id}>
                      <td>{presentation.name}</td>
                      <td className="num">{formatMoney(Number(presentation.sale_price))}</td>
                      <td className="num fuerte">{suggestion ? `${formatMoney(suggestion.displayPrice)}${presentation.sold_by_weight ? "/kg" : ""}` : "—"}</td>
                      <td className="acciones">
                        {suggestion
                          ? <Button variant="secundario" size="compacto" disabled={saving} onClick={() => void applySuggestedPrice(presentation, suggestion.salePrice)}>Aplicar sugerido</Button>
                          : <span className="meta">Revisá costo y contenido</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="reja-2">
        <section className="carta pila" aria-labelledby="precio-sucursal">
          <h3 className="titulo-seccion" id="precio-sucursal">Precio por sucursal</h3>
          <BranchPricesPanel presentations={presentations} />
        </section>
        <section className="carta pila" aria-labelledby="historial-precios">
          <h3 className="titulo-seccion" id="historial-precios">Historial de precios</h3>
          <p className="meta">Cada cambio de precio de venta, quién lo hizo y la variación: sirve para seguir la inflación del producto.</p>
          <PriceHistoryPanel key={presentations.map(p => `${p.id}:${p.sale_price}`).join("|")} presentations={presentations} />
        </section>
      </div>
    </>
  );
}
