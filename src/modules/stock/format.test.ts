import { describe, expect, it } from "vitest";
import { formatDay, formatQuantity, remaining, unitLabel } from "./format";

describe("Stock: cantidades y fechas en formato argentino", () => {
  it("cantidades con punto de miles, coma decimal y unidad corta", () => {
    expect(formatQuantity(1000, "gram")).toBe("1.000 g");
    expect(formatQuantity(825, "gram")).toBe("825 g");
    expect(formatQuantity(0.35, "millilitre")).toBe("0,35 ml");
    expect(formatQuantity(12, "unit")).toBe("12 u");
    expect(unitLabel("otra")).toBe("otra");
  });

  it("un vencimiento (fecha sola) no se corre al día anterior por la zona horaria", () => {
    expect(formatDay("2026-10-14")).toBe("14/10/2026");
    expect(formatDay(null)).toBe("—");
    expect(formatDay("no es fecha")).toBe("—");
  });

  it("el medidor avisa cuando queda poco", () => {
    expect(remaining(5, 30)).toEqual({ percent: 17, tone: "error" });
    expect(remaining(10, 30)).toEqual({ percent: 33, tone: "aviso" });
    expect(remaining(740, 1000)).toEqual({ percent: 74, tone: "normal" });
    expect(remaining(3, 0)).toEqual({ percent: 0, tone: "normal" });
    expect(remaining(1200, 1000).percent).toBe(100);
  });
});
