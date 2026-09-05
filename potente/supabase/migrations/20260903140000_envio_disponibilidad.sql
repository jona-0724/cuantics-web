-- ============================================================================
--  POTENTE · EQUIPO — Envío de la disponibilidad
--
--  Problema: una casilla en blanco no dice si la persona no puede o si se
--  quedó a medias. El administrador necesita un estado claro: "esta persona
--  ya respondió por todos los bloques y lo dio por cerrado".
--
--  Solución: cada clic se sigue guardando al instante (borrador, para que
--  nadie pierda lo avanzado si se le corta el internet), pero además queda
--  registrado el momento en que la persona aprieta "Subir mi disponibilidad".
--
--  Esta tabla guarda solo ese acto. Que el envío siga siendo válido se
--  calcula al vuelo: hay envío Y respondió todos los bloques que hoy tiene
--  la feria. Así, si el administrador agrega un bloque después, esa persona
--  vuelve a aparecer pendiente sin que haya que tocar nada aquí.
-- ============================================================================

create table if not exists public.envios (
  feria_id   uuid not null references public.ferias  (id) on delete cascade,
  perfil_id  uuid not null references public.perfiles (id) on delete cascade,
  enviado_en timestamptz not null default now(),
  primary key (feria_id, perfil_id)
);

comment on table public.envios is
  'Momento en que cada persona dio por cerrada su disponibilidad de una feria.';

create index if not exists envios_por_feria on public.envios (feria_id);


-- ---------------------------------------------------------------- permisos --
alter table public.envios enable row level security;
grant select, insert, update, delete on public.envios to authenticated;


-- Cada quien ve el suyo; el administrador ve todos.
drop policy if exists envios_lectura on public.envios;
create policy envios_lectura on public.envios
  for select to authenticated
  using (perfil_id = auth.uid() or public.es_admin());

-- Se envía en nombre propio y solo mientras la feria esté abierta.
-- El administrador puede registrarlo por alguien más (pasa: la persona avisa
-- por WhatsApp y él completa sus casillas).
drop policy if exists envios_crear on public.envios;
create policy envios_crear on public.envios
  for insert to authenticated
  with check (
    public.es_admin()
    or (
      perfil_id = auth.uid()
      and exists (
        select 1 from public.ferias f
        where f.id = envios.feria_id and f.estado = 'abierta'
      )
    )
  );

drop policy if exists envios_editar on public.envios;
create policy envios_editar on public.envios
  for update to authenticated
  using (
    public.es_admin()
    or (
      perfil_id = auth.uid()
      and exists (
        select 1 from public.ferias f
        where f.id = envios.feria_id and f.estado = 'abierta'
      )
    )
  )
  with check (public.es_admin() or perfil_id = auth.uid());

drop policy if exists envios_borrar on public.envios;
create policy envios_borrar on public.envios
  for delete to authenticated
  using (public.es_admin() or perfil_id = auth.uid());
