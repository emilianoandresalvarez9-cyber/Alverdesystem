import { useState, useEffect, useMemo } from "react";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { Modal, Button, Message, Options, TextField, SelectField } from "../../shared/ui";
import { formatQuantity, unitLabel } from "../stock/format";
import "../../styles/stock.css";
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

  const unit = originLot.base_unit;

  return (
    <Modal
      open={open}
      title="Fraccionamiento de mercadería"
      subtitle={<>{originLot.product_name} · {originLot.presentation_name} · bolsa de <span className="cifra">{formatQuantity(originLot.current_quantity, unit)}</span></>}
      onClose={onClose}
      footer={
        <>
          <Button variant="fantasma" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            icon="call_split"
            onClick={handleSubmit}
            loading={loading}
            disabled={Boolean(statusMessage) || !calc || overCapacity || emptyButMarkedOpen || invalidRealRemaining || targetPresentations.length === 0}
          >
            {loading ? "Guardando…" : statusMessage ? "Fraccionamiento guardado" : "Confirmar fraccionamiento"}
          </Button>
        </>
      }
    >
      {error && <Message tone="error">{error}</Message>}
      {statusMessage && <Message tone="aviso">{statusMessage}</Message>}

      {targetPresentations.length === 0 ? (
        <Message tone="aviso">Este producto no tiene otras presentaciones (bolsitas) en el catálogo. No se puede fraccionar.</Message>
      ) : (
        <>
          <SelectField
            label="Presentación destino"
            value={selectedPresentationId}
            onChange={(e) => setSelectedPresentationId(e.target.value)}
          >
            {targetPresentations.map((p) => (
              <option key={p.presentation_id} value={p.presentation_id}>
                {p.presentation_name} ({formatQuantity(p.base_quantity, p.base_unit)} c/u)
              </option>
            ))}
          </SelectField>

          <TextField
            label="Cantidad de bolsitas generadas"
            type="number"
            numeric
            suffix="u"
            min="1"
            step="1"
            value={packetsToProduce}
            onChange={(e) => setPacketsToProduce(e.target.value)}
            placeholder="Ej: 15"
            error={overCapacity ? "Stock insuficiente en el lote de origen para esa cantidad." : undefined}
          />

          {emptyButMarkedOpen && (
            <Message tone="error">La bolsa quedaría vacía. Marcala como terminada para cerrar el lote.</Message>
          )}

          {/* RF-15: pregunta de cierre */}
          <Options
            name="bolsa-origen"
            legend="¿La bolsa de origen queda abierta o se terminó?"
            showLegend
            variant="segmento"
            value={bagFinished ? "terminada" : "abierta"}
            onChange={(value) => setBagFinished(value === "terminada")}
            options={[{ value: "abierta", label: "Queda abierta" }, { value: "terminada", label: "Se terminó" }]}
          />

          {bagFinished && (
            <TextField
              label="Cantidad real que quedó en la bolsa"
              type="number"
              numeric
              suffix={unitLabel(unit)}
              min="0"
              max={Math.max(0, theoreticalRemaining)}
              step="0.001"
              value={realRemainingQuantity}
              onChange={(e) => setRealRemainingQuantity(e.target.value)}
              error={invalidRealRemaining ? `Ingresá un remanente entre 0 y ${formatQuantity(Math.max(0, theoreticalRemaining), unit)}.` : undefined}
              help="La diferencia con el remanente teórico queda registrada como merma."
            />
          )}

          {/* Cuenta antes de confirmar (RF-14, RF-16) */}
          {calc && !overCapacity && (
            <div className="cuenta" aria-label="Cuenta del fraccionamiento">
              <p className="par"><span>A descontar de la bolsa</span><span className="cifra">{formatQuantity(calc.gramsNeeded, unit)}</span></p>
              {bagFinished && calc.merma > 0 && (
                <p className="par par--error"><span>Merma</span><span className="cifra">{formatQuantity(calc.merma, unit)}</span></p>
              )}
              <p className="par par--total"><span>Queda en la bolsa de origen</span><span className="cifra">{formatQuantity(calc.newOriginQuantity, unit)}</span></p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
