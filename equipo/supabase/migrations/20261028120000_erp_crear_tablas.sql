-- ============================================================================
--  CUANTICS · ERP (cuantics.pe/equipo) — CREAR TABLAS
--  Qué hace: crea el acceso del equipo, los datos de la empresa y las
--  órdenes de compra. Se corre UNA vez en Supabase → SQL Editor.
--  Si se corre de nuevo no rompe nada.
--
--  Convenciones (las mismas de Potente):
--    · Todo en español, para que las tablas se lean igual que se habla.
--    · Cada tabla nace con RLS activado y sin permisos. Nada se lee ni se
--      escribe si no hay una política explícita más abajo.
--    · Los permisos (GRANT) van escritos a mano: desde el 30/10/2026 Supabase
--      ya no los da solo a las tablas nuevas.
--    · Esta migración no se edita nunca. Los cambios van en archivos nuevos.
-- ============================================================================

create extension if not exists pgcrypto;

-- Este esquema vive en el proyecto Supabase "CUANTICS", que también usa el
-- flyer (cold_mail_flyer_open). Si ya existiera una tabla con el mismo nombre
-- que no sea del ERP, se detiene aquí sin tocar nada.
do $$
begin
  if to_regclass('public.perfiles') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'perfiles' and column_name = 'cargo') then
    raise exception 'Ya existe public.perfiles de otra aplicación: no se aplica el esquema del ERP';
  end if;
  if to_regclass('public.empresa') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'empresa' and column_name = 'datos') then
    raise exception 'Ya existe public.empresa de otra aplicación: no se aplica el esquema del ERP';
  end if;
  if to_regclass('public.ordenes_compra') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'ordenes_compra' and column_name = 'datos') then
    raise exception 'Ya existe public.ordenes_compra de otra aplicación: no se aplica el esquema del ERP';
  end if;
end;
$$;


-- ============================================================================
--  1. PERFILES
--     Una fila por persona con acceso al ERP, ligada a su cuenta de Supabase.
-- ============================================================================

create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text        not null default '',
  cargo      text        not null default '',
  rol        text        not null default 'usuario'
                         check (rol in ('admin', 'usuario')),
  activo     boolean     not null default true,
  creado_en  timestamptz not null default now()
);

comment on column public.perfiles.cargo is 'Sale bajo la firma de los documentos que emite (p. ej. Gerente General).';
comment on column public.perfiles.rol   is 'admin cambia los datos de la empresa y gestiona cuentas; usuario emite documentos.';

-- Correos que entran como administrador al crearse su cuenta.
create table if not exists public.admins_iniciales (
  correo text primary key
);

insert into public.admins_iniciales (correo) values
  ('jonathan@cuantics.pe'),
  ('jonoc90@gmail.com')
on conflict do nothing;


-- ============================================================================
--  2. EMPRESA
--     Una sola fila con los datos que salen en el encabezado de cada documento.
-- ============================================================================

