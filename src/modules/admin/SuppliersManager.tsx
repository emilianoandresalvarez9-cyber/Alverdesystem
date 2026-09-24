import { useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Button, TextField, GlassCard, Badge, EmptyState } from "../../shared/ui";

export function SuppliersManager() {
  const [suppliers, setSuppliers] = useState<{id: string; name: string; contact?: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const sb = getSupabase();

  const loadSuppliers = async () => {
    setLoading(true);
    const { data, error } = await sb.from("suppliers").select("*").order("name");
    if (error) setError(error.message);
    else setSuppliers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    let err;
    if (editingId) {
      const { error } = await sb.from("suppliers").update({ name, contact }).eq("id", editingId);
      err = error;
    } else {
      const { error } = await sb.from("suppliers").insert({ name, contact });
      err = error;
    }

    if (err) {
      setError(err.message);
    } else {
      setName("");
      setContact("");
      setEditingId(null);
      await loadSuppliers();
    }
    setLoading(false);
  };

  const handleEdit = (sup: {id: string; name: string; contact?: string}) => {
    setName(sup.name);
    setContact(sup.contact || "");
    setEditingId(sup.id);
  };

  return (
    <GlassCard>
      <h2>Proveedores</h2>
      <p>Gestión de proveedores del negocio.</p>
      
      {error && <Badge tone="error" style={{ marginBottom: "1rem" }}>{error}</Badge>}

      <form onSubmit={handleSave} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", marginBottom: "2rem" }}>
        <TextField
          label="Nombre del Proveedor"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="Contacto (Tel, Email, etc.)"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <Button variant="primario" type="submit" disabled={loading || !name.trim()}>
          {editingId ? "Actualizar" : "Crear Proveedor"}
        </Button>
        {editingId && (
          <Button variant="fantasma" type="button" onClick={() => { setEditingId(null); setName(""); setContact(""); }}>
            Cancelar
          </Button>
        )}
      </form>

      {suppliers.length === 0 ? (
        <EmptyState title="No hay proveedores">Crea el primer proveedor.</EmptyState>
      ) : (
        <table style={{ width: "100%", textAlign: "left" }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(sup => (
              <tr key={sup.id}>
                <td>{sup.name}</td>
                <td>{sup.contact || "-"}</td>
                <td>
                  <Button variant="fantasma" onClick={() => handleEdit(sup)}>Editar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
}
