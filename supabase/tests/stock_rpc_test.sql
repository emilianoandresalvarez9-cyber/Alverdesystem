BEGIN;
SELECT plan(8);

-- Setup: Create users
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test_employee@example.com');
UPDATE public.profiles SET role = 'employee' WHERE id = '00000000-0000-0000-0000-000000000001';

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'test_admin@example.com');
UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-000000000002';

-- Create product and presentation
INSERT INTO public.brands (id, name) VALUES ('00000000-0000-0000-0000-000000000100', 'Test Brand');
INSERT INTO public.products (id, brand_id, name, base_unit) VALUES ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000100', 'Lentejas', 'gram'::public.base_unit);
INSERT INTO public.product_presentations (id, product_id, name, base_quantity) VALUES ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000200', 'Bolsa 150g', 150);

-- TEST 1: quick_restock
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;

SELECT throws_ok(
    'SELECT public.quick_restock(''00000000-0000-0000-0000-000000000300''::uuid, ''00000000-0000-0000-0000-000000000200''::uuid, 10::numeric, current_date)',
    '42501',
    'Solo la administradora puede ingresar stock.',
    'Employee cannot call quick_restock'
);

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

SELECT lives_ok(
    'SELECT public.quick_restock(''00000000-0000-0000-0000-000000000300''::uuid, ''00000000-0000-0000-0000-000000000200''::uuid, 10::numeric, current_date)',
    'Admin can call quick_restock'
);

-- Extract the newly created lot ID
CREATE TEMP TABLE temp_lot AS SELECT id FROM public.stock_lots WHERE presentation_id = '00000000-0000-0000-0000-000000000300';
SELECT is((SELECT count(*)::int FROM temp_lot), 1, 'Lot created successfully');
SELECT is((SELECT current_quantity FROM public.stock_lots WHERE id = (SELECT id FROM temp_lot)), 10::numeric, 'Lot quantity is 10');

-- TEST 2: adjust_stock
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;
SELECT throws_ok(
    'SELECT public.adjust_stock((SELECT id FROM temp_lot), ''00000000-0000-0000-0000-000000000200''::uuid, ''waste''::public.stock_movement_kind, 2::numeric, ''Test'', 8::numeric, false)',
    '42501',
    'Solo la administradora puede ajustar el stock.',
    'Employee cannot call adjust_stock'
);

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;
SELECT lives_ok(
    'SELECT public.adjust_stock((SELECT id FROM temp_lot), ''00000000-0000-0000-0000-000000000200''::uuid, ''waste''::public.stock_movement_kind, 2::numeric, ''Test'', 8::numeric, false)',
    'Admin can call adjust_stock'
);
SELECT is((SELECT current_quantity FROM public.stock_lots WHERE id = (SELECT id FROM temp_lot)), 8::numeric, 'Lot quantity is now 8');

-- TEST 3: fraction_stock
-- We fraction 8 to 0, producing new lots (we just test lives_ok)
SELECT lives_ok(
    'SELECT public.fraction_stock((SELECT id FROM temp_lot), ''00000000-0000-0000-0000-000000000300''::uuid, 2::numeric, 8::numeric, 0::numeric, 0::numeric, ''closed''::public.stock_lot_status)',
    'Admin can call fraction_stock'
);

RESET role;
SELECT * FROM finish();
ROLLBACK;
