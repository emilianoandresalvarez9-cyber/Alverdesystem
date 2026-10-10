import { ALL_BRANCHES } from "./branch";
import { useBranch } from "./BranchContext";

/**
 * RF-66: selector de sucursal en la barra lateral. La administradora elige (o "Todas"
 * para consultar); el empleado ve en cuál trabaja, sin poder cambiarla.
 */
export function BranchSelector() {
  const { branches, selection, canChoose, label, setSelection } = useBranch();
  if (branches.length === 0 && !selection) return null;

  if (!canChoose) {
    return (
      <p className="branch-current" title="Sucursal en la que trabajás">
        <span className="branch-label">Sucursal</span>
        <strong>{label}</strong>
      </p>
    );
  }

  const value = selection?.kind === "all" ? ALL_BRANCHES : selection?.id ?? "";
  return (
    <label className="branch-select">
      <span className="branch-label">Sucursal</span>
      <select
        value={value}
        onChange={(e) => setSelection(e.target.value === ALL_BRANCHES ? { kind: "all" } : { kind: "branch", id: e.target.value })}
        aria-label="Sucursal en la que trabajás"
      >
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value={ALL_BRANCHES}>Todas las sucursales (consulta)</option>
      </select>
    </label>
  );
}