create table if not exists public.empresa (
  id             smallint    primary key default 1 check (id = 1),
  datos          jsonb       not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

insert into public.empresa (id, datos) values (1, jsonb_build_object(
  'razon',   'CUANTICS S.A.C.',
  'ruc',     '',
  'dir',     '',
  'tel',     '',
  'mail',    'administracion@cuantics.pe',
  'fact',    'administracion@cuantics.pe',
  'web',     'www.cuantics.pe',
  'serie',   'OC',
  'entrega', 'Jr. Tnte Coronel Melchor Frisancho 376 - Santiago de Surco'
))
on conflict (id) do nothing;


-- ============================================================================
--  3. ÓRDENES DE COMPRA
--     Las columnas sueltas sirven para listar y buscar; "datos" guarda la
--     orden completa tal como se llenó en pantalla (proveedor, ítems,
--     condiciones), para reimprimirla idéntica.
-- ============================================================================

create table if not exists public.ordenes_compra (
  id              uuid        primary key default gen_random_uuid(),
  numero          text        unique,
  anio            smallint,
  correlativo     integer,
  rev             smallint    not null default 0,
  estado          text        not null default 'Borrador'
                              check (estado in ('Borrador', 'Emitida', 'Aceptada', 'Recibida', 'Anulada')),
  fecha           date        not null default ((now() at time zone 'America/Lima')::date),
  proveedor       text        not null default '',
  proveedor_pais  text        not null default '',
  cotizacion      text        not null default '',
  moneda          text        not null default 'USD' check (moneda in ('USD', 'PEN', 'EUR')),
  total           numeric(14,2) not null default 0,
  datos           jsonb       not null default '{}'::jsonb,
  creado_por      uuid        references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint correlativo_unico unique (anio, correlativo)
);

comment on column public.ordenes_compra.estado is
  'Borrador · Emitida (enviada al proveedor) · Aceptada (el proveedor la confirmó) · Recibida (llegó lo comprado) · Anulada. No se borran: se anulan.';

create index if not exists ordenes_compra_recientes on public.ordenes_compra (creado_en desc);


-- ============================================================================
--  4. FUNCIONES DE APOYO
-- ============================================================================

-- SECURITY DEFINER a propósito: si consultara perfiles con los permisos del
-- propio usuario, las políticas de perfiles se llamarían a sí mismas.
create or replace function public.es_miembro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

revoke all on function public.es_miembro() from public;
revoke all on function public.es_admin()   from public;
grant execute on function public.es_miembro() to authenticated;
grant execute on function public.es_admin()   to authenticated;


-- Perfil automático al crearse la cuenta.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rol_asignado text := 'usuario';
begin
  if exists (select 1 from public.admins_iniciales where correo = lower(new.email)) then
    rol_asignado := 'admin';
  end if;

  -- Solo los administradores iniciales nacen activos. Cualquier otra cuenta
  -- (un invitado, o alguien que se registre si el registro quedara abierto)
  -- nace desactivada y no ve nada hasta que un administrador la active.
  insert into public.perfiles (id, nombre, rol, activo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    rol_asignado,
    rol_asignado = 'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();


-- Nadie se asciende a sí mismo a administrador.
-- Sin SECURITY DEFINER a propósito: así current_user es quien hace el cambio.
-- El candado aplica a quien entra por la web (authenticated); el panel de
-- Supabase (postgres / service_role) sí puede activar cuentas y cambiar roles.
create or replace function public.proteger_rol()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.es_admin() then
    if new.rol is distinct from old.rol or new.activo is distinct from old.activo then
      raise exception 'Solo un administrador puede cambiar el rol o el estado de una cuenta'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists al_actualizar_perfil on public.perfiles;
create trigger al_actualizar_perfil
  before update on public.perfiles
  for each row execute function public.proteger_rol();


create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_empresa on public.empresa;
create trigger al_actualizar_empresa
  before update on public.empresa
  for each row execute function public.tocar_actualizado_en();


-- El número de la orden lo pone la base, no la página: así dos personas
-- guardando a la vez nunca reciben el mismo número.
-- Formato: SERIE-AÑO-0001, correlativo que vuelve a 1 cada año.
-- Si la orden llega ya numerada (importada de antes), se respeta su número.
create or replace function public.numerar_orden_compra()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  serie text;
begin
  perform pg_advisory_xact_lock(hashtext('ordenes_compra.numero'));

  if coalesce(new.numero, '') <> '' then
    if new.numero ~ '-[0-9]{4}-[0-9]+$' then
      new.anio        := substring(new.numero from '-([0-9]{4})-[0-9]+$')::smallint;
      new.correlativo := substring(new.numero from '-([0-9]+)$')::integer;
    end if;
    return new;
  end if;

  select coalesce(nullif(datos ->> 'serie', ''), 'OC') into serie from public.empresa where id = 1;
  new.anio := extract(year from coalesce(new.fecha, (now() at time zone 'America/Lima')::date))::smallint;
  select coalesce(max(correlativo), 0) + 1 into new.correlativo
    from public.ordenes_compra where anio = new.anio;
  new.numero := coalesce(serie, 'OC') || '-' || new.anio || '-' || lpad(new.correlativo::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists al_crear_orden_compra on public.ordenes_compra;
create trigger al_crear_orden_compra
  before insert on public.ordenes_compra
  for each row execute function public.numerar_orden_compra();


-- Una orden emitida no cambia de número.
create or replace function public.proteger_numero_oc()
returns trigger language plpgsql as $$
begin
  if new.numero is distinct from old.numero
     or new.anio is distinct from old.anio
     or new.correlativo is distinct from old.correlativo then
    raise exception 'El número de una orden de compra no se cambia' using errcode = '42501';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_orden_compra on public.ordenes_compra;
create trigger al_actualizar_orden_compra
  before update on public.ordenes_compra
  for each row execute function public.proteger_numero_oc();


-- ============================================================================
--  5. SEGURIDAD A NIVEL DE FILA
--     Sin sesión iniciada no se ve absolutamente nada.
-- ============================================================================

alter table public.perfiles         enable row level security;
alter table public.admins_iniciales enable row level security;
alter table public.empresa          enable row level security;
alter table public.ordenes_compra   enable row level security;
-- admins_iniciales queda sin políticas a propósito: solo la lee el trigger.

grant usage on schema public to authenticated, service_role;

revoke all on public.perfiles         from anon;
revoke all on public.admins_iniciales from anon, authenticated;
revoke all on public.empresa          from anon;
revoke all on public.ordenes_compra   from anon;

grant select, update                 on public.perfiles       to authenticated;
grant select, update                 on public.empresa        to authenticated;
grant select, insert, update, delete on public.ordenes_compra to authenticated;

grant all on public.perfiles         to service_role;
grant all on public.admins_iniciales to service_role;
grant all on public.empresa          to service_role;
grant all on public.ordenes_compra   to service_role;


-- ---------- perfiles ----------
drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_miembro());

drop policy if exists perfiles_editar_el_propio on public.perfiles;
create policy perfiles_editar_el_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists perfiles_editar_admin on public.perfiles;
create policy perfiles_editar_admin on public.perfiles
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());


-- ---------- empresa ----------
drop policy if exists empresa_lectura on public.empresa;
create policy empresa_lectura on public.empresa
  for select to authenticated
  using (public.es_miembro());

drop policy if exists empresa_editar_admin on public.empresa;
create policy empresa_editar_admin on public.empresa
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());


-- ---------- órdenes de compra ----------
drop policy if exists oc_lectura on public.ordenes_compra;
create policy oc_lectura on public.ordenes_compra
  for select to authenticated
  using (public.es_miembro());

drop policy if exists oc_crear on public.ordenes_compra;
create policy oc_crear on public.ordenes_compra
  for insert to authenticated
  with check (public.es_miembro());

drop policy if exists oc_editar on public.ordenes_compra;
create policy oc_editar on public.ordenes_compra
  for update to authenticated
  using (public.es_miembro()) with check (public.es_miembro());

-- Borrar solo el administrador; en el día a día una orden se anula.
drop policy if exists oc_borrar_admin on public.ordenes_compra;
create policy oc_borrar_admin on public.ordenes_compra
  for delete to authenticated
  using (public.es_admin());
