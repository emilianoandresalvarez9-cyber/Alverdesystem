import { useState, type FormEvent } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, TextField, GlassCard, Badge } from "../../shared/ui";
import type { PresentationLookupResult } from "./types";

interface QuickRestockProps {
  onSuccess?: () => void;
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

      // 1. Buscar en presentaciones por código interno
      const { data: presData, error: presErr } = await supabase
        .from("product_presentations")
        .select(`
          id, name, base_quantity, sale_price, internal_barcode,
          product:products(id, name, manufacturer_barcode, active)
        `)
        .eq("internal_barcode", code)
        .eq("active", true)
        .maybeSingle();

      if (presErr) throw presErr;

      if (presData && presData.product) {
        const prod = presData.product as unknown as { id: string; name: string; manufacturer_barcode: string | null; active: boolean };
        if (prod.active) {
          setFoundPresentation({
            presentation_id: presData.id,
            presentation_name: presData.name,
            product_id: prod.id,
            product_name: prod.name,
            base_quantity: presData.base_quantity,
            sale_price: presData.sale_price,
            internal_barcode: presData.internal_barcode,
            manufacturer_barcode: prod.manufacturer_barcode,
          });
          setQuantity("1");
          return;
        }
      }

      // 2. Si no encontró en presentación, buscar en producto por código de fabricante
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select(`
          id, name, manufacturer_barcode, active,
          presentations:product_presentations(id, name, base_quantity, sale_price, internal_barcode, active)
        `)
        .eq("manufacturer_barcode", code)
        .eq("active", true)
        .maybeSingle();

      if (prodErr) throw prodErr;

      if (prodData && prodData.presentations && prodData.presentations.length > 0) {
        const activePres = (prodData.presentations as unknown as Array<{
          id: string; name: string; base_quantity: number; sale_price: number; internal_barcode: string | null; active: boolean
        }>).find(p => p.active);

        if (activePres) {
          setFoundPresentation({
            presentation_id: activePres.id,
            presentation_name: activePres.name,
            product_id: prodData.id,
            product_name: prodData.name,
            base_quantity: activePres.base_quantity,
            sale_price: activePres.sale_price,
            internal_barcode: activePres.internal_barcode,
            manufacturer_barcode: prodData.manufacturer_barcode,
          });
          setQuantity("1");
          return;
        }
      }

      setError(`No se encontró ningún producto activo con el código: ${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar producto");
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
      const supabase = getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión requerida");

      const { error: rpcErr } = await supabase.rpc('quick_restock', {
        p_presentation_id: foundPresentation.presentation_id,
        p_product_id: foundPresentation.product_id,
        p_quantity: qty,
        p_expiry_date: expiryDate || null
      });

      if (rpcErr) throw rpcErr;

      setSuccessMsg(`Lote ingresado exitosamente: ${qty} unidad(es) de ${foundPresentation.product_name} (${foundPresentation.presentation_name})`);
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
              step="any"
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


