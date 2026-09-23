import type { ReactNode, HTMLAttributes, ElementType } from "react";

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  padding?: "normal" | "compact" | "none";
  as?: ElementType;
}

const PADDING: Record<string, string> = {
  normal: "1.5rem",
  compact: "1rem",
  none: "0",
};

export function GlassCard({
  children,
  padding = "normal",
  as: Component = "div",
  className = "",
  style,
  ...rest
}: GlassCardProps) {
  return (
    <Component
      className={`glass ${className}`}
      style={{ borderRadius: "var(--radio-carta)", padding: PADDING[padding], ...style }}
      {...rest}
    >
      {children}
    </Component>
  );
}
