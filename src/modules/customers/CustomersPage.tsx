import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, GlassCard, Modal, TextField } from "../../shared/ui";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { subscribeToQueueChanges } from "../../shared/offline/queue";
import { formatMoney } from "../pos/money";
import { createCustomer, loadAccounts, type AccountsResult } from "./api";
import { filterAccounts } from "./balance";
import { CustomerCreditModal } from "./CustomerCreditModal";
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

  return (
    <div className="pos-setup" style={{ maxWidth: "none" }}>
      <GlassCard className="pos-panel pos-scan">
        <TextField label="Buscar cliente" placeholder="Nombre o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={() => setCreating(true)}>Nuevo cliente</Button>
      </GlassCard>

      {error && <p className="form-error" role="alert">{error}</p>}
      {data?.fromCache && (
        <p className="field-help">Sin conexión: saldos de la última copia ({new Date(data.refreshedAt ?? "").toLocaleString("es-AR")}) más lo registrado en este equipo.</p>
      )}
      {data && visible.length === 0 && (
        <EmptyState title={search ? "Nadie coincide con la búsqueda" : "Todavía no hay clientes"}>
          {search ? "Probá con otra parte del nombre o el teléfono." : "Creá el primero con “Nuevo cliente”."}
        </EmptyState>
      )}

      <div className="dashboard-grid">
        {visible.map((account) => (
          <CustomerCard key={account.id} account={account} onOpen={() => setSelectedId(account.id)} />
        ))}
      </div>

      {selected && (
        <CustomerCreditModal account={selected} isAdmin={isAdmin} onClose={() => setSelectedId(null)} onChanged={refresh} />
      )}
      {creating && <NewCustomerDialog isAdmin={isAdmin} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
    </div>
  );
}

function CustomerCard({ account, onOpen }: { account: CustomerAccount; onOpen: () => void }) {
  const overLimit = account.credit_limit !== null && account.balance > account.credit_limit;
  return (
    <GlassCard className="pos-panel">
      <div className="pos-shift" style={{ marginTop: 0 }}>
        <div>
          <h3 style={{ margin: 0 }}>{account.name}</h3>
          <p className="field-help" style={{ margin: 0 }}>{account.phone ?? "Sin teléfono"}</p>
        </div>
        {!account.active ? <Badge tone="neutro">Archivado</Badge> : overLimit ? <Badge tone="aviso">Supera el tope</Badge> : null}
      </div>
      <p className="pos-total-label" style={{ marginTop: "var(--esp-m)" }}>Saldo</p>
      <p className="pos-amount" style={{ textAlign: "left", fontSize: "var(--texto-l)" }}>{formatMoney(account.balance)}</p>
      <Button variant="secundario" onClick={onOpen}>Ver cuenta</Button>
    </GlassCard>
  );
}

function NewCustomerDialog({ isAdmin, onClose, onCreated }: { isAdmin: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <Modal open title="Nuevo cliente" onClose={onClose}>
      <form onSubmit={submit} className="pos-setup">
        <TextField label="Nombre" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Teléfono (opcional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {isAdmin && <TextField label="Tope de fiado (opcional)" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" loading={busy}>Crear cliente</Button>
        <p className="field-help">Crear un cliente necesita conexión.</p>
      </form>
    </Modal>
  );
}
