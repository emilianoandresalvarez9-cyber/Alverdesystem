import { useState } from "react";
import { Modal, Button, TextField, SelectField } from "../../shared/ui";
import { getSupabase } from "../../shared/supabase/client";
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

    try {
      const supabase = getSupabase();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión requerida");

      const signedQuantity = kind === "adjustment" && adjustmentDirection === "add" ? qty : -qty;
      const newLotQuantity = Number(Math.max(0, lot.current_quantity + signedQuantity).toFixed(3));
      const shouldClose = newLotQuantity <= 0.0001;

      const { error: rpcErr } = await supabase.rpc('adjust_stock', {
        p_lot_id: lot.id,
        p_product_id: lot.product_id,
        p_kind: kind,
        p_quantity: signedQuantity,
        p_reason: reason.trim(),
        p_new_lot_quantity: newLotQuantity,
        p_should_close_lot: shouldClose
      });

      if (rpcErr) throw rpcErr;

      onSuccess();
      onClose();
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
          <Button variant="peligro" onClick={handleSubmit} disabled={loading || !quantity || !reason.trim()}>
            {loading ? "Registrando..." : "Confirmar Movimiento"}
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

