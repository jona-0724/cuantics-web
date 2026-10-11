-- ============================================================================
--  POTENTE · Inventario de cierre: también de días que ya pasaron
--  ---------------------------------------------------------------------------
--  La primera versión solo dejaba guardar el inventario de HOY y solo a quien
--  tenía turno hoy. En la práctica se olvida: sobre todo el del último día,
--  cuando ya no hay un "mañana" con turno para acordarse.
--
--  Ahora:
--    · se puede llenar o corregir el inventario de cualquier día de la feria
--      que ya haya llegado (nunca uno futuro);
--    · lo puede hacer quien trabajó en esa feria, aunque hoy no tenga turno,
--      hasta 7 días después de que termine;
--    · el administrador, siempre y de cualquier día.
--
--  La versión anterior de guardar_inventario (sin fecha) se deja: una página
--  que todavía no se haya actualizado sigue guardando el día de hoy.
--
--  Depende de: 20261011120000_inventario_cierre.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. ¿TRABAJÉ EN ESTA FERIA?
--     Basta con tener un bloque asignado en ella, del día que sea.
-- ----------------------------------------------------------------------------
create or replace function public.trabaje_en_feria(p_feria uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.asignaciones a
      join public.bloques b on b.id = a.bloque_id
     where a.perfil_id = auth.uid()
       and b.feria_id  = p_feria
  );
$$;

-- Las ferias cuyo inventario todavía puedo completar: las que ya empezaron y
-- terminaron hace 7 días o menos. La página las ofrece aunque hoy no me toque.
create or replace function public.mis_ferias_inventario()
returns table (feria_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select f.id
    from public.ferias f
   where f.fecha_inicio <= (now() at time zone 'America/Lima')::date
     and f.fecha_fin    >= (now() at time zone 'America/Lima')::date - 7
     and public.trabaje_en_feria(f.id);
$$;


-- ----------------------------------------------------------------------------
--  2. GUARDAR, AHORA DICIENDO DE QUÉ DÍA
-- ----------------------------------------------------------------------------
create or replace function public.guardar_inventario(p_feria uuid, p_fecha date, p_datos jsonb, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_nombre text;
  v_hoy    date := (now() at time zone 'America/Lima')::date;
  v_inicio date;
  v_fin    date;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  select nombre into v_nombre from public.perfiles where id = v_perfil and activo;
  if not found then
    raise exception 'Tu cuenta está desactivada.';
  end if;
  select fecha_inicio, fecha_fin into v_inicio, v_fin from public.ferias where id = p_feria;
  if not found then
    raise exception 'Esa feria ya no existe.';
  end if;
  if p_fecha is null or p_fecha > v_hoy then
    raise exception 'No se puede guardar el inventario de un día que todavía no llega.';
  end if;

  -- El administrador guarda cualquier día. El equipo, solo días de la feria
  -- donde trabajó y hasta una semana después de que termine.
  if not public.es_admin() then
    if not (public.trabaje_en_feria(p_feria) or public.puedo_operar(p_feria)) then
      raise exception 'No trabajaste en esta feria.';
    end if;
    if p_fecha < v_inicio or p_fecha > v_fin then
      raise exception 'Ese día no es de esta feria.';
    end if;
    if v_hoy > v_fin + 7 then
      raise exception 'Esta feria terminó hace más de una semana. Pídele al administrador que lo corrija.';
    end if;
  end if;

  if p_datos is null or jsonb_typeof(p_datos) <> 'object' or length(p_datos::text) > 20000 then
    raise exception 'El inventario llegó con un formato que no se reconoce.';
  end if;

  insert into public.inventarios (feria_id, fecha, datos, nota, perfil_id, por_nombre, actualizado_en)
  values (p_feria, p_fecha, p_datos, nullif(btrim(left(p_nota, 4000)), ''), v_perfil, v_nombre, now())
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
--     Para corregir un día anterior hay que poder leerlo: el equipo ve los
--     inventarios de las ferias donde trabajó, no solo el de hoy.
-- ----------------------------------------------------------------------------
drop policy if exists inventarios_lectura on public.inventarios;
create policy inventarios_lectura on public.inventarios
  for select to authenticated
  using (
    public.es_admin()
    or public.puedo_operar(feria_id)
    or public.trabaje_en_feria(feria_id)
  );

revoke execute on function public.trabaje_en_feria(uuid)                       from anon, public;
revoke execute on function public.mis_ferias_inventario()                      from anon, public;
revoke execute on function public.guardar_inventario(uuid, date, jsonb, text)  from anon, public;

grant execute on function public.trabaje_en_feria(uuid)                        to authenticated;
grant execute on function public.mis_ferias_inventario()                       to authenticated;
grant execute on function public.guardar_inventario(uuid, date, jsonb, text)   to authenticated;

notify pgrst, 'reload schema';
