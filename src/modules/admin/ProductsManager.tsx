import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Enums } from "../../shared/supabase/database.types";
import { Button, TextField, SelectField, Message, Modal } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { parseEditedPrice, priceEditStart, pricePerKiloFromGram } from "../catalog/scalePricing";
import { formatQuantity } from "../stock/format";
import { normalizeManufacturerBarcode } from "./manufacturerBarcode";
import { ProductPricing } from "./ProductPricing";

import type { Product, Presentation, Brand, Category } from "../../shared/types";

export function ProductsManager() {
  const [errorMsg, setErrorMsg] = useState("");
  const [pricePrompt, setPricePrompt] = useState<{ presId: string; soldByWeight: boolean } | null>(null);
  const [newPriceInput, setNewPriceInput] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  
  const [loading, setLoading] = useState(false);

  // Form states (simplified)
  const [productName, setProductName] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productBrandId, setProductBrandId] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productBaseUnit, setProductBaseUnit] = useState<Enums<"base_unit">>("unit");
  const [productMultiplier, setProductMultiplier] = useState("");

  const sb = getSupabase();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: pData }, { data: bData }, { data: cData }] = await Promise.all([
      sb.from("products").select("*").order("name"),
      sb.from("brands").select("*").order("name"),
      sb.from("categories").select("*").order("name")
    ]);
    setProducts(pData || []);
    setBrands(bData || []);
    setCategories(cData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectProduct = async (prod: Product | null) => {
    if (!prod) return setSelectedProduct(null);
    setSelectedProduct(prod);
    setProductName(prod.name);
    setProductBarcode(prod.manufacturer_barcode ?? "");
    setProductBrandId(prod.brand_id || "");
    setProductCategoryId(prod.category_id || "");
    setProductBaseUnit(prod.base_unit || "unit");
    setProductMultiplier(prod.price_multiplier == null ? "" : String(prod.price_multiplier));

    const { data } = await sb.from("product_presentations").select("*").eq("product_id", prod.id).order("name");
    setPresentations(data || []);
  };

  const handleSaveProduct = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!productName.trim()) return setErrorMsg("Nombre obligatorio");
    const parsedMultiplier = productMultiplier.trim() === "" ? null : Number(productMultiplier);
    if (parsedMultiplier !== null && (!Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0)) {
      return setErrorMsg("El multiplicador propio debe ser mayor que cero o quedar vacío para heredar.");
    }
    const payload = {
      name: productName.trim(),
      manufacturer_barcode: normalizeManufacturerBarcode(productBarcode),
      brand_id: productBrandId || null,
      category_id: productCategoryId || null,
      base_unit: productBaseUnit,
      price_multiplier: parsedMultiplier,
      active: true
    };

    if (selectedProduct) {
      const { data, error } = await sb.from("products").update(payload).eq("id", selectedProduct.id).select().single();
      if (error) setErrorMsg(error.message);
      else { setSuccessMsg("Producto actualizado"); setSelectedProduct(data as Product); void loadData(); }
    } else {
      const { error, data } = await sb.from("products").insert(payload).select().single();
      if (error) setErrorMsg(error.message);
      else {
        setSuccessMsg("Producto creado");
        void loadData();
        await handleSelectProduct(data);
      }
    }
  };

  const handleArchiveProduct = async () => {
    if (!selectedProduct) return;
    // confirm bypass
    const { error } = await sb.from("products").update({ active: false }).eq("id", selectedProduct.id);
    if (error) setErrorMsg(error.message);
    else { setSuccessMsg("Archivado"); loadData(); setSelectedProduct(null); }
  };

  // Presentations
  const [presName, setPresName] = useState("");
  const [presBaseQty, setPresBaseQty] = useState("");
  const [presSalePrice, setPresSalePrice] = useState("");

  const handleSavePresentation = async () => {
    if (!selectedProduct || !presName || !presBaseQty || !presSalePrice) return setErrorMsg("Faltan datos");
    
    const { error } = await sb.from("product_presentations").insert({
      product_id: selectedProduct.id,
      name: presName,
      base_quantity: parseFloat(presBaseQty),
      sale_price: parseFloat(presSalePrice)
    });

    if (error) setErrorMsg(error.message);
    else {
      setSuccessMsg("Presentación añadida");
      setPresName(""); setPresBaseQty(""); setPresSalePrice("");
      handleSelectProduct(selectedProduct);
    }
  };

  const handleUpdatePrice = (pr: Presentation) => {
    setErrorMsg("");
    setSuccessMsg("");
    setPricePrompt({ presId: pr.id, soldByWeight: pr.sold_by_weight });
    setNewPriceInput(priceEditStart(pr));
  };

  const confirmUpdatePrice = async () => {
    if (!pricePrompt) return;
    const parsed = parseEditedPrice(newPriceInput, pricePrompt.soldByWeight);
    if (!parsed.ok) {
      setErrorMsg(parsed.error);
      return;
    }
    const { error } = await sb.from("product_presentations").update({ sale_price: parsed.salePrice }).eq("id", pricePrompt.presId);
    if (error) setErrorMsg(error.message);
    else {
      setSuccessMsg("Precio actualizado");
      handleSelectProduct(selectedProduct);
      setPricePrompt(null);
    }
  };

  const startNew = () => {
    setSelectedProduct(null);
    setProductName("");
    setProductBarcode("");
    setProductBrandId("");
    setProductCategoryId("");
    setProductBaseUnit("unit");
    setProductMultiplier("");
    setErrorMsg("");
    setSuccessMsg("");
  };
  const priceText = (pr: Presentation) =>
    pr.sold_by_weight ? `${formatMoney(pricePerKiloFromGram(Number(pr.sale_price)))}/kg` : formatMoney(Number(pr.sale_price));

  return (
    <>
      <div className="fila fila--m productos-barra">
        <SelectField inline label="Producto" className="crece" value={selectedProduct?.id ?? ""} disabled={loading}
          onChange={(e) => void handleSelectProduct(products.find((p) => p.id === e.target.value) ?? null)}>
          <option value="">{loading ? "Cargando…" : "Elegí un producto…"}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (archivado)"}</option>)}
        </SelectField>
        <Button variant="secundario" icon="add" onClick={startNew}>Nuevo producto</Button>
      </div>

      {errorMsg && <Message tone="error">{errorMsg}</Message>}
      {successMsg && <Message tone="exito">{successMsg}</Message>}

      <section className="carta pila" aria-labelledby="ficha-producto">
        <h3 className="titulo-seccion" id="ficha-producto">{selectedProduct ? "Ficha del producto" : "Nuevo producto"}</h3>
        <div className="form-fila form-fila--tres">
          <TextField label="Nombre" value={productName} onChange={e => setProductName(e.target.value)} />
          <TextField
            label="Código de barras del fabricante"
            icon="barcode"
            value={productBarcode}
            onChange={e => setProductBarcode(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Escaneá o escribí el código"
            help="Para encontrarlo al escanearlo en Caja. Conserva los ceros iniciales."
          />
          <SelectField label="Marca" value={productBrandId} onChange={e => setProductBrandId(e.target.value)}>
            <option value="">Sin marca</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <SelectField label="Rubro" value={productCategoryId} onChange={e => setProductCategoryId(e.target.value)}>
            <option value="">Sin rubro</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Unidad base" value={productBaseUnit} onChange={e => setProductBaseUnit(e.target.value as Enums<"base_unit">)}>
            <option value="unit">Unidad</option>
            <option value="gram">Gramos</option>
            <option value="millilitre">Mililitros</option>
          </SelectField>
          <TextField label="Multiplicador propio (opcional)" type="number" numeric min="0.001" step="0.001"
            value={productMultiplier} onChange={e => setProductMultiplier(e.target.value)}
            placeholder="Usa el del rubro" help="Vacío: usa el multiplicador del rubro y luego el general." />
        </div>
        <div className="fila">
          <Button onClick={handleSaveProduct}>Guardar producto</Button>
          {selectedProduct && selectedProduct.active && (
            <Button variant="peligro" icon="archive" onClick={handleArchiveProduct}>Archivar</Button>
          )}
        </div>
      </section>

      {selectedProduct && (
        <>
          <section className="carta pila" aria-labelledby="presentaciones">
            <h3 className="titulo-seccion" id="presentaciones">Presentaciones</h3>
            {presentations.length > 0 && (
              <div className="tabla-marco">
                <table className="tabla tabla--compacta">
                  <thead><tr><th>Nombre</th><th className="num">Cantidad base</th><th className="num">Precio</th><th className="acciones"><span className="sr">Acciones</span></th></tr></thead>
                  <tbody>
                    {presentations.map(pr => (
                      <tr key={pr.id}>
                        <td>{pr.name}</td>
                        <td className="num">{formatQuantity(Number(pr.base_quantity), selectedProduct.base_unit)}</td>
                        <td className="num">{priceText(pr)}</td>
                        <td className="acciones">
                          <Button variant="fantasma" size="compacto" icon="sell" onClick={() => handleUpdatePrice(pr)}>Cambiar precio base</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="form-fila">
              <TextField label="Nombre" placeholder="Bolsa 1 kg" value={presName} onChange={e => setPresName(e.target.value)} />
              <TextField label="Cantidad base" type="number" numeric value={presBaseQty} onChange={e => setPresBaseQty(e.target.value)} />
              <TextField label="Precio" type="number" numeric value={presSalePrice} onChange={e => setPresSalePrice(e.target.value)} />
              <Button variant="secundario" icon="add" onClick={handleSavePresentation}>Añadir</Button>
            </div>
          </section>

          <ProductPricing key={selectedProduct.id} product={selectedProduct} presentations={presentations}
            onPricesSaved={() => { void handleSelectProduct(selectedProduct); }} />
        </>
      )}

      <Modal
        open={pricePrompt !== null}
        title="Cambiar precio"
        onClose={() => setPricePrompt(null)}
        footer={(
          <>
            <Button variant="fantasma" onClick={() => setPricePrompt(null)}>Cancelar</Button>
            <Button onClick={confirmUpdatePrice} disabled={!pricePrompt || !parseEditedPrice(newPriceInput, pricePrompt.soldByWeight).ok}>
              Guardar precio
            </Button>
          </>
        )}
      >
        <TextField
          label={pricePrompt?.soldByWeight ? "Precio nuevo por kilo" : "Precio nuevo"}
          type="number"
          numeric
          min="0"
          step={pricePrompt?.soldByWeight ? "10" : "0.01"}
          suffix={pricePrompt?.soldByWeight ? "/kg" : undefined}
          help={pricePrompt?.soldByWeight ? "Se vende con balanza: el precio va por kilo, en múltiplos de $10." : undefined}
          value={newPriceInput}
          onChange={e => setNewPriceInput(e.target.value)}
          autoFocus
        />
      </Modal>
    </>
  );
}
