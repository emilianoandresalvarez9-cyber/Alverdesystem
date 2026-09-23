-- Migración para la T-16: Secuencia y generador de código interno

-- Creamos la secuencia para asegurar que no se repitan los números
CREATE SEQUENCE IF NOT EXISTS public.internal_barcode_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Regla de higiene: revocamos a anon y public
REVOKE ALL ON SEQUENCE public.internal_barcode_seq FROM public, anon;
GRANT USAGE, SELECT ON SEQUENCE public.internal_barcode_seq TO authenticated;

-- Función segura para obtener el siguiente valor
CREATE OR REPLACE FUNCTION public.get_next_internal_code_seq()
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
    SELECT nextval('public.internal_barcode_seq');
$$;

-- Regla de higiene
REVOKE ALL ON FUNCTION public.get_next_internal_code_seq() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_next_internal_code_seq() TO authenticated;
