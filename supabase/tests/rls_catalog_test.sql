BEGIN;
SELECT plan(7);

-- Setup: Create a test employee
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test_employee@example.com');
UPDATE public.profiles SET role = 'employee' WHERE id = '00000000-0000-0000-0000-000000000001';

-- Setup: Create a test admin
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'test_admin@example.com');
UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-000000000002';

-- Create a valid brand and product for testing
INSERT INTO public.brands (id, name) VALUES ('00000000-0000-0000-0000-000000000100', 'Test Brand');
INSERT INTO public.products (id, brand_id, name, base_unit) VALUES ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000100', 'Test Product', 'unit'::public.base_unit);

-- Switch to employee
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;

SELECT lives_ok('SELECT * FROM public.brands', 'Employee can read brands');
SELECT results_eq('SELECT count(*)::int FROM public.products', ARRAY[0::int], 'Employee CANNOT read products directly (returns 0 rows due to RLS)');
SELECT lives_ok('SELECT * FROM public.employee_catalog', 'Employee can read employee_catalog view');

-- Let's test missing_items
SELECT throws_ok('INSERT INTO public.missing_items (product_id, reported_by) VALUES (''00000000-0000-0000-0000-000000000200'', ''00000000-0000-0000-0000-000000000002'')', '42501', 'new row violates row-level security policy for table "missing_items"', 'Employee CANNOT insert missing_items for another user');
SELECT lives_ok('INSERT INTO public.missing_items (product_id, reported_by) VALUES (''00000000-0000-0000-0000-000000000200'', ''00000000-0000-0000-0000-000000000001'')', 'Employee CAN insert missing_items for themselves');

-- Switch to admin
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

SELECT lives_ok('SELECT * FROM public.products', 'Admin can read products directly');
SELECT lives_ok('SELECT * FROM public.employee_catalog', 'Admin can read employee_catalog view');

-- Cleanup
RESET role;
SELECT * FROM finish();
ROLLBACK;
