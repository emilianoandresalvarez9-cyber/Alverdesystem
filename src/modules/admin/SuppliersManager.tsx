import { type FormEvent, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, TextField, EmptyState, Message, useCompact } from "../../shared/ui";

type Supplier = { id: string; name: string; contact: string | null };

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const compact = useCompact();

  const sb = getSupabase();

  const loadSuppliers = async () => {
    const { data, error } = await sb.from("suppliers").select("*").order("name");
    if (error) setError(error.message);
    else setSuppliers(data || []);
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const reset = () => {
    setName("");
    setContact("");
    setEditingId(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");
    setSaved("");
    const payload = { name: name.trim(), contact: contact.trim() || null };
    const { error: err } = editingId
      ? await sb.from("suppliers").update(payload).eq("id", editingId)
      : await sb.from("suppliers").insert(payload);

    if (err) {
      setError(err.message);
    } else {
      setSaved(editingId ? `Se guardaron los cambios de ${payload.name}.` : `${payload.name} quedó en la lista de proveedores.`);
      reset();
      await loadSuppliers();
    }
    setLoading(false);
  };

  const handleEdit = (sup: Supplier) => {
    setSaved("");
    setName(sup.name);
    setContact(sup.contact || "");
    setEditingId(sup.id);
  };

  const edit = (sup: Supplier) => (
    <Button variant="fantasma" size="compacto" icon="edit" aria-label={`Editar ${sup.name}`} onClick={() => handleEdit(sup)}>Editar</Button>
  );

  return (
    <>
      <form className="carta pila" onSubmit={handleSave} aria-labelledby="proveedor-form">
        <h3 className="titulo-seccion" id="proveedor-form">{editingId ? "Editar proveedor" : "Nuevo proveedor"}</h3>
        <div className="form-fila">
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Contacto (opcional)" placeholder="Teléfono o correo" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="fila">
          <Button type="submit" icon={editingId ? "check" : "add"} loading={loading} disabled={!name.trim()}>
            {editingId ? "Guardar cambios" : "Crear proveedor"}
          </Button>
          {editingId && <Button variant="fantasma" onClick={reset}>Cancelar</Button>}
        </div>
        {error && <Message tone="error">{error}</Message>}
        {saved && <Message tone="exito">{saved}</Message>}
      </form>

      {!suppliers ? (
        <div className="carta pila pila--s" aria-busy="true" aria-label="Cargando proveedores…"><span className="esqueleto" /><span className="esqueleto" /></div>
      ) : suppliers.length === 0 ? (
        <EmptyState title="Todavía no hay proveedores" icon="local_shipping">Creá el primero con el formulario de arriba.</EmptyState>
      ) : compact ? (
        <ul className="lista" aria-label="Proveedores">
          {suppliers.map((sup) => (
            <li key={sup.id} aria-selected={sup.id === editingId || undefined}>
              <div className="lista__principal">
                <span className="lista__titulo">{sup.name}</span>
                <span className="lista__meta">{sup.contact || "Sin contacto"}</span>
              </div>
              {edit(sup)}
            </li>
          ))}
        </ul>
      ) : (
        <section className="carta carta--sin-relleno" aria-label="Proveedores">
          <div className="tabla-marco">
            <table className="tabla tabla--compacta">
              <thead><tr><th>Nombre</th><th>Contacto</th><th className="acciones"><span className="sr">Acciones</span></th></tr></thead>
              <tbody>
                {suppliers.map((sup) => (
                  <tr key={sup.id} aria-selected={sup.id === editingId || undefined}>
                    <td className="fuerte">{sup.name}</td>
                    <td className={sup.contact ? undefined : "apagada"}>{sup.contact || "—"}</td>
                    <td className="acciones">{edit(sup)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
