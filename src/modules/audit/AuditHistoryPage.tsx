import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import type { Database } from "../../shared/supabase/database.types";
import { Button, EmptyState, Icon, Message, SelectField, TextField, useCompact } from "../../shared/ui";
import { formatDay, formatDayTime } from "../../shared/format/date";
import { EMPTY_FILTERS, ENTITY_LABELS, entityLabel, fieldLabel, formatValue, toSearchArgs, type AuditFilters } from "./auditFormat";

type AuditRow = Database["public"]["Functions"]["audit_history_search"]["Returns"][number];
type Person = { id: string; display_name: string };

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
  const compact = useCompact();

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

  const count = rows
    ? rows.length === LIMIT ? `Últimos ${LIMIT} cambios · acotá con los filtros` : `${rows.length} cambio${rows.length === 1 ? "" : "s"}`
    : "";

  return (
    <>
      <form className="carta pila" onSubmit={submit} aria-label="Filtros del historial">
        <p className="cuerpo-s suave">Qué cambió, quién lo hizo, cuándo, y el valor anterior y el nuevo.</p>
        <TextField label="Buscar" icon="search" type="search" placeholder="Producto, marca, rubro o cliente" value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })} />
        <div className="form-fila">
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
        </div>
        <div className="fila">
          <Button type="submit" variant="secundario" icon="search">Buscar</Button>
          <Button variant="fantasma" onClick={clear}>Limpiar</Button>
        </div>
        {error && <Message tone="error">{error}</Message>}
      </form>

      {!rows && !error && <div className="carta pila pila--s" aria-busy="true" aria-label="Cargando historial…"><span className="esqueleto" /><span className="esqueleto" /></div>}

      {rows && rows.length === 0 && <EmptyState title="No hay cambios con esos filtros" icon="history" />}

      {rows && rows.length > 0 && (compact ? (
        <section className="pila pila--s" aria-label="Cambios">
          <span className="meta">{count}</span>
          <ul className="lista">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="lista__principal">
                  <span className="lista__titulo">{r.entity_label ?? r.entity_id}</span>
                  <span className="lista__meta">{entityLabel(r.entity)} · {fieldLabel(r.field)}</span>
                  <Change field={r.field} before={r.old_value} after={r.new_value} />
                  <span className="meta" title={formatDay(r.occurred_at)}>{formatDayTime(r.occurred_at)} · {r.user_name}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="carta carta--sin-relleno" aria-label="Cambios">
          <div className="carta__cabecera"><span className="meta">{count}</span></div>
          <div className="tabla-marco">
            <table className="tabla tabla--compacta">
              <thead>
                <tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Campo</th><th>Anterior → nuevo</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="cifra" title={formatDay(r.occurred_at)}>{formatDayTime(r.occurred_at)}</td>
                    <td className="nowrap">{r.user_name}</td>
                    <td><span className="pila auditoria__que"><span className="meta">{entityLabel(r.entity)}</span><span className="fuerte">{r.entity_label ?? r.entity_id}</span></span></td>
                    <td>{fieldLabel(r.field)}</td>
                    <td><Change field={r.field} before={r.old_value} after={r.new_value} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

/** Valor anterior → nuevo: el anterior apagado, el nuevo en negrita. */
function Change({ field, before, after }: { field: string; before: AuditRow["old_value"]; after: AuditRow["new_value"] }) {
  return (
    <span className="auditoria__cambio">
      <span className="apagada">{formatValue(field, before)}</span>
      <Icon name="arrow_forward" size="s" /><span className="sr">pasó a</span>
      <span className="fuerte">{formatValue(field, after)}</span>
    </span>
  );
}
