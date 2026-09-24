const fs = require('fs');
let code = fs.readFileSync('TAREAS.md', 'utf8');

code = code.replace(
  '> **Este repositorio estǭ listo para release y NO tiene bloqueantes P0 activos.**',
  '> **Estado:** Pendiente de Validación QA Manual en Entorno Real y CI Verde Consistente.\n> *Nota: Se han mitigado todos los issues P0 y P1 detectados, pero requieren validación física y E2E completa.*'
);

code = code.replace(
  '> Todas las tareas pendientes del proyecto, as como las resoluciones de los bloqueos tǸcnicos y deuda tǸcnica, han sido COMPLETADAS.',
  '> Las deudas técnicas y bloqueantes P0/P1 han sido parcheados, listos para revisión.'
);

// Remove any mention of "Todas las tareas desde T-01 hasta T-17 han sido implementadas" if it implies they are fully accepted
code = code.replace(
  'Todas las tareas desde **T-01 hasta T-17** han sido implementadas, sometidas a pruebas automatizadas (pgTAP/Vitest/Playwright), y fusionadas a la rama `main` en GitHub.',
  'Las tareas desde **T-01 hasta T-17** han sido desarrolladas y enviadas a `main`, pendientes de aprobación en condiciones reales.'
);

fs.writeFileSync('TAREAS.md', code);
