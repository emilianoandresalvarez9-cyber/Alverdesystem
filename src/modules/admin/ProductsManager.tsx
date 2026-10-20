import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Enums } from "../../shared/supabase/database.types";
import { Button, TextField, SelectField, Message, Modal } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { pricePerKiloFromGram } from "../catalog/scalePricing";
import { formatQuantity } from "../stock/format";
import { ProductPricing } from "./ProductPricing";
import {
  EMPTY_PRESENTATION_FORM, EMPTY_PRODUCT_FORM, MISSING_PRESENTATION_WARNING, baseQuantityHelp, createProductWithPresentation,
  parsePresentationForm, parseProductForm, productFormFrom, productOptionLabel,
  type PresentationFormValues, type ProductFormValues, type ProductStore
} from "./productForm";

import type { Product, Presentation, Brand, Category } from "../../shared/types";

type ProductRow = Product & { product_presentations: { active: boolean }[] };

export function ProductsManager() {
  const [errorMsg, setErrorMsg] = useState("");
  const [pricePrompt, setPricePrompt] = useState<{presId: string, oldPrice: number} | null>(null);
  const [newPriceInput, setNewPriceInput] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  // Último producto creado: el formulario vuelve a "Nuevo producto" y desde el aviso se abre su ficha.
  const [createdProduct, setCreatedProduct] = useState<Product | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  const [presForm, setPresForm] = useState<PresentationFormValues>(EMPTY_PRESENTATION_FORM);
  const setField = (patch: Partial<ProductFormValues>) => setForm((prev) => ({ ...prev, ...patch }));
  const setPresField = (patch: Partial<PresentationFormValues>) => setPresForm((prev) => ({ ...prev, ...patch }));

  const sb = getSupabase();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: pData, error: pError }, { data: bData }, { data: cData }] = await Promise.all([
      sb.from("products").select("*, product_presentations(active)").order("name"),
      sb.from("brands").select("*").order("name"),
      sb.from("categories").select("*").order("name")
    ]);
    if (pError) setErrorMsg(`No se pudieron cargar los productos: ${pError.message}`);
    setProducts((pData ?? []) as ProductRow[]);
    setBrands(bData || []);
    setCategories(cData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectProduct = async (prod: Product | null, keepPresentationForm = false) => {
    setCreatedProduct(null);
    if (!keepPresentationForm) setPresForm(EMPTY_PRESENTATION_FORM);
    if (!prod) return startNew();
    setSelectedProduct(prod);
    setForm(productFormFrom(prod));

    const { data } = await sb.from("product_presentations").select("*").eq("product_id", prod.id).order("name");
    setPresentations(data || []);
  };

  const store: ProductStore = {
    insertProduct: async (payload) => {
      const { data, error } = await sb.from("products").insert(payload).select().single();
      return { data, error };
    },
    insertPresentation: async (payload) => {
      const { error } = await sb.from("product_presentations").insert(payload);
      return { error };
    }
  };

  const handleSaveProduct = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (selectedProduct) {
      const parsed = parseProductForm(form);
      if (!parsed.ok) return setErrorMsg(parsed.error);
      setSaving(true);
      const { data, error } = await sb.from("products").update(parsed.value).eq("id", selectedProduct.id).select().single();
      setSaving(false);
      if (error) setErrorMsg(error.message);
      else { setSuccessMsg("Cambios guardados"); setSelectedProduct(data as Product); void loadData(); }
      return;
    }

    setSaving(true);
    const result = await createProductWithPresentation(store, form, presForm);
    setSaving(false);
    if (result.kind === "invalid" || result.kind === "failed") return setErrorMsg(result.message);
    void loadData();
    if (result.kind === "presentation_failed") {
      // El producto quedó creado: se abre su ficha con la presentación cargada para reintentar "Añadir".
      setErrorMsg(`Se creó «${result.product.name}», pero no su presentación: ${result.message}`);
      await handleSelectProduct(result.product, true);
      return;
    }
    startNew();
    setCreatedProduct(result.product);
    setSuccessMsg(`Se creó «${result.product.name}» con la presentación «${result.presentationName}». Ya aparece en la Caja y se le puede cargar stock en Stock, Ingreso rápido.`);
  };

  const handleArchiveProduct = async () => {
    if (!selectedProduct) return;
    // confirm bypass
    const { error } = await sb.from("products").update({ active: false }).eq("id", selectedProduct.id);
    if (error) setErrorMsg(error.message);
    else {
      setSelectedProduct(null);
      setPresentations([]);
      setForm(EMPTY_PRODUCT_FORM);
      setSuccessMsg("Archivado");
      void loadData();
    }
  };

  const handleSavePresentation = async () => {
    if (!selectedProduct) return;
    setErrorMsg("");
    setSuccessMsg("");
    const parsed = parsePresentationForm(presForm);
    if (!parsed.ok) return setErrorMsg(parsed.error);

    const { error } = await sb.from("product_presentations").insert({ ...parsed.value, product_id: selectedProduct.id });

    if (error) setErrorMsg(error.message);
    else {
      setSuccessMsg("Presentación añadida");
      setPresForm(EMPTY_PRESENTATION_FORM);
      void loadData();
      void handleSelectProduct(selectedProduct);
    }
  };

  const handleUpdatePrice = (presId: string, oldPrice: number) => {
    setErrorMsg("");
    setSuccessMsg("");
    setPricePrompt({presId, oldPrice});
    setNewPriceInput(oldPrice.toString());
  };

  const confirmUpdatePrice = async () => {
    if (!pricePrompt) return;
    const newPrice = Number(newPriceInput);
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      setErrorMsg("Ingresá un precio válido mayor o igual a 0.");
      return;
    }
    const { error } = await sb.from("product_presentations").update({ sale_price: newPrice }).eq("id", pricePrompt.presId);
    if (error) setErrorMsg(error.message);
    else {
      setSuccessMsg("Precio actualizado");
      handleSelectProduct(selectedProduct);
      setPricePrompt(null);
    }
  };

  const startNew = () => {
    setSelectedProduct(null);
    setPresentations([]);
    setCreatedProduct(null);
    setForm(EMPTY_PRODUCT_FORM);
    setPresForm(EMPTY_PRESENTATION_FORM);
    setErrorMsg("");
    setSuccessMsg("");
  };
  const hasActivePresentation = (id: string) =>
    products.find((p) => p.id === id)?.product_presentations.some((pr) => pr.active) ?? false;
  const selectedWithoutPresentation = selectedProduct !== null && !presentations.some((pr) => pr.active);
  const presentationFields = (
    <div className="form-fila form-fila--tres">
      <TextField label="Nombre de la presentación" placeholder="Bolsa 1 kg" value={presForm.name}
        onChange={e => setPresField({ name: e.target.value })} />
      <TextField label="Cantidad base" type="number" numeric min="0.001" step="0.001" value={presForm.baseQuantity}
        onChange={e => setPresField({ baseQuantity: e.target.value })} help={baseQuantityHelp(form.baseUnit)} />
      <TextField label="Precio" type="number" numeric min="0" step="0.01" value={presForm.salePrice}
        onChange={e => setPresField({ salePrice: e.target.value })} />
    </div>
  );
  const priceText = (pr: Presentation) =>
    pr.sold_by_weight ? `${formatMoney(pricePerKiloFromGram(Number(pr.sale_price)))}/kg` : formatMoney(Number(pr.sale_price));

  return (
    <>
      <div className="fila fila--m productos-barra">
        <SelectField inline label="Producto" className="crece" value={selectedProduct?.id ?? ""} disabled={loading}
          onChange={(e) => {
            setErrorMsg("");
            setSuccessMsg("");
            void handleSelectProduct(products.find((p) => p.id === e.target.value) ?? null);
          }}>
          <option value="">{loading ? "Cargando…" : "Elegí un producto…"}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{productOptionLabel(p, hasActivePresentation(p.id))}</option>)}
        </SelectField>
        <Button variant="secundario" icon="add" onClick={startNew}>Nuevo producto</Button>
      </div>

      {errorMsg && <Message tone="error">{errorMsg}</Message>}
      {successMsg && (
        <Message tone="exito">
          {successMsg}
          {createdProduct && (
            <> <Button variant="fantasma" size="compacto" onClick={() => void handleSelectProduct(createdProduct)}>Abrir su ficha</Button></>
          )}
        </Message>
      )}

      <section className="carta pila" aria-labelledby="ficha-producto">
        <h3 className="titulo-seccion" id="ficha-producto">{selectedProduct ? `Ficha de ${selectedProduct.name}` : "Nuevo producto"}</h3>
        {selectedWithoutPresentation && <Message tone="aviso">{MISSING_PRESENTATION_WARNING}</Message>}
        <div className="form-fila form-fila--tres">
          <TextField label="Nombre" value={form.name} onChange={e => setField({ name: e.target.value })} />
          <TextField
            label="Código de barras del fabricante"
            icon="barcode"
            value={form.barcode}
            onChange={e => setField({ barcode: e.target.value })}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Escaneá o escribí el código"
            help="Para encontrarlo al escanearlo en Caja. Conserva los ceros iniciales."
          />
          <SelectField label="Marca" value={form.brandId} onChange={e => setField({ brandId: e.target.value })}>
            <option value="">Sin marca</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <SelectField label="Rubro" value={form.categoryId} onChange={e => setField({ categoryId: e.target.value })}>
            <option value="">Sin rubro</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Unidad base" value={form.baseUnit} onChange={e => setField({ baseUnit: e.target.value as Enums<"base_unit"> })}>
            <option value="unit">Unidad</option>
            <option value="gram">Gramos</option>
            <option value="millilitre">Mililitros</option>
          </SelectField>
          <TextField label="Multiplicador propio (opcional)" type="number" numeric min="0.001" step="0.001"
            value={form.multiplier} onChange={e => setField({ multiplier: e.target.value })}
            placeholder="Usa el del rubro" help="Vacío: usa el multiplicador del rubro y luego el general." />
        </div>
        {!selectedProduct && (
          <>
            <h4 className="titulo-seccion">Primera presentación</h4>
            <p className="cuerpo-s suave">Sin presentación el producto no aparece en la Caja ni se le puede cargar stock. Después podés agregar otras.</p>
            {presentationFields}
          </>
        )}
        <div className="fila">
          <Button onClick={handleSaveProduct} loading={saving}>{selectedProduct ? "Guardar cambios" : "Crear producto"}</Button>
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
                          <Button variant="fantasma" size="compacto" icon="sell" onClick={() => handleUpdatePrice(pr.id, pr.sale_price)}>Cambiar precio base</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {presentationFields}
            <div className="fila">
              <Button variant="secundario" icon="add" onClick={handleSavePresentation}>Añadir presentación</Button>
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
            <Button onClick={confirmUpdatePrice} disabled={!newPriceInput.trim() || !Number.isFinite(Number(newPriceInput)) || Number(newPriceInput) < 0}>
              Guardar precio
            </Button>
          </>
        )}
      >
        <TextField
          label="Precio nuevo"
          type="number"
          numeric
          min="0"
          step="0.01"
          value={newPriceInput}
          onChange={e => setNewPriceInput(e.target.value)}
          autoFocus
        />
      </Modal>
    </>
  );
}
