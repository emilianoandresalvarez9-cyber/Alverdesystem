-- authenticated needs ordinary row operations governed by RLS; these object privileges
-- are unnecessary and cannot be constrained by row policies.
revoke truncate, trigger, references on table
  public.cash_shifts,
  public.missing_items,
  public.stock_warnings
from authenticated;

