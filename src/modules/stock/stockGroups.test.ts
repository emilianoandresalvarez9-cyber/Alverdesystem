import { describe, expect, it } from "vitest";
import { groupStockLots } from "./stockGroups";

describe("agrupación visual de lotes", () => {
  it("une lotes de la misma presentación y sucursal, sin mezclar sucursales o presentaciones", () => {
    const lots = [
      { id: "l1", presentation_id: "p1", branch_id: "b1" },
      { id: "l2", presentation_id: "p1", branch_id: "b1" },
      { id: "l3", presentation_id: "p1", branch_id: "b2" },
      { id: "l4", presentation_id: "p2", branch_id: "b1" },
    ];

    const groups = groupStockLots(lots);

    expect(groups.map((group) => group.lots.map((lot) => lot.id))).toEqual([
      ["l1", "l2"], ["l3"], ["l4"]
    ]);
  });
});
