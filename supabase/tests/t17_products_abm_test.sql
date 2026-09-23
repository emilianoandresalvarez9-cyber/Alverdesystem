BEGIN;
SELECT plan(10);

-- Setup: Create a test employee and admin
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'emp_t17@test');
UPDATE public.profiles SET role = 'employee' WHERE id = '00000000-0000-0000-0000-000000000001';

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000002', 'admin_t17@test');
UPDATE public.profiles SET role = 'administrator' WHERE id = '00000000-0000-0000-0000-000000000002';

-- We need a brand and category for FKs
INSERT INTO public.brands (id, name) VALUES ('00000000-0000-0000-0000-000000000100', 'T17 Brand');

---------------------------------------------------------
-- EMPLOYEE TESTS (RLS)
---------------------------------------------------------
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;

SELECT throws_ok(
    'INSERT INTO public.products (id, name, base_unit, brand_id) VALUES (''00000000-0000-0000-0000-000000000200'', ''Emp Prod'', ''unit'', ''00000000-0000-0000-0000-000000000100'')',
    '42501',
    NULL,
    'Empleado NO puede crear productos'
);

SELECT throws_ok(
    'INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sale_price) VALUES (''00000000-0000-0000-0000-000000000300'', ''00000000-0000-0000-0000-000000000200'', ''Pres'', 1, 1000)',
    '42501',
    NULL,
    'Empleado NO puede crear presentaciones'
);

---------------------------------------------------------
-- ADMIN TESTS (ABM)
---------------------------------------------------------
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

SELECT lives_ok(
    'INSERT INTO public.products (id, name, base_unit, brand_id) VALUES (''00000000-0000-0000-0000-000000000200'', ''Admin Prod'', ''unit'', ''00000000-0000-0000-0000-000000000100'')',
    'Admin SI puede crear productos (ABM)'
);

SELECT lives_ok(
    'INSERT INTO public.product_presentations (id, product_id, name, base_quantity, sale_price) VALUES (''00000000-0000-0000-0000-000000000300'', ''00000000-0000-0000-0000-000000000200'', ''Admin Pres'', 1, 1000)',
    'Admin SI puede crear presentaciones (ABM)'
);

-- ARCHIVADO (RF-56)
SELECT lives_ok(
    'UPDATE public.products SET active = false WHERE id = ''00000000-0000-0000-0000-000000000200''',
    'Admin SI puede archivar productos (RF-56)'
);

-- CHECK HISTORIAL DE PRECIOS TRIGGER (RF-27)
-- La insercion inicial deberia haber creado 1 registro (depende de como se haga el trigger).
-- Si el trigger hace ON INSERT OR UPDATE, habria 1 registro.
-- Vamos a actualizar el precio para estar seguros:
UPDATE public.product_presentations SET sale_price = 1500 WHERE id = '00000000-0000-0000-0000-000000000300';

PREPARE count_history AS 
    SELECT count(*) FROM public.product_price_history 
    WHERE presentation_id = '00000000-0000-0000-0000-000000000300' AND sale_price = 1500;

SELECT results_eq(
    'count_history',
    ARRAY[1::bigint],
    'Debe existir un registro de historial al cambiar el precio a 1500 (RF-27)'
);

UPDATE public.product_presentations SET sale_price = 2000 WHERE id = '00000000-0000-0000-0000-000000000300';

PREPARE count_history_2 AS 
    SELECT count(*) FROM public.product_price_history 
    WHERE presentation_id = '00000000-0000-0000-0000-000000000300' AND sale_price = 2000;

SELECT results_eq(
    'count_history_2',
    ARRAY[1::bigint],
    'Debe existir un nuevo registro de historial al cambiar el precio a 2000 (RF-27)'
);

-- REVISAR PERMISOS DEL HISTORIAL
SELECT lives_ok(
    'SELECT * FROM public.product_price_history',
    'Admin puede ver el historial de precios'
);

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET role authenticated;

SELECT results_eq(
    'SELECT count(*)::int FROM public.product_price_history',
    ARRAY[0::int],
    'Empleado no puede ver el historial de precios por RLS'
);

-- No puede editar la presentacion (RLS silencia el update actualizando 0 filas)
UPDATE public.product_presentations SET sale_price = 9999 WHERE id = '00000000-0000-0000-0000-000000000300';

PREPARE check_emp_update AS
    SELECT sale_price FROM public.product_presentations WHERE id = '00000000-0000-0000-0000-000000000300';

-- Como RLS no le permite verla directamente (o la oculta), no deberia poder cambiar el precio
-- Vamos a revisar como admin
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SET role authenticated;

PREPARE check_emp_update_admin AS
    SELECT sale_price FROM public.product_presentations WHERE id = '00000000-0000-0000-0000-000000000300';

SELECT results_eq(
    'check_emp_update_admin',
    ARRAY[2000::numeric],
    'Empleado NO debe poder editar presentaciones (el precio sigue en 2000)'
);

SELECT * FROM finish();
ROLLBACK;
