/* prueba_turnos.mjs — armar los turnos sin pelearse con la pantalla.
   Nació de un problema real: con una feria de tres días la tabla no entra en
   pantalla, y al asignar a alguien la tabla se redibujaba entera y la barra
   horizontal volvía al inicio. Había que arrastrar otra vez hasta el domingo
   después de CADA persona. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const LIB  = readFileSync(new URL('./falso_equipo.js', import.meta.url), 'utf8');
const BASE = 'http://localhost:8770/potente/equipo/';

const problemas = [];
const dice = (t, ok) => { console.log((ok ? '  ok  ' : ' FALLA  ') + t); if (!ok) problemas.push(t) };
const titulo = t => console.log('\n--- ' + t + ' ---');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{ width:1100, height:900 } });   // angosta a propósito
p.on('pageerror', e => problemas.push('JS: ' + e.message));
p.on('console', m => {
  if (m.type() === 'error' && !/TUNNEL|favicon|fonts\.g|404/.test(m.text()))
    problemas.push('consola: ' + m.text().slice(0, 140));
});
await p.route('**/lib/supabase-js-*.js', r =>
  r.fulfill({ contentType:'application/javascript', body: LIB }));
await p.goto(BASE + '?quien=admin', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(1600);

titulo('entrar a la feria y a Turnos');
dice('entra como administrador', /Administrador/.test(await p.textContent('#miRol')));
await p.locator('#listaFeriasAdmin .feria').first().click();
await p.waitForTimeout(900);
dice('abre la feria', /PERU BEBE Y SABE/.test(await p.textContent('#detalleFeria')));
await p.locator('.pestana', { hasText:'Turnos' }).first().click();
await p.waitForTimeout(700);
dice('la tabla de turnos se dibuja', (await p.locator('#listaTurnos table.crono').count()) === 1);

const marco = p.locator('#listaTurnos .scroll-x');
const medidas = await marco.evaluate(el => ({ ancho:el.clientWidth, total:el.scrollWidth }));
console.log('      tabla:', medidas.total, 'px en una ventana de', medidas.ancho, 'px');
dice('la tabla no entra en pantalla: hay barra horizontal', medidas.total > medidas.ancho + 20);

titulo('el domingo se queda a la vista al asignar');
// Hasta el final, que es donde está el domingo.
await marco.evaluate(el => { el.scrollLeft = el.scrollWidth });
await p.waitForTimeout(350);
const antes = await marco.evaluate(el => el.scrollLeft);
dice('la barra se movió hasta el domingo', antes > 100);

// El último desplegable visible: una casilla del domingo.
const sel = p.locator('#listaTurnos select:not([disabled])').last();
const cupo = await sel.getAttribute('data-cupo');
console.log('      asignando en la casilla', cupo);
await sel.selectOption({ label: 'Ivana Panduro' });
await p.waitForTimeout(1100);

const despues = await marco.evaluate(el => el.scrollLeft);
console.log('      barra antes:', Math.round(antes), '→ después:', Math.round(despues));
dice('la barra NO volvió a la izquierda', despues > 100);
dice('se quedó donde estaba', Math.abs(despues - antes) < 40);

titulo('la asignación se guardó');
const esc = await p.evaluate(() => window.__E.escrituras.filter(e => e.tabla === 'asignaciones'));
dice('se escribió en asignaciones', esc.length >= 1);
dice('quedó una persona asignada',
  await p.evaluate(() => window.__E.asignaciones.length === 1));
dice('es la persona elegida',
  await p.evaluate(() => window.__E.asignaciones[0].perfil_id === 'u-ivana'));
dice('la casilla la muestra puesta', /Ivana Panduro/.test(await p.textContent('#listaTurnos')));

titulo('el foco vuelve a la misma casilla');
const enfocado = await p.evaluate(() => {
  const a = document.activeElement;
  return a && a.tagName === 'SELECT' ? a.dataset.cupo : null;
});
dice('sigues parado en la casilla que acabas de llenar · ' + enfocado, enfocado === cupo);

titulo('cambiar de persona en la misma casilla');
const sel2 = p.locator(`#listaTurnos select[data-cupo="${cupo}"]`);
await sel2.selectOption({ label: 'Samira Panduro' });
await p.waitForTimeout(1100);
dice('no se duplica la asignación, se reemplaza',
  await p.evaluate(() => window.__E.asignaciones.length === 1));
dice('ahora está la nueva persona',
  await p.evaluate(() => window.__E.asignaciones[0].perfil_id === 'u-sami'));
const despues2 = await marco.evaluate(el => el.scrollLeft);
dice('y la barra sigue en su sitio', Math.abs(despues2 - antes) < 40);

titulo('vaciar una casilla');
await sel2.selectOption('');
await p.waitForTimeout(1100);
dice('se borra la asignación', await p.evaluate(() => window.__E.asignaciones.length === 0));
const despues3 = await marco.evaluate(el => el.scrollLeft);
dice('la barra tampoco se mueve al vaciar', Math.abs(despues3 - antes) < 40);

titulo('"Mostrar a todo el equipo" tampoco pierde el sitio');
await p.locator('#verTodos').check();
await p.waitForTimeout(800);
const despues4 = await marco.evaluate(el => el.scrollLeft);
dice('la barra se mantiene al cambiar la casilla de arriba', Math.abs(despues4 - antes) < 40);

dice('sin errores de JavaScript', !problemas.some(x => /^JS:|^consola:/.test(x)));
await p.screenshot({ path:'/home/claude/turnos.png', fullPage:false });
await b.close();
console.log(problemas.length
  ? '\nprueba_turnos: PROBLEMAS\n- ' + problemas.join('\n- ')
  : '\nprueba_turnos: todo en verde');
process.exit(problemas.length ? 1 : 0);
