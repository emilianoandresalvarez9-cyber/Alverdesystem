import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../shared/supabase/client";
import { Badge, Button, EmptyState, Message, Modal, SelectField, TextField, useCompact } from "../../shared/ui";
import { useCurrentProfile } from "../../shared/auth/AuthGate";
import { staffAccess } from "./staffAccess";

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

  if (loading) {
    return <div className="carta pila pila--s" aria-busy="true" aria-label="Cargando sucursales…"><span className="esqueleto" /><span className="esqueleto" /></div>;
  }

  const archive = (register: Register, archived: boolean) =>
    run(() => getSupabase().from("registers").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", register.id));

  return (
    <>
      {error && <Message tone="error">{error}</Message>}
      <NewBranchForm onCreate={(name, address) => run(() => getSupabase().from("branches").insert({ name, address: address || null }))} />

      {branches.length === 0 && (
        <EmptyState title="Todavía no hay sucursales" icon="storefront">Creá la primera para poder agregarle cajas.</EmptyState>
      )}

      {branches.length > 0 && (
        <div className="reja-2">
          {branches.map((branch) => {
            const own = registers.filter((r) => r.branch_id === branch.id);
            return (
              <section key={branch.id} className="carta carta--sin-relleno" aria-labelledby={`sucursal-${branch.id}`}>
                <div className="carta__cabecera">
                  <div className="pila pila--s sucursal__nombre">
                    <h3 className="titulo-seccion" id={`sucursal-${branch.id}`}>{branch.name}</h3>
                    {branch.address && <span className="meta">{branch.address}</span>}
                  </div>
                  {branch.archived_at && <Badge tone="neutro" icon="archive">Archivada</Badge>}
                </div>
                {own.length === 0 ? (
                  <p className="relleno cuerpo-s suave">Sin cajas.</p>
                ) : (
                  <ul className="lista lista--plana" aria-label={`Cajas de ${branch.name}`}>
                    {own.map((register) => (
                      <li key={register.id}>
                        <div className="lista__principal">
                          <span className={register.archived_at ? "lista__titulo apagada" : "lista__titulo"}>{register.name}</span>
                        </div>
                        {register.archived_at ? (
                          <>
                            <Badge tone="neutro">Archivada</Badge>
                            <Button variant="fantasma" size="compacto" icon="unarchive" onClick={() => void archive(register, false)}>Reactivar</Button>
                          </>
                        ) : (
                          <Button variant="fantasma" size="compacto" icon="archive" onClick={() => void archive(register, true)}>Archivar</Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!branch.archived_at && (
                  <div className="relleno sucursal__nueva-caja">
                    <NewRegisterForm branchName={branch.name}
                      onCreate={(name) => run(() => getSupabase().from("registers").insert({ branch_id: branch.id, name }))} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <StaffBranches branches={branches.filter((b) => !b.archived_at)} />
    </>
  );
}

/**
 * RF-67: la sucursal de cada usuario. El empleado trabaja fijo en la suya (RF-66);
 * sin asignar, trabaja en la sucursal principal (la más antigua).
 * RF-59: activar y dar de baja. Dar de baja corta el acceso en todos los equipos (#107); la base
 * no deja que alguien se dé de baja a sí mismo ni que quede el sistema sin administración activa.
 */
function StaffBranches({ branches }: { branches: Branch[] }) {
  const me = useCurrentProfile();
  const compact = useCompact();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function setActive(person: Person, active: boolean) {
    setError(null);
    setSaved(null);
    setBusy(true);
    const { error: err } = await getSupabase().from("profiles").update({ active }).eq("id", person.id);
    setBusy(false);
    setConfirming(null);
    if (err) return setError(err.message);
    setSaved(active ? `${person.display_name} ya puede entrar.` : `${person.display_name} quedó dado de baja: ya no puede entrar ni operar.`);
    await load();
  }

  const mainName = branches[0]?.name ?? "la principal";
  const roleLabel = (person: Person) => (person.role === "administrator" ? "Administrador" : "Empleado");
  const branchSelect = (person: Person) => (
    <SelectField hideLabel label={`Sucursal de ${person.display_name}`} value={person.branch_id ?? ""}
      onChange={(e) => void assign(person, e.target.value)}>
      <option value="">Sin asignar ({mainName})</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </SelectField>
  );
  const accessControl = (person: Person) => {
    const access = staffAccess(person, me.id, people ?? []);
    if (access.kind === "activate") {
      return (
        <Button variant="secundario" size="compacto" icon="check" disabled={busy}
          aria-label={`Activar a ${person.display_name}`} onClick={() => void setActive(person, true)}>
          Activar
        </Button>
      );
    }
    if (access.kind === "deactivate") {
      return (
        <Button variant="peligro" size="compacto" disabled={busy}
          aria-label={`Dar de baja a ${person.display_name}`} onClick={() => setConfirming(person)}>
          Dar de baja
        </Button>
      );
    }
    return <span className="meta">{access.reason}</span>;
  };
  return (
    <section className="carta carta--sin-relleno" aria-labelledby="personal-por-sucursal">
      <div className="relleno pila pila--s">
        <h3 className="titulo-seccion" id="personal-por-sucursal">Personal</h3>
        <p className="cuerpo-s suave">
          Cada empleado trabaja sólo en su sucursal: vende, ingresa y ajusta stock ahí. Sin asignar, trabaja en {mainName}.
          La administración puede elegir sucursal desde la barra lateral.
        </p>
        <p className="cuerpo-s suave">
          Las cuentas nuevas se crean en Supabase → Authentication → Users → Add user y aparecen acá. Para que alguien deje de
          entrar, dalo de baja: lo que registró queda.
        </p>
        {error && <Message tone="error">{error}</Message>}
        {saved && <Message tone="exito">{saved}</Message>}
      </div>
      {!people ? (
        <div className="relleno pila pila--s" aria-busy="true"><span className="esqueleto" /><span className="esqueleto" /></div>
      ) : people.length === 0 ? (
        <EmptyState title="Todavía no hay usuarios" icon="group" />
      ) : compact ? (
        <ul className="lista lista--plana personal">
          {people.map((person) => (
            <li key={person.id}>
              <div className="lista__principal pila pila--s">
                <span className={`lista__titulo${person.active ? "" : " apagada"}`}>
                  {person.display_name}{person.active ? null : <> <Badge tone="neutro">Inactivo</Badge></>}
                </span>
                <span className="lista__meta">{roleLabel(person)}</span>
                {branchSelect(person)}
                {accessControl(person)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tabla-marco">
          <table className="tabla tabla--compacta">
            <thead><tr><th>Persona</th><th>Rol</th><th>Sucursal</th><th>Acceso</th></tr></thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td className={person.active ? "fuerte" : "apagada"}>
                    {person.display_name}{person.active ? null : <> <Badge tone="neutro">Inactivo</Badge></>}
                  </td>
                  <td>{roleLabel(person)}</td>
                  <td className="personal__sucursal">{branchSelect(person)}</td>
                  <td className="personal__acceso">{accessControl(person)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirming && (
        <DeactivateDialog name={confirming.display_name} busy={busy}
          onCancel={() => setConfirming(null)} onConfirm={() => void setActive(confirming, false)} />
      )}
    </section>
  );
}

/** RF-59: la baja pide confirmación y dice qué pasa con lo que la persona ya registró. */
export function DeactivateDialog({ name, busy, onCancel, onConfirm }: {
  name: string; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal open title={`¿Dar de baja a ${name}?`} onClose={onCancel}
      footer={<>
        <Button variant="fantasma" onClick={onCancel}>Cancelar</Button>
        <Button variant="peligro" confirmar loading={busy} onClick={onConfirm}>Dar de baja</Button>
      </>}>
      <div className="pila pila--s">
        <p className="cuerpo-s">
          Deja de poder entrar y de ver o registrar datos en todos los equipos, también donde tenga la sesión abierta.
          Lo que ya registró (ventas, movimientos, fiado) queda, y se puede volver a activar.
        </p>
        <p className="meta">
          Si tiene ventas sin enviar en un equipo sin conexión, quedan guardadas en ese equipo hasta que la actives un momento.
        </p>
      </div>
    </Modal>
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
    <form className="carta pila" onSubmit={submit} aria-labelledby="sucursal-nueva">
      <h3 className="titulo-seccion" id="sucursal-nueva">Nueva sucursal</h3>
      <div className="form-fila">
        <TextField label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Dirección (opcional)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Button type="submit" icon="add" disabled={!name.trim()}>Crear sucursal</Button>
      </div>
    </form>
  );
}

function NewRegisterForm({ branchName, onCreate }: { branchName: string; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim());
    setName("");
  }
  return (
    <form className="form-fila" onSubmit={submit} aria-label={`Nueva caja en ${branchName}`}>
      <TextField label="Nueva caja" placeholder="Ej.: Caja 2" required value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" variant="secundario" icon="add" disabled={!name.trim()}>Agregar caja</Button>
    </form>
  );
}
