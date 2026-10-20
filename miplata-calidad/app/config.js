/* MiPlata — configuración pública del cliente.
   Las publishable keys son públicas por diseño: la seguridad la dan las reglas RLS de la base.
   Ambientes (cada uno con su propia base de datos en Supabase):
   - calidad:    cuantics.pe/miplata-calidad y la computadora (localhost) → proyecto "miplata-calidad"
   - producción: cuantics.pe/miplata → proyecto "miplata" (clientes reales) */
(function () {
  const AMBIENTES = {
    produccion: { SUPABASE_URL: 'https://wxdgfxrplrbhwbbouzsk.supabase.co', SUPABASE_KEY: 'sb_publishable_JVx2anQlT7zWca-EPMwezQ_v6UdzTd8' },
    calidad: { SUPABASE_URL: 'https://xicfsokfnczmqjcuegxt.supabase.co', SUPABASE_KEY: 'sb_publishable_K_SCs36Qo2zWcfB3Shtw0Q_3bveEpRS' }
  };
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const ambiente = local || /^\/miplata-calidad(\/|$)/.test(location.pathname) ? 'calidad' : 'produccion';
  const ref = AMBIENTES[ambiente].SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];
  window.MIPLATA_CONFIG = {
    AMBIENTE: ambiente,
    ...AMBIENTES[ambiente],
    // clave donde supabase-js guarda la sesión (la usa la portada para saber si ya iniciaste sesión)
    SESION_KEY: 'sb-' + ref + '-auth-token',
    // Banderas: funciones a medio hacer quedan apagadas
    FLAGS: { voz: true, foto: false, topes: false, pagos: true, admin: true, espacios: true, resumen: false }
  };
})();
