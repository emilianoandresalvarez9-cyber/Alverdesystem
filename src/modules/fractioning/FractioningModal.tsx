import { useState, useEffect, useMemo } from "react";
import { Modal, Button, TextField, SelectField, GlassCard, Badge } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
import type { StockLot } from "../stock/types";
import { calculateFractioning } from "./fractioningLogic";

interface PresentationOption {
  id: string;
  name: string;
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
  const [targetPresentations, setTargetPresentations] = useState<PresentationOption[]>([]);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>("");
  const [packetsToProduce, setPacketsToProduce] = useState<string>("");
  const [bagFinished, setBagFinished] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar presentaciones del mismo producto
  useEffect(() => {
    if (!originLot || !open) return;

    let active = true;
    const fetchPresentations = async () => {
      try {
        const supabase = getSupabase();
        // Buscar otras presentaciones de este producto
        const { data, error: err } = await supabase
          .from("product_presentations")
          .select("id, name, base_quantity, product:products(base_unit)")
          .eq("product_id", originLot.product_id)
          .eq("active", true)
          .neq("id", originLot.presentation_id) // Excluir la propia presentación origen
          .order("base_quantity", { ascending: true });

        if (err) throw err;
        
        if (active && data) {
          const options: PresentationOption[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            base_quantity: d.base_quantity,
            base_unit: (Array.isArray(d.product) ? d.product[0]?.base_unit : d.product?.base_unit) || "gram"
          }));
          setTargetPresentations(options);
          const firstOpt = options[0];
          if (firstOpt) {
            setSelectedPresentationId(firstOpt.id);
          }
        }
      } catch (err) {
        console.error("Error cargando presentaciones", err);
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
      setError(null);
    }
  }, [open]);

  const targetPresentation = targetPresentations.find((p) => p.id === selectedPresentationId);
  const packetsNum = parseInt(packetsToProduce || "0", 10);

  // Cálculo en vivo
  const calc = useMemo(() => {
    if (!originLot || !targetPresentation || packetsNum <= 0) return null;
    try {
      return calculateFractioning({
        originLotQuantity: originLot.current_quantity,
        targetBaseQuantity: targetPresentation.base_quantity,
        packetsToProduce: packetsNum,
        bagFinished,
        realRemainingGrams: 0
      });
    } catch (e) {
      return null;
    }
  }, [originLot, targetPresentation, packetsNum, bagFinished]);

  const overCapacity =
    originLot && targetPresentation && packetsNum * targetPresentation.base_quantity > originLot.current_quantity;

  const handleSubmit = async () => {
    if (!originLot || !targetPresentation || packetsNum <= 0) return;
    if (!calc) return;
    
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión requerida");

      // Transacción emulada secuencial (o RPC si estuviera, pero no hay RPC en Fase 0 para esto, hacemos insert y update)
      // Asegurar que el lote origen esté abierto si no lo estaba
      const originOpenedAt = originLot.opened_at || new Date().toISOString();
      const { error: rpcErr } = await supabase.rpc('fraction_stock', {
        p_origin_lot_id: originLot.id,
        p_target_presentation_id: targetPresentation.id,
        p_packets_num: packetsNum,
        p_grams_needed: calc.gramsNeeded,
        p_merma: calc.merma,
        p_new_origin_quantity: calc.newOriginQuantity,
        p_origin_lot_status: calc.originLotStatus
      });

      if (rpcErr) throw rpcErr;

      onSuccess();
      onClose();
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
            disabled={loading || !calc || overCapacity || targetPresentations.length === 0}
          >
            {loading ? "Registrando..." : "Confirmar Fraccionamiento"}
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
                <option key={p.id} value={p.id}>
                  {p.name} ({p.base_quantity} {p.base_unit}/u)
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

            {/* RF-15: Pregunta de cierre */}
            <SelectField
              label="¿La bolsa de origen queda abierta o se terminó? (RF-15)"
              value={bagFinished ? "terminada" : "abierta"}
              onChange={(e) => setBagFinished(e.target.value === "terminada")}
            >
              <option value="abierta">Queda abierta (tiene más stock utilizable)</option>
              <option value="terminada">Se terminó (vacía / descartada)</option>
            </SelectField>

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

