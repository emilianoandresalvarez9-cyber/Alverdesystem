-- T-13: Alta de clientes sin conexión con idempotencia

CREATE OR REPLACE FUNCTION public.sync_offline_customer(
  p_id uuid,
  p_name text,
  p_phone text,
  p_credit_limit numeric
)
RETURNS void
SECURITY INVOKER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.customers (id, name, phone, credit_limit)
  VALUES (p_id, p_name, p_phone, p_credit_limit)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_offline_customer(uuid, text, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_customer(uuid, text, text, numeric) TO authenticated;
