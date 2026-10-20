#!/usr/bin/env node
/* correr_pruebas.mjs — corre todas las suites de la web de feria.
   Levanta el servidor estático, ejecuta cada suite y resume. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const AQUI = new URL('.', import.meta.url).pathname;        // potente/pruebas/
const RAIZ = new URL('../../', import.meta.url).pathname;   // raíz del repo: lo que se sirve
const PUERTO = 8770;
const TIPOS = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript',
                '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };

const servidor = createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(req.url.split('?')[0]);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const abs = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
    await stat(abs);
    res.writeHead(200, { 'content-type': TIPOS[extname(abs)] || 'application/octet-stream' });
    res.end(await readFile(abs));
  } catch { res.writeHead(404); res.end('no'); }
});

const SUITES = [
  ['prueba_operacion.mjs',  'Caja: ferias en paralelo, cliente, pedidos, corregir, anular, POS'],
  ['prueba_carta.mjs',      'Carta: orden, combos, opciones obligatorias y precios'],
  ['prueba_cambiar.mjs',    'Línea del pedido: − / +, Salsas, Cambiar y Quitar'],
  ['prueba_feria.mjs',      'Cocina: un medio de pago raro no tumba la pantalla'],
  ['prueba_entregados.mjs', 'Cocina: lo que ya se despachó hoy'],
  ['prueba_inventario.mjs', 'Inventario de cierre, por día y por feria']
];

await new Promise(r => servidor.listen(PUERTO, r));
console.log('Servidor de pruebas en http://localhost:' + PUERTO + '\n');

const fallaron = [];
for (const [archivo, que] of SUITES){
  console.log('═'.repeat(72));
  console.log('▶  ' + archivo + '  —  ' + que);
  console.log('═'.repeat(72));
  // spawn asíncrono a propósito: spawnSync bloquea el bucle de eventos y el
  // servidor de arriba se quedaría sin atender a la propia prueba.
  const code = await new Promise(res => {
    const h = spawn(process.execPath, [join(AQUI, archivo)], { stdio:'inherit', cwd:AQUI });
    h.on('close', c => res(c));
  });
  if (code !== 0) fallaron.push(archivo);
}

servidor.close();
console.log('\n' + '═'.repeat(72));
if (fallaron.length){
  console.log('FALLARON ' + fallaron.length + ' de ' + SUITES.length + ':\n- ' + fallaron.join('\n- '));
  process.exit(1);
}
console.log('Las ' + SUITES.length + ' suites en verde.');
