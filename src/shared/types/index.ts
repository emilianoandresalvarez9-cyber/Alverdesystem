/**
 * Tipos de filas de la base. Salen de database.types.ts (generado desde las migraciones con
 * `npm run gen:types`), así no pueden desincronizarse del esquema real.
 *
 * Antes eran interfaces escritas a mano con campos que no existen (Presentation.status,
 * Presentation.internal_code, StockLot.cost, Customer.contact) y un `SupabaseAny` que era
 * `any` con otro nombre (P20).
 */
import type { Tables } from "../supabase/database.types";

export type Brand = Tables<"brands">;
export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type Presentation = Tables<"product_presentations">;
export type StockLot = Tables<"stock_lots">;
export type Sale = Tables<"sales">;
export type SaleItem = Tables<"sale_items">;
export type Customer = Tables<"customers">;
export type Supplier = Tables<"suppliers">;
