import { type FormEvent, useState, useEffect, useRef } from "react";
import { TextField, Button, Badge, Message } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { pricePerKiloFromGram } from "../catalog/scalePricing";
import { validateEan13 } from "./ean13";
import type { BarcodeScanLookup } from "./types";

interface BarcodeScannerTesterProps {
  onScan: (barcode: string) => void;
  lastLookupResult?: BarcodeScanLookup | null;
}

/**
 * Prueba del lector de códigos de barras (ej. Nictom LCB3100): captura lo que escanea o un código escrito.
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

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
    }
  };

  const result = lastLookupResult;
  return (
    <section className="carta pila" aria-labelledby="probar-lector">
      <div className="pila pila--s">
        <div className="fila fila--entre">
          <h3 className="titulo-seccion" id="probar-lector">Probar el lector</h3>
          {isListening
            ? <Badge tone="exito" icon="barcode_scanner">Escuchando el lector</Badge>
            : <Badge tone="neutro">Lector en pausa</Badge>}
        </div>
        <p className="cuerpo-s suave">
          Escaneá cualquier código con el lector, sin tocar antes ningún campo: abajo aparece qué producto es.
          Si no tenés el lector a mano, escribí el código y tocá Buscar.
        </p>
      </div>

      <form className="form-fila" onSubmit={handleManualSubmit}>
        <TextField label="Código" icon="barcode" inputMode="numeric" value={manualCode}
          onChange={(e) => setManualCode(e.target.value)} placeholder="2000000000123" />
        <div className="fila">
          <Button variant="secundario" type="submit" icon="search" disabled={!manualCode.trim()}>Buscar</Button>
          <Button variant="fantasma" onClick={() => setIsListening((on) => !on)}>
            {isListening ? "Pausar el lector" : "Volver a escuchar"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="pila pila--s" aria-live="polite">
          <span className="rotulo-seccion">Último código</span>
          {!result.found ? (
            <Message tone="error">No hay ningún producto con el código <span className="cifra">{result.barcode}</span>.</Message>
          ) : (
            <ul className="lista">
              <li>
                <div className="lista__principal">
                  <span className="lista__titulo">{result.product?.name}{result.presentation ? ` · ${result.presentation.name}` : ""}</span>
                  <span className="lista__meta cifra">{result.barcode}</span>
                  <span className="fila">
                    <Badge tone="exito">Encontrado</Badge>
                    {result.isBulk && <Badge tone="etiqueta" icon="scale">Granel</Badge>}
                    {validateEan13(result.barcode).isInternalRange && <Badge tone="neutro">Código interno</Badge>}
                  </span>
                </div>
                {result.presentation && (
                  // Balanza (ADR-001): el precio se guarda por gramo y se muestra por kilo.
                  result.isBulk && Number(result.presentation.baseQuantity) === 1
                    ? <span className="lista__valor">{formatMoney(pricePerKiloFromGram(Number(result.presentation.salePrice)))}<small>por kilo</small></span>
                    : <span className="lista__valor">{formatMoney(Number(result.presentation.salePrice))}</span>
                )}
              </li>
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
