import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Badge, Button, EmptyState, Icon, Message, Modal, Options, SelectField, TextField, useCompact, type IconName, type OptionItem } from "../../shared/ui";
import { enqueueOperation, pendingOperations } from "../../shared/offline/queue";
import { getSupabase } from "../../shared/supabase/client";
import { checkGranelStock } from "./granelStock";
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
import { PAYMENT_LABELS, type CartLine, type CurrentShift, type PaymentMethod, type PosEntry } from "./types";
import { useScanner } from "./useScanner";
import { useBranch } from "../../shared/branch/BranchContext";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { registerBranchWarning } from "./registerBranch";
import { loadAccounts } from "../customers/api";
import { exceedsLimit, filterAccounts } from "../customers/balance";
import type { CustomerAccount } from "../customers/types";

type Stage = { kind: "loading" } | { kind: "register" } | { kind: "open"; register: RegisterOption } | { kind: "selling"; shift: CurrentShift } | { kind: "blocked"; message: string };

export function PosPage() {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const profile = useCurrentProfile();
  const { isAdmin, workingBranchId } = useBranch();

  const resolveStage = useCallback(async () => {
    const shift = await currentShift(profile.id);
    if (shift) {
      const unsafeEmployeeShift = !isAdmin && (
        shift.ownerUserId !== profile.id ||
        !workingBranchId ||
        !shift.branchId ||
        shift.branchId !== workingBranchId
      );
      const selectedBranchMismatch = isAdmin && workingBranchId && shift.branchId && shift.branchId !== workingBranchId;
      if (unsafeEmployeeShift || selectedBranchMismatch) {
        return setStage({ kind: "blocked", message: "Hay un turno local de otra cuenta o sucursal. No se habilitó la venta para evitar operar una caja ajena. Administración debe revisar y cerrar el turno anterior." });
      }
      return setStage({ kind: "selling", shift });
    }
    const register = await assignedRegister();
    if (register && !isAdmin && (!workingBranchId || register.branchId !== workingBranchId)) {
      return setStage({ kind: "register" });
    }
    setStage(register ? { kind: "open", register } : { kind: "register" });
  }, [profile.id, isAdmin, workingBranchId]);

  useEffect(() => { void resolveStage(); }, [resolveStage]);

  switch (stage.kind) {
    case "loading":
      return (
        <div className="pila" aria-busy="true">
          <span className="esqueleto" style={{ width: "40%" }} />
          <p className="meta">Preparando la caja…</p>
        </div>
      );
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
    case "blocked":
      return <SetupCard title="No se puede abrir esta caja">
        <Message tone="error">{stage.message}</Message>
      </SetupCard>;
  }
}

function RegisterSetup({ onAssigned }: { onAssigned: (register: RegisterOption) => void }) {
  const [registers, setRegisters] = useState<RegisterOption[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { workingBranchId, label: branchLabel } = useBranch();

  useEffect(() => {
    listRegisters(workingBranchId)
      .then((list) => {
        setRegisters(list);
        setSelected(list[0]?.id ?? "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudieron cargar las cajas."));
  }, [workingBranchId]);

  async function confirm() {
    const register = registers?.find((r) => r.id === selected);
    if (!register) return;
    await assignRegister(register);
    onAssigned(register);
  }

  return (
    <SetupCard title="¿Qué caja es este equipo?">
      <p className="cuerpo-s suave">
        Se elige una sola vez por equipo. Hace falta conexión para ver la lista.
        {workingBranchId ? ` Se muestran las cajas de ${branchLabel}: las ventas descuentan stock de esa sucursal.` : ""}
      </p>
      {error && <Message tone="error">{error}</Message>}
      {registers && registers.length === 0 && (
        <EmptyState title="No hay cajas cargadas">La administradora las crea en Administración → Sucursales y cajas.</EmptyState>
      )}
      {registers && registers.length > 0 && (
        <>
          <SelectField label="Caja" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.branchName ? ` (${r.branchName})` : ""}</option>
            ))}
          </SelectField>
          <Button block onClick={() => void confirm()} disabled={!selected}>Usar esta caja</Button>
        </>
      )}
    </SetupCard>
  );
}

/** Antes de vender: una sola carta centrada; el marco sigue en su lugar para que la transición sea sólo el contenido. */
function SetupCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="login">
      <section className="carta login__carta">
        <div className="pila pila--s">
          <h2 className="titulo-modal">{title}</h2>
          {subtitle ? <p className="meta">{subtitle}</p> : null}
        </div>
        {children}
      </section>
    </div>
  );
}

