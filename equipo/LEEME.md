# CUANTICS · ERP (cuantics.pe/equipo)

Herramientas internas de CUANTICS detrás de un login. Mismo esquema que `potente/equipo`:
páginas estáticas en Cloudflare, Supabase como base y acceso, librería dentro del repo.

```
equipo/
  index.html            ← login + panel principal
  compras/index.html    ← órdenes de compra
  lib/conexion.js       ← URL y clave publishable de Supabase (las usan todas las páginas)
  lib/supabase-js-…js   ← librería, sin CDN
  img/libelula.png
  supabase/migrations/  ← la base, en SQL
```

## Puesta en marcha (una sola vez)

1. **Crear el proyecto** en supabase.com → New project → nombre `cuantics-erp`, región
   São Paulo (la más cercana a Lima). Guarda la contraseña de la base en un lugar seguro.
2. **Crear las tablas.** SQL Editor → pegar y correr
   `supabase/migrations/20261028120000_esquema_inicial.sql`.
   (O, igual que en Potente: Integrations → GitHub → este repo, carpeta `equipo/supabase`.)
3. **Cerrar el registro público.** Authentication → Sign In / Providers → desactivar
   *Allow new users to sign up*. Nadie entra si no lo invitas.
4. **Direcciones de retorno.** Authentication → URL Configuration:
   - Site URL: `https://cuantics.pe/equipo/`
   - Redirect URLs: `https://cuantics.pe/equipo/**`
5. **Tu cuenta.** Authentication → Users → *Invite user* → `jonathan@cuantics.pe`.
   Llega un correo; el enlace abre `cuantics.pe/equipo` pidiendo definir la contraseña.
   Ese correo está en `admins_iniciales`, así que entra como administrador.
6. **Conectar la web.** Project Settings → API → copiar *Project URL* y la clave
   *publishable* en `lib/conexion.js`, y el Project ID en `supabase/config.toml`.

## Agregar a alguien del equipo

Invítalo desde Authentication → Users. Su cuenta nace **desactivada** (no ve nada).
Para darle acceso: Table Editor → `perfiles` → su fila → `activo = true`.
Para hacerlo administrador, además `rol = admin`.

## Cómo funciona la numeración

El número `OC-AÑO-0001` lo pone la base al guardar (función `numerar_orden_compra`), con un
candado para que dos personas guardando a la vez no reciban el mismo. En pantalla se muestra
un número provisional hasta guardar. Imprimir guarda primero: una orden impresa siempre
existe en la base con su número final. Los números no se cambian ni se reutilizan; una
orden que no va se marca **Anulada**.

## Seguridad

- Sin sesión no se lee nada (`anon` no tiene permisos en ninguna tabla).
- Cuentas activas: leen y emiten órdenes. Solo el administrador cambia los datos de la
  empresa, borra órdenes y activa cuentas.
- Nadie se asciende a sí mismo: el disparador `proteger_rol` lo impide desde la web.
- La clave en `conexion.js` es pública a propósito; lo que protege los datos es RLS.
