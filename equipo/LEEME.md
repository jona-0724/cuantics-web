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

La base vive en el proyecto Supabase **CUANTICS** (`gsjeyqccxwefbetxgutn`), el mismo del
flyer. `lib/conexion.js` ya apunta ahí. Las tablas del ERP no tocan lo del flyer, y si
encontraran una tabla con su mismo nombre de otra app, la migración se detiene sin cambiar nada.

1. **Crear las tablas.** SQL Editor → New query → pegar y correr
   `supabase/migrations/20261028120000_esquema_inicial.sql`. Debe terminar en *Success*.
2. **Cerrar el registro público.** Authentication → Sign In / Providers → desactivar
   *Allow new users to sign up*. (El flyer no usa cuentas; no le afecta.)
3. **Direcciones de retorno.** Authentication → URL Configuration:
   - Site URL: `https://cuantics.pe/equipo/`
   - Redirect URLs: `https://cuantics.pe/equipo/**`
4. **Tu cuenta.** Authentication → Users → *Add user* → *Send invitation* →
   `jonathan@cuantics.pe`. El enlace del correo abre `cuantics.pe/equipo` pidiendo definir
   la contraseña. Ese correo está en `admins_iniciales`: entra como administrador.

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
