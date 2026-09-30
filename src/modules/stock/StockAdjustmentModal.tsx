import { useEffect, useState } from "react";
import { Modal, Button, TextField, SelectField } from "../../shared/ui";
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
    });
  }, [pendingFeedbackId]);

  if (!lot) return null;

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Ingresá una cantidad mayor a 0.");
      return;
    }
    if (kind !== "adjustment" || adjustmentDirection === "remove") {
      if (qty > lot.current_quantity) {
      setError(`No podés descontar más del stock actual (${lot.current_quantity}).`);
      return;
      }
    }
    if (!reason.trim()) {
      setError("El motivo del descarte/ajuste es obligatorio (RF-57).");
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
      });

      onSuccess();
      if (result.synchronized) onClose();
      else {
        setPendingFeedbackId(result.localId);
        setStatusMessage(`Guardado en este dispositivo; queda pendiente de sincronización.${result.failureMessage ? ` Motivo: ${result.failureMessage}` : ""}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el movimiento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Ajuste de Stock: ${lot.product_name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="fantasma" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="peligro" onClick={handleSubmit} disabled={loading || Boolean(statusMessage) || !quantity || !reason.trim()}>
            {loading ? "Guardando..." : statusMessage ? "Movimiento guardado" : "Confirmar Movimiento"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-s)" }}>
        <p style={{ margin: 0, color: "var(--color-tinta-suave)", fontSize: "var(--texto-s)" }}>
          Lote: <strong>{lot.presentation_name}</strong> | Stock actual:{" "}
          <strong>
            {lot.current_quantity} {lot.base_unit}
          </strong>
        </p>

        {error && (
          <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>
            {error}
          </p>
        )}
        {statusMessage && <p role="status" style={{ color: "var(--color-aviso)", margin: 0 }}>{statusMessage}</p>}

        <SelectField
          label="Tipo de movimiento (RF-57)"
          value={kind}
          onChange={(e) => setKind(e.target.value as "waste" | "discard" | "adjustment")}
        >
          <option value="waste">Merma / Desperdicio (rotura, humedad)</option>
          <option value="discard">Descarte por vencimiento</option>
          <option value="adjustment">Ajuste de inventario (error de conteo)</option>
        </SelectField>

        {kind === "adjustment" && (
          <SelectField
            label="Dirección del ajuste"
            value={adjustmentDirection}
            onChange={(e) => setAdjustmentDirection(e.target.value as "add" | "remove")}
          >
            <option value="add">Agregar stock faltante</option>
            <option value="remove">Descontar stock sobrante</option>
          </SelectField>
        )}

        <TextField
          label={`Cantidad a ${kind === "adjustment" && adjustmentDirection === "add" ? "agregar" : "descontar"} (${lot.base_unit})`}
          type="number"
          min="0.001"
          max={kind === "adjustment" && adjustmentDirection === "add" ? undefined : lot.current_quantity}
          step={0.001}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={kind === "adjustment" && adjustmentDirection === "add" ? "Cantidad a sumar" : `Máximo: ${lot.current_quantity}`}
        />

        <TextField
          label="Motivo obligatorio"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Bolsa pinchada en el depósito / Fecha cumplida"
        />
      </div>
    </Modal>
  );
}


