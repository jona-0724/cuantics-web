-- ============================================================================
-- Carta: Salchipapa Mixta, Combo Salchipapa y Combo Pancho
-- y un orden fijo de la carta:
--   Combos · Sándwiches · Panchos · Acompañamientos · Refrescos · Salchipapas
--
-- Los precios son los de partida: se cambian después desde
-- Operación en feria → Ventas → Carta y PIN, sin tocar código.
--
-- "on conflict do nothing": si alguno de estos productos ya existiera, no se
-- duplica ni se pisa su precio. Los valores de texto van sin tipo explícito
-- para que la base los convierta sola al tipo de cada columna.
-- ============================================================================

insert into public.productos
  (sku, nombre, categoria, descripcion, precio, lleva_salsas, activo, opciones, posicion)
values
  ('salchipapa_mixta', 'Salchipapa Mixta', 'Salchipapas',
   'Salchicha y chorizo, papas crujientes y salsas',
   20, true, true, '[]', 62),

  ('combo_salchipapa', 'Combo Salchipapa', 'Combos',
   'Salchipapa a elección + refresco 12 oz',
   23, true, true,
   '[{"id":"salchipapa","label":"Salchipapa","valores":["Salchipapa Potente","Choripapa Potente","Salchipapa Mixta"]},
     {"id":"sabor","label":"Refresco 12 oz","valores":["Chicha morada","Maracuyá"]}]',
   11),

  ('combo_pancho', 'Combo Pancho', 'Combos',
   'Pancho Hot-Dog + refresco 9 oz',
   5, true, true,
   '[{"id":"sabor","label":"Refresco 9 oz","valores":["Chicha morada","Maracuyá"]}]',
   12)
on conflict do nothing;

-- Orden dentro de cada categoría. El orden ENTRE categorías lo fija la página;
-- esto solo ordena los productos de cada una. Si algún sku no existe, esa
-- línea simplemente no cambia nada.
update public.productos set posicion = 10 where sku = 'combo';
update public.productos set posicion = 11 where sku = 'combo_salchipapa';
update public.productos set posicion = 12 where sku = 'combo_pancho';
update public.productos set posicion = 20 where sku = 'choripan';
update public.productos set posicion = 21 where sku = 'hotdog';
update public.productos set posicion = 22 where sku = 'burger';
update public.productos set posicion = 30 where sku = 'pancho';
update public.productos set posicion = 40 where sku = 'papas';
update public.productos set posicion = 50 where sku = 'refresco12';
update public.productos set posicion = 51 where sku = 'refresco9';
update public.productos set posicion = 60 where sku = 'salchipapa';
update public.productos set posicion = 61 where sku = 'choripapa';
update public.productos set posicion = 62 where sku = 'salchipapa_mixta';
