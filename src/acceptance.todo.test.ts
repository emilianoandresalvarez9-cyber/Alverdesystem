import { describe, it } from "vitest";

// Criterios de aceptación transversales (requisitos, sección de agentes H, I y K).
// Antes eran aserciones constantes (siempre verdaderas) y figuraban como aprobados sin probar nada.
// Quedan como pendientes visibles en la salida de Vitest hasta que exista un test real
// (pgTAP en supabase/tests o E2E). Reemplazar cada `it.todo` por el test que lo cubre.
// Ya cubierto: "una venta offline descuenta stock por FEFO" → supabase/tests/venta_contrato_test.sql.
describe("Aceptación transversal (pendiente de test real)", () => {
  it.todo("Un fiado y un pago posterior actualizan el mismo saldo sin duplicar");
  it.todo("Archivar un producto no rompe las ventas históricas");
});
