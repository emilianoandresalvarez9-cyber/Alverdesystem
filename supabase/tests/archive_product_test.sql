BEGIN;
SELECT plan(2);

-- Crear usuarios, sucursales y cajas requeridas por FK
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000aa', 'test_archive@test');
INSERT INTO public.profiles (id, role, display_name) VALUES ('00000000-0000-0000-0000-0000000000aa', 'administrator', 'Admin Test') ON CONFLICT (id) DO UPDATE SET role = 'administrator', display_name = 'Admin Test';
INSERT INTO public.branches (id, name) VALUES ('00000000-0000-0000-0000-0000000000bb', 'Sucursal Test');
INSERT INTO public.registers (id, branch_id, name) VALUES ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000bb', 'Caja Test');

-- Crear un producto, presentacion y venta, luego archivar
INSERT INTO public.products (id, name, base_unit, active) VALUES ('55555555-5555-5555-5555-555555555555', 'Test Product Archive', 'gram', true);
INSERT INTO public.product_presentations (id, product_id, name, base_quantity) VALUES ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'Test Pres', 100);

-- Venta
INSERT INTO public.sales (id, local_id, branch_id, register_id, user_id, payment_method, occurred_at) VALUES ('77777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', 'cash', now());
INSERT INTO public.sale_items (sale_id, presentation_id, quantity, unit_price, local_id) VALUES ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 1, 1000, '88888888-8888-8888-8888-888888888888');

-- Archivar el producto
UPDATE public.products SET active = false WHERE id = '55555555-5555-5555-5555-555555555555';

-- Comprobar que podemos cruzar la venta con el producto archivado sin perder la consistencia
PREPARE check_sale AS
  SELECT count(*) FROM public.sales s
  JOIN public.sale_items si ON s.id = si.sale_id
  JOIN public.product_presentations pp ON si.presentation_id = pp.id
  JOIN public.products p ON pp.product_id = p.id
  WHERE s.id = '77777777-7777-7777-7777-777777777777' AND p.active = false;

SELECT results_eq(
    'check_sale', 
    ARRAY[1::bigint], 
    'La venta historica debe seguir existiendo y cruzar correctamente con el producto archivado (RF-56)'
);

-- Intentar borrar el producto fisicamente debe ser bloqueado por la base de datos (seguridad adicional)
PREPARE delete_product AS
  DELETE FROM public.products WHERE id = '55555555-5555-5555-5555-555555555555';

SELECT throws_ok(
    'delete_product', 
    'P0001', 
    NULL, 
    'Borrar el producto fisicamente debe fallar, obligando a archivarlo y asegurando integridad (RF-56)'
);

SELECT * FROM finish();
ROLLBACK;
