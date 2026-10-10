/**
 * Íconos Material Symbols Outlined 400, copiados como máscaras SVG en design-system.css
 * (sección 3): funcionan sin conexión y toman el color del texto. Esta lista es la de
 * esa hoja; tests/theme/icons.test.ts verifica que cada nombre tenga su máscara.
 */
export const ICON_NAMES = [
  "account_balance", "add", "add_alert", "admin_panel_settings", "archive", "arrow_forward", "backup",
  "badge", "bar_chart", "barcode", "barcode_scanner", "block", "calendar_today", "call", "call_split",
  "cancel", "category", "check", "check_circle", "chevron_right", "close", "cloud_done", "cloud_off",
  "dark_mode", "delete_sweep", "download", "edit", "error", "folder_open", "group", "history", "inbox", "info",
  "inventory_2", "keyboard_arrow_down", "label", "light_mode", "local_shipping", "lock", "logout", "menu",
  "menu_book", "merge", "more_horiz", "package_2", "payments", "percent", "person", "point_of_sale",
  "price_change", "print", "qr_code_2", "receipt_long", "refresh", "remove", "scale", "schedule", "search",
  "sell", "settings_backup_restore", "sort", "storefront", "swap_horiz", "sync", "unarchive", "visibility",
  "warning"
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export type IconProps = {
  name: IconName;
  /** s = 16 px (chips, estados, botones compactos); l = 24 px (Cobrar). Por defecto 20 px. */
  size?: "s" | "l";
  className?: string;
};

/** Siempre decorativo: el texto o el aria-label del control dice qué es. */
export function Icon({ name, size, className }: IconProps) {
  const classes = ["ic", `ic-${name}`, size ? `ic--${size}` : "", className].filter(Boolean).join(" ");
  return <span className={classes} aria-hidden="true" />;
}
