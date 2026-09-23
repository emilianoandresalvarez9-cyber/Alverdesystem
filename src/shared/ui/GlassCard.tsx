import type { ReactNode, HTMLAttributes } from "react";

export interface GlassCardProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  padding?: "normal" | "compact" | "none";
  as?: keyof JSX.IntrinsicElements;
}

const PADDING: Record<string, string> = {
  normal: "1.5rem",
  compact: "1rem",
  none: "0",
};

export function GlassCard({
  children,
  padding = "normal",
  as: Tag = "div",
  className = "",
  style,
  ...rest
}: GlassCardProps) {
  return (
    <Tag
      className={`glass ${className}`}
      style={{ borderRadius: "var(--radio-carta)", padding: PADDING[padding], ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
