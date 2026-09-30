import { useEffect, useState, type FormEvent } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { loadCatalogSnapshot } from "../../shared/offline/queue";
import { queueStockOperation, watchStockOperationSync } from "../stock/offlineStock";
import { Button, TextField, GlassCard, Badge } from "../../shared/ui";
import type { PresentationLookupResult } from "./types";
import type { CatalogProduct } from "../catalog/types";

interface QuickRestockProps {
  onSuccess?: () => void;
}

interface EmployeeCatalogRow {
  presentation_id: string;
  presentation_name: string;
  product_id: string;
  product_name: string;
  base_quantity: number;
  sale_price: number;
  internal_barcode: string | null;
  manufacturer_barcode: string | null;
  base_unit: "gram" | "millilitre" | "unit";
  sold_by_weight: boolean;
  open_shelf_life_days: number | null;
}

function findCachedPresentation(rows: unknown[], code: string): PresentationLookupResult | null {
  const products = rows as CatalogProduct[];
  const entries = products.flatMap((product) => product.presentations.map((presentation) => ({ product, presentation })));
  const internal = entries.find(({ presentation }) => presentation.internal_barcode === code);
  const manufacturer = entries
    .filter(({ product }) => product.manufacturer_barcode === code)
    .sort((left, right) => left.presentation.base_quantity - right.presentation.base_quantity)[0];
  const match = internal ?? manufacturer;
  if (!match) return null;
  return {
    presentation_id: match.presentation.id,
    presentation_name: match.presentation.name,
    product_id: match.product.id,
    product_name: match.product.name,
    base_quantity: match.presentation.base_quantity,
    sale_price: match.presentation.sale_price,
    internal_barcode: match.presentation.internal_barcode,
    manufacturer_barcode: match.product.manufacturer_barcode,
    base_unit: match.product.base_unit,
    sold_by_weight: match.presentation.sold_by_weight,
    open_shelf_life_days: match.product.open_shelf_life_days,
  };
}

