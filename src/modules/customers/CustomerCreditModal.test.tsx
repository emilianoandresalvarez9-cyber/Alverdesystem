import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerCreditModal } from "./CustomerCreditModal";
import type { CustomerAccount } from "./types";

const account: CustomerAccount = {
  id: "c1", name: "Marta Rossi", phone: null, credit_limit: 50000, active: true, balance: 12300, last_movement_at: null
} as CustomerAccount;

const render = (isAdmin: boolean) =>
  renderToStaticMarkup(<CustomerCreditModal account={account} isAdmin={isAdmin} onClose={() => {}} onChanged={() => {}} />);

describe("Cuenta del cliente", () => {
  it("resume saldo, tope y teléfono arriba del detalle", () => {
    const html = render(false);
    expect(html).toContain("Cuenta de Marta Rossi");
    expect(html).toMatch(/kpi__etiqueta">Saldo<\/p><p class="kpi__valor">\$12\.300/);
    expect(html).toMatch(/kpi__etiqueta">Tope<\/p><p class="kpi__valor">\$50\.000/);
    expect(html).toContain("Sin teléfono");
  });

  it("RF-48 y RF-47: el empleado registra abonos y fiados, pero no ajusta deuda ni toca el tope", () => {
    const html = render(false);
    expect(html).toMatch(/value="payment"/);
    expect(html).toMatch(/value="charge"/);
    expect(html).not.toMatch(/value="adjustment"/);
    expect(html).not.toContain("Guardar tope");
  });

  it("la administradora además ajusta y define el tope", () => {
    const html = render(true);
    expect(html).toMatch(/value="adjustment"/);
    expect(html).toContain("Guardar tope");
  });
});
