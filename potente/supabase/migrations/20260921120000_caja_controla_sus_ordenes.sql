-- ============================================================================
--  POTENTE · Caja controla sus órdenes
--  ---------------------------------------------------------------------------
--  Tres cosas que faltaban en el stand:
--
--  1. NOMBRE DEL CLIENTE — para llamarlo cuando su pedido está listo, en vez
--     de gritar el número y que nadie voltee.
--
--  2. CAJA VE SUS PEDIDOS — hasta ahora, al mandar la orden a cocina, caja la
--     perdía de vista: un error solo lo podía arreglar el administrador desde
--     Ventas. Ahora caja ve la lista del día, corrige y anula.
--
--  3. PASADO POR POS — en el pico se cobra rápido y el voucher del POS se hace
--     después. Cada orden lleva su marca de "ya la pasé", para que al cerrar
--     no quede ninguna sin pasar.
--
--  Lo que NO cambia: cocina sigue leyendo una vista sin un solo monto, y la
--  tabla de órdenes sigue siendo de lectura solo para el administrador. Todo
--  lo que caja escribe pasa por funciones que comprueban el turno.
--
--  Depende de: 20260914090000_turno_manda.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. COLUMNAS NUEVAS
-- ----------------------------------------------------------------------------
alter table public.ordenes
  add column if not exists cliente    text,
  add column if not exists pos_ok     boolean not null default false,
  add column if not exists editada_en timestamptz;

comment on column public.ordenes.cliente is
  'A quién llamar cuando el pedido esté listo. Opcional.';
comment on column public.ordenes.pos_ok is
  'true = caja ya pasó este cobro por el POS. Sirve para cuadrar al cierre.';
comment on column public.ordenes.editada_en is
  'Última vez que caja corrigió la orden después de mandarla. Cocina lo ve marcado.';


-- ----------------------------------------------------------------------------
--  2. LO QUE VE COCINA
--     Se le agregan el nombre del cliente y el medio de pago (que es un dato
--     del pedido, no un monto): sin el medio, la etiqueta de la tarjeta salía
--     vacía. Ni un sol más que antes.
-- ----------------------------------------------------------------------------
create or replace view public.cola_feria as
  select id, feria_id, bloque_id, numero, dia, estado, nota,
         cajero_id, cocinero_id, creado_en, iniciada_en, lista_en, entregada_en,
         cliente, medio_pago, editada_en
    from public.ordenes
   where estado <> 'anulado'
     and public.puedo_operar(feria_id);


-- ----------------------------------------------------------------------------
--  3. LO QUE VE CAJA
--     Caja sí necesita el monto: es quien cobra y quien pasa el voucher por el
--     POS. Incluye las anuladas, porque parte de su trabajo es verlas.
--     Solo del día en curso: el histórico es del administrador.
-- ----------------------------------------------------------------------------
create or replace view public.cola_caja as
  select o.id, o.feria_id, o.bloque_id, o.numero, o.dia, o.estado, o.nota,
         o.cajero_id, o.cocinero_id, o.creado_en, o.iniciada_en, o.lista_en,
         o.entregada_en, o.cliente, o.medio_pago, o.editada_en,
         o.total, o.pos_ok
    from public.ordenes o
   where o.dia = (now() at time zone 'America/Lima')::date
     and public.puedo_operar(o.feria_id);

create or replace view public.cola_caja_items as
  select i.id, i.orden_id, i.sku, i.nombre, i.categoria, i.cantidad,
         i.opciones, i.salsas, i.nota, i.precio, i.subtotal
    from public.orden_items i
    join public.ordenes o on o.id = i.orden_id
   where o.dia = (now() at time zone 'America/Lima')::date
     and public.puedo_operar(o.feria_id);

revoke all on public.cola_caja, public.cola_caja_items from anon;
grant select on public.cola_caja, public.cola_caja_items to authenticated;


