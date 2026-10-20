-- ============================================================================
--  Potente · Permisos explícitos del Data API
--  20261020120000_grants_explicitos.sql
--
--  POR QUÉ ESTE ARCHIVO
--  Desde el 30 de octubre de 2026, Supabase deja de dar acceso automático al
--  Data API a las tablas nuevas del esquema "public". Las tablas que ya
--  existen conservan sus permisos, así que la base de hoy NO se rompe. Lo que
--  sí se rompería es volver a levantar este esquema desde cero (un proyecto
--  nuevo, una rama de preview o un `supabase db reset`): las tablas nacerían
--  sin permisos y la aplicación devolvería "permission denied".
--
--  Este archivo deja los permisos escritos a mano, uno por uno, para que las
--  migraciones se basten solas. Es idempotente: correrlo ahora no cambia
--  nada de lo que ya funciona.
--
--  CRITERIO
--  - anon  (visitante sin sesión) no toca NADA. En Potente nadie entra sin
--    cuenta y las cuentas solo las crea el administrador por invitación.
--  - authenticated recibe exactamente los verbos que sus políticas RLS ya
--    permiten. El permiso abre la puerta; la política RLS sigue decidiendo
--    qué filas se ven. Un GRANT de más aquí no salta ninguna política.
--  - service_role recibe acceso completo porque su llave es secreta y vive
--    solo del lado del servidor. Esto NO expone nada al público: esa llave
--    nunca va en una página web.
-- ============================================================================

-- El esquema mismo tiene que ser visible para poder usar lo que hay adentro.
grant usage on schema public to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1 · Equipo, ferias y turnos
-- ---------------------------------------------------------------------------
revoke all on public.perfiles       from anon;
revoke all on public.ferias         from anon;
revoke all on public.bloques        from anon;
revoke all on public.disponibilidad from anon;
revoke all on public.asignaciones   from anon;
revoke all on public.envios         from anon;

-- perfiles no lleva insert: el perfil lo crea el disparador crear_perfil()
-- cuando nace la cuenta, no la aplicación.
grant select, update, delete                 on public.perfiles       to authenticated;
grant select, insert, update, delete         on public.ferias         to authenticated;
grant select, insert, update, delete         on public.bloques        to authenticated;
grant select, insert, update, delete         on public.disponibilidad to authenticated;
grant select, insert, update, delete         on public.asignaciones   to authenticated;
grant select, insert, update, delete         on public.envios         to authenticated;

grant all on public.perfiles       to service_role;
grant all on public.ferias         to service_role;
grant all on public.bloques        to service_role;
grant all on public.disponibilidad to service_role;
grant all on public.asignaciones   to service_role;
grant all on public.envios         to service_role;

-- ---------------------------------------------------------------------------
-- 2 · Carta (productos y salsas)
--     Todo el equipo la lee; solo el administrador la escribe, y eso ya lo
--     deciden las políticas productos_escritura_admin / salsas_escritura_admin.
-- ---------------------------------------------------------------------------
revoke all on public.productos from anon;
revoke all on public.salsas    from anon;

grant select, insert, update, delete on public.productos to authenticated;
grant select, insert, update, delete on public.salsas    to authenticated;

grant all on public.productos to service_role;
grant all on public.salsas    to service_role;

-- ---------------------------------------------------------------------------
-- 3 · Pedidos
--     Aquí vive la plata. Las políticas solo dejan pasar al administrador;
--     el equipo llega a sus pedidos por las vistas cola_feria y cola_caja,
--     nunca por estas tablas.
-- ---------------------------------------------------------------------------
revoke all on public.ordenes     from anon;
revoke all on public.orden_items from anon;

grant select, insert, update, delete on public.ordenes     to authenticated;
grant select, insert, update, delete on public.orden_items to authenticated;

grant all on public.ordenes     to service_role;
grant all on public.orden_items to service_role;

-- ---------------------------------------------------------------------------
-- 4 · Inventario de cierre
--     Lo escribe la función guardar_inventario(); la tabla se lee directo
--     según las políticas inventarios_lectura / inventarios_admin.
-- ---------------------------------------------------------------------------
revoke all on public.inventarios from anon;

grant select, insert, update, delete on public.inventarios to authenticated;
grant all on public.inventarios to service_role;

