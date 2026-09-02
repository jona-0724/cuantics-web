\set ON_ERROR_STOP on
\pset pager off

-- ---------- 1. altas de usuarios (dispara el trigger) ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'jonoc90@gmail.com'),
  ('22222222-2222-2222-2222-222222222222', 'maria@ejemplo.com'),
  ('33333333-3333-3333-3333-333333333333', 'luis@ejemplo.com');

\echo '--- perfiles creados automaticamente (jonathan debe salir admin) ---'
select nombre, rol, activo from public.perfiles order by nombre;

-- ---------- 2. el admin crea una feria con bloques ----------
reset role;
insert into public.ferias (id, nombre, lugar, fecha_inicio, fecha_fin, estado)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Feria de prueba', 'Barranco', '2026-09-11', '2026-09-13', 'abierta');

insert into public.bloques (id, feria_id, fecha, hora_inicio, hora_fin, etiqueta) values
  ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','2026-09-11','10:00','16:00','Mañana'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','2026-09-11','16:00','22:00','Tarde');

-- ---------- 3. MARIA (feriante) marca su disponibilidad ----------
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

\echo '--- maria es admin? (debe ser false) ---'
select public.es_admin() as es_admin;

insert into public.disponibilidad (bloque_id, perfil_id, estado)
values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','si');

\echo '--- maria ve su propia disponibilidad (1 fila) ---'
select estado from public.disponibilidad;

\echo '--- maria intenta marcar EN NOMBRE DE LUIS (debe fallar) ---'
do $$
begin
  insert into public.disponibilidad (bloque_id, perfil_id, estado)
  values ('bbbbbbbb-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333','si');
  raise exception 'FALLO DE SEGURIDAD: pudo escribir por otro';
exception when insufficient_privilege then
  raise notice 'OK: bloqueado por RLS';
end $$;

\echo '--- maria intenta hacerse admin (debe fallar) ---'
do $$
begin
  update public.perfiles set rol = 'admin' where id = '22222222-2222-2222-2222-222222222222';
  raise exception 'FALLO DE SEGURIDAD: se pudo autoascender';
exception when insufficient_privilege then
  raise notice 'OK: bloqueado, no puede cambiarse el rol';
end $$;
select rol as rol_de_maria from public.perfiles where id = '22222222-2222-2222-2222-222222222222';

\echo '--- maria SI puede cambiar su nombre (debe funcionar) ---'
update public.perfiles set nombre = 'Maria Perez' where id = '22222222-2222-2222-2222-222222222222';
select nombre from public.perfiles where id = '22222222-2222-2222-2222-222222222222';

-- ---------- 4. LUIS no debe ver lo de Maria ----------
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
\echo '--- luis ve disponibilidad ajena? (debe ser 0) ---'
select count(*) as filas_visibles_para_luis from public.disponibilidad;

-- ---------- 5. el ADMIN ve todo ----------
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
\echo '--- jonathan es admin? (debe ser true) ---'
select public.es_admin() as es_admin;
\echo '--- el admin ve la disponibilidad de todos (1 fila) ---'
select count(*) as filas_visibles_para_admin from public.disponibilidad;

\echo '--- el admin asigna un turno ---'
insert into public.asignaciones (bloque_id, perfil_id, rol)
values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','cocina');
select count(*) as asignaciones from public.asignaciones;

-- ---------- 6. feria cerrada: ya no se puede marcar ----------
update public.ferias set estado = 'cerrada' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
\echo '--- luis intenta marcar en feria cerrada (debe fallar) ---'
do $$
begin
  insert into public.disponibilidad (bloque_id, perfil_id, estado)
  values ('bbbbbbbb-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333','si');
  raise exception 'FALLO: pudo marcar en feria cerrada';
exception when insufficient_privilege then
  raise notice 'OK: feria cerrada, bloqueado';
end $$;

\echo '--- luis ve los turnos antes de publicar? (debe ser 0) ---'
select count(*) as asignaciones_visibles from public.asignaciones;

reset role;
update public.ferias set estado = 'publicada' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
\echo '--- ya publicada, luis ve los turnos (debe ser 1) ---'
select count(*) as asignaciones_visibles from public.asignaciones;

\echo '=== TODAS LAS PRUEBAS PASARON ==='
