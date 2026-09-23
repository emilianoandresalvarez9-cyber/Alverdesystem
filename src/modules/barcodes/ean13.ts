import type { Ean13ValidationResult } from "./types";

/**
 * Calcula el dígito verificador módulo 10 estándar de GS1 para EAN-13.
 * Toma los primeros 12 dígitos del código.
 */
export function calculateEan13CheckDigit(code12: string): number {
  if (code12.length !== 12 || !/^\d+$/.test(code12)) {
    throw new Error("Se requieren exactamente 12 dígitos para calcular el verificador EAN-13.");
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const char = code12.charAt(i);
    const digit = parseInt(char, 10);
    // Posiciones impares (índice 0, 2, 4...) multiplican por 1.
    // Posiciones pares (índice 1, 3, 5...) multiplican por 3.
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Valida un código EAN-13 completo (13 dígitos) y comprueba su dígito verificador
 * y si pertenece al rango interno (prefijos 20-29).
 */
export function validateEan13(code: string): Ean13ValidationResult {
  const cleanCode = code.replace(/\D/g, ""); // Limpiar guiones o espacios si los hay

  if (cleanCode.length !== 13) {
    return { valid: false, code: cleanCode, reason: "Debe tener exactamente 13 dígitos." };
  }

  const code12 = cleanCode.substring(0, 12);
  const providedCheckDigit = parseInt(cleanCode.charAt(12), 10);
  const calculatedCheckDigit = calculateEan13CheckDigit(code12);

  const prefix = parseInt(cleanCode.substring(0, 2), 10);
  const isInternalRange = prefix >= 20 && prefix <= 29;

  if (providedCheckDigit !== calculatedCheckDigit) {
    return {
      valid: false,
      code: cleanCode,
      checkDigit: providedCheckDigit,
      calculatedCheckDigit,
      isInternalRange,
      reason: "Dígito verificador incorrecto.",
    };
  }

  return {
    valid: true,
    code: cleanCode,
    checkDigit: providedCheckDigit,
    calculatedCheckDigit,
    isInternalRange,
  };
}

/**
 * RF-20, RF-21, RF-23:
 * Genera un código EAN-13 interno válido.
 * Utiliza un prefijo (20 a 29) y un ID de presentación numérico o string numérico (hasta 10 dígitos).
 * El precio NO SE INCLUYE NUNCA (RF-23).
 */
export function generateInternalEan13(presentationSequenceId: string | number, prefix: number = 20): string {
  if (prefix < 20 || prefix > 29) {
    throw new Error("El prefijo interno debe estar entre 20 y 29.");
  }

  const idStr = String(presentationSequenceId).replace(/\D/g, "");
  
  if (idStr.length > 10) {
    throw new Error("El ID de presentación no puede superar los 10 dígitos.");
  }

  // Rellenar con ceros a la izquierda hasta completar 10 dígitos
  const paddedId = idStr.padStart(10, "0");
  
  // Código de 12 dígitos: prefijo (2) + id (10)
  const code12 = `${prefix}${paddedId}`;
  const checkDigit = calculateEan13CheckDigit(code12);
  
  return `${code12}${checkDigit}`;
}

// ============================================================================
// LÓGICA DE CODIFICACIÓN EN BARRAS (MÓDULOS SVG)
// ============================================================================

const L_CODE = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];
const G_CODE = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];
const R_CODE = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100"
];

// Reglas de paridad para el lado izquierdo basadas en el primer dígito (0-9)
// 'L' significa usar L_CODE, 'G' usar G_CODE.
const PARITY_MAP = [
  "LLLLLL", // 0
  "LLGLGG", // 1
  "LLGGLG", // 2
  "LLGGGL", // 3
  "LGLLGG", // 4
  "LGGLLG", // 5
  "LGGGLL", // 6
  "LGLGLG", // 7
  "LGLGGL", // 8
  "LGGLGL"  // 9
];

/**
 * Transforma un código EAN-13 válido (13 dígitos numéricos)
 * en un array de booleanos de 95 elementos (true = barra negra, false = espacio blanco)
 */
export function encodeEan13Modules(code13: string): boolean[] {
  if (code13.length !== 13 || !/^\d+$/.test(code13)) {
    throw new Error("Se requiere un código EAN-13 de exactamente 13 dígitos numéricos.");
  }

  const digits = code13.split("").map(Number);
  const firstDigit = digits[0];
  const paritySequence = PARITY_MAP[firstDigit as number] || "";
  
  let modules = "";

  // 1. Barra de inicio: 101
  modules += "101";

  // 2. Lado izquierdo (6 dígitos)
  for (let i = 1; i <= 6; i++) {
    const d = digits[i] as number;
    const parity = paritySequence.charAt(i - 1); // L o G
    if (parity === "L") {
      modules += L_CODE[d] || "";
    } else {
      modules += G_CODE[d] || "";
    }
  }

  // 3. Barra central: 01010
  modules += "01010";

  // 4. Lado derecho (6 dígitos)
  for (let i = 7; i <= 12; i++) {
    const d = digits[i] as number;
    modules += R_CODE[d] || "";
  }

  // 5. Barra de fin: 101
  modules += "101";

  if (modules.length !== 95) {
    throw new Error(`Error en el cálculo de módulos. Longitud esperada: 95, obtenida: ${modules.length}`);
  }

  // Convertir string "10101..." a array de booleanos
  return modules.split("").map(char => char === "1");
}
