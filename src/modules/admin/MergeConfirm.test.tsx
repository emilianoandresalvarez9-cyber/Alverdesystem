import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MergeConfirm } from "./ClassifierManager";

describe("RF-03: Unir con… pide confirmación con los dos nombres", () => {
  const html = renderToStaticMarkup(<MergeConfirm from="Granix" into="Granix S.A." busy={false} onCancel={() => {}} onConfirm={() => {}} />);

  it("la pregunta en el título y la consecuencia escrita", () => {
    expect(html).toContain("¿Unir «Granix» con «Granix S.A.»?");
    expect(html).toMatch(/mensaje mensaje--error.*No se puede deshacer.*queda archivada/);
  });

  it("la acción en peligro relleno, Cancelar fantasma", () => {
    expect(html).toMatch(/boton boton--peligro boton--confirmar"[^>]*>Unir</);
    expect(html).toMatch(/boton boton--fantasma"[^>]*>Cancelar/);
  });

  it("ya no usa la ventanita del navegador", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/modules/admin/ClassifierManager.tsx", "utf8")).not.toContain("window.confirm");
  });
});
