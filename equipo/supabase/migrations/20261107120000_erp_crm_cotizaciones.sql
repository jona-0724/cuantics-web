-- ============================================================================
--  CUANTICS · ERP (cuantics.pe/equipo) — CRM: CLIENTES, CATÁLOGO Y COTIZACIONES
--  Qué hace:
--    · clientes y contactos       → las empresas a las que se vende y su gente.
--    · lineas_producto, productos → el catálogo con part numbers por línea
--                                   (Kepware, Canary, Litmus, Ignition, Opto 22,
--                                   Tulip y servicios CUANTICS).
--    · cotizaciones               → COT-AÑO-0001 Rev0, Rev1… colgadas de una
--                                   oportunidad. Es la oferta económica.
--    · oportunidades              → se ligan a un cliente y a un contacto, y
--                                   suman la etapa "Cancelada".
--
--  Se corre UNA vez en Supabase → SQL Editor, después de
--  20261106120000_erp_ventas_pipeline.sql. Si se corre de nuevo no rompe nada.
-- ============================================================================

do $$
begin
  if to_regclass('public.oportunidades') is null then
    raise exception 'Primero corre 20261106120000_erp_ventas_pipeline.sql';
  end if;
  if to_regclass('public.clientes') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'clientes' and column_name = 'ruc') then
    raise exception 'Ya existe public.clientes de otra aplicación: no se aplica el esquema del ERP';
  end if;
  if to_regclass('public.productos') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'productos' and column_name = 'pn') then
    raise exception 'Ya existe public.productos de otra aplicación: no se aplica el esquema del ERP';
  end if;
end;
$$;


-- El teléfono de quien emite sale en el bloque EMITIDO POR y en la firma.
alter table public.perfiles add column if not exists telefono text not null default '';


-- ============================================================================
--  1. CLIENTES Y CONTACTOS
-- ============================================================================

