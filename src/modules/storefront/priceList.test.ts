import { describe, expect, it } from "vitest";
import {
  EMPTY_PRICE_FILTERS,
  availabilityBadge,
  categoriesOf,
  changedPresentations,
  countText,
  filterProducts,
  groupProducts,
  parseAvailability,
  priceText,
  updatedLabel,
  type PriceRow
} from "./priceList";

const row = (patch: Partial<PriceRow>): PriceRow => ({
  presentation_id: "c1", product_id: "f1", product_name: "Almendras", brand_name: "Del local", category_name: "Frutos secos",
  presentation_name: "Bolsa 250 g", sold_by_weight: false, price: 4000, availability: "disponible", ...patch
});

const rows: PriceRow[] = [
  row({}),
  row({ presentation_id: "c2", presentation_name: "Granel", sold_by_weight: true, price: "14.80", availability: "ultimas" }),
  row({ presentation_id: "c3", product_id: "f2", product_name: "Café molido", brand_name: null, category_name: "Infusiones", presentation_name: "Frasco 200 g", price: 6100, availability: "sin_stock" }),
  row({ presentation_id: "c4", product_id: "f3", product_name: "Yerba", brand_name: "", category_name: null, presentation_name: "Paquete", price: 3200, availability: "disponible" })
];

describe("groupProducts", () => {
  it("agrupa las presentaciones por producto y conserva el orden de la base", () => {
    const products = groupProducts(rows);
    expect(products.map((p) => p.name)).toEqual(["Almendras", "Café molido", "Yerba"]);
    expect(products[0]!.presentations.map((p) => p.name)).toEqual(["Bolsa 250 g", "Granel"]);
    expect(products[0]!.presentations[1]).toEqual({ id: "c2", name: "Granel", soldByWeight: true, price: 14.8, availability: "ultimas" });
  });

  it("marca y rubro vacíos quedan en null, y descarta precios inválidos o en cero", () => {
    const products = groupProducts([...rows, row({ presentation_id: "c9", product_id: "f9", price: 0 }), row({ presentation_id: "c8", product_id: "f8", price: "x" })]);
    expect(products.find((p) => p.id === "f3")).toMatchObject({ brand: null, category: null });
    expect(products.some((p) => p.id === "f9" || p.id === "f8")).toBe(false);
  });
});

describe("parseAvailability", () => {
  it("un valor desconocido no promete stock", () => {
    expect(parseAvailability("disponible")).toBe("disponible");
    expect(parseAvailability("ultimas")).toBe("ultimas");
    expect(parseAvailability("sin_stock")).toBe("sin_stock");
    expect(parseAvailability("muchisimo")).toBe("sin_stock");
    expect(parseAvailability(null)).toBe("sin_stock");
  });
});

describe("filterProducts", () => {
  const products = groupProducts(rows);

  it("busca sin acentos ni mayúsculas, por producto, marca, rubro o presentación", () => {
    expect(filterProducts(products, { ...EMPTY_PRICE_FILTERS, search: "CAFE" }).map((p) => p.name)).toEqual(["Café molido"]);
    expect(filterProducts(products, { ...EMPTY_PRICE_FILTERS, search: "del local" }).map((p) => p.name)).toEqual(["Almendras"]);
    expect(filterProducts(products, { ...EMPTY_PRICE_FILTERS, search: "frasco" }).map((p) => p.name)).toEqual(["Café molido"]);
    expect(filterProducts(products, { ...EMPTY_PRICE_FILTERS, search: "almendras granel" })).toHaveLength(1);
    expect(filterProducts(products, { ...EMPTY_PRICE_FILTERS, search: "almendras frasco" })).toHaveLength(0);
  });

  it("filtra por rubro", () => {
    expect(filterProducts(products, { ...EMPTY_PRICE_FILTERS, category: "Infusiones" }).map((p) => p.name)).toEqual(["Café molido"]);
  });

  it("«sólo con stock» quita las presentaciones agotadas y los productos que quedan vacíos", () => {
    const available = filterProducts(products, { ...EMPTY_PRICE_FILTERS, onlyAvailable: true });
    expect(available.map((p) => p.name)).toEqual(["Almendras", "Yerba"]);
    expect(products).toHaveLength(3); // no modifica la lista original
  });

  it("sin filtros devuelve todo", () => {
    expect(filterProducts(products, EMPTY_PRICE_FILTERS)).toHaveLength(3);
  });
});

describe("textos", () => {
  it("rubros en orden alfabético y sin repetir", () => {
    expect(categoriesOf(groupProducts(rows))).toEqual(["Frutos secos", "Infusiones"]);
  });

  it("precio por unidad, y por kilo en balanza (la base guarda por gramo)", () => {
    expect(priceText({ price: 4000, soldByWeight: false })).toBe("$4.000");
    expect(priceText({ price: 14.8, soldByWeight: true })).toBe("$14.800/kg");
    expect(priceText({ price: 3200.5, soldByWeight: false })).toBe("$3.200,50");
  });

  it("la disponibilidad se dice con palabras; en balanza no habla de unidades", () => {
    expect(availabilityBadge({ availability: "disponible", soldByWeight: false })).toEqual({ text: "Disponible", tone: "exito" });
    expect(availabilityBadge({ availability: "ultimas", soldByWeight: false })).toEqual({ text: "Últimas unidades", tone: "aviso" });
    expect(availabilityBadge({ availability: "ultimas", soldByWeight: true })).toEqual({ text: "Queda poco", tone: "aviso" });
    expect(availabilityBadge({ availability: "sin_stock", soldByWeight: true })).toEqual({ text: "Sin stock", tone: "neutro" });
  });

  it("hace cuánto se actualizó", () => {
    const t = 1_000_000;
    expect(updatedLabel(t, t + 20_000)).toBe("Actualizado recién");
    expect(updatedLabel(t, t + 60_000)).toBe("Actualizado hace 1 minuto");
    expect(updatedLabel(t, t + 12 * 60_000)).toBe("Actualizado hace 12 minutos");
    expect(updatedLabel(t, t + 3 * 3_600_000)).toBe("Actualizado hace más de una hora");
    expect(updatedLabel(t, t - 5_000)).toBe("Actualizado recién"); // reloj del equipo atrasado
  });

  it("cuenta de productos", () => {
    expect(countText(1, 1)).toBe("1 producto");
    expect(countText(7, 7)).toBe("7 productos");
    expect(countText(2, 7)).toBe("2 productos de 7");
  });
});

describe("changedPresentations", () => {
  const before = groupProducts(rows);

  it("la primera lista no resalta nada", () => {
    expect(changedPresentations(null, before).size).toBe(0);
  });

  it("detecta cambio de precio y de disponibilidad; lo nuevo y lo igual no se resaltan", () => {
    const after = groupProducts([
      row({ price: 4300 }),
      row({ presentation_id: "c2", presentation_name: "Granel", sold_by_weight: true, price: "14.80", availability: "sin_stock" }),
      row({ presentation_id: "c3", product_id: "f2", product_name: "Café molido", price: 6100, availability: "sin_stock" }),
      row({ presentation_id: "c7", product_id: "f7", product_name: "Nuevo", price: 100 })
    ]);
    expect([...changedPresentations(before, after)].sort()).toEqual(["c1", "c2"]);
  });
});
