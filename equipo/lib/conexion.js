/* ==========================================================================
   CUANTICS · ERP — Conexión compartida
   La usan el panel (equipo/index.html) y cada módulo (equipo/compras/…).

   La clave publishable es pública a propósito: lo que protege los datos son
   las políticas RLS de la base, no el secreto de esta cadena.
   Se completa con los datos del proyecto Supabase "cuantics-erp"
   (Project Settings → API).
   ========================================================================== */
window.ERP_SUPABASE = {
  url: 'https://PENDIENTE.supabase.co',
  key: 'sb_publishable_PENDIENTE'
}

window.erpConectar = function () {
  const c = window.ERP_SUPABASE
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('No se pudo cargar la librería de la base de datos. Recarga la página.')
  }
  if (/PENDIENTE/.test(c.url + c.key)) {
    throw new Error('El ERP todavía no está conectado a su base de datos (falta configurar Supabase en equipo/lib/conexion.js).')
  }
  return window.supabase.createClient(c.url, c.key)
}
