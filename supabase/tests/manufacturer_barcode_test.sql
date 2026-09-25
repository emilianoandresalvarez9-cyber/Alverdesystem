BEGIN;
SELECT plan(3);

INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000009901', 'admin_barcode@test');
UPDATE public.profiles
SET role = 'administrator'
WHERE id = '00000000-0000-0000-0000-000000009901';

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000009901';
SET role authenticated;

SELECT lives_ok(
  $$INSERT INTO public.products (id, name, base_unit, manufacturer_barcode)
    VALUES ('00000000-0000-0000-0000-000000009902', 'Agua 500 ml', 'unit', '0012345678905')$$,
  'Administrador puede guardar el EAN/UPC del envase (RF-19)'
);

SELECT results_eq(
  $$SELECT manufacturer_barcode FROM public.products
    WHERE id = '00000000-0000-0000-0000-000000009902'$$,
  ARRAY['0012345678905'::text],
  'El código se conserva como texto, incluidos sus ceros iniciales'
);

SELECT throws_ok(
  $$INSERT INTO public.products (id, name, base_unit, manufacturer_barcode)
    VALUES ('00000000-0000-0000-0000-000000009903', 'Agua duplicada', 'unit', '0012345678905')$$,
  '23505',
  NULL,
  'El mismo código de fabricante no se puede asignar a dos productos'
);

SELECT * FROM finish();
ROLLBACK;
