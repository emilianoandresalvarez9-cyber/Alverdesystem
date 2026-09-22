-- Fase 0: Esquema completo de Alverde System
-- Basado en la sección 13 del documento de requisitos
-- Antigravity: migración faltante detectada en revisión del PR #1

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- TABLAS DE REFERENCIA
-- ============================================================

create table public.marcas (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

create table public.rubros (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  rubro_padre_id uuid references public.rubros(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (nombre, rubro_padre_id)
);

create table public.etiquetas (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SUCURSALES Y PUESTOS (RF-53 a RF-55)
-- ============================================================

create table public.sucursales (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.puestos (
  id uuid primary key default uuid_generate_v4(),
  sucursal_id uuid not null references public.sucursales(id) on delete restrict,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PERFILES DE USUARIO (RF-59)
-- Solo dos roles: administrator / employee
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'employee' check (role in ('administrator', 'employee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger: crear perfil automáticamente al registrar usuario en Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    'employee'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROVEEDORES (RF-24)
-- ============================================================

create table public.proveedores (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  contacto text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTOS Y PRESENTACIONES (RF-01 a RF-06)
-- ============================================================

create table public.productos (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  codigo_barras text unique,
  marca_id uuid references public.marcas(id) on delete set null,
  rubro_id uuid references public.rubros(id) on delete set null,
  unidad_base text not null default 'unidad'
    check (unidad_base in ('gramos', 'mililitros', 'unidad')),
  multiplicador_precio numeric(10, 4),  -- solo Administrador; si null, usa el global x2
  vida_util_post_apertura_dias integer,
  rotulo text,
  activo boolean not null default true,  -- RF-56: nunca se borra, solo se archiva
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.producto_etiquetas (
  producto_id uuid not null references public.productos(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  primary key (producto_id, etiqueta_id)
);

create table public.presentaciones (
  id uuid primary key default uuid_generate_v4(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre text not null,                     -- ej. "150 g", "granel por kg"
  cantidad_base numeric(14, 4) not null,    -- en unidad_base del producto
  codigo_barras_propio text unique,          -- EAN-13 interno (prefijo 20-29, RF-20)
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Relación producto-proveedor (RF-24)
create table public.proveedor_productos (
  id uuid primary key default uuid_generate_v4(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  codigo_proveedor text,
  costo numeric(14, 2) not null default 0,  -- solo Administrador (RNF-04)
  fecha_ultima_compra date,
  es_principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (producto_id, proveedor_id)
);

-- ============================================================
-- LOTES (RF-07 a RF-10)
-- ============================================================

create table public.lotes (
  id uuid primary key default uuid_generate_v4(),
  presentacion_id uuid not null references public.presentaciones(id) on delete restrict,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  cantidad_inicial numeric(14, 4) not null,
  cantidad_actual numeric(14, 4) not null,
  costo_compra numeric(14, 2) not null default 0,  -- solo Administrador (RNF-04)
  fecha_ingreso date not null default current_date,
  fecha_vencimiento_fabricante date,
  fecha_apertura timestamptz,       -- nullable; para granel (RF-11)
  fecha_fraccionamiento timestamptz, -- nullable (RF-14)
  estado text not null default 'abierto'
    check (estado in ('abierto', 'cerrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CLIENTES Y FIADO (RF-45 a RF-48)
-- ============================================================

create table public.clientes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  telefono text,
  tope_fiado numeric(14, 2),  -- null = sin tope; lo define la dueña (RF-47)
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- VENTAS (RF-31 a RF-33)
-- ============================================================

create table public.ventas (
  id uuid primary key default uuid_generate_v4(),
  local_id text unique not null,  -- generado en el dispositivo antes de sincronizar (RF-35)
  fecha_hora timestamptz not null default now(),
  puesto_id uuid references public.puestos(id) on delete set null,
  usuario_id uuid not null references public.profiles(id) on delete restrict,
  medio_pago text not null
    check (medio_pago in ('efectivo', 'transferencia', 'qr')),
  cliente_id uuid references public.clientes(id) on delete set null,
  estado text not null default 'cerrada'
    check (estado in ('cerrada', 'anulada')),  -- anular: solo Administrador
  sincronizado boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.venta_items (
  id uuid primary key default uuid_generate_v4(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  presentacion_id uuid not null references public.presentaciones(id) on delete restrict,
  lote_id uuid references public.lotes(id) on delete set null,
  cantidad numeric(14, 4) not null,
  precio_unitario numeric(14, 2) not null
);

-- ============================================================
-- MOVIMIENTOS DE STOCK (RF-57)
-- ============================================================

create table public.movimientos_stock (
  id uuid primary key default uuid_generate_v4(),
  local_id text unique,  -- para idempotencia offline
  tipo text not null
    check (tipo in ('ingreso', 'venta', 'fraccionamiento', 'merma', 'ajuste', 'descarte')),
  producto_id uuid references public.productos(id) on delete set null,
  lote_id uuid references public.lotes(id) on delete set null,
  cantidad numeric(14, 4) not null,
  motivo text,
  usuario_id uuid references public.profiles(id) on delete set null,
  fecha_hora timestamptz not null default now(),
  sincronizado boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- MOVIMIENTOS DE FIADO (RF-46)
-- El saldo es la suma de movimientos, nunca un campo que se pisa
-- ============================================================

create table public.movimientos_fiado (
  id uuid primary key default uuid_generate_v4(),
  local_id text unique,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  tipo text not null check (tipo in ('cargo', 'abono')),
  monto numeric(14, 2) not null,
  fecha timestamptz not null default now(),
  usuario_id uuid references public.profiles(id) on delete set null,
  venta_id uuid references public.ventas(id) on delete set null,
  sincronizado boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HISTORIAL DE CAMBIOS (RF-58, RF-60)
-- ============================================================

create table public.historial_cambios (
  id uuid primary key default uuid_generate_v4(),
  entidad text not null,
  entidad_id uuid not null,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  usuario_id uuid references public.profiles(id) on delete set null,
  fecha_hora timestamptz not null default now()
);

-- ============================================================
-- HISTORIAL DE PRECIOS (RF-27)
-- ============================================================

create table public.historial_precios (
  id uuid primary key default uuid_generate_v4(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_venta numeric(14, 2) not null,
  usuario_id uuid references public.profiles(id) on delete set null,
  fecha_hora timestamptz not null default now()
);

-- ============================================================
-- FALTANTES / REPOSICIÓN (RF-49 a RF-51)
-- ============================================================

create table public.faltantes (
  id uuid primary key default uuid_generate_v4(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete set null,
  nota text,
  resuelto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index on public.productos using gin (nombre gin_trgm_ops);
create index on public.productos (marca_id);
create index on public.productos (rubro_id);
create index on public.productos (activo);
create index on public.presentaciones (producto_id);
create index on public.lotes (presentacion_id);
create index on public.lotes (estado);
create index on public.lotes (fecha_vencimiento_fabricante);
create index on public.ventas (fecha_hora);
create index on public.ventas (usuario_id);
create index on public.ventas (cliente_id);
create index on public.movimientos_fiado (cliente_id);
create index on public.historial_cambios (entidad, entidad_id);
create index on public.historial_cambios (usuario_id);
create index on public.historial_cambios (fecha_hora);
create index on public.faltantes (producto_id);
create index on public.faltantes (resuelto);

-- ============================================================
-- VISTA PARA EMPLEADOS — sin costos ni márgenes (RNF-04)
-- Esta es la única forma en que el empleado accede al catálogo
-- ============================================================

create or replace view public.employee_catalog as
select
  p.id as product_id,
  p.nombre as product_name,
  p.codigo_barras,
  p.unidad_base,
  p.vida_util_post_apertura_dias,
  p.rotulo,
  p.activo,
  m.id as marca_id,
  m.nombre as marca,
  r.id as rubro_id,
  r.nombre as rubro,
  r.rubro_padre_id,
  pr.id as presentacion_id,
  pr.nombre as presentacion_nombre,
  pr.cantidad_base,
  pr.codigo_barras_propio,
  coalesce(
    jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre))
      filter (where e.id is not null),
    '[]'::jsonb
  ) as etiquetas
from public.productos p
left join public.marcas m on m.id = p.marca_id
left join public.rubros r on r.id = p.rubro_id
left join public.presentaciones pr on pr.producto_id = p.id and pr.activo = true
left join public.producto_etiquetas pe on pe.producto_id = p.id
left join public.etiquetas e on e.id = pe.etiqueta_id
where p.activo = true
group by p.id, m.id, r.id, pr.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.marcas enable row level security;
alter table public.rubros enable row level security;
alter table public.etiquetas enable row level security;
alter table public.sucursales enable row level security;
alter table public.puestos enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos enable row level security;
alter table public.producto_etiquetas enable row level security;
alter table public.presentaciones enable row level security;
alter table public.proveedor_productos enable row level security;
alter table public.lotes enable row level security;
alter table public.clientes enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.movimientos_fiado enable row level security;
alter table public.historial_cambios enable row level security;
alter table public.historial_precios enable row level security;
alter table public.faltantes enable row level security;

-- Helper: obtener rol del usuario actual
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Perfiles
create policy "Ver propio perfil" on public.profiles
  for select using (id = auth.uid());
create policy "Admins ven todos los perfiles" on public.profiles
  for select using (public.current_user_role() = 'administrator');
create policy "Actualizar propio perfil" on public.profiles
  for update using (id = auth.uid());

-- Tablas de referencia: cualquier autenticado lee
create policy "Autenticados leen marcas" on public.marcas
  for select using (auth.uid() is not null);
create policy "Autenticados leen rubros" on public.rubros
  for select using (auth.uid() is not null);
create policy "Autenticados leen etiquetas" on public.etiquetas
  for select using (auth.uid() is not null);
create policy "Autenticados leen sucursales" on public.sucursales
  for select using (auth.uid() is not null);
create policy "Autenticados leen puestos" on public.puestos
  for select using (auth.uid() is not null);
create policy "Autenticados leen productos" on public.productos
  for select using (auth.uid() is not null);
create policy "Autenticados leen presentaciones" on public.presentaciones
  for select using (auth.uid() is not null);
create policy "Autenticados leen producto_etiquetas" on public.producto_etiquetas
  for select using (auth.uid() is not null);
create policy "Autenticados leen clientes" on public.clientes
  for select using (auth.uid() is not null);
create policy "Autenticados leen ventas" on public.ventas
  for select using (auth.uid() is not null);
create policy "Autenticados leen venta_items" on public.venta_items
  for select using (auth.uid() is not null);
create policy "Autenticados leen movimientos_stock" on public.movimientos_stock
  for select using (auth.uid() is not null);
create policy "Autenticados leen movimientos_fiado" on public.movimientos_fiado
  for select using (auth.uid() is not null);
create policy "Autenticados leen faltantes" on public.faltantes
  for select using (auth.uid() is not null);

-- Proveedores: solo admins (contienen info de negocio)
create policy "Admins leen proveedores" on public.proveedores
  for select using (public.current_user_role() = 'administrator');
create policy "Admins modifican proveedores" on public.proveedores
  for all using (public.current_user_role() = 'administrator');

-- Lotes: autenticados leen (costo_compra se protege en app y en la vista employee_catalog)
create policy "Autenticados leen lotes" on public.lotes
  for select using (auth.uid() is not null);
create policy "Admins modifican lotes" on public.lotes
  for all using (public.current_user_role() = 'administrator');

-- proveedor_productos: solo admins (contiene costos)
create policy "Admins leen proveedor_productos" on public.proveedor_productos
  for select using (public.current_user_role() = 'administrator');
create policy "Admins modifican proveedor_productos" on public.proveedor_productos
  for all using (public.current_user_role() = 'administrator');

-- historial_precios: solo admins
create policy "Admins leen historial_precios" on public.historial_precios
  for select using (public.current_user_role() = 'administrator');
create policy "Admins modifican historial_precios" on public.historial_precios
  for all using (public.current_user_role() = 'administrator');

-- historial_cambios: solo admins pueden leer
create policy "Admins leen historial_cambios" on public.historial_cambios
  for select using (public.current_user_role() = 'administrator');
create policy "Sistema inserta historial" on public.historial_cambios
  for insert with check (auth.uid() is not null);

-- Escritura operativa: cualquier autenticado
create policy "Autenticados insertan ventas" on public.ventas
  for insert with check (auth.uid() is not null);
create policy "Autenticados insertan venta_items" on public.venta_items
  for insert with check (auth.uid() is not null);
create policy "Autenticados insertan movimientos_stock" on public.movimientos_stock
  for insert with check (auth.uid() is not null);
create policy "Autenticados insertan movimientos_fiado" on public.movimientos_fiado
  for insert with check (auth.uid() is not null);
create policy "Autenticados insertan faltantes" on public.faltantes
  for insert with check (auth.uid() is not null);
create policy "Autenticados actualizan faltantes" on public.faltantes
  for update using (auth.uid() is not null);

-- Solo admins modifican catálogo maestro
create policy "Admins modifican marcas" on public.marcas
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican rubros" on public.rubros
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican etiquetas" on public.etiquetas
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican productos" on public.productos
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican presentaciones" on public.presentaciones
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican clientes" on public.clientes
  for all using (public.current_user_role() = 'administrator');
create policy "Admins anulan ventas" on public.ventas
  for update using (public.current_user_role() = 'administrator');
create policy "Admins modifican sucursales" on public.sucursales
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican puestos" on public.puestos
  for all using (public.current_user_role() = 'administrator');
create policy "Admins modifican producto_etiquetas" on public.producto_etiquetas
  for all using (public.current_user_role() = 'administrator');

-- ============================================================
-- RPC: apply_offline_operation (RF-35 a RF-38)
-- Aplica operaciones de la cola offline de forma idempotente.
-- El local_id garantiza que no se duplica si se envía dos veces.
-- ============================================================

create or replace function public.apply_offline_operation(p_operation jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_kind    text    := p_operation->>'kind';
  v_local_id text   := p_operation->>'localId';
  v_payload  jsonb  := p_operation->'payload';
  v_user_id  uuid   := auth.uid();
  v_venta_id uuid;
begin
  if v_kind = 'sale' then
    -- Idempotencia: si el local_id ya existe, no hacer nada
    if exists (select 1 from public.ventas where local_id = v_local_id) then
      return;
    end if;

    insert into public.ventas (
      local_id, fecha_hora, puesto_id, usuario_id,
      medio_pago, cliente_id, estado, sincronizado
    ) values (
      v_local_id,
      coalesce((v_payload->>'fecha_hora')::timestamptz, now()),
      (v_payload->>'puesto_id')::uuid,
      v_user_id,
      v_payload->>'medio_pago',
      (v_payload->>'cliente_id')::uuid,
      'cerrada',
      true
    ) returning id into v_venta_id;

    insert into public.venta_items
      (venta_id, presentacion_id, lote_id, cantidad, precio_unitario)
    select
      v_venta_id,
      (item->>'presentacion_id')::uuid,
      (item->>'lote_id')::uuid,
      (item->>'cantidad')::numeric,
      (item->>'precio_unitario')::numeric
    from jsonb_array_elements(v_payload->'items') as item;

  elsif v_kind = 'stock_movement' then
    if exists (select 1 from public.movimientos_stock where local_id = v_local_id) then
      return;
    end if;

    insert into public.movimientos_stock (
      local_id, tipo, producto_id, lote_id,
      cantidad, motivo, usuario_id, fecha_hora, sincronizado
    ) values (
      v_local_id,
      v_payload->>'tipo',
      (v_payload->>'producto_id')::uuid,
      (v_payload->>'lote_id')::uuid,
      (v_payload->>'cantidad')::numeric,
      v_payload->>'motivo',
      v_user_id,
      coalesce((v_payload->>'fecha_hora')::timestamptz, now()),
      true
    );

  elsif v_kind = 'credit_movement' then
    if exists (select 1 from public.movimientos_fiado where local_id = v_local_id) then
      return;
    end if;

    insert into public.movimientos_fiado (
      local_id, cliente_id, tipo, monto,
      fecha, usuario_id, venta_id, sincronizado
    ) values (
      v_local_id,
      (v_payload->>'cliente_id')::uuid,
      v_payload->>'tipo',
      (v_payload->>'monto')::numeric,
      coalesce((v_payload->>'fecha')::timestamptz, now()),
      v_user_id,
      (v_payload->>'venta_id')::uuid,
      true
    );

  else
    raise exception 'Tipo de operación desconocido: %', v_kind;
  end if;
end;
$$;

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Marca "Del local" requerida por RF-06
insert into public.marcas (nombre) values ('Del local');

-- Sucursal y puesto iniciales (RF-53 a RF-55)
-- El local arranca con uno de cada uno; agregar más es solo un INSERT
insert into public.sucursales (nombre, direccion)
values ('Principal', 'Sucursal principal');

insert into public.puestos (sucursal_id, nombre)
values (
  (select id from public.sucursales where nombre = 'Principal' limit 1),
  'Caja 1'
);
