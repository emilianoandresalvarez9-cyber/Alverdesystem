-- Sitio público: lista de precios y disponibilidad en vivo, sin iniciar sesión.
--
-- Hasta ahora `anon` (un visitante sin sesión) no podía leer ni ejecutar nada, y eso no cambia
-- para las tablas: no se le da permiso sobre ninguna. Lo único que se abre son dos funciones de
-- sólo lectura que devuelven exactamente lo que el local ya muestra en su pizarra:
--
--   public_branches()            sucursales abiertas: nombre y dirección.
--   public_price_list(sucursal)  producto, marca, rubro, presentación, precio de venta de esa
--                                sucursal (RF-69) y disponibilidad.
--
-- Lo que NO sale, ni oculto (RNF-04): costos, márgenes, multiplicadores, proveedores, lotes,
-- vencimientos, códigos de barras ni cantidades. La disponibilidad es una de tres palabras:
--   'sin_stock'   no hay stock vendible en la sucursal;
--   'ultimas'     quedan hasta 3 unidades, o hasta 500 g/ml en presentaciones de balanza;
--   'disponible'  más que eso.
-- Stock vendible = lotes de la sucursal (RF-65) con cantidad positiva y sin vencer (RF-08).
-- No se listan productos archivados (RF-56), presentaciones inactivas ni precios en $0.
--
-- Son SECURITY DEFINER a propósito: leen tablas que `anon` no puede leer y devuelven sólo esas
-- columnas. Se puede correr más de una vez.

create or replace function public.public_branches()
returns table (id uuid, name text, address text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.address
  from public.branches b
  where b.archived_at is null
  order by b.created_at, b.id;
$$;

create or replace function public.public_price_list(p_branch_id uuid default null)
returns table (
  presentation_id uuid,
  product_id uuid,
  product_name text,
  brand_name text,
  category_name text,
  presentation_name text,
  sold_by_weight boolean,
  price numeric,
  availability text
)
language sql
stable
security definer
set search_path = public
as $$
  with branch as (
    select b.id
    from public.branches b
    where b.archived_at is null
      and b.id = coalesce(p_branch_id, public.default_branch_id())
  ),
  sellable as (
    select sl.presentation_id, sum(sl.current_quantity) as quantity
    from public.stock_lots sl
    join branch on branch.id = sl.branch_id
    join public.product_presentations spr on spr.id = sl.presentation_id
    join public.products sp on sp.id = spr.product_id
    where sl.current_quantity > 0
      and coalesce(
        public.effective_expiry_date(sl.manufacturer_expiry_date, sl.opened_at, sp.open_shelf_life_days)
          >= (now() at time zone 'America/Argentina/Buenos_Aires')::date,
        true)
    group by sl.presentation_id
  )
  select
    pr.id,
    p.id,
    p.name,
    b.name,
    c.name,
    pr.name,
    pr.sold_by_weight,
    public.effective_sale_price(pr.id, branch.id),
    case
      when coalesce(s.quantity, 0) <= 0 then 'sin_stock'
      when s.quantity <= (case when pr.sold_by_weight then 500 else 3 end) then 'ultimas'
      else 'disponible'
    end
  from branch
  join public.products p on p.active
  join public.product_presentations pr on pr.product_id = p.id and pr.active
  left join public.brands b on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  left join sellable s on s.presentation_id = pr.id
  where public.effective_sale_price(pr.id, branch.id) > 0
  order by p.name, p.id, pr.sold_by_weight desc, pr.base_quantity, pr.name;
$$;

revoke all on function public.public_branches() from public;
revoke all on function public.public_price_list(uuid) from public;
grant execute on function public.public_branches() to anon, authenticated;
grant execute on function public.public_price_list(uuid) to anon, authenticated;

comment on function public.public_branches() is
  'Sitio público: sucursales abiertas (nombre y dirección). Ejecutable sin sesión.';
comment on function public.public_price_list(uuid) is
  'Sitio público: precio de venta y disponibilidad (sin_stock / ultimas / disponible) por presentación en una sucursal. Sin costos, cantidades ni lotes (RNF-04). Ejecutable sin sesión.';
