import { describe, expect, it } from "vitest";
import { accumulatedChange, formatPercent, groupByBranch, toPriceHistory, type PriceHistoryRow } from "./priceHistory";

const row = (over: Partial<PriceHistoryRow>): PriceHistoryRow => ({
  id: "h1", presentation_id: "p1", sale_price: "1000.00", previous_price: null, changed_at: "2026-08-01T10:00:00Z",
  changed_by: "u1", batch_id: null, profile: { display_name: "Hija A" }, ...over
});

describe("RF-27: historial de precios por producto", () => {
  const entries = toPriceHistory([
    row({}),
    row({ id: "h2", sale_price: "1100.00", previous_price: "1000.00", changed_at: "2026-09-01T10:00:00Z", batch_id: "b1" }),
    row({ id: "h3", sale_price: "1320.00", previous_price: "1100.00", changed_at: "2026-10-01T10:00:00Z", profile: null })
  ]);

  it("ordena del más reciente al más viejo con la variación contra el anterior", () => {
    expect(entries.map((e) => e.id)).toEqual(["h3", "h2", "h1"]);
    expect(entries[0]!.change).toBeCloseTo(0.2);
    expect(entries[1]!.change).toBeCloseTo(0.1);
    expect(entries[2]!.change).toBeNull();
  });

  it("marca los cambios que vinieron de una actualización masiva y quién los hizo", () => {
    expect(entries[1]!.fromBulkUpdate).toBe(true);
    expect(entries[1]!.changedBy).toBe("Hija A");
    expect(entries[0]!.changedBy).toBe("—");
  });

  it("calcula la variación acumulada del producto (inflación)", () => {
    expect(accumulatedChange(entries)).toBeCloseTo(0.32);
    expect(accumulatedChange(entries.slice(0, 1))).toBeNull();
  });

  it("formatea porcentajes con signo", () => {
    expect(formatPercent(0.2)).toBe("+20 %");
    expect(formatPercent(-0.055)).toBe("-5,5 %");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("RF-69: historial separado por precio base y por sucursal", () => {
  it("no mezcla la inflación del base con la del precio propio de una sucursal", () => {
    const entries = toPriceHistory([
      row({ id: "b1", sale_price: "1000.00", previous_price: null, changed_at: "2026-08-01T10:00:00Z" }),
      row({ id: "b2", sale_price: "1100.00", previous_price: "1000.00", changed_at: "2026-09-01T10:00:00Z" }),
      row({ id: "n1", sale_price: "1500.00", previous_price: "1100.00", changed_at: "2026-09-15T10:00:00Z", branch_id: "norte" })
    ]);
    const groups = groupByBranch(entries);
    expect(groups.map((g) => g.branchId)).toEqual([null, "norte"]);
    expect(accumulatedChange(groups[0]!.entries)).toBeCloseTo(0.1);
    expect(groups[1]!.entries.map((e) => e.id)).toEqual(["n1"]);
  });
});
