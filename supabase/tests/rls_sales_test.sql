BEGIN;
SELECT plan(6);

-- Setup: Create a test employee 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'emp1@example.com');
UPDATE public.profiles SET role = 'employee' WHERE id = '00000000-0000-0000-0000-000000000001';

-- Setup: Create a test employee 2
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'emp2@example.com');
UPDATE public.profiles SET role = 'employee' WHERE id = '00000000-0000-0000-0000-000000000002';

-- Setup: Create an admin
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000003', 'admin@example.com');
UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-000000000003';

-- Pre-requisites: Insert a branch and a register
INSERT INTO public.branches (id, name) VALUES ('00000000-0000-0000-0000-000000000010', 'Central');
INSERT INTO public.registers (id, branch_id, name) VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'Caja 1');

-- La venta de Emp 1 se crea como postgres: desde 20260923100000 los empleados no
-- insertan ventas directo (van por process_offline_sale). Acá se prueba solo la visibilidad.
INSERT INTO public.cash_shifts (id, register_id, user_id) VALUES ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.sales (id, local_id, user_id, payment_method, occurred_at, shift_id) VALUES ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', 'cash', now(), '00000000-0000-0000-0000-000000000030');

-- Switch to emp 1
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;

SELECT results_eq('SELECT count(*)::int FROM public.sales', ARRAY[1::int], 'Emp 1 puede ver su venta');

SELECT throws_ok('INSERT INTO public.sales (id, local_id, user_id, payment_method, occurred_at, shift_id) VALUES (''00000000-0000-0000-0000-000000000041'', ''00000000-0000-0000-0000-000000000041'', ''00000000-0000-0000-0000-000000000001'', ''cash'', now(), ''00000000-0000-0000-0000-000000000030'')', '42501', NULL, 'Emp 1 NO puede insertar ventas directo, ni a su nombre');

SELECT throws_ok('INSERT INTO public.sales (id, local_id, user_id, payment_method, occurred_at, shift_id) VALUES (''00000000-0000-0000-0000-000000000042'', ''00000000-0000-0000-0000-000000000042'', ''00000000-0000-0000-0000-000000000002'', ''cash'', now(), ''00000000-0000-0000-0000-000000000030'')', '42501', NULL, 'Emp 1 NO puede crear una venta a nombre de Emp 2');

-- Switch to emp 2
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

SELECT results_eq('SELECT count(*)::int FROM public.sales', ARRAY[0::int], 'Emp 2 NO puede ver las ventas de Emp 1');

-- Switch to admin
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SET role authenticated;

SELECT results_eq('SELECT count(*)::int FROM public.sales', ARRAY[1::int], 'Admin puede ver todas las ventas');
SELECT lives_ok('UPDATE public.sales SET status = ''voided'' WHERE id = ''00000000-0000-0000-0000-000000000040''', 'Admin puede anular ventas');

-- Cleanup
RESET role;
SELECT * FROM finish();
ROLLBACK;
