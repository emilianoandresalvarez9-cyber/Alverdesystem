import { useState, useEffect, useMemo } from "react";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { Modal, Button, TextField, SelectField, GlassCard, Badge } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import { loadCatalogSnapshot } from "../../shared/offline/queue";
import { queueStockOperation, watchStockOperationSync } from "../stock/offlineStock";
import type { StockLot } from "../stock/types";
import { calculateFractioning } from "./fractioningLogic";

interface PresentationOption {
  presentation_id: string;
  presentation_name: string;
  product_id: string;
  base_quantity: number;
  base_unit: string;
}

interface FractioningModalProps {
  originLot: StockLot | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FractioningModal({ originLot, open, onClose, onSuccess }: FractioningModalProps) {
  const profile = useCurrentProfile();
  const [targetPresentations, setTargetPresentations] = useState<PresentationOption[]>([]);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>("");
  const [packetsToProduce, setPacketsToProduce] = useState<string>("");
  const [bagFinished, setBagFinished] = useState<boolean>(false);
  const [realRemainingQuantity, setRealRemainingQuantity] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);

  // Cargar presentaciones del mismo producto
  useEffect(() => {
    if (!originLot || !open) return;

    let active = true;
    const fetchPresentations = async () => {
      try {
        const supabase = getSupabase();
        // Buscar otras presentaciones de este producto
        const { data, error: err } = await supabase
          .from("employee_catalog")
          .select("presentation_id, presentation_name, product_id, base_quantity, base_unit")
          .eq("product_id", originLot.product_id)
          .eq("sold_by_weight", false)
          .neq("presentation_id", originLot.presentation_id) // Excluir la propia presentación origen
          .order("base_quantity", { ascending: true });

        if (err) throw err;
        
        if (active && data) {
          const options: PresentationOption[] = (data as unknown as PresentationOption[]).map((d) => ({
            presentation_id: d.presentation_id,
            presentation_name: d.presentation_name,
            product_id: d.product_id,
            base_quantity: d.base_quantity,
            base_unit: d.base_unit
          }));
          setError(null);
          setTargetPresentations(options);
          const firstOpt = options[0];
          if (firstOpt) {
            setSelectedPresentationId(firstOpt.presentation_id);
          }
        }
      } catch (err) {
        if (active) {
          const snapshot = await loadCatalogSnapshot();
          const product = (snapshot?.rows as Array<{ id: string; presentations: Array<{ id: string; name: string; base_quantity: number; sold_by_weight: boolean }> }> | undefined)
            ?.find((row) => row.id === originLot.product_id);
          const cached = product?.presentations
            .filter((presentation) => !presentation.sold_by_weight && presentation.id !== originLot.presentation_id)
            .map((presentation) => ({
              presentation_id: presentation.id,
              presentation_name: presentation.name,
              product_id: originLot.product_id,
              base_quantity: presentation.base_quantity,
              base_unit: originLot.base_unit,
            })) ?? [];
          setTargetPresentations(cached);
          setError(cached.length ? null : err instanceof Error ? `No se pudieron cargar las presentaciones: ${err.message}` : "No se pudieron cargar las presentaciones.");
          if (cached[0]) setSelectedPresentationId(cached[0].presentation_id);
        }
      }
    };

    fetchPresentations();
    return () => { active = false; };
  }, [originLot, open]);

