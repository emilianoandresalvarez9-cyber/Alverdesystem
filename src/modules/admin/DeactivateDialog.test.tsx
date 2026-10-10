import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeactivateDialog } from "./BranchesManager";

describe("RF-59: dar de baja pide confirmación", () => {
  const html = renderToStaticMarkup(<DeactivateDialog name="Tomás Ríos" busy={false} onCancel={() => {}} onConfirm={() => {}} />);

  it("pregunta en el título con el nombre", () => {
    expect(html).toContain("¿Dar de baja a Tomás Ríos?");
  });

  it("dice qué deja de poder hacer, que lo registrado queda y que se puede volver a activar", () => {
    expect(html).toContain("Deja de poder entrar");
    expect(html).toContain("también donde tenga la sesión abierta");
    expect(html).toContain("Lo que ya registró (ventas, movimientos, fiado) queda");
    expect(html).toContain("se puede volver a activar");
  });

  it("Cancelar es la salida suave; Dar de baja va en peligro relleno", () => {
    expect(html).toMatch(/boton boton--fantasma"[^>]*>Cancelar/);
    expect(html).toMatch(/boton boton--peligro boton--confirmar"[^>]*>Dar de baja/);
  });
});
