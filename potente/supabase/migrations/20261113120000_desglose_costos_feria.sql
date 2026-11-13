-- ============================================================================
--  DESGLOSE DE COSTOS DE LA FERIA
--  El punto 0 deja de ser un número escrito a mano: es la suma de los gastos
--  que el administrador anota (personal, insumos día 1, día 2…, transporte).
--  `punto0` sigue guardando la suma, así avance_bono() no cambia.
-- ============================================================================

alter table public.ferias
  add column if not exists costos jsonb not null default '[]'::jsonb;

comment on column public.ferias.costos is
  'Desglose del punto 0: lista de {nombre, monto}. La suma de los montos es punto0.';
