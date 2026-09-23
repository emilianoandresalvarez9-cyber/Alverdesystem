-- T-17: Historial de Precios automático al editar (RF-27)

CREATE OR REPLACE FUNCTION public.log_price_history_on_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.sale_price IS DISTINCT FROM OLD.sale_price) THEN
    INSERT INTO public.product_price_history (presentation_id, sale_price, changed_by)
    VALUES (NEW.id, NEW.sale_price, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Regla de seguridad e higiene
REVOKE ALL ON FUNCTION public.log_price_history_on_update() FROM public, anon;
-- No se expone EXECUTE a authenticated porque es para un trigger interno
-- Sin embargo, los dueños pueden preferirlo. No se requiere grant execute para triggers,
-- pero se revoca de public/anon por seguridad.

DROP TRIGGER IF EXISTS trg_log_price_history ON public.product_presentations;
CREATE TRIGGER trg_log_price_history
AFTER INSERT OR UPDATE ON public.product_presentations
FOR EACH ROW EXECUTE FUNCTION public.log_price_history_on_update();
