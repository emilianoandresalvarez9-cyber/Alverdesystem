import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { lotActions } from "../../src/modules/stock/StockLotsTable";
import { ActionsMenu } from "../../src/shared/ui";
import type { StockLot } from "../../src/modules/stock/types";

/**
 * Stock: cada lote tiene todas sus acciones en «Más acciones» y la que corresponde a la
 * vista (decisión del sistema de diseño). Ninguna acción del inventario se pierde.
 */
const lot = (over: Partial<StockLot>): StockLot => ({
  id: "l1", presentation_id: "p1", supplier_id: null, initial_quantity: 1000, current_quantity: 800,
  received_at: "2026-09-20T12:00:00Z", manufacturer_expiry_date: null, opened_at: null, portioned_at: null,
  status: "open", created_at: "2026-09-20T12:00:00Z", product_id: "pr1", product_name: "Lenteja",
  presentation_name: "Granel", base_unit: "gram", base_quantity: 1, sold_by_weight: true, open_shelf_life_days: null,
  supplier_name: null, branch_id: "b1", branch_name: "Centro", effective_expiry_date: null,
  expiry_status: "indeterminate", days_until_expiry: null, ...over
});
const noop = () => {};
const run = (l: StockLot, opts: Partial<{ hasActiveBag: boolean; canFraction: boolean; canTransfer: boolean }> = {}) =>
  lotActions(l, { hasActiveBag: false, canFraction: true, canTransfer: false, onOpen: noop, onFraction: noop, onAdjust: noop, onTransfer: noop, ...opts });
const keys = (r: ReturnType<typeof run>) => r.all.map((a) => a.key);

describe("Acciones de un lote", () => {
  it("granel sin abrir: Abrir bolsa a la vista; Fraccionar y Ajustar en el menú", () => {
    const r = run(lot({}));
    expect(r.primary?.key).toBe("open");
    expect(keys(r)).toEqual(["open", "fraction", "adjust"]);
  });

  it("bolsa de granel abierta: Fraccionar a la vista", () => {
    expect(run(lot({ opened_at: "2026-10-01T10:00:00Z" })).primary?.key).toBe("fraction");
  });

  it("RF-12: con otra bolsa abierta, Abrir bolsa queda deshabilitada con el motivo y no va a la vista", () => {
    const r = run(lot({ sold_by_weight: false }), { hasActiveBag: true });
    const open = r.all.find((a) => a.key === "open");
    expect(open).toMatchObject({ disabled: true, reason: "Ya hay una bolsa abierta de este producto." });
    expect(r.primary?.key).toBe("adjust");
  });

  it("Traspasar sólo para administración con más de una sucursal y stock (RF-68)", () => {
    expect(keys(run(lot({}), { canTransfer: false }))).not.toContain("transfer");
    expect(keys(run(lot({}), { canTransfer: true }))).toContain("transfer");
    expect(keys(run(lot({ current_quantity: 0 }), { canTransfer: true }))).not.toContain("transfer");
  });

  it("un lote cerrado o pendiente de sincronizar no tiene acciones", () => {
    expect(run(lot({ status: "closed" })).all).toEqual([]);
    expect(run(lot({ id: "pending:abc" })).all).toEqual([]);
  });
});

describe("ActionsMenu", () => {
  it("el botón nombra el objeto y arranca cerrado", () => {
    const html = renderToStaticMarkup(<ActionsMenu label="Más acciones para Spirulina" actions={[{ label: "Ajustar", icon: "edit", onSelect: noop }]} />);
    expect(html).toContain('aria-label="Más acciones para Spirulina" aria-expanded="false"');
    expect(html).not.toContain("menu--flotante");
  });
});
