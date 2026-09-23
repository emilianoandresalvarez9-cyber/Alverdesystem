BEGIN;
SELECT plan(7);

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

-- Switch to emp 1
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;

-- Emp 1 opens a shift and creates a sale
SELECT lives_ok('INSERT INTO public.cash_shifts (id, register_id, user_id) VALUES (''00000000-0000-0000-0000-000000000030'', ''00000000-0000-0000-0000-000000000020'', ''00000000-0000-0000-0000-000000000001'')', 'Emp 1 puede abrir su propio turno');

SELECT lives_ok('INSERT INTO public.sales (id, local_id, user_id, payment_method, occurred_at, shift_id) VALUES (''00000000-0000-0000-0000-000000000040'', ''00000000-0000-0000-0000-000000000040'', ''00000000-0000-0000-0000-000000000001'', ''cash'', now(), ''00000000-0000-0000-0000-000000000030'')', 'Emp 1 puede crear una venta a su nombre');

SELECT results_eq('SELECT count(*)::int FROM public.sales', ARRAY[1::int], 'Emp 1 puede ver su venta');

-- Emp 1 attempts to insert a sale for Emp 2
SELECT throws_ok('INSERT INTO public.sales (id, local_id, user_id, payment_method, occurred_at, shift_id) VALUES (''00000000-0000-0000-0000-000000000041'', ''00000000-0000-0000-0000-000000000041'', ''00000000-0000-0000-0000-000000000002'', ''cash'', now(), ''00000000-0000-0000-0000-000000000030'')', '42501', 'new row violates row-level security policy for table "sales"', 'Emp 1 NO puede crear una venta a nombre de Emp 2');

-- Switch to emp 2
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

SELECT results_eq('SELECT count(*)::int FROM public.sales', ARRAY[0::int], 'Emp 2 NO puede ver las ventas de Emp 1');

-- Switch to admin
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SET role authenticated;

SELECT results_eq('SELECT count(*)::int FROM public.sales', ARRAY[1::int], 'Admin puede ver todas las ventas');
SELECT lives_ok('UPDATE public.sales SET total_amount = 1000 WHERE id = ''00000000-0000-0000-0000-000000000040''', 'Admin puede modificar ventas');

-- Cleanup
RESET role;
SELECT * FROM finish();
ROLLBACK;
