import { useEffect, useState } from "react";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { Modal, Button, Message, Options, TextField } from "../../shared/ui";
import { formatQuantity, unitLabel } from "./format";
import { queueStockOperation, watchStockOperationSync } from "./offlineStock";
import type { StockLot } from "./types";

interface StockAdjustmentModalProps {
  lot: StockLot | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustmentModal({
  lot,
  open,
  onClose,
  onSuccess,
}: StockAdjustmentModalProps) {
  const profile = useCurrentProfile();
  const [kind, setKind] = useState<"waste" | "discard" | "adjustment">("waste");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"add" | "remove">("remove");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingFeedbackId, setPendingFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind("waste");
    setAdjustmentDirection("remove");
    setQuantity("");
    setReason("");
    setError(null);
    setStatusMessage(null);
  }, [open, lot?.id]);

  useEffect(() => {
    if (!pendingFeedbackId) return;
    return watchStockOperationSync(pendingFeedbackId, () => {
      setStatusMessage("Movimiento sincronizado correctamente.");
      setPendingFeedbackId(null);
      onClose();
    });
  }, [pendingFeedbackId, onClose]);

  if (!lot) return null;

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Ingresá una cantidad mayor a 0.");
      return;
    }
    if (kind !== "adjustment" || adjustmentDirection === "remove") {
      if (qty > lot.current_quantity) {
      setError(`No podés descontar más del stock actual (${formatQuantity(lot.current_quantity, lot.base_unit)}).`);
      return;
      }
    }
    if (!reason.trim()) {
      setError("El motivo es obligatorio: contá qué pasó.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const signedQuantity = kind === "adjustment" && adjustmentDirection === "add" ? qty : -qty;
      const result = await queueStockOperation({
        action: "adjust_stock",
        lotId: lot.id,
        productId: lot.product_id,
        movementKind: kind,
        quantity: signedQuantity,
        reason: reason.trim(),
      }, profile.id);

      onSuccess();
      setPendingFeedbackId(result.localId);
      setStatusMessage("Guardado en este dispositivo; queda pendiente de sincronización.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el movimiento.");
    } finally {
      setLoading(false);
    }
  };

  const adding = kind === "adjustment" && adjustmentDirection === "add";

  return (
    <Modal
      open={open}
      title={`Ajuste de stock: ${lot.product_name}`}
      subtitle={<>{lot.presentation_name} · quedan <span className="cifra">{formatQuantity(lot.current_quantity, lot.base_unit)}</span></>}
      onClose={onClose}
      footer={
        <>
          <Button variant="fantasma" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={Boolean(statusMessage) || !quantity || !reason.trim()}>
            {loading ? "Guardando…" : statusMessage ? "Movimiento guardado" : "Confirmar movimiento"}
          </Button>
        </>
      }
    >
      {error && <Message tone="error">{error}</Message>}
      {statusMessage && <Message tone="aviso">{statusMessage}</Message>}

      <Options
        name="tipo-movimiento"
        legend="Tipo de movimiento"
        showLegend
        variant="lista"
        value={kind}
        onChange={setKind}
        options={[
          { value: "waste", label: "Merma / Desperdicio (rotura, humedad)" },
          { value: "discard", label: "Descarte por vencimiento" },
          { value: "adjustment", label: "Ajuste de inventario (error de conteo)" }
        ]}
      />

      {kind === "adjustment" && (
        <Options
          name="direccion-ajuste"
          legend="Dirección del ajuste"
          showLegend
          variant="segmento"
          value={adjustmentDirection}
          onChange={setAdjustmentDirection}
          options={[
            { value: "add", label: "Agregar faltante", icon: "add" },
            { value: "remove", label: "Descontar sobrante", icon: "remove" }
          ]}
        />
      )}

      <TextField
        label={`Cantidad a ${adding ? "agregar" : "descontar"}`}
        type="number"
        numeric
        suffix={unitLabel(lot.base_unit)}
        min="0.001"
        max={adding ? undefined : lot.current_quantity}
        step={0.001}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        help={adding ? undefined : `Máximo ${formatQuantity(lot.current_quantity, lot.base_unit)}.`}
      />

      <TextField
        label="Motivo obligatorio"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Contá qué pasó: bolsa pinchada, fecha cumplida…"
      />
    </Modal>
  );
}