  // Limpiar form al cerrar/abrir
  useEffect(() => {
    if (open) {
      setPacketsToProduce("");
      setBagFinished(false);
      setRealRemainingQuantity("0");
      setError(null);
      setStatusMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (!pendingFeedbackId) return;
    return watchStockOperationSync(pendingFeedbackId, () => {
      setStatusMessage("Fraccionamiento sincronizado correctamente.");
      setPendingFeedbackId(null);
      onClose();
    });
  }, [pendingFeedbackId, onClose]);

  const targetPresentation = targetPresentations.find((p) => p.presentation_id === selectedPresentationId);
  const packetsNum = parseInt(packetsToProduce || "0", 10);
  const theoreticalRemaining = originLot && targetPresentation && packetsNum > 0
    ? Number((originLot.current_quantity - packetsNum * targetPresentation.base_quantity).toFixed(3))
    : 0;
  const realRemaining = Number(realRemainingQuantity);
  const invalidRealRemaining = bagFinished && (
    !Number.isFinite(realRemaining) || realRemaining < 0 || realRemaining > theoreticalRemaining
  );

  // Cálculo en vivo
  const calc = useMemo(() => {
    if (!originLot || !targetPresentation || packetsNum <= 0) return null;
    try {
      return calculateFractioning({
        originLotQuantity: originLot.current_quantity,
        targetBaseQuantity: targetPresentation.base_quantity,
        packetsToProduce: packetsNum,
        bagFinished,
        realRemainingGrams: realRemaining
      });
    } catch (e) {
      return null;
    }
  }, [originLot, targetPresentation, packetsNum, bagFinished, realRemaining]);

  const overCapacity =
    originLot && targetPresentation && packetsNum * targetPresentation.base_quantity > originLot.current_quantity;
  const emptyButMarkedOpen = !bagFinished && calc?.newOriginQuantity === 0;

  const handleSubmit = async () => {
    if (!originLot || !targetPresentation || packetsNum <= 0) return;
    if (!calc) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await queueStockOperation({
        action: "fraction_stock",
        originLotId: originLot.id,
        targetPresentationId: targetPresentation.presentation_id,
        packetsNum,
        gramsNeeded: calc.gramsNeeded,
        merma: calc.merma,
        newOriginQuantity: calc.newOriginQuantity,
        originLotStatus: calc.originLotStatus,
        productId: originLot.product_id,
        productName: originLot.product_name,
        presentationName: targetPresentation.presentation_name,
        baseUnit: originLot.base_unit,
        baseQuantity: targetPresentation.base_quantity,
        soldByWeight: false,
        openShelfLifeDays: originLot.open_shelf_life_days,
        expiryDate: originLot.manufacturer_expiry_date,
      }, profile.id);

      onSuccess();
      setPendingFeedbackId(result.localId);
      setStatusMessage("Fraccionamiento guardado en este dispositivo; queda pendiente de sincronización.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el fraccionamiento.");
    } finally {
      setLoading(false);
    }
  };

  if (!originLot) return null;

