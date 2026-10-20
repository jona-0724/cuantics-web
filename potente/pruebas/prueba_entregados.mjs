/* prueba_entregados.mjs — lo que cocina ya despachó.
   Antes, la orden entregada desaparecía de la pantalla: si el cliente volvía
   reclamando, cocina no tenía dónde mirar con qué número ni a nombre de quién
   se entregó. */
import { banco, abrirNavegador, abrir, entrar } from './ayuda.mjs';

const { problemas, dice, titulo, cerrar } = banco();
const b = await abrirNavegador();
const p = await abrir(b, problemas, 'feriante', 1280);
await entrar(p, 'EXPO MIRAFLORES', 'cocina');

titulo('el acceso desde la cola');
dice('la cola de cocina se dibuja', (await p.locator('.kds').count()) === 1);
dice('hay un botón para ver los entregados', (await p.locator('[data-ent="1"]').count()) === 1);
dice('el botón trae la cuenta del día', /Entregados hoy · 1/.test(await p.textContent('[data-ent="1"]')));

titulo('la lista');
await p.locator('[data-ent="1"]').click(); await p.waitForTimeout(700);
dice('se abre', /Entregados hoy/.test(await p.textContent('#view')) && (await p.locator('.peds').count()) === 1);
dice('sale el número de ticket', /#2/.test(await p.textContent('.ped__n')));
dice('sale el nombre del cliente', /Miguel/.test(await p.textContent('.ped__c')));
dice('sale lo que llevaba', /Hotdog Callejero/.test(await p.textContent('.ped__i')));
dice('sale la hora de entrega', /entregado \d{1,2}:\d{2}/.test(await p.textContent('.ped__hora')));
dice('y cuántos minutos tomó', /\d+ min/.test(await p.textContent('.ped')));
dice('cocina sigue sin ver montos aquí', !/S\/\s?\d/.test(await p.textContent('.peds')));
dice('no se cuelan pedidos de la otra feria', !/Carlos|Choripán/.test(await p.textContent('.peds')));

titulo('devolver lo entregado por error');
dice('hay botón para devolverlo a listos', (await p.locator('[data-est$="|listo"]').count()) === 1);
await p.locator('[data-est$="|listo"]').click(); await p.waitForTimeout(900);
dice('la orden vuelve a "listo"',
  await p.evaluate(() => window.__D.ordenes.find(o => o.id === 'o4').estado === 'listo'));

titulo('volver a la cola');
await p.locator('[data-ent="0"]').click(); await p.waitForTimeout(600);
dice('se vuelve a la cola', (await p.locator('.kds').count()) === 1);
dice('y la orden devuelta aparece en "listos"',
  /Miguel/.test(await p.textContent('.kds')));
dice('el contador de entregados bajó a 0', /Entregados hoy · 0/.test(await p.textContent('[data-ent="1"]')));

await cerrar(b, 'prueba_entregados');
