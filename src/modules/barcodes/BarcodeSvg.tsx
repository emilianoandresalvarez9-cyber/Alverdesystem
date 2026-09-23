import { useMemo } from "react";
import { encodeEan13Modules } from "./ean13";

interface BarcodeSvgProps {
  code: string;
  width?: number | string;
  height?: number;
  showText?: boolean;
  barColor?: string;
  bgColor?: string;
  style?: React.CSSProperties;
}

/**
 * Renderiza un código EAN-13 utilizando SVG vectorial.
 * Garantiza total nitidez para lectores láser 1D.
 * Cero dependencias externas.
 */
export function BarcodeSvg({
  code,
  width = "100%",
  height = 80,
  showText = true,
  barColor = "#000000",
  bgColor = "#ffffff",
  style,
}: BarcodeSvgProps) {
  // Solo procesar si el código tiene exactamente 13 dígitos numéricos
  const isValid = /^\d{13}$/.test(code);

  const modules = useMemo(() => {
    if (!isValid) return null;
    try {
      return encodeEan13Modules(code);
    } catch {
      return null;
    }
  }, [code, isValid]);

  if (!isValid || !modules) {
    return (
      <div style={{ padding: "1rem", color: "red", border: "1px solid red", background: bgColor }}>
        Error: Código EAN-13 inválido
      </div>
    );
  }

  // Dimensiones
  const totalModules = 95;
  const moduleWidth = 2; // px por módulo virtual
  const svgWidth = totalModules * moduleWidth + 40; // Agregar padding para el 1er dígito
  const barHeight = height - (showText ? 15 : 0);
  const guardExtraHeight = showText ? 8 : 0; // Las guardas bajan un poco más si hay texto

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${svgWidth} ${height}`}
      width={width}
      height={height}
      style={{ backgroundColor: bgColor, ...style }}
    >
      <g fill={barColor}>
        {modules.map((isBar, index) => {
          if (!isBar) return null; // Solo dibujar barras negras

          // Identificar si es barra de guardia (baja más si hay texto)
          // Start: 0-2, Center: 45-49, End: 92-94
          const isGuard = index < 3 || (index >= 45 && index <= 49) || index > 91;
          const h = barHeight + (isGuard ? guardExtraHeight : 0);
          
          // Desplazamiento x. Empezamos en 24 para dejar espacio al dígito 1
          const x = 24 + index * moduleWidth;

          return <rect key={index} x={x} y={0} width={moduleWidth} height={h} />;
        })}
      </g>

      {showText && (
        <g fill={barColor} fontFamily="monospace" fontSize="14" textAnchor="middle">
          {/* Primer dígito (afuera a la izq) */}
          <text x={12} y={height - 1}>{code[0]}</text>
          
          {/* Lado izquierdo (dígitos 2 a 7) */}
          <text x={24 + (21 * moduleWidth)} y={height - 1} textLength={36} lengthAdjust="spacingAndGlyphs">
            {code.substring(1, 7)}
          </text>
          
          {/* Lado derecho (dígitos 8 a 13) */}
          <text x={24 + (74 * moduleWidth)} y={height - 1} textLength={36} lengthAdjust="spacingAndGlyphs">
            {code.substring(7, 13)}
          </text>
        </g>
      )}
    </svg>
  );
}
