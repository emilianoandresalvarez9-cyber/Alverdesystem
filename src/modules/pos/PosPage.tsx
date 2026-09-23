import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Button, EmptyState, GlassCard, Modal, SelectField, TextField } from "../../shared/ui";
import { OfflineIndicator } from "../../shared/components/OfflineIndicator";
import { enqueueOperation } from "../../shared/offline/queue";
import { synchronizePendingOperations } from "../../shared/offline/sync";
import { useCatalog } from "../catalog/useCatalog";
import { lookupBarcode, pricePerKilo, searchEntries, toPosEntries } from "./catalogLookup";
import { buildSalePayload, cartReducer, cartTotal, lineTotal } from "./cart";
import { formatMoney, lineSubtotal, roundQuantity } from "./money";
import {
  assignRegister, assignedRegister, closeShift, currentShift, listRegisters, openShift, shiftSummary,
  type CloseResult, type RegisterOption
} from "./shift";
import type { ShiftSummary } from "./shiftSummary";
import { PAYMENT_LABELS, type CurrentShift, type PaymentMethod, type PosEntry } from "./types";
import { useScanner } from "./useScanner";

type Stage = { kind: "loading" } | { kind: "register" } | { kind: "open"; register: RegisterOption } | { kind: "selling"; shift: CurrentShift };

export function PosPage() {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  const resolveStage = useCallback(async () => {
    const shift = await currentShift();
    if (shift) return setStage({ kind: "selling", shift });
    const register = await assignedRegister();
    setStage(register ? { kind: "open", register } : { kind: "register" });
  }, []);

  useEffect(() => { void resolveStage(); }, [resolveStage]);

  switch (stage.kind) {
    case "loading":
      return <p className="glass loading-card">Preparando la caja…</p>;
    case "register":
      return <RegisterSetup onAssigned={(register) => setStage({ kind: "open", register })} />;
    case "open":
      return (
        <OpenShiftForm
          register={stage.register}
          onOpened={(shift) => setStage({ kind: "selling", shift })}
          onChangeRegister={() => setStage({ kind: "register" })}
        />
      );
    case "selling":
      return <Register shift={stage.shift} onClosed={() => void resolveStage()} />;
  }
}

function RegisterSetup({ onAssigned }: { onAssigned: (register: RegisterOption) => void }) {
  const [registers, setRegisters] = useState<RegisterOption[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRegisters()
      .then((list) => {
        setRegisters(list);
        setSelected(list[0]?.id ?? "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudieron cargar las cajas."));
  }, []);

  async function confirm() {
    const register = registers?.find((r) => r.id === selected);
    if (!register) return;
    await assignRegister(register);
    onAssigned(register);
  }

  return (
    <GlassCard className="pos-panel pos-setup">
      <h2>¿Qué caja es este equipo?</h2>
      <p className="field-help">Se elige una sola vez por equipo. Hace falta conexión para ver la lista.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {registers && registers.length === 0 && (
        <EmptyState title="No hay cajas cargadas">La administradora las crea en Administración → Sucursales.</EmptyState>
      )}
      {registers && registers.length > 0 && (
        <>
          <SelectField label="Caja" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.branchName ? ` (${r.branchName})` : ""}</option>
            ))}
          </SelectField>
          <Button onClick={() => void confirm()} disabled={!selected}>Usar esta caja</Button>
        </>
      )}
    </GlassCard>
  );
}

