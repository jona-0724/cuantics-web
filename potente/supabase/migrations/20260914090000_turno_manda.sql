-- ============================================================================
--  POTENTE · el turno manda
--  ---------------------------------------------------------------------------
--  Hasta ahora "Operación en feria" confiaba en la pantalla: escondía los
--  botones de quien no tenía turno, pero la base aceptaba igual el cobro.
--  Esto lo cierra donde de verdad cuenta.
--
--  La regla, una sola y en un solo sitio:
--    puedes cobrar y mover la cola de una feria si el administrador te asignó
--    un bloque de ESA feria para HOY y los turnos están publicados.
--    El administrador entra siempre, a cualquier feria: es quien resuelve.
--
--  El rol de la asignación (caja / cocina / jalador) NO decide la pantalla:
--  en el stand se rota, así que quien está asignado usa las dos. El rol sigue
--  sirviendo como referencia al armar los turnos.
--
--  Depende de: 20260913120000_operacion_feria.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. LA REGLA
-- ----------------------------------------------------------------------------

-- ¿Me toca hoy esta feria? Corre como dueña porque tiene que mirar
-- asignaciones y bloques de todo el mundo para responder por uno.
create or replace function public.tengo_turno(p_feria uuid)
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
      join public.ferias  f on f.id = b.feria_id
     where a.perfil_id = auth.uid()
       and b.feria_id  = p_feria
       and b.fecha     = (now() at time zone 'America/Lima')::date
       and f.estado    = 'publicada'
  );
$$;

