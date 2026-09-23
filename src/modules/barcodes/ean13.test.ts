import { describe, it, expect } from "vitest";
import {
  calculateEan13CheckDigit,
  validateEan13,
  generateInternalEan13,
  encodeEan13Modules
} from "./ean13";

describe("EAN-13 GS1 Algorithm Tests", () => {
  it("should calculate correct check digit for official GS1 examples", () => {
    // Ejemplo de la doc oficial GS1: "4006381333931" (verificador = 1)
    expect(calculateEan13CheckDigit("400638133393")).toBe(1);
    
    // Otro ejemplo: "5901234123457" (verificador = 7)
    expect(calculateEan13CheckDigit("590123412345")).toBe(7);
  });

  it("should throw error if input length is not 12", () => {
    expect(() => calculateEan13CheckDigit("123")).toThrowError();
    expect(() => calculateEan13CheckDigit("1234567890123")).toThrowError();
  });

  it("should validate a correct full EAN-13 code", () => {
    const result = validateEan13("4006381333931");
    expect(result.valid).toBe(true);
    expect(result.checkDigit).toBe(1);
    expect(result.calculatedCheckDigit).toBe(1);
    expect(result.isInternalRange).toBe(false); // 40 no es rango interno
  });

  it("should invalidate an EAN-13 code with wrong check digit", () => {
    const result = validateEan13("4006381333939");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Dígito verificador incorrecto");
  });

  it("should correctly identify internal ranges (20-29)", () => {
    const internalResult = validateEan13("2012345678903"); // Check digit corregido de 6 a 3
    expect(internalResult.valid).toBe(true);
    expect(internalResult.isInternalRange).toBe(true);

    const normalResult = validateEan13("7501031311309"); // normal EAN
    expect(normalResult.valid).toBe(true);
    expect(normalResult.isInternalRange).toBe(false);
  });

  describe("Internal EAN-13 Generator (RF-20, RF-21, RF-23)", () => {
    it("should generate a valid 13-digit EAN code within internal prefix 20", () => {
      const barcode = generateInternalEan13(12345);
      expect(barcode).toHaveLength(13);
      expect(barcode.startsWith("20")).toBe(true);
      
      const validation = validateEan13(barcode);
      expect(validation.valid).toBe(true);
      expect(validation.isInternalRange).toBe(true);
    });

    it("should pad presentation ID correctly", () => {
      // Prefijo 21 => "210000000005" + "0" (verificador de 210000000005 es 0)
      const barcode = generateInternalEan13(5, 21);
      expect(barcode).toBe("2100000000050");
    });

    it("should guarantee that NO PRICE is encoded in the barcode (RF-23)", () => {
      // Indiferentemente del precio del producto, el generador toma un sequence/ID.
      // RF-23 estipula que no se embebe el precio en el número interno.
      const barcode1 = generateInternalEan13(999);
      expect(barcode1.includes("precio")).toBe(false);
      expect(barcode1.length).toBe(13);
      expect(isNaN(Number(barcode1))).toBe(false);
    });
  });

  describe("EAN-13 SVG Modules Encoder", () => {
    it("should produce exactly 95 modules (bars and spaces)", () => {
      const code = "4006381333931";
      const modules = encodeEan13Modules(code);
      expect(modules.length).toBe(95);
    });

    it("should have correct guard bars at start, center and end", () => {
      const modules = encodeEan13Modules("2012345678906");
      
      // Start = 101 (true, false, true)
      expect(modules[0]).toBe(true);
      expect(modules[1]).toBe(false);
      expect(modules[2]).toBe(true);

      // End = 101 (last 3 modules)
      expect(modules[92]).toBe(true);
      expect(modules[93]).toBe(false);
      expect(modules[94]).toBe(true);

      // Center = 01010 (starts after 3 + 42 = 45) -> indices 45 to 49
      expect(modules[45]).toBe(false);
      expect(modules[46]).toBe(true);
      expect(modules[47]).toBe(false);
      expect(modules[48]).toBe(true);
      expect(modules[49]).toBe(false);
    });
  });

  it("reserva el prefijo 29 para etiquetas de balanza (ADR-001)", () => {
    expect(() => generateInternalEan13(5, 29)).toThrow(/reservado/);
    expect(generateInternalEan13(5, 28)).toMatch(/^28/);
  });
});
