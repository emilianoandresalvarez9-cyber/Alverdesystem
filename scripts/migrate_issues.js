const fs = require("fs");
const { execSync } = require("child_process");

const issues = [
  { title: "T-03: Prueba en condiciones reales (QA)", body: "**Criterio de aceptación:** Planilla con cada paso, resultado y captura: escanear código de fabricante y código interno, vender por peso, vender sin internet, apagar la notebook de golpe con ventas pendientes, reconectar y ver que llegó cada venta una sola vez, cerrar turno y abrir el respaldo descargado." },
  { title: "T-04: Primer corrida del CI nuevo en GitHub", body: "**Criterio de aceptación:** Enlace al run verde de los 3 jobs sobre `main`." },
  { title: "T-05: Proteger main en GitHub", body: "**Criterio de aceptación:** Captura de la regla activa." },
  { title: "T-06: Reportes en el servidor", body: "**Criterio de aceptación:** Funciones SQL agregadas por día, producto y rubro; el navegador recibe solo totales. Test pgTAP con ventas conocidas que verifica cada total. Cero `any` en `src/modules/reports`." },
  { title: "T-07: Service Worker que precachea los assets", body: "**Criterio de aceptación:** Manifest generado en el build y precacheado en `install`. Prueba: instalar, cortar red, recargar cada página." },
  { title: "T-08: Sincronización con reintentos espaciados y corte ante error de red", body: "**Criterio de aceptación:** Test unitario con un cliente simulado: un error de red detiene el lote sin marcar el resto; los reintentos crecen hasta un máximo." },
  { title: "T-09: Restaurar un respaldo y guardarlo fuera de la notebook", body: "**Criterio de aceptación:** Restaurar el JSON del cierre en un equipo limpio devuelve la cola pendiente; prueba documentada de restauración completa de la base." },
  { title: "T-10: Precios y actualización masiva", body: "**Criterio de aceptación:** Tests de la regla de precio (incluido redondeo) y pgTAP del historial. Los costos nunca llegan a Empleado (test con rol empleado)." },
  { title: "T-11: Anular una venta devuelve el stock", body: "**Criterio de aceptación:** pgTAP: vender, anular, verificar lotes y saldo del cliente." },
  { title: "T-12: Proveedores y panel de márgenes", body: "**Criterio de aceptación:** ABM funcional; test de RLS que muestra que un empleado no lee costos." },
  { title: "T-13: Alta de clientes sin conexión", body: "**Criterio de aceptación:** Nuevo tipo de operación offline con id generado en el equipo; test de idempotencia." },
  { title: "T-14: Exportar cualquier tabla a Excel", body: "**Criterio de aceptación:** Exportación de ventas, lotes y clientes, respetando RNF-04 para Empleado." },
  { title: "T-15: Pruebas E2E automatizadas (Playwright)", body: "**Criterio de aceptación:** Suite en CI con Supabase local." },
  { title: "T-16: Generador de códigos internos", body: "**Criterio de aceptación:** Secuencia en la base para el número interno; test de 1000 códigos sin repetir; error visible si falla el guardado. Nunca usa el prefijo 29." },
  { title: "T-17: Alta y edición de productos y presentaciones desde Administración", body: "**Criterio de aceptación:** ABM con archivado (RF-56), historial de precios (RF-27) y tests de RLS." },
  { title: "T-P2-01: Quitar 'any' restantes", body: "Limpiar `CounterBulkSheet`, `fullBackup`, etc." },
  { title: "T-P2-02: Renombrar integration.test.ts y mover E2E", body: "`src/integration.test.ts` prueba solo `allocateByFefo` en TypeScript: renombrarlo y mover los flujos reales a E2E." },
  { title: "T-P2-03: Revisar rendimiento de transiciones", body: "Revisar que las transiciones (RNF-07/08) y el desenfoque no generen lag en la notebook de la caja." }
];

async function run() {
  for (const issue of issues) {
    try {
      execSync(`gh issue create --title "${issue.title}" --body "${issue.body}" --repo emilianoandresalvarez9-cyber/Alverdesystem`);
      console.log(`Created: ${issue.title}`);
    } catch(e) {
      console.log(`Failed for ${issue.title}, you might need to use fetch/api. Error: ${e.message}`);
      break;
    }
  }
}
run();
