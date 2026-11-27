import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculateEffectiveExpiry, evaluateExpiryStatus, getDaysUntilExpiry } from "./expiry";

describe("Vencimiento de lotes en zona horaria de Argentina (A-01, RF-08, RF-10)", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "America/Argentina/Buenos_Aires";
  });

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("un lote que vence hoy da 0 días (crítico, no vencido) y uno que vence mañana da 1 día", () => {
    const todayInBuenosAires = new Date(2026, 9, 20, 14, 30, 0); // 20/10/2026 14:30 hora local

    const daysToday = getDaysUntilExpiry("2026-10-20", todayInBuenosAires);
    expect(daysToday).toBe(0);
    expect(evaluateExpiryStatus(daysToday)).toBe("critical");

    const daysTomorrow = getDaysUntilExpiry("2026-10-21", todayInBuenosAires);
    expect(daysTomorrow).toBe(1);
    expect(evaluateExpiryStatus(daysTomorrow)).toBe("critical");

    const daysYesterday = getDaysUntilExpiry("2026-10-19", todayInBuenosAires);
    expect(daysYesterday).toBe(-1);
    expect(evaluateExpiryStatus(daysYesterday)).toBe("expired");
  });

  it("calcula el vencimiento efectivo al abrir una bolsa a última hora local sin correrse de día", () => {
    // 20/10/2026 a las 22:30 en Argentina (sería 21/10 01:30 en UTC)
    const openedLateLocal = new Date(2026, 9, 20, 22, 30, 0).toISOString();
    expect(calculateEffectiveExpiry("2026-12-31", openedLateLocal, 10)).toBe("2026-10-30");
    expect(calculateEffectiveExpiry("2026-10-25", openedLateLocal, 10)).toBe("2026-10-25");
  });

  it("devuelve null e indeterminado cuando no hay fecha válida", () => {
    expect(getDaysUntilExpiry(null)).toBeNull();
    expect(getDaysUntilExpiry("fecha-invalida")).toBeNull();
    expect(evaluateExpiryStatus(null)).toBe("indeterminate");
  });
});
