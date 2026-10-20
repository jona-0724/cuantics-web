/* prueba_feria.mjs — regresión de la caída en plena feria.
   Un pedido con un medio de pago que la pantalla no conoce tumbaba TODA la
   cola de cocina: PAGO[o.pago].color reventaba, el render moría y el equipo
   se quedaba mirando una pantalla congelada. Nunca más. */
import { banco, abrirNavegador, abrir, entrar } from './ayuda.mjs';

const { problemas, dice, titulo, cerrar } = banco();
const b = await abrirNavegador();
const p = await abrir(b, problemas, 'feriante');

/* Se ensucian los datos ANTES de entrar a cocina: un medio desconocido, y
   otro directamente nulo, como los dejaba la vista vieja. */
await p.evaluate(() => {
  const D = window.__D;
  D.ordenes.push(
    { id:"raro1", feria_id:"fb", bloque_id:"b2", numero:90, creado_en:new Date().toISOString(),
      dia:D.HOY, medio_pago:"plin_nuevo", estado:"cola", nota:"", cliente:"Ana", total:12, pos_ok:false, editada_en:null },
    { id:"raro2", feria_id:"fb", bloque_id:"b2", numero:91, creado_en:new Date().toISOString(),
      dia:D.HOY, medio_pago:null, estado:"cola", nota:"", cliente:"", total:9, pos_ok:false, editada_en:null });
  D.items.push(
    { id:"ri1", orden_id:"raro1", sku:"pancho", nombre:"Pancho Hot-Dog", categoria:"Panchos", cantidad:1, precio:5, subtotal:5, opciones:{}, salsas:[], nota:"" },
    { id:"ri2", orden_id:"raro2", sku:"papas",  nombre:"Papas Crujientes", categoria:"Acompañamientos", cantidad:1, precio:8, subtotal:8, opciones:{}, salsas:[], nota:"" });
});

titulo('cocina con medios de pago que la pantalla no conoce');
await entrar(p, 'EXPO MIRAFLORES', 'cocina');

dice('la pantalla de cocina se dibuja', (await p.locator('.kds').count()) === 1);
const vista = await p.textContent('#view');
dice('NO sale la pantalla de error', !/Se trabó|No se pudo dibujar/.test(vista));
// En la cola quedan la normal (#1 Rosa) y las dos raras; la entregada no cuenta.
dice('las dos órdenes raras salen igual', /Ana/.test(vista) && (await p.locator('.kcard').count()) === 3);
dice('el medio desconocido se dibuja como "Otro"', /Otro/.test(vista));
dice('las órdenes normales siguen bien', /Rosa/.test(vista));
dice('y cocina sigue sin ver montos', !/S\/\s?\d/.test(await p.textContent('.kds')));

titulo('la cola se puede mover igual');
const antes = await p.locator('.kcard').count();
await p.locator('.kcard', { hasText:'Ana' }).locator('[data-est]').first().click();
await p.waitForTimeout(800);
dice('una orden rara se puede empezar a preparar',
  await p.evaluate(() => window.__D.ordenes.find(o => o.id === 'raro1').estado === 'prep'));
dice('no se perdió ninguna tarjeta', (await p.locator('.kcard').count()) === antes);

await cerrar(b, 'prueba_feria');
