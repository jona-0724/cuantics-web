# CUANTICS · ERP (cuantics.pe/equipo)

Herramientas internas de CUANTICS detrás de un login. Mismo esquema que `potente/equipo`:
páginas estáticas en Cloudflare, Supabase como base y acceso, librería dentro del repo.

```
equipo/
  index.html            ← login + panel principal
  compras/index.html    ← órdenes de compra
  ventas/index.html     ← pipeline comercial: tableros de leads y oportunidades
  ventas/oportunidad/   ← ficha de una oportunidad (resumen, cotizaciones, bitácora)
  ventas/cotizacion/    ← editor de cotización: revisiones y "Emitir oferta" (Word + PDF)
  ventas/cotizaciones/  ← lista de cotizaciones
  clientes/             ← clientes y contactos
  productos/            ← catálogo de part numbers por línea
  plantillas/           ← Formato_COT_v1 con campos {…} para llenar el Word
  lib/conexion.js       ← URL y clave publishable de Supabase (las usan todas las páginas)
  lib/erp.js, erp.css   ← menú lateral, sesión, formatos y estilos comunes
  lib/supabase-js-…js   ← librería, sin CDN (igual docxtemplater y pizzip, para el Word)
  img/libelula.png
  supabase/migrations/  ← la base, en SQL
```

## Puesta en marcha (una sola vez)

La base vive en el proyecto Supabase **CUANTICS** (`gsjeyqccxwefbetxgutn`), el mismo del
flyer. `lib/conexion.js` ya apunta ahí. Las tablas del ERP no tocan lo del flyer, y si
encontraran una tabla con su mismo nombre de otra app, la migración se detiene sin cambiar nada.

1. **Crear las tablas.** SQL Editor → New query → pegar y correr
   `supabase/migrations/20261028120000_erp_crear_tablas.sql`. Debe terminar en *Success*.
   Después, en otra query, `supabase/migrations/20261106120000_erp_ventas_pipeline.sql`
   (tablas `leads` y `oportunidades` del pipeline comercial) y
   `supabase/migrations/20261107120000_erp_crm_cotizaciones.sql` (clientes, contactos,
   catálogo y cotizaciones) y `supabase/migrations/20261108120000_erp_etiquetas_color.sql`
   (color de cada línea, para usarlas como etiquetas). Siempre en ese orden.
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

## Pipeline comercial (ventas/)

Dos tableros, como en HubSpot u Odoo: las tarjetas se arrastran de una etapa a otra (en el
celular, mantener presionada la tarjeta y arrastrar) y cada movimiento queda en la bitácora.

- **Leads** — contactos todavía en verde: Nuevo → Contactado → En conversación →
  Calificado / Descartado. Al calificarlo se convierte en oportunidad y quedan ligados.
- **Oportunidades** — el funnel real: Calificación → Diagnóstico → Prueba de concepto →
  Propuesta → Licitación → Negociación → Ganada / Perdida. Número `OP-AÑO-0001` puesto
  por la base. Cada etapa propone una probabilidad (10, 20, 40, 50, 50, 75, 100, 0 %) que
  se puede ajustar a mano; el tablero suma pipeline y ponderado por moneda, sin mezclar
  dólares con soles.
- Perder una oportunidad o descartar un lead pide el motivo. No se borran (solo el
  administrador puede eliminar).

## Cotizaciones (ventas/cotizacion/)

- Una oportunidad (`OP-2026-0001`) que llega a cotizarse tiene su cotización
  `COT-2026-0002`, con revisiones Rev0, Rev1… Si nunca se cotiza, se cierra como **Cancelada**.
- El número COT lo pone la base. Arranca después del último emitido a mano antes del ERP:
  `empresa.datos.cot_ultimo_manual` (`{"2026": 1}` porque la COT-2026-0001 de Carvajal se hizo
  a mano).
- **Emitir oferta** guarda la revisión como *Enviada* (ya no se edita), descarga el Word
  desde `plantillas/Formato_COT_v1_campos.docx` y abre la impresión para guardar el PDF.
  Las revisiones anteriores quedan como *Reemplazada*. La oportunidad toma el monto sin IGV
  y pasa a *Propuesta* si estaba antes.
- Para cambiar el diseño del Word: edita `Formato_COT_v1_campos.docx` en Word sin tocar los
  campos entre llaves (`{cliente}`, `{#items}`…). Los datos bancarios salen de
  `empresa.datos.banco`.
- Las ofertas técnicas por línea se anotan en Productos → Líneas de producto cuando existan.
- Las líneas de producto son también **etiquetas de color** (como en Odoo): se eligen en el
  interés del lead y en las líneas de la oportunidad, y se ven en las tarjetas del pipeline.
  Escribir una que no existe y pulsar Enter la crea. El color se cambia en Líneas de producto.

## Seguridad

- Sin sesión no se lee nada (`anon` no tiene permisos en ninguna tabla).
- Cuentas activas: leen y emiten órdenes. Solo el administrador cambia los datos de la
  empresa, borra órdenes y activa cuentas.
- Nadie se asciende a sí mismo: el disparador `proteger_rol` lo impide desde la web.
- La clave en `conexion.js` es pública a propósito; lo que protege los datos es RLS.
