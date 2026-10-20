/* prueba_cambiar.mjs — editar una línea del pedido.
   Esta suite existe por un error real: la clave de la línea lleva comillas y
   "|" adentro, y al ir sin escapar en los data-… los botones − / +, Salsas,
   Cambiar y Quitar no hacían NADA en los productos con opciones. */
import { banco, abrirNavegador, abrir, entrar, agregar, cobrar, lineas } from './ayuda.mjs';

const { problemas, dice, titulo, cerrar } = banco();
const b = await abrirNavegador();
const p = await abrir(b, problemas, 'feriante');
await entrar(p, 'FERIA MARCIANA', 'caja');

titulo('los botones de la línea funcionan en un producto CON opciones');
await agregar(p, 'combo');          // combo = sandwich + sabor, su clave lleva comillas
await agregar(p, 'papas');
await p.locator('#toggleCart').click(); await p.waitForTimeout(350);
console.log('      carrito:', (await lineas(p)).join(' · '));
dice('hay dos líneas', (await lineas(p)).length === 2);
dice('cada línea trae Cambiar', (await p.locator('.cart-lines .line [data-cambiar]').count()) === 2);
dice('cada línea trae Quitar',  (await p.locator('.cart-lines .line [data-quitar]').count()) === 2);

const combo = p.locator('.cart-lines .line', { hasText:'Combo Potente' });
await combo.locator('[data-q][data-d="1"]').click(); await p.waitForTimeout(350);
dice('el + sube la cantidad del combo (esto era lo que estaba roto)',
  /S\/ 58\.00/.test(await p.textContent('.cart-sum')));
await p.locator('.cart-lines .line', { hasText:'Combo Potente' }).locator('[data-q][data-d="-1"]').click();
await p.waitForTimeout(350);
dice('y el − la baja', /S\/ 33\.00/.test(await p.textContent('.cart-sum')));
await p.locator('.cart-lines .line', { hasText:'Combo Potente' }).locator('[data-editar]').click();
await p.waitForTimeout(350);
dice('Salsas abre la hoja del mismo producto', /Combo Potente/.test(await p.textContent('.sheet')));
await p.locator('[data-cerrar-sheet]').first().click(); await p.waitForTimeout(300);

titulo('cambiar un producto por otro');
const antes = (await p.textContent('.cs2')).trim();
await p.locator('.cart-lines .line', { hasText:'Combo Potente' }).locator('[data-cambiar]').click();
await p.waitForTimeout(450);
dice('avisa qué se está cambiando', /Cambiando Combo Potente/.test(await p.textContent('#view')));
dice('el combo sale del carrito', !(await lineas(p)).some(x => /Combo Potente/.test(x)));
dice('la carta queda a la vista para elegir el reemplazo',
  await p.locator('.grid .prod').first().isVisible());
await agregar(p, 'salchipapa_mixta'); await p.waitForTimeout(300);
dice('el aviso desaparece al elegir', !/Cambiando /.test(await p.textContent('#view')));
await p.locator('#toggleCart').click(); await p.waitForTimeout(350);
const ahora = await lineas(p);
console.log('      carrito:', ahora.join(' · '));
dice('entró la Salchipapa Mixta', ahora.some(x => /Salchipapa Mixta/.test(x)));
dice('y el combo ya no está', !ahora.some(x => /Combo Potente/.test(x)));
const despues = (await p.textContent('.cs2')).trim();
console.log('      total', antes, '→', despues);
dice('el total se ajustó', antes !== despues);

titulo('arrepentirse del cambio');
await p.locator('.cart-lines .line', { hasText:'Salchipapa Mixta' }).locator('[data-cambiar]').click();
await p.waitForTimeout(450);
dice('ofrece "Ya no"', (await p.locator('[data-canreempl]').count()) === 1);
await p.locator('[data-canreempl]').click(); await p.waitForTimeout(400);
dice('el aviso se va', !/Cambiando /.test(await p.textContent('#view')));
dice('y el producto vuelve al pedido', (await lineas(p)).some(x => /Salchipapa Mixta/.test(x)));

titulo('quitar una línea');
await p.locator('.cart-lines .line', { hasText:'Papas' }).locator('[data-quitar]').click();
await p.waitForTimeout(400);
dice('Quitar la saca', !(await lineas(p)).some(x => /Papas/.test(x)));

titulo('cambiar dentro de una corrección');
await cobrar(p, 'efectivo');
await p.locator('[data-cerrar-sheet]').first().click(); await p.waitForTimeout(400);
await p.locator('[data-ped="1"]').click(); await p.waitForTimeout(700);
await p.locator('[data-edi]').first().click(); await p.waitForTimeout(700);
const ticket = (await p.textContent('.editbar')).match(/#(\d+)/)[1];
dice('el banner explica cómo cambiar', /Cambiar/.test(await p.textContent('.editbar')));
dice('el detalle del pedido se abre solo', (await p.locator('.cart-lines .line').count()) > 0);
await p.locator('.cart-lines .line [data-cambiar]').first().click(); await p.waitForTimeout(450);
dice('también se puede cambiar corrigiendo', /Cambiando /.test(await p.textContent('#view')));
await agregar(p, 'combo_pancho'); await p.waitForTimeout(300);
await p.locator('#toggleCart').click(); await p.waitForTimeout(350);
dice('el reemplazo entró', (await lineas(p)).some(x => /Combo Pancho/.test(x)));
dice('y sigue siendo el ticket #' + ticket,
  (await p.textContent('.editbar')).indexOf('#' + ticket) >= 0 &&
  /sigue siendo el mismo/.test(await p.textContent('.editbar')));

await cerrar(b, 'prueba_cambiar');
