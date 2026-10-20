import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tablas en memoria que se comportan como PostgREST: cada pedido devuelve como mucho `maxRows`
 * filas (Supabase corta en 1000 por defecto) y respeta order + range.
 */
const server = vi.hoisted(() => {
  const state = { tables: {} as Record<string, Record<string, unknown>[]>, maxRows: 1000, requests: 0, failOn: "" };
  const client = {
    from(table: string) {
      const orders: string[] = [];
      let range: [number, number] = [0, Number.MAX_SAFE_INTEGER];
      const builder = {
        select: () => builder,
        order: (column: string) => { orders.push(column); return builder; },
        range: (from: number, to: number) => { range = [from, to]; return builder; },
        then: <T,>(resolve: (value: unknown) => T) => {
          state.requests += 1;
          if (table === state.failOn) return Promise.resolve({ data: null, error: { message: "permission denied" } }).then(resolve);
          const rows = [...(state.tables[table] ?? [])].sort((a, b) => {
            for (const column of orders) {
              const cmp = String(a[column]).localeCompare(String(b[column]));
              if (cmp !== 0) return cmp;
            }
            return 0;
          });
          const page = rows.slice(range[0], Math.min(range[1] + 1, range[0] + state.maxRows));
          return Promise.resolve({ data: page, error: null }).then(resolve);
        }
      };
      return builder;
    }
  };
  return { state, client };
});

vi.mock("../supabase/client", () => ({ getSupabase: () => server.client, SQL_NULL: null }));

const { fetchAllRows, generateFullBackup } = await import("./export");

const rows = (n: number, key = "id") => Array.from({ length: n }, (_, i) => ({ [key]: `r${String(i).padStart(5, "0")}`, n: i }));

beforeEach(() => {
  server.state.tables = {};
  server.state.maxRows = 1000;
  server.state.requests = 0;
  server.state.failOn = "";
});

describe("RF-41: el respaldo trae todas las filas, no sólo las primeras 1000", () => {
  it("una tabla de 2500 filas sale completa en la copia completa", async () => {
    server.state.tables.sale_items = rows(2500);
    const backup = await generateFullBackup();
    expect(backup.tables.sale_items).toHaveLength(2500);
    expect(new Set(backup.tables.sale_items?.map((row) => row.id)).size).toBe(2500);
  });

  it("también si el servidor corta en menos de lo que pide cada página", async () => {
    server.state.maxRows = 400;
    server.state.tables.audit_history = rows(1500);
    expect(await fetchAllRows(server.client as never, "audit_history")).toHaveLength(1500);
  });

  it("las tablas sin columna id se ordenan por su clave primaria", async () => {
    server.state.tables.product_labels = Array.from({ length: 1200 }, (_, i) => ({ product_id: `p${String(i).padStart(4, "0")}`, label_id: "vegano" }));
    const result = await fetchAllRows(server.client as never, "product_labels");
    expect(new Set(result.map((row) => row.product_id)).size).toBe(1200);
  });

  it("una tabla vacía no queda pidiendo páginas", async () => {
    expect(await fetchAllRows(server.client as never, "missing_items")).toEqual([]);
    expect(server.state.requests).toBe(1);
  });

  it("si una tabla falla, la copia falla nombrándola en vez de salir incompleta", async () => {
    server.state.failOn = "stock_movements";
    await expect(generateFullBackup()).rejects.toThrow("stock_movements: permission denied");
  });
});
