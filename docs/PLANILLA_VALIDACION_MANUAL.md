# Planilla de Validación Manual QA (Fase 4)

Este documento contiene los escenarios físicos y end-to-end requeridos por el equipo de QA (T-03) que no pueden ser verificados únicamente mediante CI o unit tests.

### Preparación del Entorno
- [ ] Ejecutar el entorno local conectando tanto el frontend como el backend (Supabase local).
- [ ] Disponer de un usuario Administrador y un usuario Empleado (creados desde auth/seed).

### Escenarios de Prueba

#### Autenticación y Autorización
- [ ] Iniciar sesión como `Administrador`.
- [ ] Iniciar sesión como `Empleado` (en pestaña incógnito o sesión separada).
- [ ] Verificar que el empleado NO tenga acceso a costos/margen de ganancia en el catálogo (RNF-04).
- [ ] Verificar que el empleado no pueda exportar el CSV de productos con el precio de compra visible (T-14).

#### Ventas y Catálogo
- [ ] Buscar y escanear (ingreso por input) un código de barras de un producto existente.
- [ ] Registrar venta normal pagando con efectivo.
- [ ] Registrar venta por peso (báscula manual, T-02) ingresando el gramaje; validar cálculo de precio final.
- [ ] Registrar una venta "fiada" a un cliente existente. Verificar que el monto impacte en el saldo de su cuenta corriente.
- [ ] Intentar enviar cantidad = 0 o importe negativo y comprobar que el sistema lo prohíbe.

#### Resiliencia y Modo Offline (T-03)
- [ ] Simular corte de red (apagar Wi-Fi o tildar `Offline` en DevTools).
- [ ] Registrar 3 ventas en modo offline.
- [ ] Apagar abruptamente la pestaña o el servidor local.
- [ ] Reabrir la aplicación (sin red).
- [ ] Comprobar que las 3 ventas pendientes siguen en la cola de sincronización.
- [ ] Restaurar la red. Comprobar que la cola se vacía progresivamente y las ventas impactan la DB.
- [ ] Comprobar idempotencia: intentar enviar dos veces el mismo request offline, la base de datos debe ignorar el duplicado.

#### Casos Límite y Conflictos Offline
- [ ] **Fraude de Precio (P0-03):** Interceptar el payload offline (usando Burp Suite o modificando el IndexedDB a mano) bajando el `unitPrice` de un producto a la mitad. Sincronizar.
- [ ] Verificar que la venta impacta (para no frenar la caja), pero que el sistema arroja una alerta automática de diferencia de precios en la tabla `stock_warnings`.
- [ ] **Conflicto Concurrente:** Dos cajas en modo offline venden la última unidad del mismo producto. Al sincronizar, la base de datos permite stock negativo pero levanta alerta (RF-38).

#### Backups y Restauración
- [ ] Cierre de caja. Descargar archivo de backup JSON local.
- [ ] Utilizar la vista de Configuración -> Respaldos para "Restaurar" el JSON guardado previamente.
- [ ] Comprobar que los lotes, precios y operaciones offline pendientes en ese dispositivo fueron recuperados.

### Aprobación Final
- **Firma QA Independiente:** ____________
- **Fecha:** ____________
- **Veredicto:** [APROBADO / RECHAZADO]