function OpenShiftForm({ register, onOpened, onChangeRegister }: {
  register: RegisterOption; onOpened: (shift: CurrentShift) => void; onChangeRegister: () => void;
}) {
  const [initial, setInitial] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const profile = useCurrentProfile();
  const { isAdmin, workingBranchId, label: branchLabel } = useBranch();
  const otherBranch = registerBranchWarning({ isAdmin, workingBranchId, workingBranchLabel: branchLabel, register });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (otherBranch) return;
    const amount = Number(initial.replace(",", "."));
    if (!(amount >= 0)) return setError("Ingresá el efectivo inicial (puede ser 0).");
    setBusy(true);
    setError(null);
    try {
      onOpened(await openShift(register, amount, profile.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el turno.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupCard title={`Abrir turno en ${register.name}`} subtitle={register.branchName ?? undefined}>
      <form onSubmit={submit} className="pila">
        <TextField label="Efectivo en la caja al empezar" inputMode="decimal" numeric value={initial}
          onChange={(e) => setInitial(e.target.value)} help="Sin conexión el turno se abre igual y se registra al volver internet." />
        {otherBranch && <Message tone="aviso">{otherBranch}</Message>}
        {error && <Message tone="error">{error}</Message>}
        <Button type="submit" block loading={busy} disabled={!!otherBranch}>Abrir turno</Button>
        <Button variant="fantasma" block onClick={onChangeRegister}>Este equipo es otra caja</Button>
      </form>
    </SetupCard>
  );
}

const METHOD_ICONS: Record<PaymentMethod, IconName> = { cash: "payments", transfer: "account_balance", qr: "qr_code_2", credit: "menu_book" };
const SELLING_METHODS: OptionItem<PaymentMethod>[] = (["cash", "transfer", "qr", "credit"] as const)
  .map((value) => ({ value, label: PAYMENT_LABELS[value], icon: METHOD_ICONS[value] }));

const TIME_FORMAT = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Hora local de apertura del turno; si la fecha guardada no se puede leer, no se muestra nada raro. */
function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : TIME_FORMAT.format(date);
}

function Register({ shift, onClosed }: { shift: CurrentShift; onClosed: () => void }) {
  const { products, isLoading, isOffline } = useCatalog();
  // RF-69: precios de la sucursal de la caja (turnos viejos sin sucursal: la de trabajo).
  const { workingBranchId } = useBranch();
  const priceBranch = shift.branchId ?? workingBranchId;
  const entries = useMemo(() => toPosEntries(products, priceBranch), [products, priceBranch]);
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<PosEntry[] | null>(null);
  const [weighing, setWeighing] = useState<PosEntry | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [charging, setCharging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const compact = useCompact();

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
      // RF-38: el granel no admite faltante. Con conexión se avisa antes de cobrar; sin conexión decide la base.
      if (navigator.onLine) {
        const shortage = await checkGranelStock(getSupabase(), lines, shift.branchId ?? workingBranchId ?? null, await pendingOperations());
        if (shortage) {
          setFeedback({ tone: "error", text: shortage });
          return;
        }
      }
      const payload = buildSalePayload(lines, {
        shiftId: shift.id,
        paymentMethod: method,
        ...(method === "credit" && customer ? { customerId: customer.id } : {}),
        newId: () => crypto.randomUUID()
      });
      await enqueueOperation({ kind: "sale", payload });
      dispatch({ type: "clear" });
      setMethod("cash");
      setCustomer(null);
      setFeedback({
        tone: "ok",
        text: payload.paymentMethod === "credit" && customer
          ? `Fiado guardado: ${formatMoney(payload.totalAmount)} a la cuenta de ${customer.name}.`
          : `Venta guardada: ${formatMoney(payload.totalAmount)} en ${PAYMENT_LABELS[payload.paymentMethod].toLowerCase()}.`
      });
      void synchronizePendingOperations().catch(() => undefined);
    } catch (err) {
      setFeedback({ tone: "error", text: err instanceof Error ? err.message : "No se pudo guardar la venta." });
    } finally {
      setCharging(false);
      focusScan();
    }
  }

  const itemCount = lines.reduce((sum, line) => sum + (line.weight === undefined ? line.quantity : 1), 0);
  const itemText = itemCount === 1 ? "1 artículo" : `${itemCount} artículos`;
  const canCharge = lines.length > 0 && !(method === "credit" && !customer);
  const feedbackMessage = feedback
    ? <Message tone={feedback.tone === "ok" ? "exito" : "error"}>{feedback.text}</Message>
    : null;

  return (
    <div className="caja">
      <div className="pila">
        <div className="turno">
          <Badge tone="exito">Turno abierto</Badge>
          {!shift.persisted && <Badge tone="aviso" icon="sync">Abierto sin conexión · se registra al sincronizar</Badge>}
          <span><strong>{shift.registerName}</strong> · desde las <span className="cifra">{formatTime(shift.openedAt)}</span></span>
          <span>Efectivo inicial <span className="cifra">{formatMoney(shift.initialBalance)}</span></span>
          <Button variant="secundario" size="compacto" icon="lock" className="turno__cerrar" onClick={() => setClosing(true)}>Cerrar turno</Button>
        </div>

        <section className="pila pila--s" aria-label="Carga de productos">
          <form className="caja-busqueda" onSubmit={submitQuery}>
            <TextField ref={scanRef} className="crece" label="Código o nombre del producto" hideLabel icon="barcode_scanner"
              autoFocus autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Código o nombre" />
            <Button type="submit" variant="secundario" icon="add">Agregar</Button>
          </form>
          <CatalogState loading={isLoading && entries.length === 0} offline={isOffline} count={entries.length} />

          {results.length > 0 && (
            <ul className="resultados" aria-label="Resultados">
              {results.map((entry) => (
                <li key={entry.presentationId}>
                  <button type="button" onClick={() => addEntry(entry)}>
                    <span><strong>{entry.productName}</strong> · {entry.presentationName}</span>
                    <EntryPrice entry={entry} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {choices && choices.length > 0 && (
            <ul className="resultados" aria-label="Elegí la presentación">
              <li className="resultados__titulo">Elegí la presentación · {choices[0]!.productName}</li>
              {choices.map((entry) => (
                <li key={entry.presentationId}>
                  <button type="button" onClick={() => addEntry(entry)}>
                    <span>{entry.presentationName}</span>
                    <EntryPrice entry={entry} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {compact && feedbackMessage}
        </section>

        <Ticket lines={lines} compact={compact} itemText={itemText}
          onClear={() => dispatch({ type: "clear" })}
          onQuantity={(lineId, quantity) => dispatch({ type: "setQuantity", lineId, quantity })}
          onRemove={(lineId) => dispatch({ type: "remove", lineId })} />
      </div>

      <aside className="carta cobro" aria-label="Cobro">
        {!compact && (
          <div className="total">
            <p className="total__etiqueta"><span>Total</span><span className="meta">{itemText}</span></p>
            <p className="total__cifra" aria-live="polite">{formatMoney(total)}</p>
          </div>
        )}
        <Options name="metodo" legend="Medio de pago" showLegend value={method} onChange={setMethod} options={SELLING_METHODS} />
        {method === "credit" && <CustomerPicker selected={customer} onSelect={setCustomer} saleTotal={total} />}
        {!compact && (
          <Button size="grande" block onClick={() => void charge()} disabled={!canCharge} loading={charging}>
            Cobrar{lines.length > 0 ? <span className="boton__cifra">{formatMoney(total)}</span> : null}
          </Button>
        )}
        {!compact && feedbackMessage}
      </aside>

      {compact && (
        <div className="barra-cobro">
          <div className="total">
            <p className="total__etiqueta">Total</p>
            <p className="total__cifra" aria-live="polite">{formatMoney(total)}</p>
          </div>
          <Button size="grande" onClick={() => void charge()} disabled={!canCharge} loading={charging}>Cobrar</Button>
        </div>
      )}

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

/** Estado del catálogo de la caja: sin conexión se vende con la copia guardada, y se avisa. */
function CatalogState({ loading, offline, count }: { loading: boolean; offline: boolean; count: number }) {
  const products = count === 1 ? "1 producto" : `${count} productos`;
  if (loading) return <p className="meta">Cargando catálogo…</p>;
  if (offline) return <Badge tone="aviso" icon="cloud_off" className="caja-catalogo">Catálogo guardado en este equipo · {products}</Badge>;
  return <p className="meta caja-catalogo"><Icon name="check_circle" size="s" />Catálogo listo · {products}</p>;
}

function EntryPrice({ entry }: { entry: PosEntry }) {
  return entry.soldByWeight
    ? <span className="precio">{formatMoney(pricePerKilo(entry))} <small>/kg</small></span>
    : <span className="precio">{formatMoney(entry.salePrice)}</span>;
}

const unitOf = (line: CartLine) => (line.entry.baseUnit === "millilitre" ? "ml" : "g");

/** «Granel · $14.800/kg» o «Paquete 500 g · $1.950»: el precio unitario va en la meta de la línea. */
function LineMeta({ line }: { line: CartLine }) {
  return (
    <>
      {line.entry.presentationName} · <span className="cifra">
        {line.weight !== undefined ? `${formatMoney(pricePerKilo(line.entry))}/${unitOf(line) === "ml" ? "l" : "kg"}` : formatMoney(line.entry.salePrice)}
      </span>
    </>
  );
}

/** − / cantidad / +. Lo pesado no se suma de a uno: muestra el peso leído. */
function LineQuantity({ line, onQuantity }: { line: CartLine; onQuantity: (lineId: string, quantity: number) => void }) {
  const name = line.entry.productName;
  if (line.weight !== undefined) {
    return (
      <div className="cantidad cantidad--fija" role="group" aria-label={`Cantidad de ${name}`}>
        <output>{line.weight} {unitOf(line)}</output>
      </div>
    );
  }
  return (
    <div className="cantidad" role="group" aria-label={`Cantidad de ${name}`}>
      <button type="button" aria-label="Restar" onClick={() => onQuantity(line.lineId, line.quantity - 1)}><Icon name="remove" /></button>
      <output>{line.quantity} u</output>
      <button type="button" aria-label="Sumar" onClick={() => onQuantity(line.lineId, line.quantity + 1)}><Icon name="add" /></button>
    </div>
  );
}

function Ticket({ lines, compact, itemText, onClear, onQuantity, onRemove }: {
  lines: CartLine[]; compact: boolean; itemText: string; onClear: () => void;
  onQuantity: (lineId: string, quantity: number) => void; onRemove: (lineId: string) => void;
}) {
  const head = (
    <>
      <h2 className="titulo-seccion">Ticket <span className="meta">· {itemText}</span></h2>
      <Button variant="fantasma" size="compacto" icon="delete_sweep" onClick={onClear} disabled={lines.length === 0}>Vaciar</Button>
    </>
  );
  const empty = <EmptyState title="Todavía no hay productos">Pasá un producto por el lector o buscalo por nombre.</EmptyState>;
  const remove = (line: CartLine) => (
    <Button variant="fantasma" size="icono" aria-label={`Quitar ${line.entry.productName} del ticket`} onClick={() => onRemove(line.lineId)}>
      <Icon name="close" />
    </Button>
  );

  if (compact) {
    return (
      <section className="pila pila--s pos-ticket" aria-label="Ticket">
        <div className="fila fila--entre">{head}</div>
        {lines.length === 0 ? empty : (
          <ul className="lista">
            {lines.map((line) => (
              <li key={line.lineId} className="ticket-linea">
                <div className="lista__principal">
                  <span className="lista__titulo">{line.entry.productName}</span>
                  <span className="lista__meta"><LineMeta line={line} /></span>
                </div>
                <span className="lista__valor">{formatMoney(lineTotal(line))}</span>
                <div className="fila fila--entre ticket-linea__acciones">
                  <LineQuantity line={line} onQuantity={onQuantity} />
                  {remove(line)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="carta carta--sin-relleno pos-ticket" aria-label="Ticket">
      <div className="carta__cabecera">{head}</div>
      {lines.length === 0 ? empty : (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr><th>Producto</th><th>Cantidad</th><th className="num">Subtotal</th><th className="acciones"><span className="sr">Quitar</span></th></tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId}>
                  <td>
                    <div className="celda">
                      <span className="celda__titulo">{line.entry.productName}</span>
                      <span className="suave"><LineMeta line={line} /></span>
                    </div>
                  </td>
                  <td><LineQuantity line={line} onQuantity={onQuantity} /></td>
                  <td className="num fuerte">{formatMoney(lineTotal(line))}</td>
                  <td className="acciones">{remove(line)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CustomerPicker({ selected, onSelect, saleTotal }: {
  selected: CustomerAccount | null; onSelect: (account: CustomerAccount | null) => void; saleTotal: number;
}) {
  const [accounts, setAccounts] = useState<CustomerAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    loadAccounts()
      .then((result) => setAccounts(result.accounts.filter((a) => a.active)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes."));
  }, []);

  if (selected) {
    const over = exceedsLimit(selected, saleTotal);
    return (
      <div className="fiado" role="status">
        <p className="campo__etiqueta">Cliente del fiado</p>
        <div className="fila fila--entre fiado__cliente">
          <span className="fila"><Icon name="person" className="apagada" /><strong className="fuerte">{selected.name}</strong></span>
          <Button variant="fantasma" size="compacto" onClick={() => onSelect(null)}>Cambiar cliente</Button>
        </div>
        <p className="par"><span>Saldo</span><span className="cifra">{formatMoney(selected.balance)}</span></p>
        {selected.credit_limit !== null && <p className="par"><span>Tope</span><span className="cifra">{formatMoney(selected.credit_limit)}</span></p>}
        {over && <Message tone="aviso">Con esta venta supera su tope de fiado. Confirmá con la dueña antes de cobrar.</Message>}
      </div>
    );
  }

  const matches = accounts ? filterAccounts(accounts, text).slice(0, 6) : [];
  return (
    <div className="fiado">
      <TextField label="Cliente del fiado" icon="search" placeholder="Nombre o teléfono" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <Message tone="error">{error}</Message>}
      {text && accounts && matches.length === 0 && <p className="meta">No aparece. Se da de alta en Clientes.</p>}
      {text && matches.length > 0 && (
        <ul className="resultados" aria-label="Clientes">
          {matches.map((account) => (
            <li key={account.id}>
              <button type="button" onClick={() => onSelect(account)}>
                <strong>{account.name}</strong>
                <span className={account.phone ? "cifra suave fiado__telefono" : "suave fiado__telefono"}>{account.phone ?? "Sin teléfono"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
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
      subtitle={<>{entry.presentationName} · <span className="cifra">{formatMoney(pricePerKilo(entry))}/{unit === "ml" ? "l" : "kg"}</span></>}
      footer={<>
        <Button variant="fantasma" onClick={onCancel}>Cancelar</Button>
        <Button icon="add" onClick={() => onConfirm(weight)} disabled={!valid}>
          Agregar{valid ? <span className="boton__cifra">{formatMoney(amount)}</span> : null}
        </Button>
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onConfirm(weight); }}>
        <TextField label="Peso leído en la balanza" icon="scale" suffix={unit} numeric inputMode="decimal" autoFocus value={value}
          onChange={(e) => setValue(e.target.value)} />
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
      const outcome = await closeShift(shift.ownerUserId ?? "");
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
    <Modal open title="Cierre de caja" onClose={result?.closed ? onClosed : onCancel}
      subtitle={<>{shift.registerName} · turno abierto a las <span className="cifra">{formatTime(shift.openedAt)}</span></>}
      footer={result?.closed
        ? <Button onClick={onClosed}>Listo</Button>
        : <>
            <Button variant="fantasma" onClick={onCancel}>Seguir vendiendo</Button>
            <Button icon="lock" onClick={() => void confirm()} loading={busy} disabled={!shown}>Cerrar turno</Button>
          </>}>
      {result?.closed && (
        <Message tone="exito">
          Turno cerrado.{result.backupError ? ` El respaldo no se pudo descargar: ${result.backupError}` : " Se descargó el respaldo del cierre."}
        </Message>
      )}
      {!shown ? <span className="esqueleto" aria-label="Calculando…" /> : (
        <div className="tabla-marco">
          <table className="tabla tabla--compacta">
            <thead><tr><th>Medio de pago</th><th className="num">Ventas</th><th className="num">Total</th></tr></thead>
            <tbody>
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                <tr key={m}><td>{PAYMENT_LABELS[m]}</td><td className="num">{shown.byMethod[m].count}</td><td className="num">{formatMoney(shown.byMethod[m].total)}</td></tr>
              ))}
              <tr className="fuerte"><td>Total</td><td className="num">{shown.salesCount}</td><td className="num">{formatMoney(shown.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {shown && (
        <p className="par">
          <span>Efectivo esperado en la caja <span className="meta">(incluye {formatMoney(shift.initialBalance)} inicial)</span></span>
          <span className="cifra">{formatMoney(shift.initialBalance + shown.byMethod.cash.total)}</span>
        </p>
      )}
      {result && !result.closed && <Message tone="error">{result.reason}</Message>}
    </Modal>
  );
}
