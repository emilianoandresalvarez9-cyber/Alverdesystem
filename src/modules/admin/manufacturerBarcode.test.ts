import { describe, expect, it } from "vitest";
import { normalizeManufacturerBarcode } from "./manufacturerBarcode";

describe("código de barras de fabricante", () => {
  it("conserva los ceros iniciales del código escaneado", () => {
    expect(normalizeManufacturerBarcode(" 0012345678905 ")).toBe("0012345678905");
  });

  it("guarda null cuando el producto no tiene código", () => {
    expect(normalizeManufacturerBarcode("   ")).toBeNull();
  });
});
