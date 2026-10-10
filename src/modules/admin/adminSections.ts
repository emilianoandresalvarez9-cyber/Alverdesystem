import type { IconName } from "../../shared/ui";

/**
 * Administración en cinco grupos y catorce secciones (decisión del sistema de diseño):
 * las 13 pestañas de antes más Márgenes (RF-26), que existía pero no tenía cómo abrirse.
 * El id va en el hash de la URL (`/admin.html#margenes`): se puede enlazar y volver atrás.
 */
export type AdminSectionId =
  | "reportes" | "margenes"
  | "lotes" | "fraccionamiento" | "faltantes" | "proveedores"
  | "productos" | "precios" | "clasificadores" | "balanza"
  | "sucursales" | "trazabilidad"
  | "codigos" | "configuracion";

export type AdminSection = { id: AdminSectionId; label: string; icon: IconName };
export type AdminGroup = { label: string; sections: AdminSection[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  { label: "Ventas", sections: [
    { id: "reportes", label: "Reportes", icon: "bar_chart" },
    { id: "margenes", label: "Márgenes", icon: "percent" }
  ] },
  { label: "Mercadería", sections: [
    { id: "lotes", label: "Lotes y vencimientos", icon: "calendar_today" },
    { id: "fraccionamiento", label: "Fraccionamiento y granel", icon: "call_split" },
    { id: "faltantes", label: "Faltantes e ingresos", icon: "add_alert" },
    { id: "proveedores", label: "Proveedores", icon: "local_shipping" }
  ] },
  { label: "Productos y precios", sections: [
    { id: "productos", label: "Productos", icon: "inventory_2" },
    { id: "precios", label: "Precios sugeridos", icon: "price_change" },
    { id: "clasificadores", label: "Marcas, rubros y etiquetas", icon: "label" },
    { id: "balanza", label: "Balanza", icon: "scale" }
  ] },
  { label: "Negocio", sections: [
    { id: "sucursales", label: "Sucursales y cajas", icon: "storefront" },
    { id: "trazabilidad", label: "Trazabilidad", icon: "history" }
  ] },
  { label: "Sistema", sections: [
    { id: "codigos", label: "Códigos y planilla", icon: "barcode" },
    { id: "configuracion", label: "Configuración y respaldos", icon: "backup" }
  ] }
];

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_GROUPS.flatMap((group) => group.sections);

export const DEFAULT_SECTION: AdminSectionId = "reportes";

/** «#margenes» → "margenes"; cualquier otra cosa, la sección por defecto. */
export function sectionFromHash(hash: string): AdminSectionId {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  return ADMIN_SECTIONS.some((section) => section.id === id) ? (id as AdminSectionId) : DEFAULT_SECTION;
}

export function sectionLabel(id: AdminSectionId): string {
  return ADMIN_SECTIONS.find((section) => section.id === id)?.label ?? "";
}
