import { describe, expect, it } from "vitest";
import { grossMarginPercentage, latestLotCost, marginTone } from "./marginCalculations";

describe("margin calculations", () => {
  it("does not fall back to an older cost when the newest lot has no cost", () => {
    const lots = [
      { presentation_id: "bag", purchase_cost: 0, received_at: "2026-09-27T10:00:00Z" },
      { presentation_id: "bag", purchase_cost: 240, received_at: "2026-09-26T10:00:00Z" }
    ];

    expect(latestLotCost(lots, "bag")).toBeNull();
  });

  it("uses the newest lot cost for its presentation", () => {
    const lots = [
      { presentation_id: "bag", purchase_cost: 240, received_at: "2026-09-26T10:00:00Z" },
      { presentation_id: "bag", purchase_cost: 300, received_at: "2026-09-27T10:00:00Z" },
      { presentation_id: "bulk", purchase_cost: 1.6, received_at: "2026-09-28T10:00:00Z" }
    ];

    expect(latestLotCost(lots, "bag")).toBe(300);
  });

  it("treats a recently portioned lot as newer than its original receipt date", () => {
    const lots = [
      { presentation_id: "bag", purchase_cost: 240, received_at: "2026-09-20T10:00:00Z", portioned_at: "2026-09-27T10:00:00Z" },
      { presentation_id: "bag", purchase_cost: 300, received_at: "2026-09-26T10:00:00Z", portioned_at: null }
    ];

    expect(latestLotCost(lots, "bag")).toBe(240);
  });

  it("reports gross margin as profit divided by sale price", () => {
    expect(grossMarginPercentage(100, 200)).toBe(50);
    expect(grossMarginPercentage(220, 200)).toBe(-10);
  });

  it("marks losses as errors before applying the low-margin warning", () => {
    expect(marginTone(-10)).toBe("error");
    expect(marginTone(10)).toBe("aviso");
    expect(marginTone(50)).toBe("exito");
  });
});
