// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Base en memoria con la forma del cliente de Supabase que usa la pantalla: guarda las filas y
 * registra cada escritura, para ver qué le manda la pantalla a la base al apretar los botones.
 */
const memory = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const state = { tables: {} as Record<string, Row[]>, writes: [] as string[], seq: 0 };

  class Query {
    private op: "select" | "insert" | "update" = "select";
    private payload: Row | null = null;
    private filters: [string, unknown][] = [];
    private one = false;
    private columns = "*";
    constructor(private table: string) {}
    select(columns = "*") { if (this.op === "select") this.columns = columns; return this; }
    insert(payload: Row) { this.op = "insert"; this.payload = payload; return this; }
    update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
    eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
    in() { return this; }
    order() { return this; }
    limit() { return this; }
    is() { return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; return this; }
    then<T>(resolve: (value: { data: unknown; error: null }) => T) { return Promise.resolve(this.run()).then(resolve); }
    private run() {
      const rows = (state.tables[this.table] ??= []);
      const matches = (row: Row) => this.filters.every(([column, value]) => row[column] === value);
      let out: Row[];
      if (this.op === "insert") {
        const row: Row = { id: `${this.table}-${++state.seq}`, active: true, ...this.payload };
        rows.push(row);
        state.writes.push(`insert ${this.table} ${String(row.name)}`);
        out = [row];
      } else if (this.op === "update") {
        out = rows.filter(matches);
        out.forEach((row) => Object.assign(row, this.payload));
        state.writes.push(`update ${this.table} ${out.map((row) => String(row.id)).join(",")}`);
      } else {
        out = rows.filter(matches).map((row) => ({ ...row }));
        if (this.table === "products" && this.columns.includes("product_presentations(active)")) {
          out = out.map((row) => ({
            ...row,
            product_presentations: (state.tables.product_presentations ?? [])
              .filter((pr) => pr.product_id === row.id).map((pr) => ({ active: pr.active }))
          }));
        }
      }
      return { data: this.one ? (out[0] ?? null) : out, error: null };
    }
  }

  const client = { from: (table: string) => new Query(table), rpc: async () => ({ data: null, error: null }) };
  const reset = () => {
    state.tables = { pricing_settings: [{ id: 1, default_multiplier: 2 }] };
    state.writes = [];
    state.seq = 0;
  };
  return { state, client, reset };
});

vi.mock("../../shared/supabase/client", () => ({ getSupabase: () => memory.client, SQL_NULL: null }));

const { ProductsManager } = await import("./ProductsManager");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  memory.reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<ProductsManager />); });
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

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`No está el botón «${text}»`);
  await act(async () => { button.click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const title = () => container.querySelector("#ficha-producto")?.textContent;
const text = () => container.textContent ?? "";

async function createProduct(name: string, presentation: string) {
  await type("Nombre", name);
  await type("Nombre de la presentación", presentation);
  await type("Cantidad base", "1");
  await type("Precio", "1500");
  await click("Crear producto");
}

describe("Administración de productos: alta", () => {
  it("tres altas seguidas crean tres productos y no renombran el anterior", async () => {
    await createProduct("Avena", "Bolsa 1 kg");
    await createProduct("Arroz", "Paquete 1 kg");
    await createProduct("Lentejas", "Bolsa 500 g");

    expect(memory.state.writes).toEqual([
      "insert products Avena", "insert product_presentations Bolsa 1 kg",
      "insert products Arroz", "insert product_presentations Paquete 1 kg",
      "insert products Lentejas", "insert product_presentations Bolsa 500 g"
    ]);
    expect(memory.state.tables.products?.map((p) => p.name)).toEqual(["Avena", "Arroz", "Lentejas"]);
  });

  it("después de crear, el formulario queda listo para el siguiente y avisa dónde aparece", async () => {
    await createProduct("Arveja", "Lata 300 g");
    expect(title()).toBe("Nuevo producto");
    expect((field("Nombre") as HTMLInputElement).value).toBe("");
    expect(text()).toContain("Se creó «Arveja» con la presentación «Lata 300 g». Ya aparece en la Caja");
  });

  it("no crea un producto sin presentación", async () => {
    await type("Nombre", "Arveja");
    await click("Crear producto");
    expect(memory.state.writes).toEqual([]);
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Poné el nombre de la presentación");
  });

  it("desde el aviso se abre la ficha del producto creado, y ahí guardar actualiza ese producto", async () => {
    await createProduct("Arveja", "Lata 300 g");
    await click("Abrir su ficha");
    expect(title()).toBe("Ficha de Arveja");
    await type("Nombre", "Arvejas en lata");
    await click("Guardar cambios");
    expect(memory.state.writes.slice(-1)).toEqual(["update products products-1"]);
    expect(memory.state.tables.products?.map((p) => p.name)).toEqual(["Arvejas en lata"]);
  });
});

describe("Administración de productos: archivar", () => {
  it("archiva, avisa y deja el formulario listo para un alta nueva", async () => {
    await createProduct("Arveja", "Lata 300 g");
    await click("Abrir su ficha");
    await click("Archivar");
    expect(memory.state.tables.products).toMatchObject([{ name: "Arveja", active: false }]);
    expect(text()).toContain("Archivado");
    expect(title()).toBe("Nuevo producto");
    expect((field("Nombre") as HTMLInputElement).value).toBe("");
    expect([...container.querySelectorAll("option")].map((o) => o.textContent)).toContain("Arveja (archivado)");
  });
});

describe("Administración de productos: producto sin presentación", () => {
  beforeEach(async () => {
    await act(async () => { root.unmount(); });
    memory.state.tables.products = [{ id: "arveja", name: "Arveja", active: true, base_unit: "unit", manufacturer_barcode: "7798138552838" }];
    root = createRoot(container);
    await act(async () => { root.render(<ProductsManager />); });
  });

  it("el selector lo marca y la ficha explica que no aparece en Caja ni en Stock", async () => {
    const option = [...container.querySelectorAll("option")].find((o) => o.value === "arveja");
    expect(option?.textContent).toBe("Arveja (sin presentación)");

    await type("Producto", "arveja");
    expect(text()).toContain("Este producto no tiene presentaciones activas: no aparece en la Caja");

    await type("Nombre de la presentación", "Lata 300 g");
    await type("Cantidad base", "1");
    await type("Precio", "1500");
    await click("Añadir presentación");
    expect(memory.state.tables.product_presentations).toMatchObject([{ product_id: "arveja", name: "Lata 300 g", base_quantity: 1, sale_price: 1500 }]);
    expect(text()).not.toContain("Este producto no tiene presentaciones activas");
    const updated = [...container.querySelectorAll("option")].find((o) => o.value === "arveja");
    expect(updated?.textContent).toBe("Arveja");
  });
});
