import { describe, expect, it } from "vitest";
import { normalizeManufacturerBarcode } from "./manufacturerBarcode";

describe("código de barras del fabricante (RF-19)", () => {
  it("recorta espacios y conserva el código como texto, incluidos ceros iniciales", () => {
    expect(normalizeManufacturerBarcode(" 0012345678905\n")).toBe("0012345678905");
  });

  it("convierte el campo vacío en null para poder quitar un código guardado", () => {
    expect(normalizeManufacturerBarcode("   ")).toBeNull();
  });
});
