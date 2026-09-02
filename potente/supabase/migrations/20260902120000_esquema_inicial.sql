-- ============================================================================
--  POTENTE · EQUIPO — Esquema inicial
--  Disponibilidad de feriantes y armado de turnos por feria.
--
--  Convenciones:
--    · Todo en español, para que las tablas se lean igual que se habla.
--    · Cada tabla nace con RLS activado y sin permisos. Nada se lee ni se
--      escribe si no hay una política explícita más abajo.
--    · Esta migración no se edita nunca. Los cambios van en archivos nuevos.
-- ============================================================================

create extension if not exists pgcrypto;


-- ============================================================================
--  1. PERFILES
--     Una fila por persona del equipo, ligada a su cuenta de acceso.
--     Las contraseñas y los correos los administra Supabase en auth.users;
--     aquí solo guardamos lo nuestro.
-- ============================================================================

create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text        not null default '',
  telefono   text,
  rol        text        not null default 'feriante'
                         check (rol in ('admin', 'feriante')),
  activo     boolean     not null default true,
  creado_en  timestamptz not null default now()
);

comment on table  public.perfiles      is 'Miembros del equipo Potente.';
comment on column public.perfiles.rol  is 'admin arma los turnos; feriante solo marca su disponibilidad.';
comment on column public.perfiles.activo is 'Se apaga en vez de borrar, para no perder el historial de ferias pasadas.';


-- Correos que reciben rol de administrador automáticamente al registrarse.
-- Agregar aquí a alguien es darle control total: hazlo en una migración nueva,
-- para que quede el registro de cuándo y por qué.
create table if not exists public.admins_iniciales (
  correo text primary key
);

insert into public.admins_iniciales (correo) values
  ('jonoc90@gmail.com')
on conflict do nothing;


-- ============================================================================
--  2. FERIAS Y BLOQUES
--     Una feria son varios días; cada día se parte en bloques de horario.
--     El bloque es la unidad sobre la que todo gira: la gente marca si puede
--     y el administrador asigna quién trabaja.
-- ============================================================================

create table if not exists public.ferias (
  id            uuid primary key default gen_random_uuid(),
  nombre        text        not null,
  lugar         text,
  fecha_inicio  date        not null,
  fecha_fin     date        not null,
  estado        text        not null default 'borrador'
                            check (estado in ('borrador', 'abierta', 'cerrada', 'publicada')),
  notas         text,
  creado_en     timestamptz not null default now(),
  constraint fechas_coherentes check (fecha_fin >= fecha_inicio)
);

comment on column public.ferias.estado is
  'borrador: solo la ve el admin · abierta: el equipo marca disponibilidad · cerrada: ya no se puede marcar · publicada: los turnos están asignados y a la vista.';


create table if not exists public.bloques (
  id                  uuid primary key default gen_random_uuid(),
  feria_id            uuid not null references public.ferias (id) on delete cascade,
  fecha               date not null,
  hora_inicio         time not null,
  hora_fin            time not null,
  personas_necesarias smallint not null default 3 check (personas_necesarias > 0),
  etiqueta            text,
  constraint horas_coherentes check (hora_fin > hora_inicio),
  constraint bloque_unico unique (feria_id, fecha, hora_inicio, hora_fin)
);

comment on column public.bloques.etiqueta is 'Nombre corto opcional: "Mañana", "Cierre", "Pico noche".';

create index if not exists bloques_por_feria on public.bloques (feria_id, fecha, hora_inicio);


-- ============================================================================
--  3. DISPONIBILIDAD
--     Lo que cada feriante declara. Una respuesta por persona y bloque:
--     si vuelve a marcar, se actualiza la misma fila en vez de duplicar.
-- ============================================================================

create table if not exists public.disponibilidad (
  id             uuid primary key default gen_random_uuid(),
  bloque_id      uuid not null references public.bloques  (id) on delete cascade,
  perfil_id      uuid not null references public.perfiles (id) on delete cascade,
  estado         text not null check (estado in ('si', 'no', 'quizas')),
  comentario     text,
  actualizado_en timestamptz not null default now(),
  constraint una_respuesta_por_bloque unique (bloque_id, perfil_id)
);

create index if not exists disponibilidad_por_bloque on public.disponibilidad (bloque_id);
create index if not exists disponibilidad_por_perfil on public.disponibilidad (perfil_id);


-- ============================================================================
--  4. ASIGNACIONES
--     La decisión del administrador: quién trabaja en qué bloque y con qué rol.
--     Una persona no puede estar dos veces en el mismo bloque.
-- ============================================================================

create table if not exists public.asignaciones (
  id         uuid primary key default gen_random_uuid(),
  bloque_id  uuid not null references public.bloques  (id) on delete cascade,
  perfil_id  uuid not null references public.perfiles (id) on delete cascade,
  rol        text not null check (rol in ('caja', 'cocina', 'jalador')),
  creado_en  timestamptz not null default now(),
  constraint una_asignacion_por_bloque unique (bloque_id, perfil_id)
);

create index if not exists asignaciones_por_bloque on public.asignaciones (bloque_id);
create index if not exists asignaciones_por_perfil on public.asignaciones (perfil_id);


-- ============================================================================
--  5. FUNCIONES DE APOYO
-- ============================================================================

-- ¿Quien está haciendo esta consulta es administrador?
-- Va como SECURITY DEFINER a propósito: si consultara perfiles con los permisos
-- del propio usuario, las políticas de perfiles se llamarían a sí mismas y
-- Postgres entraría en recursión infinita.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and rol = 'admin'
      and activo
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;


-- Al crearse una cuenta nueva, se crea su perfil automáticamente.
-- Si el correo está en admins_iniciales, entra directo como administrador.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_asignado text := 'feriante';
begin
  if exists (select 1 from public.admins_iniciales where correo = lower(new.email)) then
    rol_asignado := 'admin';
  end if;

  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    rol_asignado
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();