-- Atajo para no repetir la misma condición en cada sitio.
create or replace function public.puedo_operar(p_feria uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin() or public.tengo_turno(p_feria);
$$;

-- Mi bloque de hoy en esa feria. Sirve para no creerle al navegador: el bloque
-- que queda grabado en la orden sale de aquí, no de lo que mande la pantalla.
create or replace function public.mi_bloque_hoy(p_feria uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
    from public.asignaciones a
    join public.bloques b on b.id = a.bloque_id
   where a.perfil_id = auth.uid()
     and b.feria_id  = p_feria
     and b.fecha     = (now() at time zone 'America/Lima')::date
   order by abs(extract(epoch from (
              b.hora_inicio - (now() at time zone 'America/Lima')::time)))
   limit 1;
$$;


-- ----------------------------------------------------------------------------
--  2. LA COLA: solo la de tu feria
-- ----------------------------------------------------------------------------
-- Antes cualquier usuario con sesión podía leer la cola de cualquier feria.
-- Las vistas corren como dueñas, así que el filtro va aquí dentro.

create or replace view public.cola_feria as
  select id, feria_id, bloque_id, numero, dia, estado, nota,
         cajero_id, cocinero_id, creado_en, iniciada_en, lista_en, entregada_en
    from public.ordenes
   where estado <> 'anulado'
     and public.puedo_operar(feria_id);

create or replace view public.cola_feria_items as
  select i.id, i.orden_id, i.sku, i.nombre, i.categoria, i.cantidad,
         i.opciones, i.salsas, i.nota
    from public.orden_items i
    join public.ordenes o on o.id = i.orden_id
   where o.estado <> 'anulado'
     and public.puedo_operar(o.feria_id);

revoke all on public.cola_feria, public.cola_feria_items from anon;
grant select on public.cola_feria, public.cola_feria_items to authenticated;


-- ----------------------------------------------------------------------------
--  3. COBRAR: solo en tu feria, y con tu bloque
-- ----------------------------------------------------------------------------

create or replace function public.crear_orden(
  p_feria    uuid,
  p_bloque   uuid,
  p_medio    text,
  p_nota     text,
  p_items    jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_num    integer;
  v_orden  uuid;
  v_total  numeric(10,2) := 0;
  v_item   jsonb;
  v_dia    date := (now() at time zone 'America/Lima')::date;
  v_bloque uuid;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión para cobrar.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_perfil and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;
  if not public.puedo_operar(p_feria) then
    raise exception 'Hoy no estás asignado a esta feria. Pídele al administrador que te asigne el turno y vuelve a entrar.';
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'El pedido está vacío.';
  end if;

  -- El bloque sale de la asignación, no de la pantalla. Si es el administrador
  -- cubriendo sin turno propio, se acepta lo que mande y si no, queda en nulo.
  v_bloque := coalesce(public.mi_bloque_hoy(p_feria), p_bloque);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'subtotal')::numeric;
  end loop;

  -- Hasta 25 intentos: si otra caja se llevó el número mientras tanto,
  -- se vuelve a calcular. En la práctica entra al primero.
  for i in 1..25 loop
    select coalesce(max(numero),0) + 1 into v_num
      from public.ordenes where feria_id = p_feria;
    begin
      insert into public.ordenes (feria_id, bloque_id, numero, dia, cajero_id, medio_pago, total, nota)
      values (p_feria, v_bloque, v_num, v_dia, v_perfil, p_medio, v_total, nullif(p_nota,''))
      returning id into v_orden;
      exit;
    exception when unique_violation then
      v_orden := null;
    end;
  end loop;

  if v_orden is null then
    raise exception 'No se pudo asignar número de ticket. Inténtalo otra vez.';
  end if;

  insert into public.orden_items (orden_id, sku, nombre, categoria, cantidad, precio, subtotal, opciones, salsas, nota)
  select v_orden,
         it->>'sku', it->>'nombre', it->>'categoria',
         (it->>'cantidad')::smallint, (it->>'precio')::numeric, (it->>'subtotal')::numeric,
         coalesce(it->'opciones','{}'::jsonb),
         coalesce((select array_agg(value::text) from jsonb_array_elements_text(it->'salsas')), '{}'),
         nullif(it->>'nota','')
    from jsonb_array_elements(p_items) it;

  return v_num;
end;
$$;


-- ----------------------------------------------------------------------------
--  4. MOVER LA COLA: solo en tu feria
-- ----------------------------------------------------------------------------

create or replace function public.marcar_estado(p_orden uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_ahora  timestamptz := now();
  v_feria  uuid;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if p_estado not in ('cola','prep','listo','entregado') then
    raise exception 'Estado desconocido: %', p_estado;
  end if;
  if not exists (select 1 from public.perfiles where id = v_perfil and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;

  select feria_id into v_feria from public.ordenes where id = p_orden;
  if v_feria is null then
    raise exception 'Esa orden ya no existe.';
  end if;
  if not public.puedo_operar(v_feria) then
    raise exception 'Hoy no estás asignado a esta feria.';
  end if;

  update public.ordenes set
    estado       = p_estado,
    cocinero_id  = case when p_estado in ('prep','listo') and cocinero_id is null then v_perfil else cocinero_id end,
    iniciada_en  = case when p_estado = 'prep'      and iniciada_en  is null then v_ahora else iniciada_en  end,
    -- Si pasó de la cola directo a listo, la preparación empezó en ese mismo
    -- instante: sin esto el reporte de cocina no podría separar las etapas.
    lista_en     = case when p_estado = 'listo'     then coalesce(lista_en, v_ahora)     else lista_en end,
    entregada_en = case when p_estado = 'entregado' then coalesce(entregada_en, v_ahora) else entregada_en end
  where id = p_orden and estado <> 'anulado';

  update public.ordenes
     set iniciada_en = lista_en
   where id = p_orden and lista_en is not null and iniciada_en is null;
end;
$$;


-- ----------------------------------------------------------------------------
--  5. MI TURNO DE HOY: ahora dice también si ya está publicado
-- ----------------------------------------------------------------------------
-- Sin esta columna, un turno armado pero sin publicar se vería igual que
-- "no te toca", y el equipo no sabría a quién reclamar.

drop function if exists public.mi_turno_hoy();
create function public.mi_turno_hoy()
returns table (feria_id uuid, bloque_id uuid, rol text,
               hora_inicio time, hora_fin time, publicado boolean)
language sql
security definer
set search_path = public
as $$
  select b.feria_id, b.id, a.rol, b.hora_inicio, b.hora_fin,
         (f.estado = 'publicada') as publicado
    from public.asignaciones a
    join public.bloques b on b.id = a.bloque_id
    join public.ferias  f on f.id = b.feria_id
   where a.perfil_id = auth.uid()
     and b.fecha = (now() at time zone 'America/Lima')::date
   order by b.hora_inicio;
$$;


-- ----------------------------------------------------------------------------
--  6. EL AVANCE DEL BONO: solo el de la feria donde estás
-- ----------------------------------------------------------------------------

create or replace function public.avance_bono(p_feria uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendido numeric;
  v_punto0  numeric;
  v_pct     smallint;
begin
  if not public.puedo_operar(p_feria) then return null; end if;
  select punto0, bono_pct into v_punto0, v_pct from public.ferias where id = p_feria;
  if v_punto0 is null or v_punto0 <= 0 then return null; end if;
  select coalesce(sum(total),0) into v_vendido
    from public.ordenes where feria_id = p_feria and estado <> 'anulado';
  return floor(v_vendido / (v_punto0 * (1 + v_pct / 100.0)) * 100)::integer;
end;
$$;


-- ----------------------------------------------------------------------------
--  7. PERMISOS
-- ----------------------------------------------------------------------------

revoke execute on function public.tengo_turno(uuid)                           from anon, public;
revoke execute on function public.puedo_operar(uuid)                          from anon, public;
revoke execute on function public.mi_bloque_hoy(uuid)                         from anon, public;
revoke execute on function public.crear_orden(uuid, uuid, text, text, jsonb)  from anon, public;
revoke execute on function public.marcar_estado(uuid, text)                   from anon, public;
revoke execute on function public.mi_turno_hoy()                              from anon, public;
revoke execute on function public.avance_bono(uuid)                           from anon, public;

grant execute on function public.tengo_turno(uuid)                            to authenticated;
grant execute on function public.puedo_operar(uuid)                           to authenticated;
grant execute on function public.mi_bloque_hoy(uuid)                          to authenticated;
grant execute on function public.crear_orden(uuid, uuid, text, text, jsonb)   to authenticated;
grant execute on function public.marcar_estado(uuid, text)                    to authenticated;
grant execute on function public.mi_turno_hoy()                               to authenticated;
grant execute on function public.avance_bono(uuid)                            to authenticated;
