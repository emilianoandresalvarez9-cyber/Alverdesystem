// src/modules/admin/ClassifierManager.tsx
// RF-03: crear, renombrar y archivar marcas, rubros y etiquetas
//
// Corregido respecto al codigo de Gemini:
// - SelectField usa children (<option>) NO prop options
// - Badge usa children NO prop label
// - EmptyState usa title + children NO prop message
// - Button variants en español: primario/secundario/fantasma/peligro
// - useCallback en fetchItems para evitar loop infinito de renders

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, TextField, SelectField, GlassCard, Badge, EmptyState } from "../../shared/ui";
import { BulkAssignPanel } from "./BulkAssignPanel";

type ClassifierType = "brand" | "category" | "label";

interface ClassifierItem {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface ClassifierManagerProps {
  type: ClassifierType;
}

const TABLE_MAP = {
  brand: "brands",
  category: "categories",
  label: "labels",
} as const satisfies Record<ClassifierType, "brands" | "categories" | "labels">;

/**
 * Las tres tablas comparten id, name y archived_at; categories agrega parent_id, que solo se envía
 * para rubros. Se tipa como "categories" porque es la forma más completa de las tres.
 */
function classifierTable(table: (typeof TABLE_MAP)[ClassifierType]) {
  return getSupabase().from(table as "categories");
}

const TITLE_MAP: Record<ClassifierType, string> = {
  brand: "Marcas",
  category: "Rubros",
  label: "Etiquetas",
};

export function ClassifierManager({ type }: ClassifierManagerProps) {
  const [items, setItems] = useState<ClassifierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tableName = TABLE_MAP[type];
  const title = TITLE_MAP[type];

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await classifierTable(tableName)
        .select("*")
        .is("archived_at", null)
        .order("name");
      if (err) throw err;
      setItems((data ?? []) as ClassifierItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      const payload: { name: string; parent_id?: string } = { name: newName.trim() };
      if (type === "category" && newParentId) payload.parent_id = newParentId;
      const { error: err } = await classifierTable(tableName).insert(payload);
      if (err) throw err;
      setNewName(""); setNewParentId("");
      await fetchItems();
    } catch (e) {
      setError(e instanceof Error ? `Error al crear: ${e.message}` : "Error al crear");
    }
  };

