-- ============================================================================
--  POTENTE · Inventario de cierre
--  ---------------------------------------------------------------------------
--  Al cerrar cada día de feria el equipo anota lo que queda: insumos,
--  descartables, cómo quedaron los chisguetes de salsa y cuántas bolsas de
--  reserva se usaron. Con eso el administrador sabe qué llevar al día
--  siguiente.
--
--  Un inventario por feria y por día. Lo llena quien cierra y cualquiera del
--  turno puede corregirlo después: se guarda encima, con el nombre y la hora
--  del último que lo tocó.
--
--  La lista de insumos NO está aquí: vive en la página, y lo que se guarda es
--  un jsonb {cant, nivel, repo}. Así agregar o quitar un insumo no necesita
--  tocar la base ni rompe los inventarios ya guardados.
--
--  Igual que con las órdenes, el equipo no escribe en la tabla: guarda por una
--  función que comprueba el turno y pone ella misma la fecha, la persona y la
--  hora.
--
--  Depende de: 20260914090000_turno_manda.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. LA TABLA
-- ----------------------------------------------------------------------------
create table if not exists public.inventarios (
  id             uuid primary key default gen_random_uuid(),
  feria_id       uuid not null references public.ferias (id) on delete cascade,
  fecha          date not null,
  datos          jsonb not null default '{}'::jsonb,
  nota           text,
  perfil_id      uuid references public.perfiles (id) on delete set null,
  por_nombre     text,
  actualizado_en timestamptz not null default now(),
  constraint un_inventario_por_dia unique (feria_id, fecha)
);

comment on table public.inventarios is
  'Lo que queda al cierre de cada día de feria. datos = {cant:{insumo:n}, nivel:{salsa:nivel}, repo:{salsa:bolsas usadas}}.';

create index if not exists inventarios_por_feria on public.inventarios (feria_id, fecha);


-- ----------------------------------------------------------------------------
--  2. GUARDAR
--     La fecha no la manda el celular: es el día de hoy en Lima. Un
--     inventario de ayer ya no se toca desde el stand.
-- ----------------------------------------------------------------------------
create or replace function public.guardar_inventario(p_feria uuid, p_datos jsonb, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_nombre text;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  select nombre into v_nombre from public.perfiles where id = v_perfil and activo;
  if not found then
    raise exception 'Tu cuenta está desactivada.';
  end if;
  if not public.puedo_operar(p_feria) then
    raise exception 'Hoy no estás asignado a esta feria.';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' or length(p_datos::text) > 20000 then
    raise exception 'El inventario llegó con un formato que no se reconoce.';
  end if;

  insert into public.inventarios (feria_id, fecha, datos, nota, perfil_id, por_nombre, actualizado_en)
  values (p_feria, v_hoy, p_datos, nullif(btrim(left(p_nota, 4000)), ''), v_perfil, v_nombre, now())
  on conflict (feria_id, fecha) do update
     set datos          = excluded.datos,
         nota           = excluded.nota,
         perfil_id      = excluded.perfil_id,
         por_nombre     = excluded.por_nombre,
         actualizado_en = excluded.actualizado_en;
end;
$$;


-- ----------------------------------------------------------------------------
--  3. PERMISOS
--     El equipo lee solo el inventario de HOY de la feria donde tiene turno,
--     para poder retomarlo y corregirlo. El histórico es del administrador.
-- ----------------------------------------------------------------------------
alter table public.inventarios enable row level security;

grant select, insert, update, delete on public.inventarios to authenticated;

drop policy if exists inventarios_lectura on public.inventarios;
create policy inventarios_lectura on public.inventarios
  for select to authenticated
  using (
    public.es_admin()
    or (public.puedo_operar(feria_id) and fecha = (now() at time zone 'America/Lima')::date)
  );

drop policy if exists inventarios_admin on public.inventarios;
create policy inventarios_admin on public.inventarios
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

revoke execute on function public.guardar_inventario(uuid, jsonb, text) from anon, public;
grant  execute on function public.guardar_inventario(uuid, jsonb, text) to authenticated;

-- Para que la página encuentre la tabla y la función sin esperar.
notify pgrst, 'reload schema';
