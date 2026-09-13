-- ============================================================================
--  OPERACIÓN EN FERIA — carta, órdenes y tiempos de cocina
--
--  Hasta aquí la base sabía QUIÉN trabaja y CUÁNDO (perfiles, ferias, bloques,
--  disponibilidad, asignaciones). Esta migración agrega QUÉ SE VENDIÓ.
--
--  Tres ideas que explican todo lo que sigue:
--
--  1. El número de ticket lo asigna la base, no el celular. Dos cajas
--     cobrando al mismo tiempo no pueden llevarse el mismo número porque
--     hay una restricción única por feria y la función reintenta.
--
--  2. Los montos son del administrador. Cocina necesita ver la cola, pero
--     no la plata: lee por unas vistas que no traen precios. La tabla real
--     solo la lee un admin.
--
--  3. Todo cambio de estado pasa por una función. Así cocina no necesita
--     permiso de escritura sobre la tabla de órdenes, y de paso la base
--     graba sola la hora y la persona.
-- ============================================================================


-- ============================================================================
--  1. LA CARTA
--     Editable desde el panel, para que un cambio de precio no necesite
--     tocar el código ni volver a publicar la web.
-- ============================================================================

create table if not exists public.productos (
  sku          text primary key,
  nombre       text     not null,
  categoria    text     not null,
  descripcion  text,
  precio       numeric(10,2) not null check (precio >= 0),
  lleva_salsas boolean  not null default false,
  opciones     jsonb    not null default '[]'::jsonb,
  posicion     smallint not null default 0,
  activo       boolean  not null default true
);

comment on table  public.productos          is 'La carta de Potente. Precios vigentes.';
comment on column public.productos.opciones is
  'Lo que caja debe preguntar: [{"id":"sabor","label":"Sabor","valores":["Chicha morada","Maracuyá"]}].';
comment on column public.productos.activo   is 'En falso = agotado. No se borra, para no perder el historial.';

insert into public.productos (sku, nombre, categoria, descripcion, precio, lleva_salsas, opciones, posicion) values
  ('combo','Combo Potente','Combos','Sándwich + papas + refresco 12 oz',25.00,true,
    '[{"id":"sandwich","label":"Sándwich","valores":["Choripán Criollo","Hotdog Callejero","Burger Potente"]},
      {"id":"sabor","label":"Refresco 12 oz","valores":["Chicha morada","Maracuyá"]}]'::jsonb, 1),
  ('choripan','Choripán Criollo','Sándwiches','Chorizo a la plancha, papas al hilo y salsas',15.00,true,'[]'::jsonb, 2),
  ('hotdog','Hotdog Callejero','Sándwiches','Salchicha, papas al hilo y salsas',15.00,true,'[]'::jsonb, 3),
  ('burger','Burger Potente','Sándwiches','Doble carne, lechuga, tomate y cheddar',18.00,true,'[]'::jsonb, 4),
  ('pancho','Pancho','Panchos','En palo, sin pan',10.00,true,
    '[{"id":"tipo","label":"Tipo","valores":["Chorizo","Hot-Dog"]}]'::jsonb, 5),
  ('papas','Papas Crujientes','Acompañamientos','Porción de papas fritas',8.00,true,'[]'::jsonb, 6),
  ('refresco12','Refresco 12 oz','Bebidas','Casero, bien frío',5.00,false,
    '[{"id":"sabor","label":"Sabor","valores":["Chicha morada","Maracuyá"]}]'::jsonb, 7),
  ('refresco9','Refresco 9 oz','Bebidas','Casero, bien frío',3.50,false,
    '[{"id":"sabor","label":"Sabor","valores":["Chicha morada","Maracuyá"]}]'::jsonb, 8)
on conflict (sku) do nothing;


-- Las seis de la barra de salsas del Recetario R4.
create table if not exists public.salsas (
  nombre   text primary key,
  posicion smallint not null default 0,
  activo   boolean  not null default true
);

insert into public.salsas (nombre, posicion) values
  ('Kétchup',1), ('Mayonesa',2), ('Mostaza',3), ('Ají',4), ('Tártara',5), ('Salsa hamburguesa',6)
on conflict (nombre) do nothing;


-- ============================================================================
--  2. PUNTO 0 Y BONO
--     Estimados del administrador sobre la feria, no sobre el día.
-- ============================================================================

