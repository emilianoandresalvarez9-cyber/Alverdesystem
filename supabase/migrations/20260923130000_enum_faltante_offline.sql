-- Alverde · Nuevo tipo de operación offline para faltantes (RF-49).
-- Va solo en su archivo: un valor nuevo de enum no se puede usar en la misma transacción.
alter type public.offline_operation_kind add value if not exists 'missing_item';
