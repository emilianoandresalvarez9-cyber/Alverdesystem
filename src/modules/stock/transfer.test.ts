import { describe, expect, it } from "vitest";
import { checkTransfer } from "./transfer";

const base = { rawQuantity: "8", available: 20, fromBranchId: "centro", toBranchId: "norte" };

describe("RF-68: validar traspaso", () => {
  it("acepta una cantidad dentro de lo disponible, con coma decimal", () => {
    expect(checkTransfer(base)).toEqual({ ok: true, quantity: 8 });
    expect(checkTransfer({ ...base, rawQuantity: "2,5" })).toEqual({ ok: true, quantity: 2.5 });
  });

  it("rechaza sin destino, a la misma sucursal, cero, más de lo disponible o más de 3 decimales", () => {
    expect(checkTransfer({ ...base, toBranchId: "" }).ok).toBe(false);
    expect(checkTransfer({ ...base, toBranchId: "centro" }).ok).toBe(false);
    expect(checkTransfer({ ...base, rawQuantity: "0" }).ok).toBe(false);
    expect(checkTransfer({ ...base, rawQuantity: "21" }).ok).toBe(false);
    expect(checkTransfer({ ...base, rawQuantity: "1.0001" }).ok).toBe(false);
  });
});
