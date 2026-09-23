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
    if (qty > lot.current_quantity) {
      setError(`No podés descontar más del stock actual (${lot.current_quantity}).`);
      return;
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

      const newLotQuantity = Number(Math.max(0, lot.current_quantity - qty).toFixed(3));
      const shouldClose = newLotQuantity <= 0.0001;

      // 1. Registrar movimiento de stock con motivo obligatorio
      const { error: movErr } = await supabase.from("stock_movements").insert({
        local_id: crypto.randomUUID(),
        kind,
        product_id: lot.product_id,
        lot_id: lot.id,
        quantity: -qty, // Salida de stock
        reason: reason.trim(),
        user_id: userId,
        occurred_at: new Date().toISOString(),
      });

      if (movErr) throw movErr;

      // 2. Actualizar cantidad en el lote
      const { error: lotErr } = await supabase
        .from("stock_lots")
        .update({
          current_quantity: newLotQuantity,
          status: shouldClose ? "closed" : lot.status,
        })
        .eq("id", lot.id);

      if (lotErr) throw lotErr;

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

        <TextField
          label={`Cantidad a descontar (${lot.base_unit})`}
          type="number"
          min="0.001"
          max={lot.current_quantity}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={`Máximo: ${lot.current_quantity}`}
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
