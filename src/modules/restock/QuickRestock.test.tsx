// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileContext } from "../../shared/auth/AuthGate";

/** employee_catalog en memoria: una fila por presentación, como la vista. */
const catalog = vi.hoisted(() => {
  const product = { product_id: "yerba", product_name: "Yerba orgánica", manufacturer_barcode: "7790000000017", base_unit: "unit", sold_by_weight: false, open_shelf_life_days: null, sale_price: 1 };
  const rows: Record<string, unknown>[] = [
    { ...product, presentation_id: "caja", presentation_name: "Caja x12", base_quantity: 12, internal_barcode: null },
    { ...product, presentation_id: "paquete", presentation_name: "Paquete 1 kg", base_quantity: 1, internal_barcode: null },
    { ...product, presentation_id: "pack", presentation_name: "Pack x3", base_quantity: 3, internal_barcode: "2000000000015" }
  ];
  const query = () => {
    const filters: [string, unknown][] = [];
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      limit: () => builder,
      order: () => builder,
      then: <T,>(resolve: (value: { data: unknown; error: null }) => T) =>
        Promise.resolve({ data: rows.filter((row) => filters.every(([c, v]) => row[c] === v)), error: null }).then(resolve)
    };
    return builder;
  };
  return { client: { from: () => query() } };
});

const queued = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock("../../shared/supabase/client", () => ({ getSupabase: () => catalog.client, SQL_NULL: null }));
vi.mock("../stock/offlineStock", () => ({
  queueStockOperation: async (payload: Record<string, unknown>) => { queued.calls.push(payload); return { localId: "l1" }; },
  watchStockOperationSync: () => () => {}
}));
vi.mock("../../shared/offline/queue", () => ({ loadCatalogSnapshot: async () => null }));

const { QuickRestock } = await import("./QuickRestock");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  queued.calls = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ProfileContext.Provider value={{ id: "u1", role: "employee", active: true }}>
        <QuickRestock />
      </ProfileContext.Provider>
    );
  });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

function field(label: string): HTMLInputElement | HTMLSelectElement {
  const found = [...container.querySelectorAll("label")].find((l) => l.textContent?.trim() === label);
  if (!found) throw new Error(`No está el campo «${label}»`);
  return container.querySelector(`#${CSS.escape(found.htmlFor)}`) as HTMLInputElement | HTMLSelectElement;
}

async function type(label: string, value: string) {
  const input = field(label);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

/** happy-dom no envía el formulario al hacer clic en un botón submit: se envía como lo haría el navegador. */
async function click(text: string) {
  const target = button(text);
  await act(async () => {
    if (target.type === "submit" && target.form) {
      if (!target.disabled) target.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    } else target.click();
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function scan(code: string) {
  await type("Escanear código de barras", code);
  await click("Buscar");
}

describe("Ingreso rápido con un código de fabricante de varias presentaciones", () => {
  it("pide elegir la presentación y no deja ingresar hasta elegirla", async () => {
    await scan("7790000000017");
    const options = [...(field("Presentación") as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(["Elegí la presentación…", "Paquete 1 kg", "Pack x3", "Caja x12"]);
    expect(button("Ingresar lote").disabled).toBe(true);
  });

  it("ingresa la presentación elegida, no la más chica", async () => {
    await scan("7790000000017");
    await type("Presentación", "caja");
    await type("Cantidad a ingresar", "4");
    await click("Ingresar lote");
    expect(queued.calls).toMatchObject([{ action: "quick_restock", presentationId: "caja", presentationName: "Caja x12", quantity: 4 }]);
  });

  it("con el código interno no pregunta: es una sola presentación", async () => {
    await scan("2000000000015");
    expect(container.textContent).toContain("Yerba orgánica · Pack x3");
    expect([...container.querySelectorAll("label")].some((l) => l.textContent?.trim() === "Presentación")).toBe(false);
    await click("Ingresar lote");
    expect(queued.calls).toMatchObject([{ presentationId: "pack", quantity: 1 }]);
  });

  it("un código que no está en el catálogo lo dice", async () => {
    await scan("123");
    expect(container.querySelector("[role=alert]")?.textContent).toContain("No se encontró ningún producto activo con el código: 123");
  });
});
