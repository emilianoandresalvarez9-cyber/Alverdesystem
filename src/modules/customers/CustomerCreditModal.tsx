import { type FormEvent, useEffect, useState } from "react";
import { Button, Message, Modal, Options, TextField } from "../../shared/ui";
import { formatMoney } from "../pos/money";
import { formatDayTime } from "../../shared/format/date";
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

  const when = formatDayTime;
  const kindText = (row: CreditMovementRow) =>
    row.kind === "adjustment" ? `Ajuste · ${row.delta < 0 ? "baja" : "sube"} la deuda` : KIND_LABEL[row.kind];

  return (
    <Modal open wide title={`Cuenta de ${account.name}`} onClose={onClose}>
      <div className="kpis" aria-label="Resumen de la cuenta">
        <div className="kpi"><p className="kpi__etiqueta">Saldo</p><p className="kpi__valor">{formatMoney(account.balance)}</p></div>
        <div className="kpi"><p className="kpi__etiqueta">Tope</p><p className="kpi__valor">{account.credit_limit === null ? "Sin tope" : formatMoney(account.credit_limit)}</p></div>
        <div className="kpi"><p className="kpi__etiqueta">Teléfono</p><p className="kpi__valor kpi__valor--texto">{account.phone ?? "Sin teléfono"}</p></div>
      </div>

      <div className={isAdmin ? "reja-2" : "pila"}>
        <form onSubmit={submit} className="pila">
          <Options name="tipo" legend="Movimiento" showLegend variant="segmento" value={kind} onChange={setKind}
            options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          {kind === "adjustment" && (
            <Options name="signo" legend="El ajuste…" variant="segmento" value={sign === -1 ? "baja" : "sube"}
              onChange={(value) => setSign(value === "baja" ? -1 : 1)}
              options={[{ value: "baja", label: "Baja la deuda", icon: "remove" }, { value: "sube", label: "Sube la deuda", icon: "add" }]} />
          )}
          <TextField label="Monto" inputMode="decimal" numeric required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pagó parte en efectivo" />
          <Button type="submit" block loading={busy}>Guardar {KIND_LABEL[kind].toLowerCase()}</Button>
        </form>

        {/* RF-47: sólo administración define el tope de fiado. */}
        {isAdmin && (
          <div className="pila">
            <div className="fila cuenta-cliente__tope">
              <TextField label="Tope de fiado" inputMode="decimal" numeric value={limit} onChange={(e) => setLimit(e.target.value)} />
              <Button variant="secundario" onClick={() => void saveLimit()}>Guardar tope</Button>
            </div>
            <p className="meta">Vacío = sin tope.</p>
          </div>
        )}
      </div>

      {message && <Message tone={message.tone === "ok" ? "exito" : "error"}>{message.text}</Message>}

      <div className="pila pila--s">
        <h3 className="titulo-seccion">Últimos movimientos</h3>
        {historyError && <p className="meta">{historyError}</p>}
        {history && history.length === 0 && <p className="meta">Todavía no hay movimientos.</p>}
        {history && history.length > 0 && (
          <div className="tabla-marco">
            <table className="tabla tabla--compacta">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Quién</th><th>Nota</th><th className="num">Importe</th></tr></thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="cifra">{when(row.occurred_at)}</td>
                    <td>{kindText(row)}</td>
                    <td>{row.user_name ?? "—"}</td>
                    <td className="suave">{row.note ?? (row.sale_id ? "Venta" : "—")}</td>
                    <td className={row.delta > 0 ? "num fuerte" : "num"}>{row.delta > 0 ? "+" : "−"}{formatMoney(Math.abs(row.delta))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
