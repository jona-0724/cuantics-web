/* prueba_operacion.mjs — caja de punta a punta.
   Dos ferias en paralelo, el nombre del cliente, la lista de pedidos del día,
   corregir sin perder el ticket, anular y restaurar, y la casilla del POS. */
import { banco, abrirNavegador, abrir, entrar, agregar, cobrar } from './ayuda.mjs';

const { problemas, dice, titulo, cerrar } = banco();
const b = await abrirNavegador();

/* ============ 1 · DOS FERIAS EN PARALELO ============ */
titulo('el feriante elige entre sus ferias');
let p = await abrir(b, problemas, 'feriante');
dice('primero pregunta en qué feria está', /En qué feria estás/.test(await p.textContent('.gate h1')));
const fer = (await p.locator('.feriacard').allTextContents()).join(' | ');
console.log('      ofrece:', fer.replace(/\s+/g, ' ').slice(0, 150));
dice('ofrece las dos de su turno de hoy', /FERIA MARCIANA/.test(fer) && /EXPO MIRAFLORES/.test(fer));
dice('no ofrece una feria donde no tiene turno', !/OTAKULAND/.test(fer));
dice('todavía no muestra caja ni cocina', (await p.locator('.role[data-rol]').count()) === 0);

await entrar(p, 'EXPO MIRAFLORES', 'caja');
dice('la caja abre en la feria elegida', /EXPO MIRAFLORES/.test(await p.textContent('#miRol')));
dice('solo ve los pedidos de esa feria', /Pedidos de hoy · 2/.test(await p.textContent('.cajahead')));
dice('el chip de arriba deja cambiar de feria', await p.isVisible('#chipFeria'));
await p.click('#chipFeria'); await p.waitForTimeout(500);
dice('al cambiar, vuelve a preguntar la feria', /En qué feria estás/.test(await p.textContent('.gate h1')));
await p.close();

/* ============ 2 · EL ADMINISTRADOR ENTRA A CUALQUIERA ============ */
titulo('el administrador entra a una feria que no ha empezado');
p = await abrir(b, problemas, 'admin');
const todas = (await p.locator('.feriacard').allTextContents()).join(' | ');
dice('le ofrece todas las ferias', /OTAKULAND/.test(todas) && /FERIA MARCIANA/.test(todas));
await p.locator('.feriacard', { hasText:'OTAKULAND' }).click(); await p.waitForTimeout(600);
dice('puede entrar a una que aún no empieza', (await p.locator('.role[data-rol]').count()) >= 3);
dice('avisa que lo que cobre ahí es real', /todavía no empieza/.test(await p.textContent('.prueba')));
await p.locator('.role[data-rol="caja"]').click(); await p.waitForTimeout(800);
dice('la caja se abre igual, sin feria en curso', (await p.locator('.prod').count()) > 0);
dice('y el aviso sigue a la vista en caja', await p.isVisible('.prueba'));
await p.close();

