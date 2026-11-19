-- ============================================================================
--  CUANTICS · ERP (cuantics.pe/equipo) — PROSPECCIÓN (panel comercial)
--  La página equipo/comercial/ muestra los números de los agentes de
--  prospección (correo en frío, LinkedIn, Apollo). Esos datos viven en otra
--  base (cuantics-leads), cuya clave no puede ir en la web. Por eso el Manager
--  Comercial sube una "foto" en JSON después de cada agente, y aquí solo la
--  leen las cuentas activas del ERP.
--
--  1) prospeccion_fotos: una fila por día con la foto (jsonb).
--  2) prospeccion_clave: la clave con la que el Manager sube la foto. Nadie la
--     lee desde la web (RLS sin políticas). Se consulta una vez en el SQL Editor.
--  3) prospeccion_guardar(clave, fecha, datos): única forma de escribir.
--  4) Los 8 leads que respondieron a la prospección hasta el 19-nov-2026, en el
--     tablero de Leads (si ya están, no se duplican).
--
--  Se corre UNA vez en Supabase → SQL Editor, después de
--  20261108120000_erp_etiquetas_color.sql. Si se corre de nuevo no rompe nada,
--  no cambia la clave y no duplica leads.
-- ============================================================================

-- 1) Fotos ---------------------------------------------------------------------
create table if not exists public.prospeccion_fotos (
  fecha      date        primary key,
  datos      jsonb       not null,
  subido_en  timestamptz not null default now()
);
comment on table public.prospeccion_fotos is
  'Foto diaria de los números de prospección (correo, LinkedIn, Apollo). La sube el Manager Comercial; la lee equipo/comercial/.';

alter table public.prospeccion_fotos enable row level security;
revoke all on public.prospeccion_fotos from anon;
grant select on public.prospeccion_fotos to authenticated;

drop policy if exists prospeccion_lectura on public.prospeccion_fotos;
create policy prospeccion_lectura on public.prospeccion_fotos
  for select to authenticated using (public.es_miembro());

-- 2) Clave de escritura ------------------------------------------------------
create table if not exists public.prospeccion_clave (
  id     smallint primary key default 1 check (id = 1),
  clave  uuid     not null default gen_random_uuid()
);
insert into public.prospeccion_clave (id) values (1) on conflict (id) do nothing;

alter table public.prospeccion_clave enable row level security;   -- sin políticas: nadie la lee desde la web
revoke all on public.prospeccion_clave from anon, authenticated;

-- 3) Escribir la foto ------------------------------------------------------------
create or replace function public.prospeccion_guardar(p_clave uuid, p_fecha date, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_clave is null or p_clave is distinct from (select clave from public.prospeccion_clave where id = 1) then
    raise exception 'clave no válida';
  end if;
  if p_fecha is null or p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'faltan la fecha o los datos';
  end if;
  if octet_length(p_datos::text) > 2000000 then
    raise exception 'la foto pesa demasiado (máx. 2 MB)';
  end if;
  insert into public.prospeccion_fotos (fecha, datos, subido_en)
  values (p_fecha, p_datos, now())
  on conflict (fecha) do update set datos = excluded.datos, subido_en = now();
end;
$$;
revoke all on function public.prospeccion_guardar(uuid, date, jsonb) from public;
grant execute on function public.prospeccion_guardar(uuid, date, jsonb) to anon, authenticated;

-- 4) Leads que respondieron (hasta el 19-nov-2026) ------------------------------
--    "Reunión" va como En conversación con la reunión en el próximo paso.
insert into public.leads (estado, empresa, contacto, cargo, correo, origen, notas, proximo_paso, responsable, creado_por, actividad, creado_en)
select v.estado, v.empresa, v.contacto, v.cargo, v.correo, v.origen, v.notas, v.proximo,
       jo.id, jo.id,
       jsonb_build_array(jsonb_build_object('en', v.desde::timestamptz, 'quien', 'Manager Comercial', 'tipo', 'nota',
         'texto', 'Respondió a la prospección (' || v.origen || '). Cargado desde el panel comercial.')),
       v.desde::timestamptz
  from (values
    ('En conversación', 'Gerdau Metaldom', 'Luis Javier Paula', '', 'luis.paula@metaldom.com', 'Correo en frío',
     'Respondió el 05-nov-2026: de acuerdo con una reunión online; se le envió la invitación de calendario.', 'Reunión online (invitación enviada)', '2026-11-05'),
    ('En conversación', 'Buenaventura', 'Jean Falen', 'Jefe Corporativo de Innovación', 'jean.falen@buenaventura.pe', 'Correo en frío',
     'Respondió el 13-nov-2026: quiere reunirse a partir de la 2.ª semana de diciembre.', 'Reunión: agendar para la 2.ª semana de diciembre', '2026-11-13'),
    ('En conversación', 'Salica del Ecuador', 'Medardo Carvajal', '', 'Mcarvajal@salicadelecuador.com.ec', 'LinkedIn',
     'Respondió el 11-nov-2026 por LinkedIn y pidió la presentación para él y dos compañeros (Gian Loor, Carlos Ramírez).', 'Enviar la presentación', '2026-11-11'),
    ('En conversación', 'CNFL (Costa Rica)', 'Cristofer Marín', '', 'cmarin@cnfl.go.cr', 'Correo en frío',
     'Respondió el 16-nov-2026: trasladó la info a su jefatura de área y de unidad; si hay respuesta positiva agenda una presentación.', '', '2026-11-16'),
    ('En conversación', 'Gutis (Costa Rica)', 'Evelio Chaves', 'Supervisor de mantenimiento', 'e.chaves@gutis.com', 'Correo en frío',
     'Respondió el 16-nov-2026: agradece y comparte la info con el equipo de mantenimiento (copió a 9 colegas).', '', '2026-11-16'),
    ('Contactado', 'Tonicorp (Ecuador)', 'Rosa Andrea de la Paz', '', '', 'Correo en frío',
     'Respondió el 18-nov-2026: enviará la información al equipo de operaciones.', '', '2026-11-18'),
    ('Contactado', 'Pantaleón (Guatemala)', 'José Pablo Marroquín', '', 'jose.marroquin@pantaleon.com', 'Correo en frío',
     'Respondió el 12-nov-2026: ya usan un par de las herramientas; sin proyecto por ahora, compartirá la info con sus compañeros.', '', '2026-11-12'),
    ('Contactado', 'Hochschild (Perú)', 'William Chuctaya', '', 'william.chuctaya@hocplc.com', 'Correo en frío',
     'Respondió el 13-nov-2026: agradece la información.', '', '2026-11-13')
  ) as v (estado, empresa, contacto, cargo, correo, origen, notas, proximo, desde)
  left join lateral (
    select p.id from public.perfiles p join auth.users u on u.id = p.id
     where lower(u.email) = 'jonathan@cuantics.pe' limit 1
  ) jo on true
 where not exists (
   select 1 from public.leads l
    where lower(l.contacto) = lower(v.contacto)
       or (v.correo <> '' and lower(l.correo) = lower(v.correo))
 );

-- Para ver la clave (una vez) y guardarla en la PC del Manager Comercial:
--   select clave from public.prospeccion_clave;
select 'ok' as prospeccion,
       (select count(*) from public.leads where actividad::text like '%panel comercial%') as leads_cargados;
