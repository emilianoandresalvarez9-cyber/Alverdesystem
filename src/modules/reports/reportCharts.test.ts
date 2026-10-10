import { describe, expect, it } from "vitest";
import { dailyBars, niceMax, percentOf, shortMoney } from "./reportCharts";

describe("Reportes: gráficos con CSS (RF-61 a RF-63)", () => {
  const now = new Date(2026, 9, 9, 16, 0); // viernes 9 de octubre, 16 h

  it("una barra por día del rango, con ceros en los días sin ventas y hoy «en curso»", () => {
    const { bars } = dailyBars([{ day: "2026-10-03", total: 214300 }, { day: "2026-10-09", total: 100700 }], 7, now);
    expect(bars.map((b) => b.day)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(bars.map((b) => b.weekday)).toEqual(["sáb", "dom", "lun", "mar", "mié", "jue", "hoy"]);
    expect(bars[1]!.total).toBe(0);
    expect(bars[6]).toMatchObject({ today: true, highlight: false });
    expect(bars.filter((b) => b.highlight).map((b) => b.day)).toEqual(["2026-10-03"]);
  });

  it("el eje redondea hacia arriba y las barras quedan a escala", () => {
    expect(niceMax(214300)).toBe(250000);
    expect(niceMax(0)).toBe(0);
    const { bars, ticks } = dailyBars([{ day: "2026-10-09", total: 125000 }], 1, now);
    expect(ticks.map((t) => t.label)).toEqual(["$0", "$100 mil", "$200 mil"]);
    expect(bars[0]!.percent).toBe(62.5);
  });

  it("montos cortos y porcentajes enteros", () => {
    expect(shortMoney(950)).toBe("$950");
    expect(shortMoney(214300)).toBe("$214 mil");
    expect(shortMoney(1_250_000)).toBe("$1,3 M");
    expect(percentOf(38, 100)).toBe(38);
    expect(percentOf(5, 0)).toBe(0);
  });
});
