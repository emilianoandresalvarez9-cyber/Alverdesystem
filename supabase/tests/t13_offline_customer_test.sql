BEGIN;
SELECT plan(4);

-- Setup: Create admin
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'admin_t13@test');
UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-000000000001';

-- Setup: Create employee
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'emp_t13@test');
UPDATE public.profiles SET role = 'employee' WHERE id = '00000000-0000-0000-0000-000000000002';

-- 1. Test employee inserting a customer with limit (should fail because employee cannot set limit)
-- Oh wait! In offline mode, the employee might try to set a limit. Let's see what the requirement is.
-- RF-47: Solo la administradora define el tope de fiado. 
-- So if an employee passes a limit, it should be rejected or ignored. In this test we verify that RLS or the RPC enforces it.

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

SELECT lives_ok(
    'SELECT public.sync_offline_customer(''11111111-1111-1111-1111-111111111111''::uuid, ''Cliente Offline'', ''123456'', NULL)',
    'Empleado puede sincronizar un cliente nuevo sin tope de credito'
);

SELECT throws_ok(
    'SELECT public.sync_offline_customer(''22222222-2222-2222-2222-222222222222''::uuid, ''Cliente Offline 2'', ''123456'', 5000)',
    '42501',
    NULL,
    'Empleado NO puede definir limite de credito al sincronizar cliente'
);

-- 2. Test idempotency
SELECT lives_ok(
    'SELECT public.sync_offline_customer(''11111111-1111-1111-1111-111111111111''::uuid, ''Cliente Offline Modificado'', ''123456'', NULL)',
    'Sincronizar dos veces el mismo ID (idempotencia) debe pasar sin error'
);

-- Verificar que el nombre NO se actualizó porque DO NOTHING
PREPARE check_idempotency AS SELECT name FROM public.customers WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT results_eq('check_idempotency', ARRAY['Cliente Offline'::text], 'La idempotencia usa DO NOTHING (no sobreescribe)');

SELECT * FROM finish();
ROLLBACK;
