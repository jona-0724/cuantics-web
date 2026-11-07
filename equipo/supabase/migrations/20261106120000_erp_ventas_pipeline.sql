-- ============================================================================
--  CUANTICS · ERP (cuantics.pe/equipo) — VENTAS: LEADS Y OPORTUNIDADES
--  Qué hace: crea el pipeline comercial en dos tableros.
--    · leads          → contactos todavía en verde: alguien con quien se habló,
--                       un interés, una tarjeta de feria. Se califican o se
--                       descartan.
--    · oportunidades  → el funnel real: hay proyecto, presupuesto o proceso
--                       (prueba de concepto, propuesta, licitación…).
--  Un lead calificado se convierte en oportunidad y queda ligado a ella.
--
--  Se corre UNA vez en Supabase → SQL Editor, después de
--  20261028120000_erp_crear_tablas.sql. Si se corre de nuevo no rompe nada.
--  Mismas convenciones: tablas en español, RLS activado, GRANT a mano.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.es_miembro()') is null then
    raise exception 'Primero corre 20261028120000_erp_crear_tablas.sql';
  end if;
  if to_regclass('public.leads') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'leads' and column_name = 'actividad') then
    raise exception 'Ya existe public.leads de otra aplicación: no se aplica el esquema del ERP';
  end if;
  if to_regclass('public.oportunidades') is not null and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'oportunidades' and column_name = 'actividad') then
    raise exception 'Ya existe public.oportunidades de otra aplicación: no se aplica el esquema del ERP';
  end if;
end;
$$;


-- ============================================================================
--  1. LEADS
-- ============================================================================

