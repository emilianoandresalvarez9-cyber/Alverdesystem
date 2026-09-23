## 📦 FASE 3 — PRÓXIMO OBJETIVO: CAJA, OFFLINE Y BACKUPS

La Fase 3 es la etapa más sensible y se enfocará en el módulo de ventas de salón (Punto de Venta/Caja), robustez en la sincronización offline y persistencia de seguridad. No iniciar el desarrollo de la Fase 3 hasta que los Pull Requests de los Agentes F y G de la Fase 2 sean aprobados y fusionados a main.

| Agente | Qué construye | RFs asociados | QA / Criterio de aceptación |
|---|---|---|---|
| **H - Ventas y caja** | Punto de venta, carrito, medios de pago | RF-31 a RF-33 | El cierre de caja separa bien el total por medio de pago. Con la balanza sin conectar, ingresar el peso a mano calcula el importe correcto. |
| **I - Modo offline y sincronización** | Resiliencia extrema offline y colas de trabajo | RF-34 a RF-40 | Apagar la notebook de golpe con operaciones pendientes no pierde ninguna al reiniciar. Ventas simultáneas offline no se pisan. |
| **J - Backups** | Copias de seguridad automáticas de PouchDB/Local | RF-41 a RF-44 | Restaurar una copia de seguridad completa devuelve los datos. El backup automático corre solo al cerrar caja. |
| **K - Clientes y fiado** | Cuentas corrientes y deudores | RF-45 a RF-48 | Un fiado y un pago posterior actualizan bien el saldo. Funciona sin conexión y se sincroniza después. |