function OpenShiftForm({ register, onOpened, onChangeRegister }: {
  register: RegisterOption; onOpened: (shift: CurrentShift) => void; onChangeRegister: () => void;
}) {
  const [initial, setInitial] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(initial.replace(",", "."));
    if (!(amount >= 0)) return setError("Ingresá el efectivo inicial (puede ser 0).");
    setBusy(true);
    setError(null);
    try {
      onOpened(await openShift(register, amount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el turno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="pos-panel pos-setup">
      <h2>Abrir turno en {register.name}</h2>
      <form onSubmit={submit} className="pos-setup">
        <TextField label="Efectivo en la caja al empezar" inputMode="decimal" value={initial}
          onChange={(e) => setInitial(e.target.value)} help="Sin conexión el turno se abre igual y se registra al volver internet." />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={busy}>Abrir turno</Button>
        <Button variant="fantasma" onClick={onChangeRegister}>Este equipo es otra caja</Button>
      </form>
    </GlassCard>
  );
}

const SELLING_METHODS: PaymentMethod[] = ["cash", "transfer", "qr"];

function Register({ shift, onClosed }: { shift: CurrentShift; onClosed: () => void }) {
  const { products, isLoading, isOffline } = useCatalog();
  const entries = useMemo(() => toPosEntries(products), [products]);
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<PosEntry[] | null>(null);
  const [weighing, setWeighing] = useState<PosEntry | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [charging, setCharging] = useState(false);
  const [closing, setClosing] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const total = cartTotal(lines);
  const results = /^\d+$/.test(query.trim()) ? [] : searchEntries(entries, query);

  const focusScan = () => requestAnimationFrame(() => scanRef.current?.focus());

  const addEntry = useCallback((entry: PosEntry) => {
    setChoices(null);
    setQuery("");
    if (entry.soldByWeight) {
      setWeighing(entry);
      return;
    }
    dispatch({ type: "add", entry, lineId: crypto.randomUUID() });
    setFeedback(null);
    focusScan();
  }, []);

  const handleCode = useCallback((code: string) => {
    const result = lookupBarcode(entries, code);
    if (result.kind === "found") return addEntry(result.entry);
    if (result.kind === "choose") return setChoices(result.entries);
    setFeedback({ tone: "error", text: `El código ${result.code} no está en el catálogo${isOffline ? " guardado en este equipo" : ""}.` });
  }, [entries, addEntry, isOffline]);

  useScanner(handleCode, useCallback(() => scanRef.current, []));

  function submitQuery(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    if (/^\d+$/.test(text)) {
      setQuery("");
      handleCode(text);
    } else if (results.length === 1 && results[0]) {
      addEntry(results[0]);
    }
  }

  async function charge() {
    setCharging(true);
    try {
      const payload = buildSalePayload(lines, { shiftId: shift.id, paymentMethod: method, newId: () => crypto.randomUUID() });
      await enqueueOperation({ kind: "sale", payload });
      dispatch({ type: "clear" });
      setMethod("cash");
      setFeedback({ tone: "ok", text: `Venta guardada: ${formatMoney(payload.totalAmount)} en ${PAYMENT_LABELS[payload.paymentMethod].toLowerCase()}.` });
      void synchronizePendingOperations().catch(() => undefined);
    } catch (err) {
      setFeedback({ tone: "error", text: err instanceof Error ? err.message : "No se pudo guardar la venta." });
    } finally {
      setCharging(false);
      focusScan();
    }
  }

  return (
    <div className="pos-layout">
      <GlassCard className="pos-panel">
        <form className="pos-scan" onSubmit={submitQuery}>
          <TextField ref={scanRef} label="Código o nombre del producto" autoFocus autoComplete="off" value={query}
            onChange={(e) => setQuery(e.target.value)} placeholder="Escaneá o escribí" />
          <Button type="submit" variant="secundario">Agregar</Button>
        </form>
        {isLoading && entries.length === 0 && <p className="field-help">Cargando catálogo…</p>}

        {results.length > 0 && (
          <ul className="pos-results" aria-label="Resultados">
            {results.map((entry) => (
              <li key={entry.presentationId}>
                <Button variant="fantasma" onClick={() => addEntry(entry)}>
                  <span>{entry.productName} · {entry.presentationName}</span>
                  <span>{entry.soldByWeight ? `${formatMoney(pricePerKilo(entry))}/kg` : formatMoney(entry.salePrice)}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}

        {choices && (
          <div role="group" aria-label="Elegí la presentación">
            <p className="field-help">Ese código es de un producto con varias presentaciones. ¿Cuál es?</p>
            <ul className="pos-results">
              {choices.map((entry) => (
                <li key={entry.presentationId}>
                  <Button variant="secundario" onClick={() => addEntry(entry)}>
                    <span>{entry.presentationName}</span><span>{formatMoney(entry.salePrice)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lines.length === 0 ? (
          <EmptyState title="Todavía no hay productos">Pasá un producto por el lector o buscalo por nombre.</EmptyState>
        ) : (
          <ul className="pos-lines">
            {lines.map((line) => (
              <li key={line.lineId} className="pos-line">
                <div>
                  <p className="pos-line-name">{line.entry.productName} · {line.entry.presentationName}</p>
                  <p className="pos-line-detail">
                    {line.weight !== undefined
                      ? `${line.weight} ${line.entry.baseUnit === "millilitre" ? "ml" : "g"} a ${formatMoney(pricePerKilo(line.entry))}/kg`
                      : `${formatMoney(line.entry.salePrice)} c/u`}
                  </p>
                </div>
                {line.weight === undefined ? (
                  <div className="pos-qty">
                    <Button variant="secundario" aria-label="Quitar uno"
                      onClick={() => dispatch({ type: "setQuantity", lineId: line.lineId, quantity: line.quantity - 1 })}>−</Button>
                    <output aria-label="Cantidad">{line.quantity}</output>
                    <Button variant="secundario" aria-label="Agregar uno"
                      onClick={() => dispatch({ type: "setQuantity", lineId: line.lineId, quantity: line.quantity + 1 })}>+</Button>
                  </div>
                ) : <span />}
                <span className="pos-amount">{formatMoney(lineTotal(line))}</span>
                <Button variant="fantasma" aria-label={`Quitar ${line.entry.productName}`}
                  onClick={() => dispatch({ type: "remove", lineId: line.lineId })}>Quitar</Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="pos-panel">
        <p className="pos-total-label">Total</p>
        <p className="pos-total" aria-live="polite">{formatMoney(total)}</p>

        <fieldset className="pos-methods">
          <legend>Medio de pago</legend>
          {SELLING_METHODS.map((m) => (
            <label key={m} className="pos-method">
              <input type="radio" name="metodo" value={m} checked={method === m} onChange={() => setMethod(m)} />
              <span>{PAYMENT_LABELS[m]}</span>
            </label>
          ))}
        </fieldset>

        <Button className="pos-charge" onClick={() => void charge()} disabled={lines.length === 0} loading={charging}>
          Cobrar {lines.length > 0 ? formatMoney(total) : ""}
        </Button>
        <Button variant="fantasma" onClick={() => dispatch({ type: "clear" })} disabled={lines.length === 0}>Vaciar</Button>
        <p className="pos-feedback" data-tone={feedback?.tone} role="status">{feedback?.text}</p>

        <div className="pos-shift">
          <OfflineIndicator />
          <Button variant="secundario" onClick={() => setClosing(true)}>Cerrar turno</Button>
        </div>
      </GlassCard>

      {weighing && (
        <WeightDialog entry={weighing} onCancel={() => { setWeighing(null); focusScan(); }}
          onConfirm={(weight) => {
            dispatch({ type: "addWeighed", entry: weighing, weight, lineId: crypto.randomUUID() });
            setWeighing(null);
            focusScan();
          }} />
      )}
      {closing && <CloseShiftDialog shift={shift} onCancel={() => setClosing(false)} onClosed={onClosed} />}
    </div>
  );
}

function WeightDialog({ entry, onConfirm, onCancel }: { entry: PosEntry; onConfirm: (weight: number) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const weight = Number(value.replace(",", "."));
  const valid = weight > 0;
  const unit = entry.baseUnit === "millilitre" ? "ml" : "g";
  const amount = valid ? lineSubtotal(roundQuantity(weight / entry.baseQuantity), entry.salePrice) : 0;

  return (
    <Modal open title={`Peso de ${entry.productName}`} onClose={onCancel}
      footer={<>
        <Button variant="fantasma" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onConfirm(weight)} disabled={!valid}>Agregar {valid ? formatMoney(amount) : ""}</Button>
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(weight); }}>
        <TextField label={`Peso leído en la balanza (${unit})`} inputMode="decimal" autoFocus value={value}
          onChange={(e) => setValue(e.target.value)} help={`${formatMoney(pricePerKilo(entry))} por ${unit === "ml" ? "litro" : "kilo"}`} />
      </form>
    </Modal>
  );
}

function CloseShiftDialog({ shift, onCancel, onClosed }: { shift: CurrentShift; onCancel: () => void; onClosed: () => void }) {
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void shiftSummary(shift).then(setSummary); }, [shift]);

  async function confirm() {
    setBusy(true);
    try {
      const outcome = await closeShift();
      setResult(outcome);
      setSummary(outcome.summary);
    } catch (err) {
      setResult({ closed: false, summary: summary!, reason: err instanceof Error ? err.message : "No se pudo cerrar el turno." });
    } finally {
      setBusy(false);
    }
  }

  const shown = summary;
  return (
    <Modal open title={`Cierre de ${shift.registerName}`} onClose={result?.closed ? onClosed : onCancel}
      footer={result?.closed
        ? <Button onClick={onClosed}>Listo</Button>
        : <>
            <Button variant="fantasma" onClick={onCancel}>Seguir vendiendo</Button>
            <Button onClick={() => void confirm()} loading={busy} disabled={!shown}>Cerrar turno</Button>
          </>}>
      {!shown ? <p>Calculando…</p> : (
        <table className="pos-summary">
          <thead><tr><th>Medio de pago</th><th>Ventas</th><th>Total</th></tr></thead>
          <tbody>
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
              <tr key={m}><td>{PAYMENT_LABELS[m]}</td><td>{shown.byMethod[m].count}</td><td>{formatMoney(shown.byMethod[m].total)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{shown.salesCount}</td><td>{formatMoney(shown.total)}</td></tr></tfoot>
        </table>
      )}
      {shown && <p className="field-help">Efectivo esperado en la caja: {formatMoney(shift.initialBalance + shown.byMethod.cash.total)} (incluye {formatMoney(shift.initialBalance)} inicial).</p>}
      {result && !result.closed && <p className="form-error" role="alert">{result.reason}</p>}
      {result?.closed && (
        <p className="notice" role="status">
          Turno cerrado.{result.backupError ? ` El respaldo no se pudo descargar: ${result.backupError}` : " Se descargó el respaldo del cierre."}
        </p>
      )}
    </Modal>
  );
}
