import { describe, expect, it } from "vitest";
import { jsonToCSV } from "./export";

describe("jsonToCSV (RF-43, C-02): CSV que Excel en español abre en columnas", () => {
  const csv = jsonToCSV([
    { id: 1, name: "Almacén \"El Brote\"", price: 1500.5, note: null, tags: ["a", "b"] },
    { id: 2, name: "Yerba; con punto y coma", price: 0, note: "línea 1\nlínea 2", tags: null }
  ]);

  it("empieza con la marca BOM, para que los acentos se lean como UTF-8", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("separa columnas con punto y coma y filas con CRLF", () => {
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe('"id";"name";"price";"note";"tags"');
    expect(lines).toHaveLength(3); // el salto de línea dentro de una celda (\n) no parte la fila
    expect(csv).not.toMatch(/","/);
  });

  it("escapa comillas, conserva el punto y coma dentro de la celda y deja vacíos los nulos", () => {
    const body = csv.slice(1);
    expect(body).toContain('"1";"Almacén ""El Brote""";"1500.5";"";"[""a"",""b""]"');
    expect(body).toContain('"2";"Yerba; con punto y coma";"0";"línea 1\nlínea 2";""');
  });

  it("sin filas devuelve vacío", () => {
    expect(jsonToCSV([])).toBe("");
  });
});
