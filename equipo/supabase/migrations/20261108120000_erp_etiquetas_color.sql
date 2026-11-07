-- ============================================================================
--  CUANTICS · ERP (cuantics.pe/equipo) — COLOR DE LAS LÍNEAS DE PRODUCTO
--  Las líneas (Kepware, Canary, Litmus…) se usan como etiquetas de color en
--  leads, oportunidades y catálogo. Aquí cada línea recibe su color.
--
--  Se corre UNA vez en Supabase → SQL Editor, después de
--  20261107120000_erp_crm_cotizaciones.sql. Si se corre de nuevo no rompe nada
--  ni pisa un color que ya se haya cambiado desde la web.
-- ============================================================================

alter table public.lineas_producto add column if not exists color text not null default '';
comment on column public.lineas_producto.color is 'Color de la etiqueta en pantalla (hex, p. ej. #60A5FA).';

update public.lineas_producto l
   set color = v.color
  from (values
    ('Kepware',            '#60A5FA'),
    ('Canary',             '#F2A93B'),
    ('Litmus',             '#A78BFA'),
    ('Ignition',           '#FB923C'),
    ('Opto 22',            '#5CD18B'),
    ('Tulip',              '#F472B6'),
    ('Servicios CUANTICS', '#22C7D6')
  ) as v (nombre, color)
 where l.nombre = v.nombre and l.color = '';