export function QuickRestock({ onSuccess }: QuickRestockProps) {
  const [barcode, setBarcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundPresentation, setFoundPresentation] = useState<PresentationLookupResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFeedbackId) return;
    return watchStockOperationSync(pendingFeedbackId, () => {
      setSuccessMsg("Ingreso sincronizado correctamente.");
      setPendingFeedbackId(null);
    });
  }, [pendingFeedbackId]);

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const code = barcode.trim();
    if (!code) return;

    setSearching(true);
    setError(null);
    setSuccessMsg(null);
    setFoundPresentation(null);

    try {
      const supabase = getSupabase();

      // Buscar sobre la proyección operativa. La tabla base de productos y
      // presentaciones queda restringida para Empleado por RLS.
      const { data: internalMatches, error: internalErr } = await supabase
        .from("employee_catalog")
        .select("presentation_id, presentation_name, product_id, product_name, base_quantity, sale_price, internal_barcode, manufacturer_barcode, base_unit, sold_by_weight, open_shelf_life_days")
        .eq("internal_barcode", code)
        .limit(1);

      if (internalErr) throw internalErr;

      const internalMatch = (internalMatches ?? [])[0] as EmployeeCatalogRow | undefined;
      if (internalMatch) {
        setFoundPresentation(internalMatch);
        setQuantity("1");
        return;
      }

      // El código de fabricante pertenece al producto y puede tener varias
      // presentaciones; usar la unidad de menor contenido como opción rápida.
      const { data: manufacturerMatches, error: manufacturerErr } = await supabase
        .from("employee_catalog")
        .select("presentation_id, presentation_name, product_id, product_name, base_quantity, sale_price, internal_barcode, manufacturer_barcode, base_unit, sold_by_weight, open_shelf_life_days")
        .eq("manufacturer_barcode", code)
        .order("base_quantity", { ascending: true })
        .limit(1);

      if (manufacturerErr) throw manufacturerErr;

      const manufacturerMatch = (manufacturerMatches ?? [])[0] as EmployeeCatalogRow | undefined;
      if (manufacturerMatch) {
        setFoundPresentation(manufacturerMatch);
        setQuantity("1");
        return;
      }

      setError(`No se encontró ningún producto activo con el código: ${code}`);
    } catch (err) {
      const snapshot = await loadCatalogSnapshot();
      const cached = snapshot ? findCachedPresentation(snapshot.rows, code) : null;
      if (cached) {
        setFoundPresentation(cached);
        setQuantity("1");
      } else {
        setError(err instanceof Error ? `${err.message} No hay un catálogo local que incluya ese código.` : "Error al buscar producto");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleRestock = async () => {
    if (!foundPresentation) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("La cantidad debe ser un número mayor a 0");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await queueStockOperation({
        action: "quick_restock",
        presentationId: foundPresentation.presentation_id,
        targetPresentationId: foundPresentation.presentation_id,
        productId: foundPresentation.product_id,
        quantity: qty,
        expiryDate: expiryDate || null,
        productName: foundPresentation.product_name,
        presentationName: foundPresentation.presentation_name,
        baseUnit: foundPresentation.base_unit ?? "unit",
        baseQuantity: foundPresentation.base_quantity,
        soldByWeight: foundPresentation.sold_by_weight ?? false,
        openShelfLifeDays: foundPresentation.open_shelf_life_days ?? null,
      });

      setSuccessMsg(result.synchronized
        ? `Lote ingresado: ${qty} unidad(es) de ${foundPresentation.product_name} (${foundPresentation.presentation_name}).`
        : `Ingreso guardado en este dispositivo. Se sincronizará al reconectar.${result.failureMessage ? ` Motivo: ${result.failureMessage}` : ""}`);
      setPendingFeedbackId(result.synchronized ? null : result.localId);
      setFoundPresentation(null);
      setBarcode("");
      setQuantity("");
      setExpiryDate("");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el lote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard>
      <h3 style={{ margin: "0 0 var(--esp-m)" }}>Ingreso Rápido de Mercadería (RF-51)</h3>
      <p>El costo del lote se calcula con el costo por envase y contenido del proveedor principal del producto. Si falta esa información, el lote queda sin costo y no se muestra un margen desactualizado.</p>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "var(--esp-s)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <TextField
          label="Escanear código de barras"
          placeholder="Código de barras fabricante o interno..."
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          autoFocus
        />
        <Button variant="primario" type="submit" disabled={searching || !barcode.trim()}>
          {searching ? "Buscando..." : "Buscar"}
        </Button>
      </form>

      {error && <p role="alert" style={{ color: "var(--color-error)", marginTop: "var(--esp-s)" }}>{error}</p>}
      {successMsg && <p role="status" style={{ color: "var(--color-exito)", marginTop: "var(--esp-s)" }}>{successMsg}</p>}

      {foundPresentation && (
        <div style={{ marginTop: "var(--esp-m)", padding: "var(--esp-m)", borderRadius: "var(--radio-panel)", background: "var(--glass-fondo-lite)" }}>
          <div style={{ display: "flex", gap: "var(--esp-s)", alignItems: "center", marginBottom: "var(--esp-s)" }}>
            <span style={{ fontWeight: 700, fontSize: "var(--texto-l)" }}>{foundPresentation.product_name}</span>
            <Badge tone="exito">{foundPresentation.presentation_name}</Badge>
          </div>

          <div style={{ display: "flex", gap: "var(--esp-s)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <TextField
              label="Cantidad a ingresar"
              type="number"
              min="0.001"
              step={0.001}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <TextField
              label="Vencimiento fabricante (opcional)"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <Button variant="primario" onClick={handleRestock} disabled={loading || !quantity}>
              {loading ? "Guardando..." : "Ingresar Lote"}
            </Button>
            <Button variant="fantasma" onClick={() => setFoundPresentation(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}



