/**
 * Alverde · componentes de base (RNF-06 a RNF-09)
 * Importar siempre desde acá: `import { Button, GlassCard } from "../shared/ui";`
 * Emiten el marcado del sistema de diseño (src/styles/design-system.css).
 */
export { Button, buttonClasses } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";
export { GlassCard } from "./GlassCard";
export type { GlassCardProps } from "./GlassCard";
export { TextField } from "./TextField";
export type { TextFieldProps } from "./TextField";
export { SelectField } from "./SelectField";
export type { SelectFieldProps } from "./SelectField";
export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";
export { Tag } from "./Tag";
export type { TagProps } from "./Tag";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
export { Icon, ICON_NAMES } from "./Icon";
export type { IconName, IconProps } from "./Icon";
export { Options } from "./Options";
export type { OptionItem, OptionsProps } from "./Options";
export { Message } from "./Message";
export type { MessageTone } from "./Message";
export { useCompact, COMPACT_QUERY } from "./useCompact";
