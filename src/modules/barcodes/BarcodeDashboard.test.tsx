// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** product_presentations en memoria, con el producto embebido como lo devuelve PostgREST. */
const db = vi.hoisted(() => {
  type Row = { id: string; name: string; active: boolean; internal_barcode: string | null; product: Record<string, unknown> };
  const state = { rows: [] as Row[], seq: 1000 };
  const query = (table: string) => {
    let patch: Partial<Row> | null = null;
    const filters: ((row: Row) => boolean)[] = [];
    const builder = {
      select: () => builder,
      update: (values: Partial<Row>) => { patch = values; return builder; },
      eq: (column: string, value: unknown) => { filters.push((row) => (row as Record<string, unknown>)[column] === value); return builder; },
      is: (column: string, value: unknown) => { filters.push((row) => (row as Record<string, unknown>)[column] === value); return builder; },
      in: () => builder,
      then: <T,>(resolve: (value: { data: unknown; error: null }) => T) => {
        if (table !== "product_presentations") return Promise.resolve({ data: [], error: null }).then(resolve);
        const matched = state.rows.filter((row) => filters.every((f) => f(row)));
        if (patch) matched.forEach((row) => Object.assign(row, patch));
        return Promise.resolve({ data: matched.map((row) => ({ ...row })), error: null }).then(resolve);
      }
    };
    return builder;
  };
  const client = {
    from: (table: string) => query(table),
    rpc: async () => ({ data: ++state.seq, error: null })
  };
  return { state, client };
});

vi.mock("../../shared/supabase/client", () => ({ getSupabase: () => db.client, SQL_NULL: null }));

const { BarcodeDashboard } = await import("./BarcodeDashboard");

const product = (base_unit: string, manufacturer_barcode: string | null = null) => ({ base_unit, manufacturer_barcode, active: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  db.state.seq = 1000;
  db.state.rows = [
    { id: "lentejas", name: "Lentejas granel", active: true, internal_barcode: null, product: product("gram") },
    { id: "aceite", name: "Aceite suelto", active: true, internal_barcode: null, product: product("millilitre") },
    { id: "budin", name: "Budín casero", active: true, internal_barcode: null, product: product("unit") },
    { id: "mayonesa", name: "mayonesa 500g", active: true, internal_barcode: null, product: product("unit", "7791866001364") },
    { id: "chia", name: "Chía granel", active: true, internal_barcode: "2000000009991", product: product("gram") }
  ];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<BarcodeDashboard />); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`No está el botón «${text}»`);
  await act(async () => { button.click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const codeOf = (id: string) => db.state.rows.find((row) => row.id === id)?.internal_barcode;

describe("Códigos internos: generar los que faltan (RF-20)", () => {
  it("genera para granel en gramos y mililitros y para lo elaborado sin código del fabricante", async () => {
    await click("Códigos internos");
    await click("Generar los códigos que faltan");

    expect(codeOf("lentejas")).toMatch(/^20\d{11}$/);
    expect(codeOf("aceite")).toMatch(/^20\d{11}$/);
    expect(codeOf("budin")).toMatch(/^20\d{11}$/);
    expect(new Set([codeOf("lentejas"), codeOf("aceite"), codeOf("budin")]).size).toBe(3);
    expect(container.textContent).toContain("Se generaron 3 códigos nuevos.");
  });

  it("no toca lo que se escanea con el código del fabricante ni lo que ya tiene código", async () => {
    await click("Códigos internos");
    await click("Generar los códigos que faltan");

    expect(codeOf("mayonesa")).toBeNull();
    expect(codeOf("chia")).toBe("2000000009991");
  });
});