  return (
    <Modal
      open={open}
      title="Fraccionamiento de Mercadería"
      onClose={onClose}
      footer={
        <>
          <Button variant="fantasma" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primario"
            onClick={handleSubmit}
            disabled={loading || Boolean(statusMessage) || !calc || overCapacity || emptyButMarkedOpen || invalidRealRemaining || targetPresentations.length === 0}
          >
            {loading ? "Guardando..." : statusMessage ? "Fraccionamiento guardado" : "Confirmar Fraccionamiento"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
        
        {/* Contexto de Origen */}
        <div style={{ padding: "var(--esp-s)", background: "var(--glass-fondo-lite)", borderRadius: "var(--radio-panel)" }}>
          <p style={{ margin: 0, fontSize: "var(--texto-s)", color: "var(--color-tinta-suave)" }}>Lote de Origen:</p>
          <div style={{ fontWeight: 700, fontSize: "var(--texto-m)" }}>{originLot.product_name} - {originLot.presentation_name}</div>
          <div style={{ marginTop: 4 }}>
            <Badge tone="neutro">Disp: {originLot.current_quantity} {originLot.base_unit}</Badge>
          </div>
        </div>

        {error && (
          <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>{error}</p>
        )}
        {statusMessage && <p role="status" style={{ color: "var(--color-aviso)", margin: 0 }}>{statusMessage}</p>}

        {targetPresentations.length === 0 ? (
          <GlassCard style={{ padding: "var(--esp-m)" }}>
            <p style={{ margin: 0, color: "var(--color-aviso)" }}>
              Este producto no tiene otras presentaciones (bolsitas) creadas en el catálogo. No se puede fraccionar.
            </p>
          </GlassCard>
        ) : (
          <>
            <SelectField
              label="Presentación destino"
              value={selectedPresentationId}
              onChange={(e) => setSelectedPresentationId(e.target.value)}
            >
              {targetPresentations.map((p) => (
                <option key={p.presentation_id} value={p.presentation_id}>
                {p.presentation_name} ({p.base_quantity} {p.base_unit}/u)
                </option>
              ))}
            </SelectField>

            <TextField
              label="Cantidad de bolsitas generadas"
              type="number"
              min="1"
              step="1"
              value={packetsToProduce}
              onChange={(e) => setPacketsToProduce(e.target.value)}
              placeholder="Ej: 15"
            />

            {overCapacity && (
              <p style={{ color: "var(--color-error)", fontSize: "var(--texto-s)", margin: 0 }}>
                Stock insuficiente en el lote origen para esta cantidad.
              </p>
            )}
            {emptyButMarkedOpen && (
              <p role="alert" style={{ color: "var(--color-error)", fontSize: "var(--texto-s)", margin: 0 }}>
                La bolsa quedaría vacía. Marcala como terminada para cerrar el lote.
              </p>
            )}

            {/* RF-15: Pregunta de cierre */}
            <SelectField
              label="¿La bolsa de origen queda abierta o se terminó? (RF-15)"
              value={bagFinished ? "terminada" : "abierta"}
              onChange={(e) => setBagFinished(e.target.value === "terminada")}
            >
              <option value="abierta">Queda abierta (tiene más stock utilizable)</option>
              <option value="terminada">Se terminó (vacía / descartada)</option>
            </SelectField>

            {bagFinished && (
              <TextField
                label={`Cantidad real que quedó en la bolsa (${originLot.base_unit})`}
                type="number"
                min="0"
                max={Math.max(0, theoreticalRemaining)}
                step="0.001"
                value={realRemainingQuantity}
                onChange={(e) => setRealRemainingQuantity(e.target.value)}
                error={invalidRealRemaining ? `Ingresá un remanente entre 0 y ${Math.max(0, theoreticalRemaining)} ${originLot.base_unit}.` : undefined}
                help="La diferencia con el remanente teórico queda registrada como merma (RF-16)."
              />
            )}

            {/* Vista previa de cálculos (RF-14, RF-16) */}
            {calc && !overCapacity && (
              <div style={{ 
                padding: "var(--esp-m)", 
                background: "var(--color-fondo)", 
                border: "1px solid var(--glass-borde)",
                borderRadius: "var(--radio-panel)",
                display: "flex", flexDirection: "column", gap: "var(--esp-xs)"
              }}>
                <div style={{ fontSize: "var(--texto-s)", display: "flex", justifyContent: "space-between" }}>
                  <span>Gramos a descontar:</span>
                  <strong>{calc.gramsNeeded} {originLot.base_unit}</strong>
                </div>
                
                {bagFinished && calc.merma > 0 && (
                  <div style={{ fontSize: "var(--texto-s)", display: "flex", justifyContent: "space-between", color: "var(--color-error)" }}>
                    <span>Merma (RF-16):</span>
                    <strong>{calc.merma} {originLot.base_unit}</strong>
                  </div>
                )}
                
                <div style={{ fontSize: "var(--texto-s)", display: "flex", justifyContent: "space-between", marginTop: "var(--esp-xs)", paddingTop: "var(--esp-xs)", borderTop: "1px dashed var(--glass-borde)" }}>
                  <span>Stock resultante en origen:</span>
                  <strong>{calc.newOriginQuantity} {originLot.base_unit}</strong>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}


