import { useMemo, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { useBranch } from "../../shared/branch/BranchContext";
import { Button, Modal, SelectField, TextField } from "../../shared/ui";
import { checkTransfer } from "./transfer";
import type { StockLot } from "./types";

/**
 * RF-68: la administradora pasa parte (o todo) un lote a otra sucursal. Es una sola
 * operación en el servidor (transfer_stock); el localId hace que un reintento no lo duplique.
 * Necesita conexión: no se encola sin conexión.
 */
export function TransferModal({ lot, onClose, onDone }: { lot: StockLot | null; onClose: () => void; onDone: () => void }) {
  const { branches } = useBranch();
  const destinations = useMemo(() => branches.filter((b) => b.id !== lot?.branch_id), [branches, lot]);
  const [toBranchId, setToBranchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localId] = useState(() => crypto.randomUUID());

  if (!lot) return null;
  const unit = lot.base_unit === "gram" ? "g" : lot.base_unit === "millilitre" ? "ml" : "u.";

  async function confirm() {
    if (!lot) return;
    const check = checkTransfer({ rawQuantity: quantity, available: lot.current_quantity, fromBranchId: lot.branch_id, toBranchId });
    if (!check.ok) return setError(check.reason);
    if (!navigator.onLine) return setError("Los traspasos necesitan conexión.");
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().rpc("transfer_stock", {
      p_lot_id: lot.id,
      p_to_branch_id: toBranchId,
      p_quantity: check.quantity,
      ...(note.trim() ? { p_note: note.trim() } : {}),
      p_local_id: localId
    });
    setBusy(false);
    if (err) return setError(err.message);
    onDone();
    onClose();
  }

  return (
    <Modal open title={`Traspasar ${lot.product_name} · ${lot.presentation_name}`} onClose={onClose}
      footer={<>
        <Button variant="fantasma" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void confirm()} loading={busy} disabled={destinations.length === 0}>Confirmar traspaso</Button>
      </>}>
      <p className="field-help" style={{ marginTop: 0 }}>
        Desde <strong>{lot.branch_name ?? "esta sucursal"}</strong>: hay {lot.current_quantity} {unit}. El lote nuevo conserva
        proveedor, costo y vencimiento.
      </p>
      {destinations.length === 0 ? (
        <p className="notice">No hay otra sucursal activa. Creala en Administración → Sucursales y cajas.</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--esp-m)" }}>
          <SelectField label="Sucursal de destino" value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
            <option value="">Elegí…</option>
            {destinations.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <TextField label={`Cantidad a traspasar (${unit})`} inputMode="decimal" value={quantity}
            onChange={(e) => setQuantity(e.target.value)} help={`Máximo ${lot.current_quantity} ${unit}`} />
          <TextField label="Nota (opcional)" placeholder="Ej.: pedido de Norte" value={note} maxLength={500}
            onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}
