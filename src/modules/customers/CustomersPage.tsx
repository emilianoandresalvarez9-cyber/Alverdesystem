import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Badge, Button, EmptyState, Icon, Message, Modal, TextField, useCompact } from "../../shared/ui";
import { useOnline } from "../../shared/offline/useOnline";
import "../../styles/customers.css";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { subscribeToQueueChanges } from "../../shared/offline/queue";
import { formatMoney } from "../pos/money";
import { createCustomer, loadAccounts, type AccountsResult } from "./api";
import { filterAccounts } from "./balance";
import { CustomerCreditModal } from "./CustomerCreditModal";
import { exportToExcel } from "../../shared/export/excel";
import type { CustomerAccount } from "./types";

export function CustomersPage() {
  const profile = useCurrentProfile();
  const isAdmin = profile.role === "administrator";
  const [data, setData] = useState<AccountsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    loadAccounts()
      .then((result) => { setData(result); setError(null); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "No se pudieron cargar los clientes."));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToQueueChanges(refresh);
  }, [refresh]);

  const visible = data ? filterAccounts(data.accounts.filter((a) => a.active || isAdmin), search) : [];
  const selected = data?.accounts.find((a) => a.id === selectedId) ?? null;

  const compact = useCompact();
  const exportCustomers = () => exportToExcel(["Nombre", "Telefono", "Saldo", "Activo"], visible.map(c => [c.name, c.phone || "", c.balance.toFixed(2), c.active ? "Si" : "No"]), "clientes");

  return (
    <>
      <div className="fila fila--m clientes-barra">
        <TextField className="crece" type="search" label="Buscar cliente" hideLabel icon="search" placeholder="Nombre o teléfono"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {compact
          ? <Button variant="fantasma" size="icono" aria-label="Exportar clientes a Excel" onClick={exportCustomers}><Icon name="download" /></Button>
          : <Button variant="fantasma" icon="download" onClick={exportCustomers}>Exportar</Button>}
        <Button icon="add" onClick={() => setCreating(true)}>{compact ? "Nuevo" : "Nuevo cliente"}</Button>
      </div>

      {error && <Message tone="error">{error}</Message>}
      {data?.fromCache && (
        <Message tone="aviso">Sin conexión: saldos de la última copia ({new Date(data.refreshedAt ?? "").toLocaleString("es-AR")}) más lo registrado en este equipo.</Message>
      )}
      {data && visible.length === 0 && (
        <EmptyState title={search ? "Nadie coincide con la búsqueda" : "Todavía no hay clientes"} icon={search ? "search" : "group"}>
          {search ? "Probá con otra parte del nombre o el teléfono." : "Creá el primero con «Nuevo cliente»."}
        </EmptyState>
      )}

      {visible.length > 0 && (
        <div className="clientes">
          {visible.map((account) => (
            <CustomerCard key={account.id} account={account} onOpen={() => setSelectedId(account.id)} />
          ))}
        </div>
      )}

      {selected && (
        <CustomerCreditModal account={selected} isAdmin={isAdmin} onClose={() => setSelectedId(null)} onChanged={refresh} />
      )}
      {creating && <NewCustomerDialog isAdmin={isAdmin} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
    </>
  );
}

function CustomerCard({ account, onOpen }: { account: CustomerAccount; onOpen: () => void }) {
  const overLimit = account.credit_limit !== null && account.balance > account.credit_limit;
  return (
    <article className="carta cliente">
      <div className="fila fila--entre cliente__cabeza">
        <div className="pila cliente__datos">
          <h2 className="titulo-seccion">{account.name}</h2>
          <p className="cuerpo-s suave fila cliente__telefono">
            <Icon name="call" size="s" />
            {account.phone ? <span className="cifra">{account.phone}</span> : "Sin teléfono"}
          </p>
        </div>
        {!account.active ? <Badge tone="neutro" icon="archive">Archivado</Badge> : overLimit ? <Badge tone="error">Supera el tope</Badge> : null}
      </div>
      <div className="fila fila--entre">
        <div className="pila cliente__datos">
          <span className="meta">Saldo</span>
          <span className="cliente__saldo">{formatMoney(account.balance)}</span>
        </div>
        <Button variant="secundario" size="compacto" onClick={onOpen} aria-label={`Ver cuenta de ${account.name}`}>Ver cuenta</Button>
      </div>
    </article>
  );
}

function NewCustomerDialog({ isAdmin, onClose, onCreated }: { isAdmin: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const online = useOnline();
  const formId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createCustomer({ name, phone, creditLimit: isAdmin && limit.trim() ? Number(limit.replace(",", ".")) : null });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Nuevo cliente" onClose={onClose}
      footer={<>
        <Button variant="fantasma" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form={formId} icon="add" loading={busy} disabled={!online}>Crear cliente</Button>
      </>}>
      <form id={formId} onSubmit={submit} className="pila">
        <TextField label="Nombre" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Teléfono (opcional)" icon="call" inputMode="tel" placeholder="11 1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {isAdmin && (
          <TextField label="Tope de fiado (opcional)" inputMode="decimal" numeric value={limit} onChange={(e) => setLimit(e.target.value)}
            help="Sólo lo ve y lo carga administración." />
        )}
        {error && <Message tone="error">{error}</Message>}
        {!online && <Message tone="aviso">Para crear un cliente necesitás conexión.</Message>}
      </form>
    </Modal>
  );
}