create table if not exists public.leads (
  id              uuid        primary key default gen_random_uuid(),
  estado          text        not null default 'Nuevo'
                              check (estado in ('Nuevo', 'Contactado', 'En conversación', 'Calificado', 'Descartado')),
  empresa         text        not null default '',
  contacto        text        not null default '',
  cargo           text        not null default '',
  correo          text        not null default '',
  telefono        text        not null default '',
  origen          text        not null default '',
  interes         text        not null default '',
  notas           text        not null default '',
  proximo_paso    text        not null default '',
  proximo_fecha   date,
  motivo_descarte text        not null default '',
  responsable     uuid        references public.perfiles (id) on delete set null default auth.uid(),
  oportunidad_id  uuid,
  actividad       jsonb       not null default '[]'::jsonb,
  creado_por      uuid        references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table  public.leads           is 'Prospectos todavía sin proyecto concreto. Se califican (pasan a oportunidad) o se descartan; no se borran.';
comment on column public.leads.estado    is 'Nuevo · Contactado · En conversación · Calificado (ya es oportunidad) · Descartado.';
comment on column public.leads.origen    is 'De dónde salió: LinkedIn, referido, feria, correo en frío, web…';
comment on column public.leads.actividad is 'Bitácora: [{en, quien, texto, tipo}] — notas, llamadas y cambios de estado.';

create index if not exists leads_recientes on public.leads (creado_en desc);


-- ============================================================================
--  2. OPORTUNIDADES
--     Número OP-AÑO-0001 puesto por la base, igual que las órdenes de compra:
--     sirve para citarla en correos, cotizaciones y expedientes de licitación.
-- ============================================================================

create table if not exists public.oportunidades (
  id              uuid        primary key default gen_random_uuid(),
  numero          text        unique,
  anio            smallint,
  correlativo     integer,
  nombre          text        not null default '',
  cliente         text        not null default '',
  contacto        text        not null default '',
  etapa           text        not null default 'Calificación'
                              check (etapa in ('Calificación', 'Diagnóstico', 'Prueba de concepto', 'Propuesta',
                                               'Licitación', 'Negociación', 'Ganada', 'Perdida')),
  tipo            text        not null default '',
  productos       text        not null default '',
  moneda          text        not null default 'USD' check (moneda in ('USD', 'PEN', 'EUR')),
  monto           numeric(14,2) not null default 0,
  probabilidad    smallint    not null default 10 check (probabilidad between 0 and 100),
  cierre_estimado date,
  competencia     text        not null default '',
  proximo_paso    text        not null default '',
  proximo_fecha   date,
  motivo_perdida  text        not null default '',
  notas           text        not null default '',
  responsable     uuid        references public.perfiles (id) on delete set null default auth.uid(),
  lead_id         uuid        references public.leads (id) on delete set null,
  actividad       jsonb       not null default '[]'::jsonb,
  cerrada_en      timestamptz,
  creado_por      uuid        references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint oportunidad_correlativo_unico unique (anio, correlativo)
);

comment on table  public.oportunidades              is 'Funnel real de ventas. No se borran: se marcan Ganada o Perdida.';
comment on column public.oportunidades.etapa        is 'Calificación · Diagnóstico · Prueba de concepto · Propuesta · Licitación · Negociación · Ganada · Perdida.';
comment on column public.oportunidades.probabilidad is 'Porcentaje de cierre. La página propone uno por etapa; se puede ajustar a mano.';
comment on column public.oportunidades.cerrada_en   is 'Se llena sola al pasar a Ganada o Perdida; se limpia si se reabre.';

create index if not exists oportunidades_recientes on public.oportunidades (creado_en desc);

-- La FK del lead hacia su oportunidad va después: las dos tablas se apuntan.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_oportunidad_fk') then
    alter table public.leads
      add constraint leads_oportunidad_fk foreign key (oportunidad_id)
      references public.oportunidades (id) on delete set null;
  end if;
end;
$$;


-- ============================================================================
--  3. FUNCIONES DE APOYO
-- ============================================================================

drop trigger if exists al_actualizar_lead on public.leads;
create trigger al_actualizar_lead
  before update on public.leads
  for each row execute function public.tocar_actualizado_en();


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

  if new.etapa in ('Ganada', 'Perdida') then new.cerrada_en := now(); end if;
  return new;
end;
$$;

drop trigger if exists al_crear_oportunidad on public.oportunidades;
create trigger al_crear_oportunidad
  before insert on public.oportunidades
  for each row execute function public.numerar_oportunidad();


create or replace function public.al_cambiar_oportunidad()
returns trigger language plpgsql as $$
begin
  if new.numero is distinct from old.numero
     or new.anio is distinct from old.anio
     or new.correlativo is distinct from old.correlativo then
    raise exception 'El número de una oportunidad no se cambia' using errcode = '42501';
  end if;
  if new.etapa in ('Ganada', 'Perdida') then
    if old.etapa not in ('Ganada', 'Perdida') then new.cerrada_en := now(); end if;
  else
    new.cerrada_en := null;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_oportunidad on public.oportunidades;
create trigger al_actualizar_oportunidad
  before update on public.oportunidades
  for each row execute function public.al_cambiar_oportunidad();


-- ============================================================================
--  4. SEGURIDAD A NIVEL DE FILA
--     Igual que compras: el equipo activo lee, crea y mueve; borrar es solo
--     del administrador (en el día a día un lead se descarta y una
--     oportunidad se pierde).
-- ============================================================================

alter table public.leads         enable row level security;
alter table public.oportunidades enable row level security;

revoke all on public.leads         from anon;
revoke all on public.oportunidades from anon;

grant select, insert, update, delete on public.leads         to authenticated;
grant select, insert, update, delete on public.oportunidades to authenticated;
grant all on public.leads         to service_role;
grant all on public.oportunidades to service_role;


drop policy if exists leads_lectura on public.leads;
create policy leads_lectura on public.leads
  for select to authenticated using (public.es_miembro());

drop policy if exists leads_crear on public.leads;
create policy leads_crear on public.leads
  for insert to authenticated with check (public.es_miembro());

drop policy if exists leads_editar on public.leads;
create policy leads_editar on public.leads
  for update to authenticated using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists leads_borrar_admin on public.leads;
create policy leads_borrar_admin on public.leads
  for delete to authenticated using (public.es_admin());


drop policy if exists op_lectura on public.oportunidades;
create policy op_lectura on public.oportunidades
  for select to authenticated using (public.es_miembro());

drop policy if exists op_crear on public.oportunidades;
create policy op_crear on public.oportunidades
  for insert to authenticated with check (public.es_miembro());

drop policy if exists op_editar on public.oportunidades;
create policy op_editar on public.oportunidades
  for update to authenticated using (public.es_miembro()) with check (public.es_miembro());

drop policy if exists op_borrar_admin on public.oportunidades;
create policy op_borrar_admin on public.oportunidades
  for delete to authenticated using (public.es_admin());