-- Candado contra la escalada de privilegios.
-- La política de más abajo deja que cada quien edite SU fila de perfil, pero
-- "su fila" incluye la columna rol: sin esto, cualquier feriante podría
-- ascenderse a administrador con una sola petición desde el navegador.
create or replace function public.proteger_rol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
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


-- Marca de tiempo automática cuando alguien cambia su disponibilidad.
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_actualizar_disponibilidad on public.disponibilidad;
create trigger al_actualizar_disponibilidad
  before update on public.disponibilidad
  for each row execute function public.tocar_actualizado_en();


-- ============================================================================
--  6. SEGURIDAD A NIVEL DE FILA
--     A partir de aquí, todo está cerrado salvo lo que se abre explícitamente.
--     Sin sesión iniciada no se ve absolutamente nada.
-- ============================================================================

alter table public.perfiles         enable row level security;
alter table public.ferias           enable row level security;
alter table public.bloques          enable row level security;
alter table public.disponibilidad   enable row level security;
alter table public.asignaciones     enable row level security;
alter table public.admins_iniciales enable row level security;
-- admins_iniciales queda sin políticas a propósito: nadie la lee ni la escribe
-- desde la aplicación. Solo la usa el trigger, que corre como SECURITY DEFINER.


-- Permisos de tabla, explícitos y no heredados de ninguna casilla del panel.
-- Esto solo dice "esta tabla es alcanzable"; quién ve qué filas lo deciden las
-- políticas de más abajo. A los visitantes sin sesión (anon) no se les da nada.
grant usage on schema public to authenticated;

grant select, update, delete on public.perfiles       to authenticated;
grant select, insert, update, delete on public.ferias         to authenticated;
grant select, insert, update, delete on public.bloques        to authenticated;
grant select, insert, update, delete on public.disponibilidad to authenticated;
grant select, insert, update, delete on public.asignaciones   to authenticated;


-- ---------- perfiles ----------
-- El equipo se ve entre sí (hacen falta los nombres para mostrar los turnos).
drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles
  for select to authenticated
  using (true);

-- Cada quien edita su nombre y teléfono, nadie más.
drop policy if exists perfiles_editar_el_propio on public.perfiles;
create policy perfiles_editar_el_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El administrador puede editar a cualquiera (activar, desactivar, corregir).
drop policy if exists perfiles_editar_admin on public.perfiles;
create policy perfiles_editar_admin on public.perfiles
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists perfiles_borrar_admin on public.perfiles;
create policy perfiles_borrar_admin on public.perfiles
  for delete to authenticated
  using (public.es_admin());

-- Nadie inserta perfiles a mano: los crea el trigger al registrarse la cuenta.


-- ---------- ferias ----------
-- El equipo ve las ferias que ya salieron de borrador.
drop policy if exists ferias_lectura on public.ferias;
create policy ferias_lectura on public.ferias
  for select to authenticated
  using (estado <> 'borrador' or public.es_admin());

drop policy if exists ferias_escritura_admin on public.ferias;
create policy ferias_escritura_admin on public.ferias
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());


-- ---------- bloques ----------
drop policy if exists bloques_lectura on public.bloques;
create policy bloques_lectura on public.bloques
  for select to authenticated
  using (
    exists (
      select 1 from public.ferias f
      where f.id = bloques.feria_id
        and (f.estado <> 'borrador' or public.es_admin())
    )
  );

drop policy if exists bloques_escritura_admin on public.bloques;
create policy bloques_escritura_admin on public.bloques
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());


-- ---------- disponibilidad ----------
-- Cada feriante ve solo lo suyo. El administrador ve todo.
drop policy if exists disponibilidad_lectura on public.disponibilidad;
create policy disponibilidad_lectura on public.disponibilidad
  for select to authenticated
  using (perfil_id = auth.uid() or public.es_admin());

-- Se marca disponibilidad solo sobre ferias abiertas, y solo en nombre propio.
drop policy if exists disponibilidad_crear on public.disponibilidad;
create policy disponibilidad_crear on public.disponibilidad
  for insert to authenticated
  with check (
    perfil_id = auth.uid()
    and exists (
      select 1
      from public.bloques b
      join public.ferias  f on f.id = b.feria_id
      where b.id = disponibilidad.bloque_id
        and f.estado = 'abierta'
    )
  );

drop policy if exists disponibilidad_editar on public.disponibilidad;
create policy disponibilidad_editar on public.disponibilidad
  for update to authenticated
  using (
    perfil_id = auth.uid()
    and exists (
      select 1
      from public.bloques b
      join public.ferias  f on f.id = b.feria_id
      where b.id = disponibilidad.bloque_id
        and f.estado = 'abierta'
    )
  )
  with check (perfil_id = auth.uid());

drop policy if exists disponibilidad_borrar on public.disponibilidad;
create policy disponibilidad_borrar on public.disponibilidad
  for delete to authenticated
  using (perfil_id = auth.uid() or public.es_admin());


-- ---------- asignaciones ----------
-- Los turnos ya decididos los ve todo el equipo, pero solo cuando la feria
-- está publicada. Antes de eso son borradores del administrador.
drop policy if exists asignaciones_lectura on public.asignaciones;
create policy asignaciones_lectura on public.asignaciones
  for select to authenticated
  using (
    public.es_admin()
    or exists (
      select 1
      from public.bloques b
      join public.ferias  f on f.id = b.feria_id
      where b.id = asignaciones.bloque_id
        and f.estado = 'publicada'
    )
  );

drop policy if exists asignaciones_escritura_admin on public.asignaciones;
create policy asignaciones_escritura_admin on public.asignaciones
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());
