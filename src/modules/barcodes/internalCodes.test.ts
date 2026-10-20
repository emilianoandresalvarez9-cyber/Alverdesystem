import { describe, expect, it } from "vitest";
import { needsInternalCode, type InternalCodeCandidate } from "./internalCodes";

const presentation = (product: InternalCodeCandidate["product"], extra: Partial<InternalCodeCandidate> = {}): InternalCodeCandidate =>
  ({ active: true, internal_barcode: null, product, ...extra });

describe("RF-20: qué presentaciones necesitan código interno", () => {
  it("granel en gramos y en mililitros", () => {
    expect(needsInternalCode(presentation({ base_unit: "gram", manufacturer_barcode: null, active: true }))).toBe(true);
    expect(needsInternalCode(presentation({ base_unit: "millilitre", manufacturer_barcode: null, active: true }))).toBe(true);
  });

  it("lo elaborado por unidad sin código del fabricante", () => {
    expect(needsInternalCode(presentation({ base_unit: "unit", manufacturer_barcode: null, active: true }))).toBe(true);
  });

  it("no lo de terceros por unidad: se escanea con el código del fabricante (RF-19)", () => {
    expect(needsInternalCode(presentation({ base_unit: "unit", manufacturer_barcode: "7791866001364", active: true }))).toBe(false);
  });

  it("no lo que ya tiene código ni lo archivado", () => {
    expect(needsInternalCode(presentation({ base_unit: "gram", manufacturer_barcode: null, active: true }, { internal_barcode: "2000000010010" }))).toBe(false);
    expect(needsInternalCode(presentation({ base_unit: "gram", manufacturer_barcode: null, active: false }))).toBe(false);
    expect(needsInternalCode(presentation({ base_unit: "gram", manufacturer_barcode: null, active: true }, { active: false }))).toBe(false);
    expect(needsInternalCode(presentation(null))).toBe(false);
  });
});
