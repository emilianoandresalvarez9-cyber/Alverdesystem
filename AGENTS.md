# Alverde — reglas de trabajo

- Leer completo \`requisitos-sistema-dietetica.md\` antes de implementar una tarea.
- Trabajar solo en una rama de tarea y abrir un Pull Request hacia \`main\`; no escribir directamente en \`main\`.
- No exponer costos, márgenes, multiplicadores, claves ni secretos en rutas, vistas o cachés para Empleado.
- Mantener las operaciones offline como eventos con \`localId\` idempotente: no sobrescribirlas ni descartarlas si falla la sincronización.
- Cada cambio debe incluir una prueba o una verificación concreta y un commit pequeño, descriptivo y vinculado a los RF/RNF que cubre.
