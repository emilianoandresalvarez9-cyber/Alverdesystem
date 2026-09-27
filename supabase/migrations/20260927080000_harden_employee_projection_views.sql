-- These SECURITY DEFINER views are deliberate, restricted read projections:
-- staff do not have SELECT policies on the underlying cost-bearing tables.
-- SECURITY INVOKER would therefore hide required catalog/lot data or produce
-- incomplete customer balances. Keep the projection boundary explicit and
-- prevent predicate pushdown from evaluating caller expressions before the
-- view's filters.
ALTER VIEW public.employee_catalog SET (security_barrier = true);
ALTER VIEW public.employee_stock_lots SET (security_barrier = true);
ALTER VIEW public.customer_accounts SET (security_barrier = true);

-- Views are API-visible only to signed-in users and are read-only contracts.
REVOKE ALL ON public.employee_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.employee_stock_lots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.customer_accounts FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.employee_catalog TO authenticated;
GRANT SELECT ON public.employee_stock_lots TO authenticated;
GRANT SELECT ON public.customer_accounts TO authenticated;

COMMENT ON VIEW public.employee_catalog IS
  'Restricted employee catalog projection. SECURITY DEFINER is intentional because staff cannot select base product rows; columns exclude price multipliers and costs.';
COMMENT ON VIEW public.employee_stock_lots IS
  'Restricted employee stock projection. SECURITY DEFINER is intentional because staff cannot select base stock lot rows; columns exclude purchase_cost.';
COMMENT ON VIEW public.customer_accounts IS
  'Employee customer balance projection. SECURITY DEFINER is intentional to aggregate all movements while base ledger rows remain restricted.';
