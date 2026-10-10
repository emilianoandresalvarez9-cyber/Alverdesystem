import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, EmptyState, GlassCard, SelectField, TextField } from "../../shared/ui";

type Branch = { id: string; name: string; address: string | null; archived_at: string | null };
type Register = { id: string; branch_id: string; name: string; archived_at: string | null };
type Person = { id: string; display_name: string; role: "administrator" | "employee"; active: boolean; branch_id: string | null };

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

      <StaffBranches branches={branches.filter((b) => !b.archived_at)} />
    </div>
  );
}

/**
 * RF-67: la sucursal de cada usuario. El empleado trabaja fijo en la suya (RF-66);
 * sin asignar, trabaja en la sucursal principal (la más antigua).
 */
function StaffBranches({ branches }: { branches: Branch[] }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await getSupabase()
      .from("profiles").select("id, display_name, role, active, branch_id").order("display_name");
    if (err) return setError(err.message);
    setPeople((data ?? []) as Person[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function assign(person: Person, branchId: string) {
    setError(null);
    setSaved(null);
    const { error: err } = await getSupabase().from("profiles").update({ branch_id: branchId || null }).eq("id", person.id);
    if (err) return setError(err.message);
    const name = branches.find((b) => b.id === branchId)?.name ?? "la sucursal principal";
    setSaved(`${person.display_name} trabaja ahora en ${name}. Lo ve la próxima vez que abra una pantalla.`);
    await load();
  }

  const mainName = branches[0]?.name ?? "la principal";
  return (
    <GlassCard className="pos-panel">
      <h3 style={{ marginTop: 0 }}>Personal por sucursal (RF-67)</h3>
      <p className="field-help">
        Cada empleado trabaja solo en su sucursal: vende, ingresa y ajusta stock ahí. Sin asignar, trabaja en {mainName}.
        La administración puede elegir sucursal desde la barra lateral.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="notice" role="status">{saved}</p>}
      {people && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Persona</th><th>Rol</th><th>Sucursal</th></tr></thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} style={{ opacity: person.active ? 1 : 0.6 }}>
                  <td>{person.display_name}{person.active ? "" : " (inactivo)"}</td>
                  <td>{person.role === "administrator" ? "Administrador" : "Empleado"}</td>
                  <td>
                    <SelectField label="" aria-label={`Sucursal de ${person.display_name}`} value={person.branch_id ?? ""}
                      onChange={(e) => void assign(person, e.target.value)}>
                      <option value="">Sin asignar ({mainName})</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </SelectField>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
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