-- ----------------------------------------------------------------------------
--  4. COBRAR, ahora con el nombre del cliente
--     Es una versión de seis parámetros al lado de la de cinco: si la página
--     todavía no está actualizada, sigue cobrando por la anterior.
-- ----------------------------------------------------------------------------
create or replace function public.crear_orden(
  p_feria    uuid,
  p_bloque   uuid,
  p_medio    text,
  p_nota     text,
  p_cliente  text,
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

  v_bloque := coalesce(public.mi_bloque_hoy(p_feria), p_bloque);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'subtotal')::numeric;
  end loop;

  for i in 1..25 loop
    select coalesce(max(numero),0) + 1 into v_num
      from public.ordenes where feria_id = p_feria;
    begin
      insert into public.ordenes (feria_id, bloque_id, numero, dia, cajero_id, medio_pago, total, nota, cliente)
      values (p_feria, v_bloque, v_num, v_dia, v_perfil, p_medio, v_total, nullif(p_nota,''), nullif(btrim(p_cliente),''))
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
--  5. CORREGIR UNA ORDEN YA MANDADA
--     Reemplaza sus líneas y recalcula el total. Conserva el número de ticket
--     —el cliente ya se lo llevó— y deja marcado que cambió, para que cocina
--     no siga preparando lo de antes.
--     Solo del día, solo en tu feria y mientras no esté entregada ni anulada.
-- ----------------------------------------------------------------------------
create or replace function public.editar_orden(
  p_orden   uuid,
  p_medio   text,
  p_nota    text,
  p_cliente text,
  p_items   jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_feria  uuid;
  v_dia    date;
  v_estado text;
  v_total  numeric(10,2) := 0;
  v_item   jsonb;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_perfil and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'El pedido no puede quedar vacío. Si ya no va, anúlalo.';
  end if;

  select feria_id, dia, estado into v_feria, v_dia, v_estado
    from public.ordenes where id = p_orden;
  if v_feria is null then
    raise exception 'Esa orden ya no existe.';
  end if;
  if not public.puedo_operar(v_feria) then
    raise exception 'Hoy no estás asignado a esta feria.';
  end if;
  if v_dia <> (now() at time zone 'America/Lima')::date then
    raise exception 'Solo se pueden corregir las órdenes de hoy.';
  end if;
  if v_estado = 'anulado' then
    raise exception 'Esa orden está anulada. Restáurala primero.';
  end if;
  if v_estado = 'entregado' then
    raise exception 'Esa orden ya se entregó. Si hay que devolver algo, anúlala y toma una nueva.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'subtotal')::numeric;
  end loop;

  delete from public.orden_items where orden_id = p_orden;

  insert into public.orden_items (orden_id, sku, nombre, categoria, cantidad, precio, subtotal, opciones, salsas, nota)
  select p_orden,
         it->>'sku', it->>'nombre', it->>'categoria',
         (it->>'cantidad')::smallint, (it->>'precio')::numeric, (it->>'subtotal')::numeric,
         coalesce(it->'opciones','{}'::jsonb),
         coalesce((select array_agg(value::text) from jsonb_array_elements_text(it->'salsas')), '{}'),
         nullif(it->>'nota','')
    from jsonb_array_elements(p_items) it;

  update public.ordenes set
    total      = v_total,
    medio_pago = coalesce(nullif(p_medio,''), medio_pago),
    nota       = nullif(p_nota,''),
    cliente    = nullif(btrim(p_cliente),''),
    editada_en = now()
  where id = p_orden;
end;
$$;


-- ----------------------------------------------------------------------------
--  6. ANULAR Y RESTAURAR
--     Al restaurar vuelve al punto de la cola donde estaba, deducido de sus
--     propias horas: no hay que preguntarle a nadie en qué iba.
-- ----------------------------------------------------------------------------
create or replace function public.anular_orden(p_orden uuid, p_anular boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_feria  uuid;
  v_dia    date;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_perfil and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;

  select feria_id, dia into v_feria, v_dia from public.ordenes where id = p_orden;
  if v_feria is null then
    raise exception 'Esa orden ya no existe.';
  end if;
  if not public.puedo_operar(v_feria) then
    raise exception 'Hoy no estás asignado a esta feria.';
  end if;
  -- El administrador puede corregir una feria pasada; el equipo, solo el día.
  if v_dia <> (now() at time zone 'America/Lima')::date and not public.es_admin() then
    raise exception 'Solo se pueden anular las órdenes de hoy.';
  end if;

  if p_anular then
    update public.ordenes set estado = 'anulado' where id = p_orden;
  else
    update public.ordenes set estado =
      case when entregada_en is not null then 'entregado'
           when lista_en     is not null then 'listo'
           when iniciada_en  is not null then 'prep'
           else 'cola' end
    where id = p_orden;
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
--  7. PASADO POR POS
-- ----------------------------------------------------------------------------
create or replace function public.marcar_pos(p_orden uuid, p_ok boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_feria  uuid;
  v_dia    date;
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_perfil and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;

  select feria_id, dia into v_feria, v_dia from public.ordenes where id = p_orden;
  if v_feria is null then
    raise exception 'Esa orden ya no existe.';
  end if;
  if not public.puedo_operar(v_feria) then
    raise exception 'Hoy no estás asignado a esta feria.';
  end if;
  if v_dia <> (now() at time zone 'America/Lima')::date and not public.es_admin() then
    raise exception 'Solo se pueden marcar las órdenes de hoy.';
  end if;

  update public.ordenes set pos_ok = coalesce(p_ok, true) where id = p_orden;
end;
$$;


-- ----------------------------------------------------------------------------
--  8. PERMISOS
-- ----------------------------------------------------------------------------
revoke execute on function public.crear_orden(uuid, uuid, text, text, text, jsonb) from anon, public;
revoke execute on function public.editar_orden(uuid, text, text, text, jsonb)      from anon, public;
revoke execute on function public.anular_orden(uuid, boolean)                      from anon, public;
revoke execute on function public.marcar_pos(uuid, boolean)                        from anon, public;

grant execute on function public.crear_orden(uuid, uuid, text, text, text, jsonb)  to authenticated;
grant execute on function public.editar_orden(uuid, text, text, text, jsonb)       to authenticated;
grant execute on function public.anular_orden(uuid, boolean)                       to authenticated;
grant execute on function public.marcar_pos(uuid, boolean)                         to authenticated;
