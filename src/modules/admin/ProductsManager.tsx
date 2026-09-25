import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, TextField, SelectField, GlassCard, Badge, EmptyState } from "../../shared/ui";
import { ProductPricing } from "./ProductPricing";

import type { Product, Presentation, Brand, Category } from "../../shared/types";

export function ProductsManager() {
  const [errorMsg, setErrorMsg] = useState("");
  const [pricePrompt, setPricePrompt] = useState<{presId: string, oldPrice: number} | null>(null);
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
  const [productBrandId, setProductBrandId] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productBaseUnit, setProductBaseUnit] = useState("unit");
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
    setProductBrandId(prod.brand_id || "");
    setProductCategoryId(prod.category_id || "");
    setProductBaseUnit(prod.base_unit || "unit");
    setProductMultiplier(prod.price_multiplier == null ? "" : String(prod.price_multiplier));

    const { data } = await sb.from("product_presentations").select("*").eq("product_id", prod.id).order("name");
    setPresentations(data || []);
  };

  const handleSaveProduct = async () => {
    if (!productName) return setErrorMsg("Nombre obligatorio");
    const parsedMultiplier = productMultiplier.trim() === "" ? null : Number(productMultiplier);
    if (parsedMultiplier !== null && (!Number.isFinite(parsedMultiplier) || parsedMultiplier <= 0)) {
      return setErrorMsg("El multiplicador propio debe ser mayor que cero o quedar vacío para heredar.");
    }
    const payload = {
      name: productName,
      brand_id: productBrandId || null,
      category_id: productCategoryId || null,
      base_unit: productBaseUnit,
      price_multiplier: parsedMultiplier,
      active: true
    };

    if (selectedProduct) {
      const { data, error } = await sb.from("products").update(payload).eq("id", selectedProduct.id).select().single();
      if (error) setErrorMsg(error.message);
      else { setSuccessMsg("Actualizado"); setSelectedProduct(data as Product); void loadData(); }
    } else {
      const { error, data } = await sb.from("products").insert(payload).select().single();
      if (error) setErrorMsg(error.message);
      else {
        setSuccessMsg("Creado");
        loadData();
        handleSelectProduct(data);
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

  const handleUpdatePrice = (presId: string, oldPrice: number) => {
    setPricePrompt({presId, oldPrice});
    setNewPriceInput(oldPrice.toString());
  };

  const confirmUpdatePrice = async () => {
    if (!pricePrompt) return;
    const { error } = await sb.from("product_presentations").update({ sale_price: parseFloat(newPriceInput) }).eq("id", pricePrompt.presId);
    if (error) setErrorMsg(error.message);
    else {
      setSuccessMsg("Precio actualizado");
      handleSelectProduct(selectedProduct);
    }
    setPricePrompt(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--esp-m)" }}>
      {/* List */}
      <GlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--esp-m)" }}>
          <h2 style={{ margin: 0 }}>Productos</h2>
          <Button onClick={() => { setSelectedProduct(null); setProductName(""); setProductBrandId(""); setProductCategoryId(""); setProductMultiplier(""); }}>
            + Nuevo Producto
          </Button>
        </div>
        {loading ? <p>Cargando...</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--esp-xs)" }}>
            {products.map(p => (
              <li key={p.id} onClick={() => handleSelectProduct(p)} style={{ padding: "var(--esp-xs)", border: "1px solid var(--glass-borde)", borderRadius: "var(--borde-radius-s)", cursor: "pointer", background: selectedProduct?.id === p.id ? "var(--accent-primary-alpha)" : "transparent" }}>
                <strong>{p.name}</strong> {!p.active && <Badge tone="aviso">Archivado</Badge>}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Detail */}
      <GlassCard>
        <h2 style={{ margin: 0, marginBottom: "var(--esp-m)" }}>
          {selectedProduct ? "Editar Producto" : "Nuevo Producto"}
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-s)" }}>
          <TextField label="Nombre" value={productName} onChange={e => setProductName(e.target.value)} />
          
          <SelectField label="Marca" value={productBrandId} onChange={e => setProductBrandId(e.target.value)}>
            <option value="">Sin Marca</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>

          <SelectField label="Rubro" value={productCategoryId} onChange={e => setProductCategoryId(e.target.value)}>
            <option value="">Sin Rubro</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>

          <SelectField label="Unidad Base" value={productBaseUnit} onChange={e => setProductBaseUnit(e.target.value)}>
            <option value="unit">Unidad</option>
            <option value="gram">Gramos</option>
            <option value="millilitre">Mililitros</option>
          </SelectField>

          <TextField label="Multiplicador propio (opcional)" type="number" min="0.001" step="0.001"
            value={productMultiplier} onChange={e => setProductMultiplier(e.target.value)}
            help="Vacío: usa el multiplicador del rubro y luego el general." />

          <div style={{ display: "flex", gap: "var(--esp-s)" }}>
            <Button onClick={handleSaveProduct}>Guardar Producto</Button>
            {selectedProduct && selectedProduct.active && (
              <Button variant="peligro" onClick={handleArchiveProduct}>Archivar</Button>
            )}
          </div>
        </div>

        {selectedProduct && (
          <div style={{ marginTop: "var(--esp-l)", borderTop: "1px solid var(--glass-borde)", paddingTop: "var(--esp-m)" }}>
            <ProductPricing key={selectedProduct.id} product={selectedProduct} presentations={presentations}
              onPricesSaved={() => { void handleSelectProduct(selectedProduct); }} />
            <h3>Presentaciones</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: "var(--esp-s)" }}>
              {presentations.map(pr => (
                <li key={pr.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--glass-borde)", paddingBottom: "var(--esp-xs)", marginBottom: "var(--esp-xs)" }}>
                  <span>{pr.name} (Cant: {pr.base_quantity}) - ${pr.sale_price}</span>
                  <Button variant="fantasma" onClick={() => handleUpdatePrice(pr.id, pr.sale_price)}>Cambiar Precio</Button>
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", gap: "var(--esp-xs)", alignItems: "flex-end" }}>
              <TextField label="Nombre Pres." value={presName} onChange={e => setPresName(e.target.value)} />
              <TextField label="Cant. Base" type="number" value={presBaseQty} onChange={e => setPresBaseQty(e.target.value)} />
              <TextField label="Precio ($)" type="number" value={presSalePrice} onChange={e => setPresSalePrice(e.target.value)} />
              <Button onClick={handleSavePresentation}>Añadir</Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
