import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VoidSaleDialog } from "./SalesHistory";

describe("RF-37: anular una venta pide confirmación", () => {
  const sale = { id: "s1", local_id: "c1a2b3c4-0000-0000-0000-000000000000", occurred_at: "2026-10-09T19:38:00Z",
    total_amount: 4200, status: "closed", payment_method: "cash" } as const;
  const html = renderToStaticMarkup(<VoidSaleDialog sale={sale} busy={false} onCancel={() => {}} onConfirm={() => {}} />);

  it("pregunta en el título, con la venta, el medio y el total", () => {
    expect(html).toContain("¿Anular la venta c1a2b3c4?");
    expect(html).toContain("Efectivo");
    expect(html).toContain("$4.200");
  });

  it("dice que no se puede deshacer y qué pasa con el stock y el fiado", () => {
    expect(html).toMatch(/mensaje mensaje--error.*no se puede deshacer/);
    expect(html).toContain("El stock vuelve a los lotes");
  });

  it("Cancelar es la salida suave; Anular venta va en peligro relleno", () => {
    expect(html).toMatch(/boton boton--fantasma"[^>]*>Cancelar/);
    expect(html).toMatch(/boton boton--peligro boton--confirmar"[^>]*>Anular venta/);
  });
});
