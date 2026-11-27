import { getSupabase } from "../../shared/supabase/client";
import { groupProducts, type PublicBranch, type PublicProduct } from "./priceList";

/** Sucursales abiertas (nombre y dirección). No necesita sesión. */
export async function fetchPublicBranches(): Promise<PublicBranch[]> {
  const { data, error } = await getSupabase().rpc("public_branches");
  if (error) throw error;
  return (data ?? []).map((b) => ({ id: b.id, name: b.name, address: b.address || null }));
}

/** Precios y disponibilidad de una sucursal; sin sucursal, la principal. No necesita sesión. */
export async function fetchPublicPriceList(branchId: string | null): Promise<PublicProduct[]> {
  const { data, error } = await getSupabase().rpc("public_price_list", branchId ? { p_branch_id: branchId } : {});
  if (error) throw error;
  return groupProducts(data ?? []);
}
