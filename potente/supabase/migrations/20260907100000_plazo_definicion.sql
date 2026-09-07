-- ============================================================================
--  POTENTE · EQUIPO — Plazo para dejar de aceptar "Quizás"
--
--  Por qué: un "quizás" a un mes de la feria es información útil. El mismo
--  "quizás" a tres días es un problema: no se puede armar un turno con él.
--
--  Qué hace: cada feria lleva cuántos días antes de empezar deja de aceptarse
--  el "Quizás". Dentro de esa ventana el equipo solo ve Sí y No, y los bloques
--  que tenían "quizás" vuelven a contar como pendientes hasta que los definan.
--
--  Siete días por defecto, para no tener que pensarlo en cada feria. Un 0
--  significa "aceptar quizás hasta el final".
-- ============================================================================

alter table public.ferias
  add column if not exists dias_definicion integer not null default 7
    check (dias_definicion >= 0 and dias_definicion <= 90);

comment on column public.ferias.dias_definicion is
  'Días antes del primer día en que el "quizás" deja de valer y hay que definir Sí o No. 0 = nunca se cierra.';