alter table public.ferias
  add column if not exists punto0         numeric(10,2) not null default 0,
  add column if not exists bono_pct       smallint      not null default 50,
  add column if not exists mostrar_equipo boolean       not null default true;

comment on column public.ferias.punto0 is
  'Cuánto cuesta poner la feria en pie. Debajo de esto la feria está en rojo.';
comment on column public.ferias.bono_pct is
  'Porcentaje sobre el punto 0 a partir del cual el equipo gana bono.';
comment on column public.ferias.mostrar_equipo is
  'Si el equipo ve su avance hacia el bono en Caja y Cocina. Nunca ve montos, solo el porcentaje.';


-- ============================================================================
--  3. ÓRDENES
--     Una fila por pedido cobrado. Guarda quién cobró, quién cocinó y las
--     cuatro horas que permiten medir a cocina.
-- ============================================================================

create table if not exists public.ordenes (
  id           uuid primary key default gen_random_uuid(),
  feria_id     uuid not null references public.ferias   (id) on delete cascade,
  bloque_id    uuid          references public.bloques  (id) on delete set null,
  numero       integer not null,
  dia          date    not null,
  cajero_id    uuid          references public.perfiles (id) on delete set null,
  cocinero_id  uuid          references public.perfiles (id) on delete set null,
  medio_pago   text    not null check (medio_pago in ('qr','qrpos','tarjeta','efectivo')),
  total        numeric(10,2) not null default 0 check (total >= 0),
  estado       text    not null default 'cola'
                       check (estado in ('cola','prep','listo','entregado','anulado')),
  nota         text,
  creado_en    timestamptz not null default now(),
  iniciada_en  timestamptz,
  lista_en     timestamptz,
  entregada_en timestamptz,
  constraint numero_unico_por_feria unique (feria_id, numero)
);

comment on column public.ordenes.numero      is 'Correlativo por feria, empieza en 1. La restricción única impide que dos cajas repitan número.';
comment on column public.ordenes.bloque_id   is 'El turno en que entró el pedido. Permite cuadrar la venta por turno.';
comment on column public.ordenes.cajero_id   is 'Quién cobró.';
comment on column public.ordenes.cocinero_id is 'Quién la puso en preparación.';

create index if not exists ordenes_por_feria  on public.ordenes (feria_id, dia, numero);
create index if not exists ordenes_por_estado on public.ordenes (feria_id, estado);


create table if not exists public.orden_items (
  id        uuid primary key default gen_random_uuid(),
  orden_id  uuid not null references public.ordenes (id) on delete cascade,
  sku       text not null,
  nombre    text not null,
  categoria text not null,
  cantidad  smallint not null check (cantidad > 0),
  precio    numeric(10,2) not null,
  subtotal  numeric(10,2) not null,
  opciones  jsonb  not null default '{}'::jsonb,
  salsas    text[] not null default '{}',
  nota      text
);

comment on table public.orden_items is
  'El nombre y el precio se copian al momento de vender: si mañana sube el precio, la orden vieja conserva el suyo.';

create index if not exists items_por_orden on public.orden_items (orden_id);


-- ============================================================================
--  4. VISTAS PARA COCINA
--     Mismas filas, sin un solo monto. Cocina lee de aquí.
--     Sin security_invoker a propósito: corren con los permisos del dueño,
--     así el equipo ve la cola sin tener permiso sobre la tabla de órdenes.
-- ============================================================================

create or replace view public.cola_feria as
  select id, feria_id, bloque_id, numero, dia, estado, nota,
         cajero_id, cocinero_id, creado_en, iniciada_en, lista_en, entregada_en
    from public.ordenes
   where estado <> 'anulado';

create or replace view public.cola_feria_items as
  select i.id, i.orden_id, i.sku, i.nombre, i.categoria, i.cantidad,
         i.opciones, i.salsas, i.nota
    from public.orden_items i
    join public.ordenes o on o.id = i.orden_id
   where o.estado <> 'anulado';

revoke all on public.cola_feria, public.cola_feria_items from anon;
grant select on public.cola_feria, public.cola_feria_items to authenticated;


-- ============================================================================
--  5. FUNCIONES
-- ============================================================================