-- ---------------------------------------------------------------------------
-- 5 · Tabla cerrada a propósito
--     admins_iniciales solo la lee el disparador crear_perfil(), que corre
--     como dueño. Nadie debe alcanzarla desde el Data API.
-- ---------------------------------------------------------------------------
revoke all on public.admins_iniciales from anon, authenticated;
grant all on public.admins_iniciales to service_role;

-- ---------------------------------------------------------------------------
-- 6 · Vistas de la operación
--     Son de solo lectura: lo que se escribe pasa siempre por una función.
-- ---------------------------------------------------------------------------
revoke all on public.cola_feria       from anon;
revoke all on public.cola_feria_items from anon;
revoke all on public.cola_caja        from anon;
revoke all on public.cola_caja_items  from anon;

grant select on public.cola_feria       to authenticated, service_role;
grant select on public.cola_feria_items to authenticated, service_role;
grant select on public.cola_caja        to authenticated, service_role;
grant select on public.cola_caja_items  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7 · Funciones
--     Se repiten los permisos que ya traían sus migraciones, para que este
--     archivo deje el esquema completo aunque se replique desde cero.
-- ---------------------------------------------------------------------------
revoke execute on function public.es_admin()                                              from anon, public;
revoke execute on function public.tengo_turno(uuid)                                       from anon, public;
revoke execute on function public.puedo_operar(uuid)                                      from anon, public;
revoke execute on function public.mi_bloque_hoy(uuid)                                     from anon, public;
revoke execute on function public.mi_turno_hoy()                                          from anon, public;
revoke execute on function public.marcar_estado(uuid, text)                               from anon, public;
revoke execute on function public.avance_bono(uuid)                                       from anon, public;
revoke execute on function public.crear_orden(uuid, uuid, text, text, jsonb)              from anon, public;
revoke execute on function public.crear_orden(uuid, uuid, text, text, text, jsonb)        from anon, public;
revoke execute on function public.editar_orden(uuid, text, text, text, jsonb)             from anon, public;
revoke execute on function public.anular_orden(uuid, boolean)                             from anon, public;
revoke execute on function public.marcar_pos(uuid, boolean)                               from anon, public;
revoke execute on function public.trabaje_en_feria(uuid)                                  from anon, public;
revoke execute on function public.mis_ferias_inventario()                                 from anon, public;
revoke execute on function public.guardar_inventario(uuid, jsonb, text)                   from anon, public;
revoke execute on function public.guardar_inventario(uuid, date, jsonb, text)             from anon, public;

grant execute on function public.es_admin()                                               to authenticated;
grant execute on function public.tengo_turno(uuid)                                        to authenticated;
grant execute on function public.puedo_operar(uuid)                                       to authenticated;
grant execute on function public.mi_bloque_hoy(uuid)                                      to authenticated;
grant execute on function public.mi_turno_hoy()                                           to authenticated;
grant execute on function public.marcar_estado(uuid, text)                                to authenticated;
grant execute on function public.avance_bono(uuid)                                        to authenticated;
grant execute on function public.crear_orden(uuid, uuid, text, text, jsonb)               to authenticated;
grant execute on function public.crear_orden(uuid, uuid, text, text, text, jsonb)         to authenticated;
grant execute on function public.editar_orden(uuid, text, text, text, jsonb)              to authenticated;
grant execute on function public.anular_orden(uuid, boolean)                              to authenticated;
grant execute on function public.marcar_pos(uuid, boolean)                                to authenticated;
grant execute on function public.trabaje_en_feria(uuid)                                   to authenticated;
grant execute on function public.mis_ferias_inventario()                                  to authenticated;
grant execute on function public.guardar_inventario(uuid, jsonb, text)                    to authenticated;
grant execute on function public.guardar_inventario(uuid, date, jsonb, text)              to authenticated;

-- ============================================================================
--  NOTA PARA LAS PRÓXIMAS MIGRACIONES
--  Cada tabla o vista nueva que se cree en "public" a partir de ahora lleva
--  sus GRANT en el mismo archivo que la crea. No se usa
--  "alter default privileges" para devolver el permiso automático: ese
--  automatismo es justo lo que Supabase está quitando porque expone tablas
--  nuevas sin que nadie lo haya decidido.
-- ============================================================================
