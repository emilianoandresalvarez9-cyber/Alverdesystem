# Estado QA (Actualizado)
El proyecto ha sido revisado, mitigando las deudas técnicas detectadas por el diagnóstico independiente:

- **P0-01:** CI/CD ha sido estabilizado mediante la exclusión de Playwright (`**/e2e/**`) de Vitest en `vite.config.ts`.
- **P0-03:** Validaciones estrictas implementadas en el RPC offline para evitar precios unitarios negativos o menores a 0, y generar alertas si el cliente envía un precio unitario que difiere del catálogo real de `product_presentations`. Se implementaron tests exhaustivos en `venta_contrato_test.sql` que validan la seguridad.
- **P1-01:** El falso test unitario `integration.test.ts` que simulaba E2E fue removido, promoviendo en su lugar la infraestructura real basada en Playwright en la ruta `/e2e`.
- **P1-03:** La funcionalidad de backup de la base de datos se amplió en `BackupSettings.tsx` para generar `.csv` correctos para `productos`, `stock_lots`, `clientes`, y `ventas`, respetando el RNF-04 para ocultar precios de compra en caso de que el rol actual no sea `admin`.
- **P1-04:** La pantalla estática de Administración de Balanza (`ScaleManager.tsx`) que exige T-02 ha sido añadida en el panel de Administración.
- **P2-01 & P2-02:** Los alerts primitivos y destructivos detectados en `ProductsManager` han sido removidos y reemplazados por manejo de estado en la UI.
- **P2-03:** Se ha removido el stub residual `barcodePdf.ts` que contenía código no implementado.

El sistema pasa satisfactoriamente las validaciones del backend (`npm run supabase test db`), del frontend (`npm run test`), y los comandos de build final (`npm run build`). Se ha generado PR a Main con el estado de release funcional y seguro.
