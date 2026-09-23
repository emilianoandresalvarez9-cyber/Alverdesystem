import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, EmptyState, GlassCard, TextField } from "../../shared/ui";

type Branch = { id: string; name: string; address: string | null; archived_at: string | null };
type Register = { id: string; branch_id: string; name: string; archived_at: string | null };

/**
 * Sucursales y cajas (RF-53, RF-55, RF-56). Sumar una caja nueva no requiere cambios de código:
 * se crea acá y el equipo la elige una vez desde /pos.html. Nada se borra: se archiva.
 */
export function BranchesManager() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [b, r] = await Promise.all([
      supabase.from("branches").select("id, name, address, archived_at").order("name"),
      supabase.from("registers").select("id, branch_id, name, archived_at").order("name")
    ]);
    if (b.error || r.error) setError((b.error ?? r.error)?.message ?? "No se pudo cargar.");
    else {
      setBranches((b.data ?? []) as Branch[]);
      setRegisters((r.data ?? []) as Register[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    const { error: err } = await action();
    if (err) setError(err.message);
    await load();
  }

  if (loading) return <p className="glass loading-card">Cargando sucursales…</p>;

  return (
    <div className="pos-setup" style={{ maxWidth: "none" }}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <NewBranchForm onCreate={(name, address) => run(() => getSupabase().from("branches").insert({ name, address: address || null }))} />

      {branches.length === 0 && (
        <EmptyState title="Todavía no hay sucursales">Creá la primera para poder agregarle cajas.</EmptyState>
      )}

      <div className="dashboard-grid">
        {branches.map((branch) => {
          const own = registers.filter((r) => r.branch_id === branch.id);
          return (
            <GlassCard key={branch.id} className="pos-panel">
              <div className="pos-shift" style={{ marginTop: 0 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{branch.name}</h3>
                  {branch.address && <p className="field-help" style={{ margin: 0 }}>{branch.address}</p>}
                </div>
                {branch.archived_at && <Badge tone="neutro">Archivada</Badge>}
              </div>
              <ul className="pos-lines" style={{ marginTop: "var(--esp-m)" }}>
                {own.length === 0 && <li className="field-help">Sin cajas.</li>}
                {own.map((register) => (
                  <li key={register.id} className="pos-line" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <span className={register.archived_at ? "field-help" : ""}>
                      {register.name}{register.archived_at ? " (archivada)" : ""}
                    </span>
                    {register.archived_at ? (
                      <Button variant="fantasma" onClick={() => void run(() => getSupabase().from("registers").update({ archived_at: null }).eq("id", register.id))}>Reactivar</Button>
                    ) : (
                      <Button variant="fantasma" onClick={() => void run(() => getSupabase().from("registers").update({ archived_at: new Date().toISOString() }).eq("id", register.id))}>Archivar</Button>
                    )}
                  </li>
                ))}
              </ul>
              {!branch.archived_at && (
                <NewRegisterForm onCreate={(name) => run(() => getSupabase().from("registers").insert({ branch_id: branch.id, name }))} />
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function NewBranchForm({ onCreate }: { onCreate: (name: string, address: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim(), address.trim());
    setName("");
    setAddress("");
  }
  return (
    <GlassCard className="pos-panel">
      <form className="pos-scan" onSubmit={submit}>
        <TextField label="Nueva sucursal" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Dirección (opcional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Button type="submit">Crear sucursal</Button>
      </form>
    </GlassCard>
  );
}

function NewRegisterForm({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim());
    setName("");
  }
  return (
    <form className="pos-scan" onSubmit={submit} style={{ marginTop: "var(--esp-m)" }}>
      <TextField label="Nueva caja" placeholder="Ej.: Caja 2" required value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" variant="secundario">Agregar caja</Button>
    </form>
  );
}