create table if not exists public.clientes (
  id              uuid        primary key default gen_random_uuid(),
  nombre          text        not null default '',
  ruc             text        not null default '',
  pais            text        not null default 'Perú',
  direccion       text        not null default '',
  ciudad          text        not null default '',
  industria       text        not null default '',
  web             text        not null default '',
  telefono        text        not null default '',
  notas           text        not null default '',
  activo          boolean     not null default true,
  creado_por      uuid        references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
comment on table public.clientes is 'Empresas a las que se vende. Los datos salen en el bloque CLIENTE de cada cotización.';

create table if not exists public.contactos (
  id          uuid        primary key default gen_random_uuid(),
  cliente_id  uuid        not null references public.clientes (id) on delete cascade,
  nombre      text        not null default '',
  cargo       text        not null default '',
  correo      text        not null default '',
  telefono    text        not null default '',
  notas       text        not null default '',
  principal   boolean     not null default false,
  creado_en   timestamptz not null default now()
);
create index if not exists contactos_cliente on public.contactos (cliente_id);

drop trigger if exists al_actualizar_cliente on public.clientes;
create trigger al_actualizar_cliente
  before update on public.clientes
  for each row execute function public.tocar_actualizado_en();


-- ============================================================================
--  2. CATÁLOGO
-- ============================================================================

create table if not exists public.lineas_producto (
  id                 uuid     primary key default gen_random_uuid(),
  nombre             text     not null unique,
  fabricante         text     not null default '',
  orden              smallint not null default 0,
  plantilla_tecnica  text     not null default '',
  activo             boolean  not null default true
);
comment on column public.lineas_producto.plantilla_tecnica is
  'Ruta o enlace a la oferta técnica de la línea (Word). Vacío hasta que se elabore.';

insert into public.lineas_producto (nombre, fabricante, orden) values
  ('Kepware',             'PTC',                  1),
  ('Canary',              'Canary Labs',          2),
  ('Litmus',              'Litmus Automation',    3),
  ('Ignition',            'Inductive Automation', 4),
  ('Opto 22',             'Opto 22',              5),
  ('Tulip',               'Tulip Interfaces',     6),
  ('Servicios CUANTICS',  'CUANTICS',             9)
on conflict (nombre) do nothing;

create table if not exists public.productos (
  id              uuid          primary key default gen_random_uuid(),
  linea_id        uuid          references public.lineas_producto (id) on delete set null,
  pn              text          not null unique,
  nombre          text          not null default '',
  detalle         text          not null default '',
  seccion         text          not null default 'Licencias de software'
                                check (seccion in ('Licencias de software', 'Hardware', 'Servicios profesionales', 'Soporte y mantenimiento')),
  unidad          text          not null default 'Und.',
  moneda          text          not null default 'USD' check (moneda in ('USD', 'PEN', 'EUR')),
  precio          numeric(14,2) not null default 0,
  costo           numeric(14,2) not null default 0,
  activo          boolean       not null default true,
  creado_en       timestamptz   not null default now(),
  actualizado_en  timestamptz   not null default now()
);
comment on column public.productos.detalle is 'Viñetas que salen bajo la descripción en la cotización, una por línea.';
comment on column public.productos.seccion is 'Sección de la oferta económica: A. Licencias · Hardware · B. Servicios · C. Soporte.';

drop trigger if exists al_actualizar_producto on public.productos;
create trigger al_actualizar_producto
  before update on public.productos
  for each row execute function public.tocar_actualizado_en();

-- Los servicios propios que ya trae el Formato_COT.
insert into public.productos (linea_id, pn, nombre, detalle, seccion, unidad) values
  ((select id from public.lineas_producto where nombre = 'Servicios CUANTICS'), 'CUA-SRV-IMP', 'Servicio de implementación',
   E'Levantamiento, instalación y configuración.\nPruebas y puesta en marcha.', 'Servicios profesionales', 'Glb.'),
  ((select id from public.lineas_producto where nombre = 'Servicios CUANTICS'), 'CUA-SRV-CAP', 'Capacitación',
   'Usuarios y administradores · remota / presencial.', 'Servicios profesionales', 'Glb.'),
  ((select id from public.lineas_producto where nombre = 'Servicios CUANTICS'), 'CUA-SRV-SOP', 'Soporte post-implementación',
   'Bolsa de horas · horario y canal de atención.', 'Soporte y mantenimiento', 'Glb.')
on conflict (pn) do nothing;


-- ============================================================================
--  3. OPORTUNIDADES: cliente, contacto y etapa "Cancelada"
--     Cancelada = no llegó a cotizarse o el cliente la detuvo.
--     Perdida   = se cotizó y no se ganó.
-- ============================================================================

alter table public.oportunidades add column if not exists cliente_id  uuid references public.clientes (id)  on delete set null;
alter table public.oportunidades add column if not exists contacto_id uuid references public.contactos (id) on delete set null;

alter table public.oportunidades drop constraint if exists oportunidades_etapa_check;
alter table public.oportunidades add constraint oportunidades_etapa_check
  check (etapa in ('Calificación', 'Diagnóstico', 'Prueba de concepto', 'Propuesta',
                   'Licitación', 'Negociación', 'Ganada', 'Perdida', 'Cancelada'));

create or replace function public.numerar_oportunidad()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('oportunidades.numero'));
  if coalesce(new.numero, '') <> '' then
    if new.numero ~ '-[0-9]{4}-[0-9]+$' then
      new.anio        := substring(new.numero from '-([0-9]{4})-[0-9]+$')::smallint;
      new.correlativo := substring(new.numero from '-([0-9]+)$')::integer;
    end if;
  else
    new.anio := extract(year from (now() at time zone 'America/Lima'))::smallint;
    select coalesce(max(correlativo), 0) + 1 into new.correlativo
      from public.oportunidades where anio = new.anio;
    new.numero := 'OP-' || new.anio || '-' || lpad(new.correlativo::text, 4, '0');
  end if;
  if new.etapa in ('Ganada', 'Perdida', 'Cancelada') then new.cerrada_en := now(); end if;
  return new;
end;
$$;

create or replace function public.al_cambiar_oportunidad()
returns trigger language plpgsql as $$
begin
  if new.numero is distinct from old.numero
     or new.anio is distinct from old.anio
     or new.correlativo is distinct from old.correlativo then
    raise exception 'El número de una oportunidad no se cambia' using errcode = '42501';
  end if;
  if new.etapa in ('Ganada', 'Perdida', 'Cancelada') then
    if old.etapa not in ('Ganada', 'Perdida', 'Cancelada') then new.cerrada_en := now(); end if;
  else
    new.cerrada_en := null;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;


-- ============================================================================
--  4. COTIZACIONES
--     Una fila por revisión. COT-2026-0002 Rev0 y COT-2026-0002 Rev1 comparten
--     número; la base pone el número a una cotización nueva y el siguiente
--     Rev a una revisión. "datos" guarda la oferta tal como se llenó (cliente,
--     ítems, condiciones) para volver a emitirla idéntica.
-- ============================================================================

