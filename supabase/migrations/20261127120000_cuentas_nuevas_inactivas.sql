-- Seguridad (RF-59, RNF-04): una cuenta nueva nace INACTIVA.
--
-- Hasta ahora toda cuenta de Auth nacía como empleado activo (profiles.active default true). Desde
-- 20261010040000 sólo el personal activo lee y opera, pero «activo» era el estado inicial: si el
-- registro abierto de Supabase queda encendido (es un interruptor del panel, fuera de este repo),
-- cualquiera que conozca la dirección del sitio se registra con la clave pública y entra como
-- empleado: lee nombres, teléfonos y saldos de clientes, y registra ventas y fiado.
--
-- Ahora la protección no depende de ese interruptor: la cuenta se crea sin acceso y una persona de
-- administración la activa desde Administración → Sucursales → Personal (botón «Activar», que ya
-- existe desde 20261010080000). La activación queda en el historial (RF-60).
--
-- No cambia ninguna cuenta existente: sólo el estado con el que nacen las nuevas.
-- La primera administradora se sigue dando de alta desde el SQL Editor, ahora con active = true
-- (ver README, «Puesta en marcha cloud»).
--
-- Se puede correr más de una vez.

alter table public.profiles alter column active set default false;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- active = false explícito: no depende del default de la columna.
  insert into public.profiles (id, display_name, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    false
  );
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'RF-59: toda cuenta nueva de Auth recibe un perfil de empleado INACTIVO; administración la activa desde la app.';
comment on column public.profiles.active is
  'false = sin acceso. Las cuentas nacen en false y administración las activa (RF-59); dar de baja lo vuelve a false.';