  const handleArchive = async (id: string) => {
    setError(null);
    try {
      const { error: err } = await classifierTable(tableName).update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (err) throw err;
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? `Error al archivar: ${e.message}` : "Error al archivar");
    }
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    setError(null);
    try {
      const { error: err } = await classifierTable(tableName).update({ name: editName.trim() }).eq("id", id);
      if (err) throw err;
      setEditingId(null);
      await fetchItems();
    } catch (e) {
      setError(e instanceof Error ? `Error al renombrar: ${e.message}` : "Error al renombrar");
    }
  };

  /** RF-03: unir dos elementos. Los productos pasan al destino y el origen queda archivado (RF-56). */
  const confirmMerge = async (fromId: string) => {
    if (!mergeTarget || mergeTarget === fromId) return;
    const from = items.find(i => i.id === fromId)?.name ?? "";
    const into = items.find(i => i.id === mergeTarget)?.name ?? "";
    if (!window.confirm(`¿Unir "${from}" con "${into}"? Los productos pasan a "${into}" y "${from}" queda archivada.`)) return;
    setMergeBusy(true);
    setError(null);
    try {
      const { data, error: err } = await getSupabase().rpc("merge_classifier", { p_kind: type, p_from_id: fromId, p_into_id: mergeTarget });
      if (err) throw err;
      setNotice(`Listo: ${data ?? 0} producto${data === 1 ? "" : "s"} pasaron a "${into}". "${from}" quedó archivada.`);
      setMergingId(null);
      setMergeTarget("");
      await fetchItems();
    } catch (e) {
      setError(e instanceof Error ? `Error al unir: ${e.message}` : "Error al unir");
    } finally {
      setMergeBusy(false);
    }
  };

  const topLevelItems = items.filter(i => !i.parent_id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-m)" }}>
      <h2 style={{ margin: 0 }}>Gestionar {title}</h2>

      {error && <p role="alert" style={{ color: "var(--color-error)", margin: 0 }}>{error}</p>}
      {notice && <p role="status" className="notice" style={{ margin: 0 }}>{notice}</p>}

      <GlassCard>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-s)" }}>
          <h3 style={{ margin: 0 }}>Agregar nuevo</h3>
          <div style={{ display: "flex", gap: "var(--esp-s)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <TextField
              label="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder={type === "brand" ? "Ej. Arcor" : type === "category" ? "Ej. Lácteos" : "Ej. Vegano"}
            />
            {type === "category" && (
              <SelectField
                label="Rubro padre (opcional)"
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
              >
                <option value="">Ninguno (rubro principal)</option>
                {topLevelItems.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </SelectField>
            )}
            <Button variant="primario" onClick={handleCreate} disabled={!newName.trim()}>
              Crear
            </Button>
          </div>
        </div>
      </GlassCard>

      {loading ? (
        <GlassCard className="skeleton" style={{ minHeight: 80 }} />
      ) : items.length === 0 ? (
        <EmptyState title={`Sin ${title.toLowerCase()} activos`}>
          Usá el formulario de arriba para crear el primero.
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--esp-xs)" }}>
          {items.map(item => (
            <GlassCard
              key={item.id} padding="compact"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--esp-s)", flexWrap: "wrap" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--esp-s)", flex: 1 }}>
                {editingId === item.id ? (
                  <TextField
                    label=""
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(item.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span style={{ fontWeight: 700 }}>{item.name}</span>
                )}
                {type === "category" && item.parent_id && (
                  <Badge tone="neutro">
                    {items.find(i => i.id === item.parent_id)?.name ?? "sub-rubro"}
                  </Badge>
                )}
              </div>
              <div style={{ display: "flex", gap: "var(--esp-xs)", flexShrink: 0 }}>
                {editingId === item.id ? (
                  <>
                    <Button variant="primario" onClick={() => saveEdit(item.id)}>Guardar</Button>
                    <Button variant="fantasma" onClick={() => setEditingId(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <Button variant="secundario" onClick={() => { setEditingId(item.id); setEditName(item.name); }}>Renombrar</Button>
                    <Button variant="secundario" onClick={() => { setAssigningId(assigningId === item.id ? null : item.id); setMergingId(null); }}>
                      Asignar a productos
                    </Button>
                    <Button variant="secundario" onClick={() => { setMergingId(mergingId === item.id ? null : item.id); setMergeTarget(""); setAssigningId(null); }}
                      disabled={items.length < 2}>
                      Unir con…
                    </Button>
                    <Button variant="peligro" onClick={() => handleArchive(item.id)}>Archivar</Button>
                  </>
                )}
              </div>
              {mergingId === item.id && (
                <div style={{ flexBasis: "100%", display: "flex", gap: "var(--esp-s)", alignItems: "flex-end", flexWrap: "wrap", paddingTop: "var(--esp-s)", borderTop: "1px solid var(--color-linea)" }}>
                  <SelectField label={`Unir "${item.name}" con`} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                    <option value="">Elegí el destino…</option>
                    {items.filter(i => i.id !== item.id).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </SelectField>
                  <Button variant="primario" onClick={() => void confirmMerge(item.id)} disabled={!mergeTarget} loading={mergeBusy}>Unir</Button>
                  <Button variant="fantasma" onClick={() => setMergingId(null)}>Cancelar</Button>
                  <p className="field-help" style={{ flexBasis: "100%", margin: 0 }}>
                    Los productos de "{item.name}" pasan al destino y "{item.name}" queda archivada (no se borra: RF-56).
                  </p>
                </div>
              )}
              {assigningId === item.id && (
                <div style={{ flexBasis: "100%", paddingTop: "var(--esp-s)", borderTop: "1px solid var(--color-linea)" }}>
                  <BulkAssignPanel kind={type} id={item.id} name={item.name}
                    onDone={(message) => { setNotice(message); setAssigningId(null); }} />
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
