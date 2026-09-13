-- ============================================================================
--  POTENTE · la carta al día (setiembre)
--  ---------------------------------------------------------------------------
--  Ajusta los productos que ve caja a la carta nueva:
--    · Salchipapas — no existían en la app. Entran como DOS productos, no como
--      uno con opción: así el panel de ventas te dice cuántas salchipapas y
--      cuántas choripapas se vendieron, sin tener que abrir cada orden.
--    · Panchos — antes S/ 10 con dos tipos (chorizo y hot-dog). La carta nueva
--      deja solo el de hot-dog a S/ 5, así que se le quita la elección.
--    · El resto de precios ya coincidía y no se toca.
--
--  Los precios se pueden seguir cambiando desde la pestaña Carta del panel,
--  sin tocar la base. Esto es solo para poner al día lo que hay.
--
--  Depende de: 20260913120000_operacion_feria.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. SALCHIPAPAS
-- ----------------------------------------------------------------------------
insert into public.productos (sku, nombre, categoria, descripcion, precio, lleva_salsas, opciones, posicion, activo) values
  ('salchipapa','Salchipapa Potente','Salchipapas','Salchicha, papas crujientes y salsas',20.00,true,'[]'::jsonb, 5, true),
  ('choripapa', 'Choripapa Potente','Salchipapas','Chorizo, papas crujientes y salsas',   20.00,true,'[]'::jsonb, 6, true)
on conflict (sku) do update set
  nombre      = excluded.nombre,
  categoria   = excluded.categoria,
  descripcion = excluded.descripcion,
  precio      = excluded.precio,
  opciones    = excluded.opciones,
  posicion    = excluded.posicion,
  activo      = true;


-- ----------------------------------------------------------------------------
--  2. PANCHO: S/ 5 y solo hot-dog
-- ----------------------------------------------------------------------------
update public.productos set
  nombre      = 'Pancho Hot-Dog',
  descripcion = 'En palo, sin pan',
  precio      = 5.00,
  opciones    = '[]'::jsonb,
  posicion    = 7,
  activo      = true
where sku = 'pancho';

-- Por si esta base se creó sin él.
insert into public.productos (sku, nombre, categoria, descripcion, precio, lleva_salsas, opciones, posicion, activo)
select 'pancho','Pancho Hot-Dog','Panchos','En palo, sin pan',5.00,true,'[]'::jsonb,7,true
where not exists (select 1 from public.productos where sku = 'pancho');


-- ----------------------------------------------------------------------------
--  3. ORDEN EN QUE APARECEN EN CAJA
--     Primero lo que más sale, al final lo suelto.
-- ----------------------------------------------------------------------------
update public.productos set posicion =  1 where sku = 'combo';
update public.productos set posicion =  2 where sku = 'choripan';
update public.productos set posicion =  3 where sku = 'hotdog';
update public.productos set posicion =  4 where sku = 'burger';
update public.productos set posicion =  8 where sku = 'papas';
update public.productos set posicion =  9 where sku = 'refresco12';
update public.productos set posicion = 10 where sku = 'refresco9';
