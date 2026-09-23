import { useState, useEffect, useRef } from "react";
import { TextField, Button, Badge } from "../../shared/ui";
import { validateEan13 } from "./ean13";
import type { BarcodeScanLookup } from "./types";

interface BarcodeScannerTesterProps {
  onScan: (barcode: string) => void;
  lastLookupResult?: BarcodeScanLookup | null;
}

/**
 * Componente que simula/captura la entrada de un lector de códigos de barras (ej. Nictom LCB3100).
 * Los lectores tipo "teclado cuña" (wedge) disparan eventos de teclado súper rápidos seguidos de Enter.
 */
export function BarcodeScannerTester({ onScan, lastLookupResult }: BarcodeScannerTesterProps) {
  const [manualCode, setManualCode] = useState("");
  const [isListening, setIsListening] = useState(true);
  const bufferRef = useRef("");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar eventos si estamos escribiendo en un input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // Los lectores suelen disparar los números rápidamente
      if (e.key >= "0" && e.key <= "9") {
        bufferRef.current += e.key;
        
        // Reset timeout
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        
        timeoutRef.current = window.setTimeout(() => {
          bufferRef.current = ""; // Limpiar si tarda mucho (no es un escáner)
        }, 100);
      } else if (e.key === "Enter") {
        if (bufferRef.current.length > 5) { // Asumir que si tiene varios chars, es un código
          e.preventDefault();
          onScan(bufferRef.current);
        }
        bufferRef.current = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [isListening, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <div className="glass" style={{ padding: "var(--esp-m)", borderRadius: "var(--radio-carta)" }}>
      <h3 style={{ marginTop: 0 }}>Simulador de Lector (Nictom LCB3100)</h3>
      <p style={{ color: "var(--color-tinta-suave)", fontSize: "0.9rem" }}>
        {isListening 
          ? "✅ Escuchando eventos de teclado... (Asegurate de hacer click fuera del cuadro de texto y probar escanear)"
          : "❌ Escucha global desactivada."}
      </p>

      <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: "var(--esp-s)", marginTop: "var(--esp-s)" }}>
        <TextField
          label="O ingreso manual"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Ej. 2000000000123"
        />
        <Button variant="secundario" type="submit" style={{ alignSelf: "flex-end" }}>
          Simular Escaneo
        </Button>
      </form>

      {lastLookupResult && (
        <div style={{ marginTop: "var(--esp-m)", padding: "var(--esp-s)", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radio-control)" }}>
          <h4 style={{ margin: "0 0 var(--esp-xs) 0" }}>Último resultado:</h4>
          {!lastLookupResult.found ? (
            <Badge tone="error">Código {lastLookupResult.barcode} no encontrado</Badge>
          ) : (
            <div>
              <div style={{ display: "flex", gap: "var(--esp-xs)", flexWrap: "wrap", marginBottom: "var(--esp-xs)" }}>
                <Badge tone="exito">Encontrado</Badge>
                {lastLookupResult.isBulk && <Badge tone="aviso">Producto a granel</Badge>}
                {validateEan13(lastLookupResult.barcode).isInternalRange && <Badge tone="neutro">Rango Interno</Badge>}
              </div>
              <strong>{lastLookupResult.product?.name}</strong> - {lastLookupResult.presentation?.name} <br/>
              <em>${lastLookupResult.presentation?.salePrice}</em>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
