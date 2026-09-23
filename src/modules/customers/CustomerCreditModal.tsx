import { type FormEvent, useEffect, useState } from "react";
import { Button, Modal, TextField } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { loadMovements, registerMovement, setCreditLimit } from "./api";
import type { CreditMovementKind, CreditMovementRow, CustomerAccount } from "./types";

type Props = {
  account: CustomerAccount;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const KIND_LABEL: Record<CreditMovementKind, string> = { charge: "Fiado", payment: "Abono", adjustment: "Ajuste" };

export function CustomerCreditModal({ account, isAdmin, onClose, onChanged }: Props) {
  const [kind, setKind] = useState<CreditMovementKind>("payment");
  const [sign, setSign] = useState<1 | -1>(-1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState(account.credit_limit === null ? "" : String(account.credit_limit));
  const [history, setHistory] = useState<CreditMovementRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadMovements(account.id).then(setHistory).catch((err: unknown) =>
      setHistoryError(err instanceof Error ? err.message : "Historial no disponible sin conexión."));
  }, [account.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));
    setBusy(true);
    try {
      await registerMovement({
        customerId: account.id,
        movementKind: kind,
        amount: value,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(kind === "adjustment" ? { adjustmentSign: sign } : {})
      });
      setAmount("");
      setNote("");
      setMessage({ tone: "ok", text: `${KIND_LABEL[kind]} de ${formatMoney(value)} guardado.` });
      onChanged();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setBusy(false);
    }
  }

  async function saveLimit() {
    const trimmed = limit.trim();
    const value = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (value !== null && !(value >= 0)) return setMessage({ tone: "error", text: "El tope tiene que ser un número (o vacío para sin tope)." });
    try {
      await setCreditLimit(account.id, value);
      setMessage({ tone: "ok", text: value === null ? "Tope quitado." : `Tope actualizado a ${formatMoney(value)}.` });
      onChanged();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "No se pudo guardar el tope." });
    }
  }

  const kinds: CreditMovementKind[] = isAdmin ? ["payment", "charge", "adjustment"] : ["payment", "charge"];

  return (
    <Modal open title={account.name} onClose={onClose}>
      <p className="pos-total-label">Saldo</p>
      <p className="pos-total">{formatMoney(account.balance)}</p>
      <p className="field-help">
        {account.credit_limit === null ? "Sin tope de fiado." : `Tope de fiado: ${formatMoney(account.credit_limit)}.`}
        {account.phone ? ` Teléfono: ${account.phone}.` : ""}
      </p>

      <form onSubmit={submit} className="pos-setup">
        <fieldset className="pos-methods">
          <legend>Movimiento</legend>
          {kinds.map((k) => (
            <label key={k} className="pos-method">
              <input type="radio" name="tipo" checked={kind === k} onChange={() => setKind(k)} />
              <span>{KIND_LABEL[k]}</span>
            </label>
          ))}
        </fieldset>
        {kind === "adjustment" && (
          <fieldset className="pos-methods">
            <legend>El ajuste…</legend>
            <label className="pos-method"><input type="radio" name="signo" checked={sign === -1} onChange={() => setSign(-1)} /><span>Baja la deuda</span></label>
            <label className="pos-method"><input type="radio" name="signo" checked={sign === 1} onChange={() => setSign(1)} /><span>Sube la deuda</span></label>
          </fieldset>
        )}
        <TextField label="Monto" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pagó parte en efectivo" />
        <Button type="submit" loading={busy}>Guardar {KIND_LABEL[kind].toLowerCase()}</Button>
      </form>

      {isAdmin && (
        <div className="pos-scan" style={{ marginTop: "var(--esp-m)" }}>
          <TextField label="Tope de fiado" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} help="Vacío = sin tope." />
          <Button variant="secundario" onClick={() => void saveLimit()}>Guardar tope</Button>
        </div>
      )}
      <p className="pos-feedback" data-tone={message?.tone} role="status">{message?.text}</p>

      <h3>Últimos movimientos</h3>
      {historyError && <p className="field-help">{historyError}</p>}
      {history && history.length === 0 && <p className="field-help">Todavía no hay movimientos.</p>}
      {history && history.length > 0 && (
        <table className="pos-summary">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Nota</th><th>Importe</th></tr></thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.occurred_at).toLocaleDateString("es-AR")}</td>
                <td>{KIND_LABEL[row.kind]}{row.user_name ? ` · ${row.user_name}` : ""}</td>
                <td>{row.note ?? (row.sale_id ? "Venta" : "")}</td>
                <td>{row.delta > 0 ? "+" : "−"}{formatMoney(Math.abs(row.delta))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