-- Cobrar. Devuelve el número de ticket asignado.
-- Los items llegan como jsonb para que sea una sola llamada: la orden y sus
-- líneas se graban juntas o no se graba nada.
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
begin
  if v_perfil is null then
    raise exception 'Hay que iniciar sesión para cobrar.';
  end if;
  if not exists (select 1 from public.perfiles where id = v_perfil and activo) then
    raise exception 'Tu cuenta está desactivada.';
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'El pedido está vacío.';
  end if;

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
      values (p_feria, p_bloque, v_num, v_dia, v_perfil, p_medio, v_total, nullif(p_nota,''))
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


-- Mover una orden por la cola. Cocina no escribe en la tabla: llama aquí.
-- La base pone la hora y anota quién fue.
create or replace function public.marcar_estado(p_orden uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_ahora  timestamptz := now();
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


-- En qué está trabajando hoy quien pregunta: devuelve feria, bloque y rol
-- según lo que el administrador asignó. Si no tiene turno, no devuelve filas.
create or replace function public.mi_turno_hoy()
returns table (feria_id uuid, bloque_id uuid, rol text, hora_inicio time, hora_fin time)
language sql
security definer
set search_path = public
as $$
  select b.feria_id, b.id, a.rol, b.hora_inicio, b.hora_fin
    from public.asignaciones a
    join public.bloques b on b.id = a.bloque_id
   where a.perfil_id = auth.uid()
     and b.fecha = (now() at time zone 'America/Lima')::date
   order by b.hora_inicio;
$$;


-- Lo vendido en una feria, sin exponer las órdenes. Lo usa la barra de avance
-- del equipo: devuelve un porcentaje, nunca un monto.
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
  select punto0, bono_pct into v_punto0, v_pct from public.ferias where id = p_feria;
  if v_punto0 is null or v_punto0 <= 0 then return null; end if;
  select coalesce(sum(total),0) into v_vendido
    from public.ordenes where feria_id = p_feria and estado <> 'anulado';
  return floor(v_vendido / (v_punto0 * (1 + v_pct / 100.0)) * 100)::integer;
end;
$$;


-- ============================================================================
--  6. PERMISOS
-- ============================================================================

alter table public.productos    enable row level security;
alter table public.salsas       enable row level security;
alter table public.ordenes      enable row level security;
alter table public.orden_items  enable row level security;

-- La carta la ve todo el equipo; la cambia solo el administrador.
drop policy if exists productos_lectura on public.productos;
create policy productos_lectura on public.productos
  for select to authenticated using (true);

drop policy if exists productos_escritura_admin on public.productos;
create policy productos_escritura_admin on public.productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists salsas_lectura on public.salsas;
create policy salsas_lectura on public.salsas
  for select to authenticated using (true);

drop policy if exists salsas_escritura_admin on public.salsas;
create policy salsas_escritura_admin on public.salsas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Las órdenes con sus montos: solo el administrador. El equipo trabaja con
-- las vistas de arriba y con las dos funciones, que no exponen plata.
drop policy if exists ordenes_lectura_admin on public.ordenes;
create policy ordenes_lectura_admin on public.ordenes
  for select to authenticated using (public.es_admin());

drop policy if exists ordenes_escritura_admin on public.ordenes;
create policy ordenes_escritura_admin on public.ordenes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists items_lectura_admin on public.orden_items;
create policy items_lectura_admin on public.orden_items
  for select to authenticated using (public.es_admin());

drop policy if exists items_escritura_admin on public.orden_items;
create policy items_escritura_admin on public.orden_items
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Las funciones corren como dueñas, así que hay que dejarlas ejecutar
-- explícitamente y cerrarle la puerta a quien no inició sesión.
revoke execute on function public.crear_orden(uuid, uuid, text, text, jsonb)  from anon, public;
revoke execute on function public.marcar_estado(uuid, text)                   from anon, public;
revoke execute on function public.mi_turno_hoy()                              from anon, public;
revoke execute on function public.avance_bono(uuid)                           from anon, public;

grant execute on function public.crear_orden(uuid, uuid, text, text, jsonb)   to authenticated;
grant execute on function public.marcar_estado(uuid, text)                    to authenticated;
grant execute on function public.mi_turno_hoy()                               to authenticated;
grant execute on function public.avance_bono(uuid)                            to authenticated;
