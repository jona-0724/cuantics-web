# Pruebas de la web de feria

Estas pruebas abren la página real en un navegador de verdad y la usan como la usaría
alguien en el stand: tocan botones, llenan casillas, cobran, corrigen y anulan. No tocan
la base de datos real: `falso_feria.js` se pone en lugar de la librería de Supabase y
responde con datos inventados.

## Correrlas

Hace falta Node y Playwright con Chromium. Desde esta carpeta:

    node correr_pruebas.mjs

Levanta un servidor en el puerto 8770, corre las seis suites y resume al final. Para correr
una sola, primero levanta el servidor (`npx http-server -p 8770 .` o equivalente) y luego:

    node prueba_carta.mjs

`correr_pruebas.mjs` sirve la raíz del repo (dos niveles arriba de esta carpeta), así que
prueba el `potente/equipo/feria/index.html` que esté en el repo en ese momento: lo que
corres es exactamente lo que vas a publicar.

Playwright no está en el repo. Si falta: `npm i -D playwright` y `npx playwright install
chromium`, o apunta `node_modules` a una instalación que ya tengas.

## Qué cubre cada suite

| Archivo | Qué vigila |
| --- | --- |
| `prueba_operacion.mjs` | Dos ferias en paralelo y que no se mezclen. El nombre del cliente desde que se arma el pedido. La lista de pedidos del día. Corregir sin perder el ticket. Anular y restaurar al estado que tenía. La casilla del POS en **todos** los pedidos. Que cocina no vea montos. |
| `prueba_carta.mjs` | El orden de las categorías y de los combos. Que un combo no se pueda agregar sin elegir sus opciones. Los precios. Que el refresco se grabe con la categoría de la base (`Bebidas`) y no con el alias de pantalla. |
| `prueba_cambiar.mjs` | Los botones de cada línea del carrito: − / +, Salsas, **Cambiar** y **Quitar**, en productos **con opciones**. Existe por un error real: la clave de la línea lleva comillas y `\|`, y al ir sin escapar en los `data-…` esos botones no hacían nada en los combos. |
| `prueba_feria.mjs` | Regresión de la caída en plena feria: un medio de pago desconocido o nulo no puede tumbar la cola de cocina. |
| `prueba_entregados.mjs` | Lo que cocina ya despachó: ticket, cliente, qué llevaba, horas, minutos, sin montos, y poder devolver a "listos" lo entregado por error. |
| `prueba_inventario.mjs` | El inventario de cierre: llenar, guardar, que el borrador sobreviva a una recarga, completar una feria pasada día por día, y que el administrador lo vea en Ventas. |

## El doble de Supabase

`falso_feria.js` imita lo que la página usa de verdad: `auth`, el constructor de consultas
(`select/eq/neq/in/order/single/maybeSingle/update`) y las funciones (`rpc`). Respeta las
reglas que de verdad rompen la página si se ignoran:

- el día se calcula en hora de Lima, igual que la página;
- `cola_feria` (cocina) no trae un solo monto y esconde los anulados;
- `cola_caja` sí trae el total, solo del día, y **sí** muestra los anulados — caja tiene
  que poder restaurarlos;
- cada vista filtra por feria, así que dos ferias en paralelo no se mezclan;
- `crear_orden` numera con `max(numero)+1` **por feria**.

Los datos de prueba están arriba del archivo: dos ferias en curso hoy donde el feriante
tiene turno, una que no ha empezado (solo el administrador entra) y una pasada donde
trabajó, para el inventario atrasado. Con `?quien=admin` entra como administrador.

`window.__D` deja los datos y el registro de llamadas a la vista: así una prueba puede
comprobar no solo lo que se ve en pantalla, sino lo que de verdad viajó a la base.

## Si una prueba falla

Primero mira si el fallo es de la página o de la prueba. Varias comprobaciones dependen de
los datos de prueba (cuántos pedidos hay, qué día es): si cambias el fixture, hay que
ajustar los números. Un fallo en `prueba_feria` o en `prueba_cambiar`, en cambio, casi
siempre es un error de verdad: esas dos nacieron de fallas que llegaron a producción.
