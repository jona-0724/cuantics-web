-- ============================================================================
--  POTENTE · EQUIPO — Dark Kitchen
--
--  Una feria no es solo los días de feria. Alrededor hay trabajo de cocina:
--
--    · PREPARACIÓN — el día anterior al primer día. Siempre ocurre.
--    · DESPACHO    — la madrugada de cada día de feria MENOS el primero
--                    (ese ya quedó cubierto por la preparación). Es
--                    condicional: se confirma el día antes según lo que
--                    haya quedado de stock.
--
--  Hasta ahora todos los bloques eran iguales. Estas dos columnas permiten
--  distinguirlos sin romper nada de lo que ya existe: los bloques creados
--  antes de esta migración quedan como 'feria' y no condicionales, que es
--  exactamente lo que eran.
-- ============================================================================

alter table public.bloques
  add column if not exists tipo text not null default 'feria'
    check (tipo in ('feria', 'dk_prep', 'dk_despacho')),
  add column if not exists condicional boolean not null default false;

comment on column public.bloques.tipo is
  'feria: atención al público · dk_prep: preparación en el Dark Kitchen el día previo · dk_despacho: reposición de madrugada.';
comment on column public.bloques.condicional is
  'true = puede no realizarse. Se confirma el día anterior. El equipo lo ve marcado como tal.';

alter table public.ferias
  add column if not exists direccion_dk text;

comment on column public.ferias.direccion_dk is
  'Dirección del Dark Kitchen para esta feria. Se muestra a quien tenga turno de cocina.';

create index if not exists bloques_por_tipo on public.bloques (feria_id, tipo);
