/* prueba_carta.mjs — la carta tal como la ve caja.
   Orden de las categorías, los tres combos con sus opciones obligatorias,
   los precios y lo que termina viajando a la base. */
import { banco, abrirNavegador, abrir, entrar, agregar } from './ayuda.mjs';

const { problemas, dice, titulo, cerrar } = banco();
const b = await abrirNavegador();
const p = await abrir(b, problemas, 'feriante');
await entrar(p, 'FERIA MARCIANA', 'caja');

titulo('orden de la carta');
const chips = (await p.locator('.cat[data-cat]').allTextContents()).map(x => x.trim());
console.log('      pestañas:', chips.join(' · '));
dice('las pestañas van en el orden del stand',
  JSON.stringify(chips) === JSON.stringify(
    ['Todo','Combos','Sándwiches','Panchos','Acompañamientos','Refrescos','Salchipapas']));

const titulos = (await p.locator('.gcat').allTextContents()).map(x => x.trim());
dice('en "Todo" cada categoría lleva su título, en ese orden',
  JSON.stringify(titulos) === JSON.stringify(
    ['Combos','Sándwiches','Panchos','Acompañamientos','Refrescos','Salchipapas']));
dice('"Bebidas" no se le muestra a nadie: en pantalla son Refrescos',
  !/Bebidas/.test(await p.textContent('.caja')));

const combos = await p.evaluate(() => {
  const out = []; let dentro = false;
  for (const el of document.querySelector('.grid').children){
    if (el.classList.contains('gcat')){ dentro = el.textContent.trim() === 'Combos'; continue }
    if (dentro) out.push(el.querySelector('.pn').textContent.trim());
  }
  return out;
});
console.log('      combos:', combos.join(' · '));
dice('los tres combos, en orden',
  JSON.stringify(combos) === JSON.stringify(['Combo Potente','Combo Salchipapa','Combo Pancho']));
dice('los combos llevan su fondo distinto',
  (await p.locator('.prod.combo[data-add="combo_salchipapa"]').count()) === 1 &&
  (await p.locator('.prod.combo[data-add="combo_pancho"]').count()) === 1);
dice('Salchipapa Mixta está en Salchipapas', await p.evaluate(() => {
  let cat = '';
  for (const el of document.querySelector('.grid').children){
    if (el.classList.contains('gcat')) cat = el.textContent.trim();
    else if (el.dataset.add === 'salchipapa_mixta') return cat === 'Salchipapas';
  }
  return false;
}));

titulo('Combo Salchipapa: no deja cobrar a medias');
await p.locator('.prod[data-add="combo_salchipapa"]').click(); await p.waitForTimeout(350);
const hoja = await p.textContent('.sheet');
dice('pide elegir la salchipapa',
  /Salchipapa Potente/.test(hoja) && /Choripapa Potente/.test(hoja) && /Salchipapa Mixta/.test(hoja));
dice('pide el sabor del refresco', /Chicha morada/.test(hoja) && /Maracuyá/.test(hoja));
dice('trae las salsas para marcarlas', /Kétchup/.test(hoja) && /Sin salsa/.test(hoja));
dice('sin elegir nada, el botón está bloqueado', await p.locator('#optAdd').isDisabled());
await p.locator('[data-opt="salchipapa|Salchipapa Mixta"]').click(); await p.waitForTimeout(150);
dice('con una sola elección sigue bloqueado', await p.locator('#optAdd').isDisabled());
await p.locator('[data-opt="sabor|Maracuyá"]').click(); await p.waitForTimeout(150);
dice('con las dos elecciones ya deja agregar', !(await p.locator('#optAdd').isDisabled()));
await p.locator('[data-salsa="Ají"]').click(); await p.waitForTimeout(120);
await p.locator('#optAdd').click(); await p.waitForTimeout(350);

titulo('precios y lo que se graba');
await agregar(p, 'combo_pancho');
await agregar(p, 'refresco9');
const total = (await p.textContent('.cart-sum')).replace(/\s+/g, ' ');
console.log('      carrito:', total.trim());
dice('23 + 5 + 3.50 = 31.50', /S\/ 31\.50/.test(total));

await p.locator('#cobrar').click(); await p.waitForTimeout(350);
await p.locator('[data-pay="efectivo"]').click(); await p.waitForTimeout(150);
await p.locator('#confirmar').click(); await p.waitForTimeout(900);
const env = await p.evaluate(() => window.__D.llamadas.filter(l => l.nombre === 'crear_orden').pop());
const its = env.args.p_items;
dice('se graban los tres ítems', its.length === 3);
const cs = its.find(i => i.sku === 'combo_salchipapa');
dice('el combo salchipapa guarda sus dos opciones',
  cs.opciones.salchipapa === 'Salchipapa Mixta' && cs.opciones.sabor === 'Maracuyá');
dice('y la salsa marcada', (cs.salsas || []).indexOf('Ají') >= 0);
const r9 = its.find(i => i.sku === 'refresco9');
dice('el refresco se graba con la categoría de la base ("Bebidas"), no con el alias',
  r9.categoria === 'Bebidas');
dice('los precios viajan correctos',
  cs.precio === 23 && its.find(i => i.sku === 'combo_pancho').precio === 5 && r9.precio === 3.5);
dice('sin cliente, viaja vacío y no rompe', env.args.p_cliente === '');

await cerrar(b, 'prueba_carta');
