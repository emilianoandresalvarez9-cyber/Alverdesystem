import { useId } from "react";
import { ALL_BRANCHES } from "./branch";
import { useBranch } from "./BranchContext";
import { Icon } from "../ui/Icon";

/**
 * RF-66: selector de sucursal en la barra lateral (y en el menú de la cabecera en celular).
 * La administradora elige (o "Todas" para consultar); el empleado ve en cuál trabaja,
 * como texto, sin poder cambiarla.
 */
export function BranchSelector() {
  const { branches, selection, canChoose, label, setSelection } = useBranch();
  const selectId = useId();
  if (branches.length === 0 && !selection) return null;

  if (!canChoose) {
    return (
      <p className="sucursal-fija" title="Sucursal en la que trabajás">
        <Icon name="storefront" />
        <span className="sr">Sucursal: </span>
        {label}
      </p>
    );
  }

  const value = selection?.kind === "all" ? ALL_BRANCHES : selection?.id ?? "";
  return (
    <div className="selector">
      <label className="selector__prefijo" htmlFor={selectId}>
        <Icon name="storefront" />
        <span className="sr">Sucursal</span>
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => setSelection(e.target.value === ALL_BRANCHES ? { kind: "all" } : { kind: "branch", id: e.target.value })}
        aria-label="Sucursal en la que trabajás"
      >
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value={ALL_BRANCHES}>Todas las sucursales (consulta)</option>
      </select>
      <Icon name="keyboard_arrow_down" />
    </div>
  );
}