create table if not exists public.cotizaciones (
  id              uuid          primary key default gen_random_uuid(),
  oportunidad_id  uuid          references public.oportunidades (id) on delete set null,
  cliente_id      uuid          references public.clientes (id) on delete set null,
  numero          text,
  anio            smallint,
  correlativo     integer,
  rev             smallint      not null default 0,
  estado          text          not null default 'Borrador'
                                check (estado in ('Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Reemplazada')),
  fecha           date          not null default ((now() at time zone 'America/Lima')::date),
  cliente         text          not null default '',
  referencia      text          not null default '',
  moneda          text          not null default 'USD' check (moneda in ('USD', 'PEN', 'EUR')),
  subtotal        numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  datos           jsonb         not null default '{}'::jsonb,
  emitida_en      timestamptz,
  creado_por      uuid          references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz   not null default now(),
  actualizado_en  timestamptz   not null default now(),
  constraint cotizacion_revision_unica unique (numero, rev)
);
comment on column public.cotizaciones.estado is
  'Borrador · Enviada (emitida al cliente) · Aceptada · Rechazada · Reemplazada (hay una revisión más nueva). No se borran.';
create index if not exists cotizaciones_oportunidad on public.cotizaciones (oportunidad_id);
create index if not exists cotizaciones_recientes   on public.cotizaciones (creado_en desc);

-- Antes del ERP ya se emitió a mano la COT-2026-0001 (Carvajal). El correlativo
-- arranca después del último número emitido fuera del sistema.
update public.empresa
   set datos = datos || jsonb_build_object('cot_ultimo_manual', jsonb_build_object('2026', 1))
 where id = 1 and not (datos ? 'cot_ultimo_manual');

create or replace function public.numerar_cotizacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  serie  text;
  manual integer;
begin
  perform pg_advisory_xact_lock(hashtext('cotizaciones.numero'));

  if coalesce(new.numero, '') <> '' then
    -- Revisión de una cotización existente (o una importada con su número).
    if new.numero ~ '-[0-9]{4}-[0-9]+$' then
      new.anio        := substring(new.numero from '-([0-9]{4})-[0-9]+$')::smallint;
      new.correlativo := substring(new.numero from '-([0-9]+)$')::integer;
    end if;
    if exists (select 1 from public.cotizaciones where numero = new.numero) then
      select max(rev) + 1 into new.rev from public.cotizaciones where numero = new.numero;
    end if;
    return new;
  end if;

  select coalesce(nullif(datos ->> 'serie_cot', ''), 'COT'),
         coalesce((datos -> 'cot_ultimo_manual' ->> extract(year from (now() at time zone 'America/Lima'))::text)::integer, 0)
    into serie, manual
    from public.empresa where id = 1;
  new.anio := extract(year from (now() at time zone 'America/Lima'))::smallint;
  select greatest(coalesce(max(correlativo), 0), coalesce(manual, 0)) + 1 into new.correlativo
    from public.cotizaciones where anio = new.anio;
  new.numero := coalesce(serie, 'COT') || '-' || new.anio || '-' || lpad(new.correlativo::text, 4, '0');
  new.rev := 0;
  return new;
end;
$$;

drop trigger if exists al_crear_cotizacion on public.cotizaciones;
create trigger al_crear_cotizacion
  before insert on public.cotizaciones
  for each row execute function public.numerar_cotizacion();

create or replace function public.proteger_numero_cot()
returns trigger language plpgsql as $$
begin
  if new.numero is distinct from old.numero or new.rev is distinct from old.rev
     or new.anio is distinct from old.anio or new.correlativo is distinct from old.correlativo then
    raise exception 'El número y la revisión de una cotización no se cambian' using errcode = '42501';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_cotizacion on public.cotizaciones;
create trigger al_actualizar_cotizacion
  before update on public.cotizaciones
  for each row execute function public.proteger_numero_cot();


-- ============================================================================
--  5. SEGURIDAD A NIVEL DE FILA
--     El equipo activo lee, crea y edita. Borrar es solo del administrador.
--     El catálogo (líneas y productos) lo edita cualquiera del equipo.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'contactos', 'lineas_producto', 'productos', 'cotizaciones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);

    execute format('drop policy if exists %I on public.%I', t || '_lectura', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_miembro())', t || '_lectura', t);
    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_miembro())', t || '_crear', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_miembro()) with check (public.es_miembro())', t || '_editar', t);
    execute format('drop policy if exists %I on public.%I', t || '_borrar_admin', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_admin())', t || '_borrar_admin', t);
  end loop;
end;
$$;

-- Un contacto se borra desde la ficha del cliente: eso sí lo hace el equipo.
drop policy if exists contactos_borrar_equipo on public.contactos;
create policy contactos_borrar_equipo on public.contactos
  for delete to authenticated using (public.es_miembro());
