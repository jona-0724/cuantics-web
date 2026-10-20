/* prueba_inventario.mjs — el inventario de cierre.
   Es la parte de la web que nunca tuvo pruebas: lo llena el equipo al cerrar
   cada día, y de ahí sale lo que el administrador manda al día siguiente. */
import { banco, abrirNavegador, abrir, entrar } from './ayuda.mjs';

const { problemas, dice, titulo, cerrar } = banco();
const b = await abrirNavegador();

/* ============ 1 · LLENAR Y GUARDAR ============ */
titulo('el equipo llena el inventario de su feria');
let p = await abrir(b, problemas, 'feriante');
await entrar(p, 'FERIA MARCIANA', 'inventario');

dice('la pantalla se dibuja', (await p.locator('.wrap.inv').count()) === 1);
dice('dice de qué feria y qué día es', /FERIA MARCIANA/.test(await p.textContent('.sec-h')));
dice('pide los insumos', (await p.locator('[data-inv^="cant:"]').count()) >= 11);
dice('pide el nivel de cada salsa', (await p.locator('[data-invniv]').count()) >= 30);
dice('pide la reposición de salsas', (await p.locator('[data-inv^="repo:"]').count()) === 6);
dice('deja escribir lo que falte', await p.isVisible('#invNota'));
dice('arranca diciendo que no se ha guardado',
  /todavía no se ha guardado/.test(await p.textContent('#invEstado')));

await p.fill('[data-inv="cant:hotdog"]', '2.5'); await p.waitForTimeout(250);
dice('acepta medios (2 tapers y medio = 2.5)',
  (await p.inputValue('[data-inv="cant:hotdog"]')) === '2.5');
await p.locator('[data-invq="cant:pan:0.5"]').click(); await p.waitForTimeout(250);
dice('el + suma medio', (await p.inputValue('[data-inv="cant:pan"]')) === '0.5');
await p.locator('[data-invniv="mayonesa:medio"]').click(); await p.waitForTimeout(250);
dice('se puede marcar el nivel de un chisguete',
  (await p.getAttribute('[data-invniv="mayonesa:medio"]', 'aria-pressed')) === 'true');
await p.fill('[data-inv="repo:mayonesa"]', '2'); await p.waitForTimeout(250);
await p.fill('#invNota', 'se acabó el papel toalla'); await p.waitForTimeout(250);
dice('avisa que hay cambios sin guardar',
  /sin guardar/.test(await p.textContent('#invEstado')));
dice('lleva la cuenta de lo lleno', /Llevas \d+ de \d+/.test(await p.textContent('#invEstado')));

await p.locator('#invGuardar').click(); await p.waitForTimeout(1000);
const env = await p.evaluate(() => window.__D.llamadas.filter(l => l.nombre === 'guardar_inventario').pop());
dice('se guarda con la feria y la fecha', env.args.p_feria === 'fa' && !!env.args.p_fecha);
dice('viajan las cantidades', env.args.p_datos.cant.hotdog === 2.5 && env.args.p_datos.cant.pan === 0.5);
dice('viaja el nivel de la salsa', env.args.p_datos.nivel.mayonesa === 'medio');
dice('viaja la reposición', env.args.p_datos.repo.mayonesa === 2);
dice('viaja la nota', /papel toalla/.test(env.args.p_nota));
dice('queda guardado en la base',
  await p.evaluate(() => !!window.__D.inventarios.find(i => i.feria_id === 'fa')));
dice('la pantalla confirma quién guardó', /guardado por/.test(await p.textContent('#invEstado')));

/* ============ 2 · NO SE PIERDE LO LLENADO ============ */
titulo('si se recarga a medio llenar, no se pierde');
await p.fill('[data-inv="cant:carne"]', '3'); await p.waitForTimeout(400);
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(1800);
dice('vuelve sola a la pantalla de inventario', (await p.locator('.wrap.inv').count()) === 1);
dice('el borrador sobrevivió a la recarga',
  (await p.inputValue('[data-inv="cant:carne"]')) === '3');
dice('y lo ya guardado también', (await p.inputValue('[data-inv="cant:hotdog"]')) === '2.5');
await p.close();

/* ============ 3 · FERIA PASADA DONDE TRABAJÉ ============ */
titulo('una feria que ya terminó se puede completar después');
p = await abrir(b, problemas, 'feriante');
const cards = (await p.locator('.feriacard').allTextContents()).join(' | ');
dice('ofrece la feria pasada donde trabajé', /GEEKFESTIVAL/.test(cards));
await p.locator('.feriacard', { hasText:'GEEKFESTIVAL' }).click(); await p.waitForTimeout(600);
const roles = await p.locator('.role[data-rol]').allTextContents();
dice('ahí NO se puede cobrar ni cocinar', !roles.join().match(/Caja|Cocina/));
dice('pero sí llenar el inventario', (await p.locator('.role[data-rol="inventario"]').count()) === 1);
await p.locator('.role[data-rol="inventario"]').click(); await p.waitForTimeout(900);
dice('ofrece un día por cada jornada de la feria', (await p.locator('[data-invdia]').count()) === 3);
dice('abre en el último día, que es el que se suele olvidar',
  (await p.inputValue('[data-inv="cant:hotdog"]')) === '');
await p.locator('[data-invdia]').first().click(); await p.waitForTimeout(900);
dice('al volver al primer día trae lo que ya se había guardado',
  (await p.inputValue('[data-inv="cant:hotdog"]')) === '2');
await p.locator('[data-invdia]').nth(1).click(); await p.waitForTimeout(900);
dice('y cada día tiene su propio formulario',
  (await p.inputValue('[data-inv="cant:hotdog"]')) === '');
await p.fill('[data-inv="cant:chorizo"]', '1'); await p.waitForTimeout(250);
await p.locator('#invGuardar').click(); await p.waitForTimeout(1000);
const dia2 = await p.evaluate(() => window.__D.inventarios.filter(i => i.feria_id === 'fd').length);
dice('se guarda como un inventario aparte, no pisa el del otro día', dia2 === 2);
await p.close();

/* ============ 4 · LO QUE VE EL ADMINISTRADOR ============ */
titulo('el administrador lo ve en Ventas');
p = await abrir(b, problemas, 'admin', 1280);
dice('al administrador no se le ofrece llenar inventario de ferias ajenas',
  await p.evaluate(() => window.__D.perfil.rol === 'admin'));
await p.locator('.feriacard', { hasText:'GEEKFESTIVAL' }).click(); await p.waitForTimeout(600);
await p.locator('.role[data-rol="admin"]').click(); await p.waitForTimeout(1200);
// Ventas abre en la lista de ferias; las pestañas salen al entrar a una.
await p.locator('[data-verferia]').first().click(); await p.waitForTimeout(1200);
const sub = p.locator('[data-sub="inventario"]');
dice('hay una pestaña de inventario en Ventas', (await sub.count()) === 1);
await sub.click(); await p.waitForTimeout(1200);
const panel = await p.textContent('#view');
dice('muestra lo que anotó el equipo', /Hot dog/.test(panel) || /Inventario/.test(panel));
dice('no dice que falte la migración', !/Todavía no está activado/.test(panel));

await cerrar(b, 'prueba_inventario');
