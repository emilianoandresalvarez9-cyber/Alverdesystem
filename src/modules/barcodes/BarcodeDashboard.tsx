import { useState } from "react";
import { Button, TextField } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { generateInternalEan13 } from "./ean13";
import { CounterBulkSheet } from "./CounterBulkSheet";
import { BarcodeScannerTester } from "./BarcodeScannerTester";
import type { BarcodeScanLookup } from "./types";

export function BarcodeDashboard() {
  const [activeTab, setActiveTab] = useState<"sheet" | "tester" | "generator">("sheet");
  const [lookupResult, setLookupResult] = useState<BarcodeScanLookup | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Simulador de búsqueda cuando el Nictom LCB3100 dispara un escaneo
  const handleScan = async (scannedCode: string) => {
    setFeedback(null);
    try {
      const sb = getSupabase();
    
    // 1. Buscar en presentaciones internas
    const { data: presData, error: presentationError } = await sb
      .from("product_presentations")
      .select("id, name, base_quantity, internal_barcode, sale_price, product:products(id, name, base_unit, active)")
      .eq("internal_barcode", scannedCode)
      .maybeSingle();

    if (presentationError) throw presentationError;

    if (presData && presData.product) {
      type ProductRelation = { id: string; name: string; base_unit: string; active: boolean };
      const rawProd = presData.product as unknown as ProductRelation | ProductRelation[];
      const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd;
      if (!prod) return;
      const isBulk = prod.base_unit === "gram";
      setLookupResult({
        found: true,
        barcode: scannedCode,
        isBulk,
        product: {
          id: prod.id,
          name: prod.name,
          baseUnit: prod.base_unit
        },
        presentation: {
          id: presData.id,
          name: presData.name,
          baseQuantity: presData.base_quantity,
          internalBarcode: presData.internal_barcode,
          salePrice: presData.sale_price
        }
      });

      // Flujo RF-22: si es granel, simulamos pedir peso
      if (isBulk) {
        setFeedback({ kind: "success", message: `Producto a granel: ingresá el peso en gramos para ${prod.name}.` });
      }
      return;
    }

    // 2. Si no, buscar en manufacturer_barcode
    const { data: prodData, error: productError } = await sb
      .from("products")
      .select("id, name, base_unit, active")
      .eq("manufacturer_barcode", scannedCode)
      .maybeSingle();

    if (productError) throw productError;

    if (prodData) {
      setLookupResult({
        found: true,
        barcode: scannedCode,
        isBulk: prodData.base_unit === "gram",
        product: {
          id: prodData.id,
          name: prodData.name,
          baseUnit: prodData.base_unit
        }
      });
      return;
    }

    // No encontrado
    setLookupResult({ found: false, barcode: scannedCode, isBulk: false });
    } catch (error) {
      setLookupResult({ found: false, barcode: scannedCode, isBulk: false });
      setFeedback({ kind: "error", message: error instanceof Error ? `No se pudo consultar el código: ${error.message}` : "No se pudo consultar el código." });
    }
  };

  // Generador batch de códigos faltantes
  const handleGenerateMissing = async () => {
    setIsGenerating(true);
    setFeedback(null);
    let successCount = 0;
    try {
      const sb = getSupabase();
    
    // Obtener presentaciones de productos en gramos sin código interno
    const { data, error: listError } = await sb
      .from("product_presentations")
      .select("id, product:products!inner(base_unit)")
      .is("internal_barcode", null)
      .eq("products.base_unit", "gram");

    if (listError) throw listError;

    if (!data || data.length === 0) {
      setFeedback({ kind: "success", message: "No hay productos a granel pendientes de código." });
      return;
    }

    for (const row of data) {
      // 1. Obtenemos el ID único de la secuencia en la base de datos
      const { data: seq, error: seqError } = await sb.rpc("get_next_internal_code_seq");
      if (seqError) {
        throw new Error(`No se pudo obtener la secuencia para el código interno: ${seqError.message}`);
      }

      // 2. Generamos el EAN-13 interno usando el prefijo 20
      const newBarcode = generateInternalEan13(seq, 20);

      // 3. Guardamos el código y mostramos el error si falla
      const { error: updateError } = await sb
        .from("product_presentations")
        .update({ internal_barcode: newBarcode })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(`No se pudo guardar el código para el producto ${row.id}: ${updateError.message}`);
      }
      
      successCount++;
    }
    
      setFeedback({ kind: "success", message: `Se generaron ${successCount} códigos de barras nuevos (Prefijo 20).` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al generar códigos de barras.";
      setFeedback({
        kind: "error",
        message: successCount > 0 ? `Se generaron ${successCount} códigos antes del error. ${message}` : message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
      <div style={{ display: "flex", gap: "var(--esp-xs)", borderBottom: "1px solid var(--glass-borde)", paddingBottom: "var(--esp-xs)" }}>
        <Button variant={activeTab === "sheet" ? "primario" : "fantasma"} onClick={() => setActiveTab("sheet")}>
          🖨️ Planilla de Mostrador
        </Button>
        <Button variant={activeTab === "tester" ? "primario" : "fantasma"} onClick={() => setActiveTab("tester")}>
          🔍 Probar Lector / Scanner
        </Button>
        <Button variant={activeTab === "generator" ? "primario" : "fantasma"} onClick={() => setActiveTab("generator")}>
          ⚙️ Generación de Códigos
        </Button>
      </div>

      {feedback && <p role={feedback.kind === "error" ? "alert" : "status"} style={{ color: feedback.kind === "error" ? "var(--color-error)" : "var(--color-exito)" }}>{feedback.message}</p>}

      {activeTab === "sheet" && (
        <div className="glass" style={{ padding: "var(--esp-m)", borderRadius: "var(--radio-carta)" }}>
          <CounterBulkSheet />
        </div>
      )}

      {activeTab === "tester" && (
        <BarcodeScannerTester onScan={handleScan} lastLookupResult={lookupResult} />
      )}

      {activeTab === "generator" && (
        <div className="glass" style={{ padding: "var(--esp-m)", borderRadius: "var(--radio-carta)" }}>
          <h2>Gestión de Códigos Internos (RF-20 / RF-21)</h2>
          <p>
            Los productos a granel y de elaboración propia requieren un código de barras EAN-13
            en el rango reservado interno (prefijo 20-29) para que el lector pueda identificarlos sin confundirlos con productos externos.
          </p>
          <div style={{ marginTop: "var(--esp-m)" }}>
            <Button variant="primario" onClick={handleGenerateMissing} disabled={isGenerating}>
              {isGenerating ? "Generando..." : "Autogenerar Códigos Faltantes (Granel)"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
