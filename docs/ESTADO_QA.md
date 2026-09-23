# Estado General del Proyecto Alverde (Auditoría de Integración)

Este es el estado de cada fase asumiendo la integración de los PRs actuales:

| Fase | Estado | Qué falta para cerrarla |
|---|---|---|
| **0 · Cimientos** | Casi cerrada | Correr por primera vez en GitHub el CI de base de datos contra Supabase real (T-04). Sin el PR-02, ni siquiera se podía iniciar sesión en local. |
| **1 · Catálogo** | Mayormente cumplida | Probar las transiciones y el desenfoque en la notebook real. Verificar dos criterios que nadie probó: asignar una etiqueta a varios productos en una sola acción, y filtrar el historial por persona, producto y fecha. Los faltantes recién existen con el PR-07. |
| **2 · Stock y lotes** | Parcial | Hacer atómico el fraccionamiento, porque hoy puede dejar el stock a medias (T-01). Leer los códigos impresos con el Nictom. Corregir el generador de códigos que puede repetir (T-16). Probar que archivar un producto no rompe sus ventas. |
| **3 · Caja** | Parcial | Restaurar un backup (RF-44) y guardarlo fuera de la notebook (RF-42), que no existen. Hacer la prueba de apagar la notebook de golpe y la de dos cajas vendiendo sin conexión. |
| **4 · Escalabilidad y reportes** | Parcial | Calcular los reportes en el servidor (T-06) y hacer el reetiquetado por cambio de precio (RF-30, T-10). Agregar cajas sin tocar código ya funciona (PR-08). |

## Lo que sí quedó cumplido y probado con tests
* **Caja:** el cierre separa totales por medio de pago, y el peso ingresado a mano calcula bien el importe.
* **Fiado:** un fiado y un abono actualizan el mismo saldo, y el fiado se registra sin conexión.
* **FEFO:** la venta descuenta primero del lote que vence antes.
* **Seguridad:** el empleado no ve costos ni manipulando la URL.
* **Faltantes:** se marcan desde el celular en 2 toques.
* **Cajas:** se agregan con un alta de datos, sin tocar código.

## QA de integración entre módulos (6 chequeos del documento)
* **Cubiertos:** la venta descuenta del lote correcto, y el fiado de la caja más el pago posterior afectan un mismo saldo. Este último está probado en dos tests, no en uno solo que haga los dos pasos.
* **Pendientes:** archivar un producto sin romper ventas, que un producto nuevo aparezca en faltantes y reportes, que el historial refleje cambios de todos los módulos, y que una etiqueta nueva aparezca en el filtro de reportes.

## Aclaración sobre la numeración
La sección 8 del documento llama "Fase 0" al relevamiento con la dueña. Esa sí puede darse por cerrada: el documento dice que no quedan preguntas, y lo único abierto era cómo manejar el granel, que definimos juntos en el PR-10.
La fase más cerca de cerrarse es la 0 de construcción: solo le falta la primera corrida del CI en GitHub, que ocurre sola al abrir el PR-01. Después conviene hacer una sola prueba en la notebook real, que sirve para validar a la vez los criterios de hardware de las fases 1, 2 y 3.
