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
import { ActionsMenu, Badge, Button, EmptyState, Message, Modal, SelectField, TextField } from "../../shared/ui";
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
  /** Unir con…: primero se elige el destino, después se confirma con los dos nombres (no se deshace). */
  const [mergeStep, setMergeStep] = useState<"choose" | "confirm">("choose");
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
  const merging = items.find(i => i.id === mergingId) ?? null;
  const mergeInto = items.find(i => i.id === mergeTarget) ?? null;
  const closeMerge = () => { setMergingId(null); setMergeTarget(""); setMergeStep("choose"); };

  return (
    <>
      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="exito">{notice}</Message>}

      <section className="carta pila" aria-labelledby="clasificador-nuevo">
        <h3 className="titulo-seccion" id="clasificador-nuevo">Agregar nuevo</h3>
        <div className="form-fila">
          <TextField
            label="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder={type === "brand" ? "Ej. Arcor" : type === "category" ? "Ej. Lácteos" : "Ej. Vegano"}
          />
          {type === "category" && (
            <SelectField label="Rubro padre (opcional)" value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
              <option value="">Ninguno (rubro principal)</option>
              {topLevelItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </SelectField>
          )}
          <Button icon="add" onClick={handleCreate} disabled={!newName.trim()}>Crear</Button>
        </div>
      </section>

      {loading ? (
        <div className="carta pila pila--s" aria-busy="true"><span className="esqueleto" /><span className="esqueleto" /></div>
      ) : items.length === 0 ? (
        <EmptyState title={`Sin ${title.toLowerCase()} activos`} icon="label">Usá el formulario de arriba para crear el primero.</EmptyState>
      ) : (
        <section className="carta carta--sin-relleno" aria-label={`${title} activos`}>
          <ul className="lista lista--plana clasificadores">
            {items.map(item => (
              <li key={item.id}>
                <div className="lista__principal">
                  {editingId === item.id ? (
                    <div className="fila">
                      <TextField
                        className="crece"
                        label={`Nuevo nombre para ${item.name}`}
                        hideLabel
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(item.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <Button size="compacto" onClick={() => saveEdit(item.id)}>Guardar</Button>
                      <Button variant="fantasma" size="compacto" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <span className="lista__titulo">
                      {item.name}
                      {type === "category" && item.parent_id && (
                        <> <Badge tone="neutro">{items.find(i => i.id === item.parent_id)?.name ?? "sub-rubro"}</Badge></>
                      )}
                    </span>
                  )}
                  {assigningId === item.id && (
                    <div className="clasificadores__asignar">
                      <BulkAssignPanel kind={type} id={item.id} name={item.name}
                        onDone={(message) => { setNotice(message); setAssigningId(null); }} />
                    </div>
                  )}
                </div>
                {editingId !== item.id && (
                  <div className="fila clasificadores__acciones">
                    <Button variant="secundario" size="compacto" icon="label"
                      onClick={() => { setAssigningId(assigningId === item.id ? null : item.id); setMergingId(null); }}>
                      {assigningId === item.id ? "Cerrar" : "Asignar a productos"}
                    </Button>
                    <ActionsMenu label={`Más acciones para ${item.name}`} actions={[
                      { label: "Renombrar", icon: "edit", onSelect: () => { setEditingId(item.id); setEditName(item.name); } },
                      { label: "Unir con…", icon: "merge", onSelect: () => { setMergingId(item.id); setMergeTarget(""); setMergeStep("choose"); setAssigningId(null); },
                        disabled: items.length < 2, reason: items.length < 2 ? "Hace falta otro elemento para unir." : undefined },
                      { label: "Archivar", icon: "archive", onSelect: () => void handleArchive(item.id) }
                    ]} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {merging && mergeStep === "choose" && (
        <Modal open title={`Unir «${merging.name}» con…`} onClose={closeMerge}
          footer={<>
            <Button variant="fantasma" onClick={closeMerge}>Cancelar</Button>
            <Button icon="merge" disabled={!mergeTarget} onClick={() => setMergeStep("confirm")}>Unir</Button>
          </>}>
          <SelectField label={`Unir "${merging.name}" con`} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
            <option value="">Elegí el destino…</option>
            {items.filter(i => i.id !== merging.id).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </SelectField>
          <p className="meta">Los productos de «{merging.name}» pasan al destino y «{merging.name}» queda archivada (no se borra).</p>
        </Modal>
      )}
      {merging && mergeInto && mergeStep === "confirm" && (
        <MergeConfirm from={merging.name} into={mergeInto.name} busy={mergeBusy}
          onCancel={closeMerge} onConfirm={() => void confirmMerge(merging.id).then(() => setMergeStep("choose"))} />
      )}
    </>
  );
}

/** Confirmación de Unir con…: los dos nombres en el título y la consecuencia escrita (RF-03, RF-56). */
export function MergeConfirm({ from, into, busy, onCancel, onConfirm }: {
  from: string; into: string; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal open title={`¿Unir «${from}» con «${into}»?`} onClose={onCancel}
      footer={<>
        <Button variant="fantasma" onClick={onCancel}>Cancelar</Button>
        <Button variant="peligro" confirmar loading={busy} onClick={onConfirm}>Unir</Button>
      </>}>
      <Message tone="error">No se puede deshacer: los productos pasan a «{into}» y «{from}» queda archivada.</Message>
    </Modal>
  );
}
