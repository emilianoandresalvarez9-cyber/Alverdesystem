/**
 * Subpestañas dentro de una sección (`.pestanas`): Marcas / Rubros / Etiquetas, Planilla /
 * Probar lector / Generación… La elegida va subrayada con el acento y en negrita, no sólo color.
 */
export function SubTabs<T extends string>({ label, tabs, value, onChange }: {
  label: string;
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="pestanas" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} onClick={() => onChange(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
