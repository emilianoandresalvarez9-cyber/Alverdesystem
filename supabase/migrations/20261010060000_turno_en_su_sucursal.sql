-- Seguridad (RF-66): un empleado abre turno sólo en una caja de SU sucursal.
--
-- Defecto (revisión de seguridad del 10/10/2026): la política de alta de turnos sólo pedía que
-- el turno fuera de quien lo abre. La caja podía ser de cualquier sucursal. La app sólo le
-- muestra las cajas de la suya, pero con una llamada directa (o con un equipo que quedó asignado
-- a una caja de otra sucursal) el empleado abría turno ahí, y como la venta descuenta stock de la
-- sucursal de la caja (RF-66), vendía y descontaba stock de una sucursal que no es la suya.
--
-- Arreglo: un control aparte del de 20261010050000 (guard_cash_shift), para que este SQL se
-- pueda aplicar antes o después de aquel. Desde la API y sin ser administración, la caja del
-- turno tiene que ser de current_branch_id(): la sucursal asignada al usuario o, si no tiene,
-- la principal (la misma que usa la app). Administración abre turno en cualquier caja (RF-66).
-- Los turnos que ya existen no cambian: sólo se controla al abrir (o si se cambiara la caja).
--
-- Se puede correr más de una vez (create or replace / drop if exists).

create or replace function public.guard_cash_shift_branch()
returns trigger
language plpgsql
security invoker -- is_api_role() mira current_user: en SECURITY DEFINER sería el dueño
set search_path = public
as $$
declare
  v_register_branch uuid;
  v_register_branch_name text;
  v_register_name text;
begin
  if not public.is_api_role() or public.is_administrator() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.register_id is not distinct from old.register_id then
    return new;
  end if;

  select r.branch_id, b.name, r.name
    into v_register_branch, v_register_branch_name, v_register_name
  from public.registers r
  join public.branches b on b.id = r.branch_id
  where r.id = new.register_id;

  if v_register_branch is distinct from public.current_branch_id() then
    raise exception '% es de la sucursal %, y tu usuario trabaja en otra. Usá una caja de tu sucursal o pedile a administración que te asigne a %.',
      coalesce(v_register_name, 'La caja'), coalesce(v_register_branch_name, '(desconocida)'), coalesce(v_register_branch_name, 'esa sucursal')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_cash_shift_branch() from public, anon, authenticated;

comment on function public.guard_cash_shift_branch() is
  'RF-66: desde la caja, el empleado abre turno sólo en cajas de su sucursal (current_branch_id). Administración, en cualquiera.';

drop trigger if exists cash_shifts_branch on public.cash_shifts;
create trigger cash_shifts_branch
  before insert or update of register_id on public.cash_shifts
  for each row execute function public.guard_cash_shift_branch();
