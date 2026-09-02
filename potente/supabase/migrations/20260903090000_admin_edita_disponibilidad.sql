-- ============================================================================
--  POTENTE · EQUIPO — El administrador puede corregir la disponibilidad ajena
--
--  Por qué: en la práctica los cambios llegan por WhatsApp o de viva voz
--  ("al final sí puedo el sábado"), y el administrador necesita registrarlos
--  sin pedirle a la persona que entre a la página.
--
--  Qué cambia: las políticas de escritura de disponibilidad pasan de
--  "solo en nombre propio y solo en feria abierta" a
--  "en nombre propio y feria abierta, O bien siendo administrador".
--
--  Qué NO cambia: un feriante sigue sin poder tocar lo ajeno, ni marcar sobre
--  una feria que no está abierta. La lectura sigue igual que antes.
--
--  El administrador puede escribir en cualquier estado de feria a propósito:
--  también hay movimientos después de cerrar, y él es quien responde por ellos.
-- ============================================================================


-- ---------- alta ----------
drop policy if exists disponibilidad_crear on public.disponibilidad;
create policy disponibilidad_crear on public.disponibilidad
  for insert to authenticated
  with check (
    public.es_admin()
    or (
      perfil_id = auth.uid()
      and exists (
        select 1
        from public.bloques b
        join public.ferias  f on f.id = b.feria_id
        where b.id = disponibilidad.bloque_id
          and f.estado = 'abierta'
      )
    )
  );


-- ---------- edición ----------
drop policy if exists disponibilidad_editar on public.disponibilidad;
create policy disponibilidad_editar on public.disponibilidad
  for update to authenticated
  using (
    public.es_admin()
    or (
      perfil_id = auth.uid()
      and exists (
        select 1
        from public.bloques b
        join public.ferias  f on f.id = b.feria_id
        where b.id = disponibilidad.bloque_id
          and f.estado = 'abierta'
      )
    )
  )
  with check (
    public.es_admin()
    or perfil_id = auth.uid()
  );


-- ---------- baja ----------
-- Ya permitía al administrador; se reescribe para dejar las tres juntas
-- y que se lean como una sola regla.
drop policy if exists disponibilidad_borrar on public.disponibilidad;
create policy disponibilidad_borrar on public.disponibilidad
  for delete to authenticated
  using (
    public.es_admin()
    or perfil_id = auth.uid()
  );
