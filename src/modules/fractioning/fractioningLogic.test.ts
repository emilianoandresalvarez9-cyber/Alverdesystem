import { describe, it, expect } from "vitest";
import { calculateFractioning, validateShelfLifeDays } from "./fractioningLogic";

describe("fractioningLogic", () => {
  describe("calculateFractioning (RF-13 a RF-16)", () => {
    it("debe descontar stock correctamente dejando la bolsa abierta (merma = 0)", () => {
      const result = calculateFractioning({
        originLotQuantity: 25000, // 25kg
        targetBaseQuantity: 150,  // Bolsitas de 150g
        packetsToProduce: 10,     // 10 bolsitas
        bagFinished: false,
        realRemainingGrams: 0
      });

      expect(result.gramsNeeded).toBe(1500);
      expect(result.theoreticalRemaining).toBe(23500);
      expect(result.merma).toBe(0);
      expect(result.newOriginQuantity).toBe(23500);
      expect(result.originLotStatus).toBe("open");
    });

    it("debe calcular la merma correctamente cuando la bolsa se declara terminada", () => {
      // Ejemplo de TAREAS.md: Fraccionar 1000g en bolsitas de 150g dejando 100g sobrantes
      // Si se arman 6 bolsitas (900g), sobran 100g teóricamente.
      const result = calculateFractioning({
        originLotQuantity: 1000,
        targetBaseQuantity: 150,
        packetsToProduce: 6,
        bagFinished: true,
        realRemainingGrams: 0 // El remanente real se descarta (es merma total)
      });

      expect(result.gramsNeeded).toBe(900);
      expect(result.theoreticalRemaining).toBe(100);
      expect(result.merma).toBe(100); // RF-16
      expect(result.newOriginQuantity).toBe(0);
      expect(result.originLotStatus).toBe("closed");
    });

    it("debe arrojar error si no hay stock suficiente", () => {
      expect(() => calculateFractioning({
        originLotQuantity: 1000,
        targetBaseQuantity: 500,
        packetsToProduce: 3, // Requiere 1500g
        bagFinished: false,
        realRemainingGrams: 0
      })).toThrowError(/Stock insuficiente/);
    });
    
    it("maneja precisión de decimales correctamente", () => {
      const result = calculateFractioning({
        originLotQuantity: 1.5,
        targetBaseQuantity: 0.33,
        packetsToProduce: 3, // 0.99
        bagFinished: true,
        realRemainingGrams: 0
      });
      
      expect(result.gramsNeeded).toBe(0.99);
      expect(result.theoreticalRemaining).toBe(0.51); // 1.5 - 0.99
      expect(result.merma).toBe(0.51);
    });
  });

  describe("validateShelfLifeDays", () => {
    it("debe aceptar nulos (para borrar vida útil)", () => {
      expect(validateShelfLifeDays(null)).toBe(true);
    });

    it("debe aceptar enteros positivos", () => {
      expect(validateShelfLifeDays(1)).toBe(true);
      expect(validateShelfLifeDays(90)).toBe(true);
    });

    it("debe rechazar cero o negativos", () => {
      expect(validateShelfLifeDays(0)).toBe(false);
      expect(validateShelfLifeDays(-5)).toBe(false);
    });

    it("debe rechazar decimales", () => {
      expect(validateShelfLifeDays(10.5)).toBe(false);
    });
  });
});
