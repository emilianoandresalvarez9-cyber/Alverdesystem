BEGIN;
SELECT plan(5);

-- Verificamos que exista la secuencia
SELECT has_sequence('public', 'internal_barcode_seq', 'Debe existir la secuencia para codigos internos');

-- Verificamos que exista la función
SELECT has_function('public', 'get_next_internal_code_seq', 'Debe existir la funcion get_next_internal_code_seq');

-- ROL: anon (no debe poder)
SET ROLE anon;
SELECT throws_ok(
    'SELECT public.get_next_internal_code_seq()',
    '42501', -- permission denied
    NULL,
    'El rol anon NO debe tener permiso para ejecutar la función'
);
RESET ROLE;

-- ROL: authenticated (empleado/admin deben poder)
SET ROLE authenticated;
SELECT lives_ok(
    'SELECT public.get_next_internal_code_seq()',
    'El rol authenticated DEBE tener permiso para ejecutar la función'
);
RESET ROLE;

-- Probamos generar 1000 valores usando la función y vemos que todos son distintos
PREPARE test_1000_distinct AS
  SELECT (
    SELECT COUNT(DISTINCT public.get_next_internal_code_seq())
    FROM generate_series(1, 1000)
  ) = 1000;

SELECT results_eq(
    'test_1000_distinct',
    ARRAY[true],
    '1000 llamadas a la secuencia deben generar valores unicos'
);

SELECT * FROM finish();
ROLLBACK;
