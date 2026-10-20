import { describe, expect, it } from "vitest";
import type { AppSupabaseClient } from "../../shared/supabase/client";
import type { QueuedOperation } from "../../shared/offline/types";
import { checkGranelStock, granelShortages } from "./granelStock";
import type { CartLine, PosEntry } from "./types";

const lentejas: PosEntry = {
  presentationId: "lentejas-granel", productId: "lentejas", productName: "Lentejas", presentationName: "Granel",
  baseUnit: "gram", baseQuantity: 1, salePrice: 3, soldByWeight: true, internalBarcode: "2000000010010", manufacturerBarcode: null
};
const alfajor: PosEntry = { ...lentejas, presentationId: "alfajor", productName: "Alfajor", presentationName: "Unidad", baseUnit: "unit", soldByWeight: false };

const weighed = (grams: number): CartLine => ({ lineId: `l${grams}`, entry: lentejas, quantity: grams, weight: grams });
const pendingSale = (presentationId: string, quantity: number, retryable?: boolean): QueuedOperation => ({
  localId: `s-${quantity}`, deviceId: "d", kind: "sale", createdAt: "2026-10-20T12:00:00Z",
  payload: { items: [{ localId: "i", presentationId, quantity, unitPrice: 3 }] },
  ...(retryable === undefined ? {} : { retryable })
});

describe("RF-38: el granel no admite faltante (control en caja antes de cobrar)", () => {
  it("dos pesadas que juntas superan el stock no alcanzan", () => {
    expect(granelShortages([weighed(250), weighed(300)], new Map([["lentejas-granel", 500]]), [])).toEqual([
      { presentationId: "lentejas-granel", label: "Lentejas · Granel", baseUnit: "gram", needed: 550, available: 500 }
    ]);
  });

  it("vender exactamente lo que queda alcanza", () => {
    expect(granelShortages([weighed(500)], new Map([["lentejas-granel", 500]]), [])).toEqual([]);
  });

  it("descuenta lo vendido en este equipo que todavía no llegó a la nube, salvo las ventas rechazadas", () => {
    const stock = new Map([["lentejas-granel", 500]]);
    expect(granelShortages([weighed(300)], stock, [pendingSale("lentejas-granel", 300)])[0]?.available).toBe(200);
    expect(granelShortages([weighed(300)], stock, [pendingSale("lentejas-granel", 300, false)])).toEqual([]);
  });

  it("sin lotes el granel no tiene stock; lo que no es granel no se controla acá", () => {
    expect(granelShortages([weighed(1)], new Map(), [])[0]).toMatchObject({ available: 0, needed: 1 });
    expect(granelShortages([{ lineId: "a", entry: alfajor, quantity: 30 }], new Map(), [])).toEqual([]);
  });
});

/** employee_stock_lots en memoria: devuelve todas las filas pedidas por presentación. */
function stockClient(rows: { presentation_id: string; current_quantity: number; branch_id: string }[] | null, failing = false) {
  const builder = {
    select: () => builder,
    in: (_column: string, ids: string[]) => ({
      then: <T,>(resolve: (value: unknown) => T) => Promise.resolve(failing
        ? { data: null, error: { message: "network" } }
        : { data: (rows ?? []).filter((row) => ids.includes(row.presentation_id)), error: null }).then(resolve)
    })
  };
  return { from: () => builder } as unknown as AppSupabaseClient;
}

describe("checkGranelStock", () => {
  const lots = [
    { presentation_id: "lentejas-granel", current_quantity: 200, branch_id: "central" },
    { presentation_id: "lentejas-granel", current_quantity: 150, branch_id: "central" },
    { presentation_id: "lentejas-granel", current_quantity: 5000, branch_id: "otra" }
  ];

  it("suma los lotes de la sucursal de la caja, no los de otra", async () => {
    expect(await checkGranelStock(stockClient(lots), [weighed(350)], "central", [])).toBeNull();
    expect(await checkGranelStock(stockClient(lots), [weighed(400)], "central", [])).toBe(
      "No alcanza el granel (Lentejas · Granel: quedan 350 g y la venta lleva 400 g). Corregí la pesada o sacala de la venta: el granel no admite faltante."
    );
  });

  it("sin granel en la venta no consulta nada, y si la consulta falla no bloquea: decide la base", async () => {
    expect(await checkGranelStock(stockClient(null, true), [{ lineId: "a", entry: alfajor, quantity: 3 }], "central", [])).toBeNull();
    expect(await checkGranelStock(stockClient(null, true), [weighed(400)], "central", [])).toBeNull();
  });
});
