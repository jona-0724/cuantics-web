/* MiPlata — configuración pública del cliente.
   La publishable key es pública por diseño: la seguridad la dan las reglas RLS de la base. */
window.MIPLATA_CONFIG = {
  SUPABASE_URL: 'https://wxdgfxrplrbhwbbouzsk.supabase.co',
  SUPABASE_KEY: 'sb_publishable_JVx2anQlT7zWca-EPMwezQ_v6UdzTd8',
  // Banderas: funciones a medio hacer quedan apagadas
  FLAGS: { voz: true, foto: false, topes: false, pagos: true, admin: true, espacios: true, resumen: false }
};
