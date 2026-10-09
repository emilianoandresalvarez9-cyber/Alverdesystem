import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Database } from "../../shared/supabase/database.types";
import { Badge, Button, EmptyState, GlassCard, SelectField, TextField } from "../../shared/ui";
import { EMPTY_FILTERS, ENTITY_LABELS, entityLabel, fieldLabel, formatValue, toSearchArgs, type AuditFilters } from "./auditFormat";

type AuditRow = Database["public"]["Functions"]["audit_history_search"]["Returns"][number];
type Person = { id: string; display_name: string };

const DATE = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const LIMIT = 200;

/**
 * RF-60: historial de modificaciones, visible para Administrador, con búsqueda por
 * producto (o marca, rubro, cliente), filtro por persona, por tipo y por fecha.
 * Cada fila muestra qué cambió, quién, cuándo, y el valor anterior y el nuevo.
 */
export function AuditHistoryPage() {
  const sb = getSupabase();
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void sb.from("profiles").select("id, display_name").order("display_name")
      .then(({ data }) => setPeople(data ?? []));
  }, [sb]);

  const search = useCallback(async (current: AuditFilters) => {
    setError(null);
    const { data, error: err } = await sb.rpc("audit_history_search", toSearchArgs(current, LIMIT));
    if (err) return setError(err.message);
    setRows(data ?? []);
  }, [sb]);

  useEffect(() => { void search(applied); }, [search, applied]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setApplied(filters);
  }

  function clear() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  return (
    <div style={{ display: "grid", gap: "var(--esp-m)" }}>
      <GlassCard>
        <h2 style={{ margin: 0 }}>Historial de modificaciones</h2>
        <p className="field-help">Qué cambió, quién lo hizo, cuándo, y el valor anterior y el nuevo (RF-58, RF-60).</p>
        <form onSubmit={submit} style={{ display: "flex", gap: "var(--esp-s)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextField label="Producto, marca, rubro o cliente" placeholder="Buscar por nombre" value={filters.text}
            onChange={(e) => setFilters({ ...filters, text: e.target.value })} style={{ minWidth: "16rem" }} />
          <SelectField label="Persona" value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })}>
            <option value="">Todas</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </SelectField>
          <SelectField label="Tipo" value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <TextField label="Desde" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <TextField label="Hasta" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <Button type="submit" variant="secundario">Buscar</Button>
          <Button variant="fantasma" onClick={clear}>Limpiar</Button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </GlassCard>

      {rows && rows.length === 0 && <EmptyState title="No hay cambios con esos filtros" />}

      {rows && rows.length > 0 && (
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--esp-s)" }}>
            <Badge>{rows.length === LIMIT ? `Últimos ${LIMIT} · acotá con los filtros` : `${rows.length} cambio${rows.length === 1 ? "" : "s"}`}</Badge>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Campo</th><th>Antes</th><th>Después</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{DATE.format(new Date(r.occurred_at))}</td>
                    <td>{r.user_name}</td>
                    <td><span className="field-help">{entityLabel(r.entity)}</span><br />{r.entity_label ?? r.entity_id}</td>
                    <td>{fieldLabel(r.field)}</td>
                    <td style={{ color: "var(--color-tinta-apagada)" }}>{formatValue(r.field, r.old_value)}</td>
                    <td><strong>{formatValue(r.field, r.new_value)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