/* ============ 3 · NOMBRE DEL CLIENTE ============ */
titulo('el nombre se pide al armar el pedido, no al cobrar');
p = await abrir(b, problemas, 'feriante');
await entrar(p, 'FERIA MARCIANA', 'caja');
await agregar(p, 'choripan');
dice('la casilla del cliente está en la pantalla de caja', await p.isVisible('#clienteCaja'));
await p.fill('#clienteCaja', 'Marisol'); await p.waitForTimeout(200);
await p.locator('#cobrar').click(); await p.waitForTimeout(350);
dice('la hoja de cobro lo trae ya escrito', (await p.inputValue('#cliente')) === 'Marisol');
await p.locator('[data-pay="tarjeta"]').click(); await p.waitForTimeout(150);
await p.locator('#confirmar').click(); await p.waitForTimeout(900);
const env = await p.evaluate(() => window.__D.llamadas.filter(l => l.nombre === 'crear_orden').pop());
dice('el nombre viaja con la orden · ' + env.args.p_cliente, env.args.p_cliente === 'Marisol');
dice('el ticket muestra a quién llamar', /Marisol/.test(await p.textContent('.ticket-ok')));
dice('el ticket es el #3 de esa feria', /#3/.test(await p.textContent('.ticket-ok')));
await p.locator('[data-cerrar-sheet]').first().click(); await p.waitForTimeout(400);

/* ============ 4 · LA LISTA DE PEDIDOS Y EL POS ============ */
titulo('caja ve sus pedidos y los pasa por el POS');
await p.locator('[data-ped="1"]').click(); await p.waitForTimeout(700);
dice('salen los pedidos del día', (await p.locator('.ped').count()) === 3);
dice('el más nuevo va primero', /#3/.test(await p.locator('.ped').first().textContent()));
dice('muestra el nombre del cliente', /Carlos/.test(await p.textContent('.peds')));
dice('la casilla del POS está en TODOS los pedidos, no solo en los de tarjeta',
  (await p.locator('.ped [data-pos]').count()) === 3);
const efectivo = p.locator('.ped').filter({ hasText:'EFECTIVO' });
dice('el de efectivo también la tiene', (await efectivo.locator('[data-pos]').count()) >= 1);
dice('avisa cuántos faltan pasar por POS', /sin pasar por POS/.test(await p.textContent('.cajahead')));
const fila1 = p.locator('.ped').filter({ hasText:'#1' });
await fila1.locator('[data-pos]').click(); await p.waitForTimeout(700);
dice('marcar el POS queda guardado',
  await p.evaluate(() => window.__D.ordenes.find(o => o.id === 'o1').pos_ok === true));
dice('el botón pasa a "POS ✓"', /POS ✓/.test(await p.locator('.ped').filter({ hasText:'#1' }).textContent()));

/* ============ 5 · CORREGIR SIN PERDER EL TICKET ============ */
titulo('corregir un pedido ya enviado');
await p.locator('.ped').filter({ hasText:'#1' }).locator('[data-edi]').click();
await p.waitForTimeout(700);
dice('abre el pedido en el carrito', /Corrigiendo el pedido #1/.test(await p.textContent('.editbar')));
dice('trae lo que llevaba', /S\/ 50\.00/.test(await p.textContent('.cart-sum')));
await agregar(p, 'papas');
dice('se le puede agregar algo · ' + (await p.textContent('.cart-sum')).replace(/\s+/g, ' ').trim(),
  /S\/ 58\.00/.test(await p.textContent('.cart-sum')));
await p.locator('#cobrar').click(); await p.waitForTimeout(400);
dice('la hoja dice que es una corrección', /Corregir el pedido #1/.test(await p.textContent('.sheet h3')));
dice('conserva el cliente', (await p.inputValue('#cliente')) === 'Carlos');
await p.locator('#confirmar').click(); await p.waitForTimeout(1000);
const o1 = await p.evaluate(() => window.__D.ordenes.find(o => o.id === 'o1'));
dice('el ticket sigue siendo el #1', o1.numero === 1);
dice('el total quedó en 58 · ' + o1.total, o1.total === 58);
dice('queda marcada como corregida', !!o1.editada_en);
dice('vuelve a la lista de pedidos', await p.isVisible('.peds'));
dice('la lista la muestra corregida', /corregida/.test(await p.locator('.ped').filter({ hasText:'#1' }).textContent()));

/* ============ 6 · ANULAR Y RESTAURAR ============ */
titulo('anular y restaurar');
await p.locator('.ped').filter({ hasText:'#2' }).locator('[data-anu]').click(); await p.waitForTimeout(450);
dice('pide confirmación antes de anular', /Anular el pedido #2/.test(await p.textContent('.sheet h3')));
await p.locator('#confirmSi').click(); await p.waitForTimeout(900);
const o2 = await p.evaluate(() => window.__D.ordenes.find(o => o.id === 'o2'));
dice('la orden queda anulada', o2.estado === 'anulado');
dice('la fila se ve tachada', (await p.locator('.ped.anul').count()) === 1);
await p.locator('.ped.anul [data-anu]').click(); await p.waitForTimeout(900);
const o2b = await p.evaluate(() => window.__D.ordenes.find(o => o.id === 'o2'));
dice('se puede restaurar al estado que tenía · ' + o2b.estado, o2b.estado === 'prep');
await p.close();

/* ============ 7 · COCINA NO VE PLATA ============ */
titulo('cocina');
p = await abrir(b, problemas, 'feriante');
await entrar(p, 'EXPO MIRAFLORES', 'cocina');
dice('la cola se dibuja', (await p.locator('.kds').count()) === 1);
dice('cocina ve a quién llamar', /Rosa/.test(await p.textContent('.kds')));
dice('cocina NO ve montos', !/S\/\s?\d/.test(await p.textContent('.kds')));
dice('no se cuela ningún pedido de la otra feria', !/Carlos/.test(await p.textContent('.kds')));
await p.close();

await cerrar(b, 'prueba_operacion');
