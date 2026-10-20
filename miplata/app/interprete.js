/* MiPlata — intérprete de frases de gasto/ingreso.
   No usa IA: reglas + diccionario (jerga.js). Corre en el navegador.

   MiPlataInterprete.interpretar(texto, { medios, hoy })
     medios: [{ id, nombre, tipo_base, alias: [] }]   (los del usuario)
     hoy:    Date (por defecto, ahora)
   Devuelve:
     { ok, motivo, tipo, monto, fecha, lugar, detalle, medio_id, medio_tipo,
       preguntar_medio, categoria_sugerida, texto }
*/
(function (g) {
  'use strict';
  const J = g.MiPlataJerga;

  const set = a => new Set(a);
  const MONEDA = set(J.MONEDA), CENT = set(J.CENTIMOS), CHINA = set(J.CHINA), RELLENO = set(J.RELLENO);
  const CANTIDAD = set(['kilo', 'kilos', 'kg', 'kgs', 'gramos', 'litro', 'litros', 'unidades', 'unidad', 'docena', 'docenas', 'paquetes', 'paquete', 'bolsas', 'botellas', 'latas', 'veces', 'horas', 'minutos', 'personas', 'por ciento', '%']);
  const CORTE = set([',', 'con', 'pague', 'pagado', 'pago', 'por', 'para', 'y', 'que', 'via', 'usando', 'hoy', 'ayer', 'antier', 'anteayer']);
  const CONTEXTO_MEDIO = ['con', 'tarjeta', 'pague', 'pago', 'pagado', 'via', 'usando', 'use', 'mi', 'la', 'el'];

  // ---------- utilidades ----------
  function quitarTildes(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function norm(s) { return quitarTildes(String(s || '').toLowerCase()).trim(); }
  function lugarNorm(s) { return norm(s).replace(/[^a-z0-9]/g, ''); }
  function capitalizar(s) {
    const menores = set(['de', 'del', 'la', 'el', 'y', 'en', 'los', 'las']);
    return s.split(/\s+/).filter(Boolean).map((w, i) => (i > 0 && menores.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  function redondear(n) { return Math.round(n * 100) / 100; }
  function iso(d) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // ---------- 1. normalizar y separar en palabras ----------
  // Cada palabra guarda su forma normalizada (t, para comparar) y la original (o, con tildes, para mostrar)
  function tokenizar(texto) {
    let t = String(texto || '').toLowerCase().trim();
    t = t.replace(/s\s*\/\s*\.?\s*(\d+(?:[.,]\d+)*)/g, '$1 soles '); // S/ 12, s/.12 → 12 soles
    t = t.replace(/\bs\s*\/\s*\.?/g, ' ');
    t = t.replace(/(\d)\s*([.,])\s*(\d{3})(?!\d)/g, '$1$3'); // 1,200 / 1.200 → 1200
    t = t.replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');         // 12,50 → 12.50
    // la voz agrega puntuación: "Cinco, lucas" / "doce. soles" → sin la coma entre el número y la unidad
    t = t.replace(/(\d|\b(?:un[oa]?|dos|tres|cuatro|c[ií]nco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diec\p{L}+|veint\p{L}*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\p{L}+cient[oa]s|mil))\s*[,.]\s*(?=(?:lucas?|lukas?|soles?|sol|chinas?|mangos?|con)\b)/gu, '$1 ');
    t = t.replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2');
    t = t.replace(/[;:!?¡¿"“”()\[\]]/g, ' ');
    t = t.replace(/,/g, ' , ').replace(/\.(?!\d)/g, ' , ');
    return t.split(/\s+/).filter(Boolean).map(w => ({ t: quitarTildes(w), o: w }));
  }

  // ---------- 2. números escritos en palabras → número ----------
  function esPalabraNumero(w) {
    return w in J.UNIDADES || w in J.DECENAS || w in J.CENTENAS || w === 'mil';
  }
  function convertirNumeros(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i].t;
      if (/^\d+(\.\d+)?$/.test(w)) {
        let n = parseFloat(w);
        if (toks[i + 1] && toks[i + 1].t === 'mil') { n *= 1000; i++; }
        out.push({ t: w, o: w, n });
        continue;
      }
      // "sol y medio", "luca y media": moneda en singular sin número delante = 1
      if (['sol', 'luca', 'luka', 'mango'].includes(w) && !(out.length && out[out.length - 1].n !== undefined)) {
        out.push({ t: 'un', o: 'un', n: 1, palabras: true, implicito: true });
        out.push(toks[i]);
        continue;
      }
      if (!esPalabraNumero(w)) { out.push(toks[i]); continue; }
      // consumir una cifra en palabras
      let total = 0, actual = 0, ultimo = null, j = i, usadas = [];
      while (j < toks.length) {
        const p = toks[j].t;
        if (p in J.CENTENAS && actual === 0 && ultimo !== 'c') { actual += J.CENTENAS[p]; ultimo = 'c'; }
        else if (p in J.DECENAS && actual % 100 === 0 && ultimo !== 'd' && ultimo !== 'u') { actual += J.DECENAS[p]; ultimo = 'd'; }
        else if (p === 'y' && ultimo === 'd' && toks[j + 1] && J.UNIDADES[toks[j + 1].t] > 0 && J.UNIDADES[toks[j + 1].t] < 10) { ultimo = 'y'; }
        else if (p in J.UNIDADES && (ultimo === null || ultimo === 'c' || ultimo === 'mil' || ultimo === 'y') && !(ultimo === 'y' && J.UNIDADES[p] >= 10)) { actual += J.UNIDADES[p]; ultimo = 'u'; }
        else if (p === 'mil' && ultimo !== 'mil') { total += (actual || 1) * 1000; actual = 0; ultimo = 'mil'; }
        else break;
        usadas.push(p); j++;
      }
      // "un/una" suelto es artículo, salvo que venga moneda, china o céntimos
      const sig = toks[j] && toks[j].t;
      if (usadas.length === 1 && (usadas[0] === 'un' || usadas[0] === 'una' || usadas[0] === 'uno') &&
          !(sig && (MONEDA.has(sig) || CHINA.has(sig) || CENT.has(sig)))) {
        out.push(toks[i]); continue;
      }
      out.push({ t: usadas.join(' '), o: usadas.join(' '), n: total + actual, palabras: true });
      i = j - 1;
    }
    return out;
  }

  // ---------- 3. monto ----------
  function esMes(t) { return t && t.t in J.MESES; }
  function buscarMonto(toks) {
    const cand = [];
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i];
      if (k.n === undefined) continue;
      let val = k.n, fin = i, pts = 1;
      const a = toks[i + 1], b = toks[i + 2], c = toks[i + 3];
      const ant = toks[i - 1];

      // fechas: "15 de octubre", "el 15"
      if (a && a.t === 'de' && esMes(b)) continue;
      if (ant && ant.t === 'el' && val <= 31 && Number.isInteger(val) && !(a && (MONEDA.has(a.t) || CHINA.has(a.t)))) continue;
      // cantidades: "2 kilos"
      if (a && CANTIDAD.has(a.t)) continue;

      if (a && CHINA.has(a.t)) {                                  // "doce china", "una china", "dos chinas"
        val = a.t === 'chinas' ? val * 0.5 : (val === 1 ? 0.5 : val + 0.5);
        fin = i + 1; pts = 3;
      } else if (a && MONEDA.has(a.t)) {                          // "12 soles ..."
        fin = i + 1; pts = 3;
        if (b && b.t === 'con' && c && c.n !== undefined && c.n < 100) { val += c.n / 100; fin = i + 3; }
        else if (b && (b.t === 'con' || b.t === 'y') && c && CHINA.has(c.t)) { val += 0.5; fin = i + 3; }
        else if (b && b.t === 'china') { val += 0.5; fin = i + 2; }                     // "cinco lucas china" (sin "con")
        else if (b && b.t === ',' && c && c.t === 'china') { val += 0.5; fin = i + 3; }  // "Cinco lucas, china" (voz)
        else if (b && b.t === 'y' && c && (c.t === 'medio' || c.t === 'media')) { val += 0.5; fin = i + 3; }
        else if (b && b.n !== undefined && b.n < 100 && Number.isInteger(b.n) && !(c && (MONEDA.has(c.t) || CANTIDAD.has(c.t)))) { val += b.n / 100; fin = i + 2; }
        if (toks[fin + 1] && CENT.has(toks[fin + 1].t)) fin++;
      } else if (a && CENT.has(a.t)) {                            // "50 céntimos"
        val = val / 100; fin = i + 1; pts = 2;
      } else if (a && a.t === 'con' && b && b.n !== undefined && b.n < 100 && Number.isInteger(val)) { // "dos con veinte"
        val += b.n / 100; fin = i + 2; pts = 2;
        if (c && (MONEDA.has(c.t) || CENT.has(c.t))) { fin++; pts = 3; }
      } else if (a && a.t === 'con' && b && CHINA.has(b.t)) {      // "doce con china"
        val += 0.5; fin = i + 2; pts = 2;
      } else if (a && a.n !== undefined && Number.isInteger(val) && Number.isInteger(a.n) && a.n >= 10 && a.n < 100 && !(b && CANTIDAD.has(b.t))) { // "doce cincuenta"
        val += a.n / 100; fin = i + 1; pts = 2;
        if (b && MONEDA.has(b.t)) { fin++; pts = 3; }
      } else if (a && a.n === undefined && a.t !== ',' && !RELLENO.has(a.t) && !CORTE.has(a.t)) {
        pts = 0.5;                                                 // "3 panes …": probablemente una cantidad
      }
      cand.push({ val: redondear(val), ini: i, fin, pts });
    }
    if (!cand.length) return null;
    cand.sort((x, y) => y.pts - x.pts || x.ini - y.ini);
    return cand[0];
  }

  // ---------- 4. tipo ----------
  function esIngreso(textoNorm) { return J.INGRESO.some(r => r.test(textoNorm)); }

  // ---------- 5. medio de pago ----------
  function buscarFrase(toks, frase, desde) {
    const ps = frase.split(/\s+/);
    for (let i = desde || 0; i + ps.length <= toks.length; i++) {
      let ok = true;
      for (let k = 0; k < ps.length; k++) if (toks[i + k].t !== ps[k]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  }
  function hayContexto(toks, i) {
    for (let k = Math.max(0, i - 3); k < i; k++) if (CONTEXTO_MEDIO.includes(toks[k].t)) return true;
    return false;
  }
  function buscarMedio(toks, medios) {
    medios = medios || [];
    let mejor = null;
    // a) medios propios del usuario (nombre y alias)
    for (const m of medios) {
      const claves = [m.nombre].concat(m.alias || []).map(norm).filter(Boolean);
      const libre = m.tipo_base === 'efectivo' || m.tipo_base === 'billetera';
      for (const cl of claves) {
        const i = buscarFrase(toks, cl);
        if (i < 0) continue;
        if (!libre && !hayContexto(toks, i)) continue; // "Ripley" sin "con" puede ser la tienda
        const largo = cl.split(/\s+/).length;
        if (!mejor || largo > mejor.largo) mejor = { medio: m, i, largo };
      }
    }
    if (mejor) return { medio_id: mejor.medio.id, medio_tipo: mejor.medio.tipo_base, usados: rango(mejor.i, mejor.largo) };

    // b) palabras genéricas (yape, efectivo, débito, tarjeta…)
    for (const gen of J.MEDIOS_GENERICOS) {
      for (const p of gen.palabras) {
        const i = buscarFrase(toks, p);
        if (i < 0) continue;
        const usados = rango(i, 1);
        let candidatos = [];
        if (gen.tipo === 'yape' || gen.tipo === 'plin') candidatos = medios.filter(m => norm(m.nombre).includes(gen.tipo) || (m.alias || []).some(a => norm(a).includes(gen.tipo)));
        else if (gen.tipo === 'efectivo') candidatos = medios.filter(m => m.tipo_base === 'efectivo');
        else if (gen.tipo === 'debito' || gen.tipo === 'credito') candidatos = medios.filter(m => m.tipo_base === gen.tipo);
        else if (gen.tipo === 'transferencia') candidatos = medios.filter(m => m.tipo_base === 'transferencia');
        else if (gen.tipo === 'tarjeta') candidatos = medios.filter(m => m.tipo_base === 'debito' || m.tipo_base === 'credito');
        if (candidatos.length === 1) return { medio_id: candidatos[0].id, medio_tipo: candidatos[0].tipo_base, usados };
        return { medio_id: null, medio_tipo: gen.tipo, preguntar_medio: candidatos.length !== 1, usados };
      }
    }
    return { medio_id: null, medio_tipo: null, usados: [] };
  }
  function rango(i, n) { const r = []; for (let k = 0; k < n; k++) r.push(i + k); return r; }

  // ---------- 6. fecha ----------
  function buscarFecha(toks, hoy) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i].t;
      if (w === 'hoy') return { fecha: d, usados: [i] };
      if (w === 'ayer') { d.setDate(d.getDate() - 1); return { fecha: d, usados: [i] }; }
      if (w === 'anteayer' || w === 'antier' || (w === 'antes' && toks[i + 2] && toks[i + 2].t === 'ayer')) { d.setDate(d.getDate() - 2); return { fecha: d, usados: [i] }; }
      if (w in J.DIAS && !(toks[i - 1] && toks[i - 1].t === 'proximo')) {
        let atras = (d.getDay() - J.DIAS[w] + 7) % 7;
        d.setDate(d.getDate() - atras);
        return { fecha: d, usados: [i] };
      }
      const k = toks[i];
      if (k.n !== undefined && Number.isInteger(k.n) && k.n >= 1 && k.n <= 31) {
        const a = toks[i + 1], b = toks[i + 2];
        if (a && a.t === 'de' && b && b.t in J.MESES) {
          let f = new Date(d.getFullYear(), J.MESES[b.t], k.n);
          if (f > d) f = new Date(d.getFullYear() - 1, J.MESES[b.t], k.n);
          return { fecha: f, usados: [i, i + 1, i + 2] };
        }
        if (toks[i - 1] && toks[i - 1].t === 'el' && !(a && (MONEDA.has(a.t) || CHINA.has(a.t)))) {
          let f = new Date(d.getFullYear(), d.getMonth(), k.n);
          if (f > d) f = new Date(d.getFullYear(), d.getMonth() - 1, k.n);
          return { fecha: f, usados: [i - 1, i] };
        }
      }
    }
    return { fecha: d, usados: [] };
  }

  // ---------- 7. lugar y detalle ----------
  function buscarLugarConocido(toks, bloqueados) {
    let mejor = null;
    for (const L of J.LUGARES) {
      for (const al of L.alias) {
        let desde = 0, i;
        while ((i = buscarFrase(toks, al, desde)) >= 0) {
          const largo = al.split(/\s+/).length;
          const libre = rango(i, largo).every(x => !bloqueados.has(x));
          if (libre && (!mejor || largo > mejor.largo)) mejor = { L, i, largo };
          desde = i + 1;
        }
      }
    }
    return mejor;
  }

  function limpiarBorde(ws) {
    const rel = w => RELLENO.has(quitarTildes(w));
    while (ws.length && rel(ws[0])) ws.shift();
    while (ws.length && (rel(ws[ws.length - 1]) || ws[ws.length - 1] === ',')) ws.pop();
    return ws;
  }

  function interpretar(texto, opciones) {
    opciones = opciones || {};
    const hoy = opciones.hoy || new Date();
    const res = { ok: false, motivo: null, tipo: 'gasto', monto: null, fecha: iso(hoy), lugar: '', detalle: '',
      medio_id: null, medio_tipo: null, preguntar_medio: false, categoria_sugerida: null, texto: String(texto || '').trim() };
    if (!res.texto) { res.motivo = 'vacio'; return res; }

    const toks = convertirNumeros(tokenizar(res.texto));
    const plano = toks.map(k => k.t).join(' ');
    const bloq = new Set();

    // monto
    const m = buscarMonto(toks);
    if (!m || !(m.val > 0)) { res.motivo = 'sin_monto'; }
    else { res.monto = m.val; for (let k = m.ini; k <= m.fin; k++) bloq.add(k); }

    // fecha
    const f = buscarFecha(toks, hoy);
    res.fecha = iso(f.fecha); f.usados.forEach(x => bloq.add(x));

    // medio
    const md = buscarMedio(toks, opciones.medios);
    res.medio_id = md.medio_id; res.medio_tipo = md.medio_tipo; res.preguntar_medio = !!md.preguntar_medio;
    md.usados.forEach(x => bloq.add(x));
    // tipo (sin contar el medio: "cuenta sueldo" no es un ingreso)
    const sinMedio = toks.filter((k, i) => !md.usados.includes(i)).map(k => k.t).join(' ');
    // …pero "me yapearon", "me depositaron" sí cuentan aunque la palabra sea también el medio
    if (esIngreso(sinMedio) || J.INGRESO[0].test(plano) || J.INGRESO[1].test(plano)) res.tipo = 'ingreso';
    // verbos de ingreso no son lugar
    toks.forEach((k, i) => { if (/^(yapearon|yapiaron|plinearon|depositaron|pagaron|transfirieron|abonaron|yapeo|yapio|plineo|deposito|transfirio|abono|cayo|mandaron|enviaron|cobre|recibi|gane|vendi)$/.test(k.t)) bloq.add(i); });

    // lugar conocido
    const lc = buscarLugarConocido(toks, bloq);
    let lugarIdx = [];
    if (lc) {
      res.lugar = lc.L.nombre;
      res.categoria_sugerida = lc.L.categoria;
      lugarIdx = rango(lc.i, lc.largo);
    } else {
      // "… en <lugar>"
      for (let i = toks.length - 1; i >= 0; i--) {
        if (toks[i].t !== 'en' || bloq.has(i)) continue;
        const ws = [], idx = [];
        for (let j = i + 1; j < toks.length && ws.length < 4; j++) {
          if (bloq.has(j) || CORTE.has(toks[j].t) || toks[j].n !== undefined) break;
          ws.push(toks[j].o); idx.push(j);
        }
        while (ws.length && ['el', 'la', 'los', 'las', 'un', 'una', 'mi'].includes(quitarTildes(ws[0]))) { ws.shift(); idx.shift(); }
        if (ws.length) { res.lugar = capitalizar(ws.join(' ')); lugarIdx = idx; break; }
      }
    }
    lugarIdx.forEach(x => bloq.add(x));

    // resto → detalle (y lugar si aún no hay)
    const resto = [];
    toks.forEach((k, i) => { if (!bloq.has(i) && k.n === undefined) resto.push({ w: k.o, i }); });
    // separar en trozos por comas / cortes
    const trozos = [];
    let cur = [];
    resto.forEach((r, n) => {
      const pegado = n > 0 && r.i === resto[n - 1].i + 1;
      if (r.w === ',' || !pegado) { if (cur.length) trozos.push(cur); cur = []; }
      if (r.w !== ',') cur.push(r.w);
    });
    if (cur.length) trozos.push(cur);
    // un trozo que empieza con "de" ("de pan", "de gaseosa") es detalle, no lugar
    const utiles = trozos.map(t => ({ detalle: quitarTildes(t[0]) === 'de', ws: limpiarBorde(t.slice()) })).filter(t => t.ws.length);

    if (!res.lugar) {
      const k = utiles.findIndex(t => !t.detalle);
      if (k >= 0) res.lugar = capitalizar(utiles.splice(k, 1)[0].ws.slice(0, 4).join(' '));
    }
    res.detalle = utiles.map(t => t.ws.join(' ')).join(', ');

    // categoría sugerida por pistas
    if (res.tipo === 'ingreso') {
      if (/\b(sueldo|quincena|grati|gratificacion|cts)\b/.test(plano)) res.categoria_sugerida = 'sueldo';
      else if (/\b(vendi|venta|ventas)\b/.test(plano)) res.categoria_sugerida = 'ventas';
      else if (/\b(freelance|cachuelo|chamba|proyecto|honorarios|recibo por honorarios)\b/.test(plano)) res.categoria_sugerida = 'freelance';
      else if (/\b(yap|plin)\w*/.test(plano)) res.categoria_sugerida = 'billetera';
      else res.categoria_sugerida = 'otros_ingresos';
    } else if (!res.categoria_sugerida) {
      for (const [cat, pistas] of Object.entries(J.PISTAS_CATEGORIA)) {
        if (pistas.some(p => (' ' + plano + ' ').includes(' ' + p + ' '))) { res.categoria_sugerida = cat; break; }
      }
    }

    res.ok = res.monto !== null;
    return res;
  }

  g.MiPlataInterprete = { interpretar, lugarNorm, normalizar: norm, capitalizar, _tokens: t => convertirNumeros(tokenizar(t)) };
})(typeof window !== 'undefined' ? window : globalThis);
