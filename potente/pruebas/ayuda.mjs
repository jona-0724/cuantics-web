/* Ayudas comunes a todas las suites de la web de feria.
   Cada suite abre su propia página con el doble de Supabase inyectado. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

export const BASE = 'http://localhost:8770/potente/equipo/feria/';
const LIB = readFileSync(new URL('./falso_feria.js', import.meta.url), 'utf8');

export function banco(){
  const problemas = [];
  const dice = (t, ok) => { console.log((ok ? '  ok  ' : ' FALLA  ') + t); if (!ok) problemas.push(t) };
  const titulo = t => console.log('\n--- ' + t + ' ---');
  const cerrar = async (navegador, nombre) => {
    dice('sin errores de JavaScript', !problemas.some(x => /JS:|consola:/.test(x)));
    await navegador.close();
    console.log(problemas.length
      ? '\n' + nombre + ': PROBLEMAS\n- ' + problemas.join('\n- ')
      : '\n' + nombre + ': todo en verde');
    process.exit(problemas.length ? 1 : 0);
  };
  return { problemas, dice, titulo, cerrar };
}

export async function abrirNavegador(){
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}

/* Abre la página ya cargada, con el doble puesto y los errores vigilados. */
export async function abrir(navegador, problemas, quien = 'feriante', ancho = 430){
  const p = await navegador.newPage({ viewport:{ width:ancho, height:1200 } });
  p.on('pageerror', e => problemas.push('JS: ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/TUNNEL|favicon|fonts\.g|404/.test(m.text()))
      problemas.push('consola: ' + m.text().slice(0, 140));
  });
  await p.route('**/lib/supabase-js-*.js', r =>
    r.fulfill({ contentType:'application/javascript', body: LIB }));
  await p.goto(BASE + '?quien=' + quien, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1500);
  return p;
}

/* Entra a una feria y a una pantalla. */
export async function entrar(p, feria, rol){
  await p.locator('.feriacard', { hasText: feria }).click();
  await p.waitForTimeout(500);
  await p.locator('.role[data-rol="' + rol + '"]').click();
  await p.waitForTimeout(800);
}

/* Agrega un producto al carrito eligiendo la primera opción de cada grupo. */
export async function agregar(p, sku){
  await p.locator('.prod[data-add="' + sku + '"]').click();
  await p.waitForTimeout(300);
  const grupos = await p.evaluate(() =>
    [...new Set([...document.querySelectorAll('[data-opt]')].map(e => e.dataset.opt.split('|')[0]))]);
  for (const g of grupos){
    await p.locator('[data-opt^="' + g + '|"]').first().click();
    await p.waitForTimeout(90);
  }
  await p.locator('#optAdd').click();
  await p.waitForTimeout(320);
}

/* Cobra lo que haya en el carrito con el medio de pago indicado. */
export async function cobrar(p, pago = 'efectivo'){
  await p.locator('#cobrar').click(); await p.waitForTimeout(350);
  await p.locator('[data-pay="' + pago + '"]').click(); await p.waitForTimeout(150);
  await p.locator('#confirmar').click(); await p.waitForTimeout(900);
}

export const lineas = p => p.evaluate(() =>
  [...document.querySelectorAll('.cart-lines .line .ln b')].map(e => e.textContent.trim()));

export const texto = (p, sel) => p.textContent(sel);
