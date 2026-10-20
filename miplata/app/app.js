/* MiPlata — app v1
   Acceso, espacios (personal / familia / empresa), movimientos por texto, Completar,
   categorías y medios por espacio, miembros e invitaciones, Activar MiPlata (pago Plin)
   y panel Admin. */
(function () {
  'use strict';
  const C = window.MIPLATA_CONFIG, J = window.MiPlataJerga, I = window.MiPlataInterprete;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
  const $app = document.getElementById('app');
  const LOGO_SVG = document.getElementById('tpl-logo').innerHTML;
  const ILUSTRA_SVG = document.getElementById('tpl-ilustra').innerHTML;
  const logo = (t, fs) => `<div class="logo" style="--t:${t}px;--fs:${fs}px">${LOGO_SVG}<b>Mi<span>Plata</span></b></div>`;
  const svg = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}>${d}</svg>`;
  const IC = {
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity=".18"/><path d="M12 7v10M7 12h10"/></svg>',
    persona: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 14.8-4.2 16 0"/>'),
    correo: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>'),
    candado: svg('<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    celular: svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18h3"/>'),
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
    familia: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
    empresa: svg('<rect x="4" y="3" width="11" height="18" rx="1.5"/><path d="M15 9h5v12h-5M8 7h3M8 11h3M8 15h3"/>'),
    flechaAbajo: svg('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2.6"'),
    copiar: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    compartir: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
    camara: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
    sobre: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>'),
    estrella: '★'
  };
  const conIcono = (ic, input) => `<div class="con-icono">${IC[ic]}${input}</div>`;
  // Paleta categórica validada (daltonismo y contraste) — orden fijo; en modo oscuro se usa su paso oscuro
  const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#8a9690'];
  const OSCURO = { '#2a78d6': '#3987e5', '#eb6834': '#d95926', '#1baf7a': '#199e70', '#eda100': '#c98500', '#e87ba4': '#d55181', '#008300': '#008300', '#6250d6': '#9085e9', '#e34948': '#e66767', '#8a9690': '#7f8f88' };
  const SIN_CAT = { claro: '#b4c2ba', oscuro: '#4f6b5e' };
  function modoOscuro() {
    const t = document.documentElement.dataset.theme;
    return t === 'oscuro' || (t !== 'claro' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function colorCat(hex) { if (!hex) return modoOscuro() ? SIN_CAT.oscuro : SIN_CAT.claro; const h = hex.toLowerCase(); return modoOscuro() ? (OSCURO[h] || h) : h; }
  const TIPO_BASE = { efectivo: 'Efectivo', billetera: 'Billetera', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia', otro: 'Otro' };

  const E = {
    sesion: null, perfil: null, espacios: [], espacio: null, rol: 'admin', medioPred: null,
    medios: [], categorias: [], miembros: [], limites: [], movs: [], mes: inicioMes(new Date()),
    pestana: 'movimientos', recuperando: false, pagoActual: null, demo: false
  };

  // ---------------- utilidades ----------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function soles(n) { return Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function inicioMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function iso(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function deIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function nombreDia(fechaIso) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = deIso(fechaIso), dif = Math.round((hoy - d) / 864e5);
    if (dif === 0) return 'Hoy';
    if (dif === 1) return 'Ayer';
    const t = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function corto(fechaIso) { const n = nombreDia(fechaIso); return n === 'Hoy' || n === 'Ayer' ? n.toLowerCase() : deIso(fechaIso).getDate() + ' ' + MESES[deIso(fechaIso).getMonth()].slice(0, 3); }
  function fechaLarga(d) { d = new Date(d); return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  const medioPorId = id => E.medios.find(m => m.id === id);
  const catPorId = id => E.categorias.find(c => c.id === id);
  const espacioActual = () => E.espacios.find(e => e.id === E.espacio) || {};
  const esGrupo = () => espacioActual().tipo && espacioActual().tipo !== 'personal';
  const esAdminEspacio = () => E.rol === 'admin';
  function accesoHasta() { const p = E.perfil; if (!p) return null; const a = new Date(p.prueba_hasta), b = p.pagado_hasta ? new Date(p.pagado_hasta) : a; return a > b ? a : b; }
  function tieneAcceso() { const h = accesoHasta(); return !!h && h > new Date(); }
  function diasRestantes() { const h = accesoHasta(); return h ? Math.ceil((h - new Date()) / 864e5) : 0; }
  const pagado = () => E.perfil && E.perfil.pagado_hasta && new Date(E.perfil.pagado_hasta) > new Date();
  function iconoEspacio(tipo) { return tipo === 'familia' ? IC.familia : tipo === 'empresa' ? IC.empresa : IC.persona; }
  function errorEs(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Ingresa con tu contraseña.';
    if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/valid email|invalid format/i.test(m)) return 'Revisa el correo: no parece válido.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
    if (/row-level security/i.test(m)) return 'No tienes permiso para esto, o tu periodo de acceso terminó.';
    if (/categorias_nombre_unico|duplicate key.*categorias/i.test(m)) return 'Ya tienes una categoría con ese nombre.';
    if (/medios_pago_nombre_unico/i.test(m)) return 'Ya tienes un medio de pago con ese nombre. Usa uno distinto, por ejemplo "Interbank crédito".';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisa tu internet y vuelve a intentar.';
    return m;
  }
  function aplicarTema(t) {
    if (t === 'claro' || t === 'oscuro') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('miplata.tema', t); } catch (e) {}
  }
  function guardarCodigoUnirme() {
    const m = location.search.match(/[?&]unirme=([A-Za-z0-9]{4,12})/);
    if (m) { try { sessionStorage.setItem('miplata.unirme', m[1].toUpperCase()); } catch (e) {} history.replaceState(null, '', location.pathname); }
  }
  function tomarCodigoUnirme() { try { const c = sessionStorage.getItem('miplata.unirme'); sessionStorage.removeItem('miplata.unirme'); return c; } catch (e) { return null; } }

  // Hoja inferior genérica
  function abrirHoja(etiqueta, pintar, alCerrar) {
    const velo = document.createElement('div'); velo.className = 'velo';
    const hoja = document.createElement('div'); hoja.className = 'hoja'; hoja.setAttribute('role', 'dialog'); hoja.setAttribute('aria-modal', 'true'); hoja.setAttribute('aria-label', etiqueta);
    let cerrada = false;
    const cerrar = () => { if (cerrada) return; cerrada = true; velo.remove(); hoja.remove(); document.removeEventListener('keydown', teclas); if (alCerrar) alCerrar(); };
    // solo la hoja de más arriba responde a Escape
    const teclas = e => { if (e.key === 'Escape' && document.querySelectorAll('.hoja').length && [...document.querySelectorAll('.hoja')].pop() === hoja) cerrar(); };
    velo.onclick = cerrar;
    document.addEventListener('keydown', teclas);
    document.body.append(velo, hoja);
    pintar(hoja, cerrar);
    setTimeout(() => hoja.querySelector('input:not([type=hidden]), button:not(.tirador)')?.focus(), 30);
    return cerrar;
  }

  // ---------------- arranque ----------------
  async function iniciar() {
    if (/[?&]demo\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return demo();
    guardarCodigoUnirme();
    if (/[?&]activar\b/.test(location.search)) E.pestana = 'activar';
    if (/type=(recovery|invite)/.test(location.hash)) E.recuperando = true;
    sb.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY') { E.recuperando = true; pantallaAcceso('nueva'); return; }
      if (evento === 'SIGNED_OUT') { E.sesion = null; E.perfil = null; pantallaAcceso('ingresar'); }
      if (evento === 'SIGNED_IN' && !E.sesion && !E.recuperando) { E.sesion = sesion; cargarUsuario(); }
    });
    const { data } = await sb.auth.getSession();
    if (E.recuperando) return pantallaAcceso('nueva');
    if (data.session) { E.sesion = data.session; cargarUsuario(); }
    else pantallaAcceso(/[?&](ingresar|activar)\b/.test(location.search) ? 'ingresar' : 'crear');
  }

  // ---------------- acceso: crear cuenta / ingresar / olvidé / nueva clave ----------------
  function pantallaAcceso(modo) {
    let cuerpo = '';
    let unirme = null; try { unirme = sessionStorage.getItem('miplata.unirme'); } catch (e) {}
    if (modo === 'crear' || modo === 'ingresar') {
      cuerpo = `
        <h1>${modo === 'crear' ? 'Dilo y queda anotado' : 'Hola de nuevo'}</h1>
        <p class="sub">${unirme ? 'Te invitaron a un grupo. Crea tu cuenta o ingresa para unirte.' : modo === 'crear' ? 'Prueba MiPlata gratis por 30 días. Sin tarjeta.' : 'Ingresa para ver tus gastos.'}</p>
        <div class="selector" role="tablist">
          <button type="button" role="tab" aria-selected="${modo === 'crear'}" data-ir="crear">${IC.mas}Crear cuenta</button>
          <button type="button" role="tab" aria-selected="${modo === 'ingresar'}" data-ir="ingresar">${IC.persona}Ingresar</button>
        </div>
        <form id="f-acceso" novalidate>
          ${modo === 'crear' ? `
          <div class="campo"><label for="a-nombre">Tu nombre</label>${conIcono('persona', '<input class="entrada" id="a-nombre" autocomplete="name" required maxlength="80" placeholder="Cómo te llamas">')}</div>` : ''}
          <div class="campo"><label for="a-correo">Correo</label>${conIcono('correo', '<input class="entrada" id="a-correo" type="email" autocomplete="email" inputmode="email" required placeholder="tu@correo.com">')}</div>
          ${modo === 'crear' ? `
          <div class="campo"><label for="a-tel">Celular (opcional)</label>${conIcono('celular', '<input class="entrada" id="a-tel" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="999 999 999">')}</div>` : ''}
          <div class="campo"><label for="a-clave">Contraseña</label>${conIcono('candado', `<input class="entrada" id="a-clave" type="password" autocomplete="${modo === 'crear' ? 'new-password' : 'current-password'}" required minlength="6" placeholder="••••••">`)}
            ${modo === 'crear' ? '<small>Mínimo 6 caracteres.</small>' : ''}</div>
          ${modo === 'crear' ? `
          <label class="check"><input type="checkbox" id="a-acepto"><span>Acepto los <a href="../terminos.html" target="_blank">términos</a> y la <a href="../privacidad.html" target="_blank">política de privacidad</a>.</span></label>` : ''}
          <div id="a-msg" role="status" aria-live="polite"></div>
          <button class="btn" type="submit">${modo === 'crear' ? 'Empezar mi prueba gratis' : 'Ingresar'}</button>
          ${modo === 'ingresar' ? '<button type="button" class="enlace" data-ir="olvide">Olvidé mi contraseña</button>' : ''}
        </form>`;
    } else if (modo === 'olvide') {
      cuerpo = `
        <h1>Recupera tu contraseña</h1>
        <p class="sub">Te enviamos un enlace a tu correo para crear una nueva.</p>
        <form id="f-acceso" novalidate>
          <div class="campo"><label for="a-correo">Correo</label>${conIcono('correo', '<input class="entrada" id="a-correo" type="email" autocomplete="email" required placeholder="tu@correo.com">')}</div>
          <div id="a-msg" role="status" aria-live="polite"></div>
          <button class="btn" type="submit">Enviar enlace</button>
          <button type="button" class="enlace" data-ir="ingresar">Volver a ingresar</button>
        </form>`;
    } else if (modo === 'nueva') {
      cuerpo = `
        <h1>Crea tu nueva contraseña</h1>
        <form id="f-acceso" novalidate>
          <div class="campo"><label for="a-clave">Nueva contraseña</label>${conIcono('candado', '<input class="entrada" id="a-clave" type="password" autocomplete="new-password" required minlength="6">')}<small>Mínimo 6 caracteres.</small></div>
          <div id="a-msg" role="status" aria-live="polite"></div>
          <button class="btn" type="submit">Guardar contraseña</button>
        </form>`;
    }
    $app.innerHTML = `<section class="pantalla acceso"><a href="../" style="text-decoration:none" aria-label="MiPlata: qué es y precio">${logo(64, 40)}</a><div class="ilustra">${ILUSTRA_SVG}</div>${cuerpo}
      <a class="enlace" href="../" style="margin-top:4px">Conoce qué es MiPlata y cuánto cuesta</a></section>`;
    $app.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => pantallaAcceso(b.dataset.ir));
    // ojo para mostrar u ocultar la contraseña
    const OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    const OJO_NO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>';
    $app.querySelectorAll('input[type=password]').forEach(inp => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ver-clave'; b.setAttribute('aria-label', 'Mostrar contraseña'); b.setAttribute('aria-pressed', 'false'); b.innerHTML = OJO;
      b.onclick = () => {
        const ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.innerHTML = ver ? OJO_NO : OJO;
        b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
        b.setAttribute('aria-pressed', String(ver));
        inp.focus();
      };
      inp.classList.add('con-ojo');
      inp.parentElement.appendChild(b);
    });
    const f = document.getElementById('f-acceso'), msg = document.getElementById('a-msg');
    const decir = (t, tipo) => { msg.innerHTML = t ? `<p class="mensaje ${tipo || 'error'}">${esc(t)}</p>` : ''; };
    const acepto = document.getElementById('a-acepto');
    if (acepto) {
      const btnCrear = f.querySelector('button[type=submit]');
      const marcar = () => { btnCrear.classList.toggle('apagado', !acepto.checked); btnCrear.setAttribute('aria-disabled', String(!acepto.checked)); if (acepto.checked) { acepto.closest('.check').classList.remove('falta'); decir(''); } };
      acepto.addEventListener('change', marcar); marcar();
    }
    f.onsubmit = async ev => {
      ev.preventDefault();
      const v = id => (document.getElementById(id) || {}).value?.trim() || '';
      const btn = f.querySelector('button[type=submit]');
      try {
        if (modo === 'crear') {
          if (!v('a-nombre')) return decir('Escribe tu nombre.');
          if (!/^\S+@\S+\.\S+$/.test(v('a-correo'))) return decir('Revisa el correo: no parece válido.');
          if (v('a-clave').length < 6) return decir('La contraseña debe tener al menos 6 caracteres.');
          if (!document.getElementById('a-acepto').checked) {
            const ch = document.getElementById('a-acepto'); ch.closest('.check').classList.add('falta'); ch.focus();
            return decir('Para crear tu cuenta, marca la casilla de términos y política de privacidad.');
          }
          btn.disabled = true; decir('');
          const { data, error } = await sb.auth.signUp({ email: v('a-correo'), password: document.getElementById('a-clave').value,
            options: { data: { nombre: v('a-nombre'), telefono: v('a-tel'), acepto_terminos: 'true' } } });
          if (error) throw error;
          if (!data.session) { btn.disabled = false; return decir('Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.', 'ok'); }
          E.sesion = data.session; cargarUsuario();
        } else if (modo === 'ingresar') {
          btn.disabled = true; decir('');
          const { data, error } = await sb.auth.signInWithPassword({ email: v('a-correo'), password: document.getElementById('a-clave').value });
          if (error) throw error;
          E.sesion = data.session; cargarUsuario();
        } else if (modo === 'olvide') {
          btn.disabled = true;
          const { error } = await sb.auth.resetPasswordForEmail(v('a-correo'), { redirectTo: location.origin + location.pathname });
          if (error) throw error;
          decir('Listo. Revisa tu correo (y la carpeta de spam).', 'ok');
        } else if (modo === 'nueva') {
          if (document.getElementById('a-clave').value.length < 6) return decir('La contraseña debe tener al menos 6 caracteres.');
          btn.disabled = true;
          const { error } = await sb.auth.updateUser({ password: document.getElementById('a-clave').value });
          if (error) throw error;
          E.recuperando = false; history.replaceState(null, '', location.pathname);
          const { data } = await sb.auth.getSession(); E.sesion = data.session; cargarUsuario();
        }
      } catch (e) { btn.disabled = false; decir(errorEs(e)); }
    };
  }

  // ---------------- cargar usuario y espacio ----------------
  async function cargarUsuario() {
    $app.innerHTML = '<div class="cargando">Cargando tus datos…</div>';
    const uid = E.sesion.user.id;
    const p = await sb.from('perfiles').select('*').eq('id', uid).single();
    if (p.error) { $app.innerHTML = `<div class="cargando">No pudimos cargar tu cuenta. ${esc(errorEs(p.error))}<br><br><button class="enlace" id="reint">Reintentar</button></div>`; document.getElementById('reint').onclick = cargarUsuario; return; }
    E.perfil = p.data;
    if (E.perfil.tema) aplicarTema(E.perfil.tema);
    const cod = tomarCodigoUnirme();
    if (cod) {
      const { data, error } = await sb.rpc('unirse_con_codigo', { p_codigo: cod });
      if (error) setTimeout(() => toast(esc(errorEs(error)), null, true), 600);
      else { E.perfil.espacio_activo = data; setTimeout(() => toast('Te uniste al grupo'), 600); }
    }
    await cargarEspacios();
    await cargarEspacio(E.perfil.espacio_activo);
    await cargarPagoActual();
    cargarAprendizaje();
    const personal = E.espacios.find(e => e.tipo === 'personal');
    if (personal && personal.id === E.espacio && !E.medios.length) return onboarding();
    principal();
  }

  // Lo que la app aprendió de esta persona: correcciones de lugar y sus lugares de siempre (para la voz)
  async function cargarAprendizaje() {
    E.aprendidos = {}; E.misLugares = [];
    try {
      const [a, l] = await Promise.all([
        sb.from('aprendizaje_lugares').select('de, a'),
        sb.from('movimientos').select('lugar').eq('usuario_id', E.sesion.user.id).not('lugar', 'is', null).order('creado_en', { ascending: false }).limit(300)
      ]);
      (a.data || []).forEach(x => { E.aprendidos[x.de] = x.a; });
      const cuenta = {};
      (l.data || []).forEach(x => { const k = x.lugar.trim(); if (k) cuenta[k] = (cuenta[k] || 0) + 1; });
      E.misLugares = Object.keys(cuenta).filter(k => !E.aprendidos[I.normalizar(k)]).sort((x, y) => cuenta[y] - cuenta[x]).slice(0, 30);
    } catch (e) { /* sin aprendizaje igual funciona */ }
  }
  const lugarAprendido = lugar => (lugar && E.aprendidos && E.aprendidos[I.normalizar(lugar)]) || lugar;

  async function cargarEspacios() {
    const { data, error } = await sb.rpc('mis_espacios');
    if (error) throw error;
    E.espacios = data || [];
  }

  async function cargarEspacio(id) {
    if (!E.espacios.some(e => e.id === id)) id = (E.espacios.find(e => e.tipo === 'personal') || E.espacios[0] || {}).id;
    E.espacio = id;
    E.rol = espacioActual().rol || 'miembro';
    const uid = E.sesion.user.id;
    const [m, c, yo, lim] = await Promise.all([
      sb.from('medios_pago').select('*').eq('espacio_id', id).eq('activo', true).order('orden'),
      sb.from('categorias').select('*').eq('espacio_id', id).order('tipo').order('orden').order('nombre'),
      sb.from('espacio_miembros').select('medio_predeterminado').eq('espacio_id', id).eq('usuario_id', uid).maybeSingle(),
      sb.from('limites').select('*').eq('espacio_id', id).order('creado_en')
    ]);
    E.limites = lim.data || [];
    E.medios = m.data || [];
    E.categorias = c.data || [];
    E.medioPred = (yo.data || {}).medio_predeterminado || null;
    E.miembros = [];
    if (espacioActual().tipo !== 'personal') {
      const r = await sb.rpc('miembros_de', { p_espacio: id });
      E.miembros = r.data || [];
    }
    if (E.perfil.espacio_activo !== id) {
      E.perfil.espacio_activo = id;
      sb.from('perfiles').update({ espacio_activo: id }).eq('id', uid).then(() => {});
    }
  }

  async function cambiarEspacio(id) {
    if (E.demo) return demoCambiar(id);
    $app.querySelector('#contenido')?.setAttribute('aria-busy', 'true');
    await cargarEspacio(id);
    E.mes = inicioMes(new Date());
    principal();
  }

  async function cargarPagoActual() {
    const { data } = await sb.from('pagos').select('*').eq('usuario_id', E.sesion.user.id).order('creado_en', { ascending: false }).limit(1);
    E.pagoActual = (data || [])[0] || null;
  }

  // Hoja para editar un medio de pago (nombre y tipo) o quitarlo. La usan el onboarding y la pestaña Espacio.
  function hojaMedio(medio, otrosNombres, alGuardar, alQuitar) {
    abrirHoja('Editar medio de pago', (hoja, cerrar) => {
      hoja.innerHTML = `<div class="tirador"></div><h2>Editar medio de pago</h2>
        <div class="campo"><label for="mp-nombre">Nombre</label><input class="entrada" id="mp-nombre" maxlength="40" value="${esc(medio.nombre)}"></div>
        <div class="campo"><label for="mp-tipo">Tipo</label><select class="entrada" id="mp-tipo">
          ${Object.entries({ debito: 'Tarjeta de débito', credito: 'Tarjeta de crédito', billetera: 'Billetera (Yape, Plin…)', efectivo: 'Efectivo', transferencia: 'Transferencia', otro: 'Otro' })
            .map(([v, t]) => `<option value="${v}" ${medio.tipo_base === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div id="mp-msg" role="status" aria-live="polite"></div>
        <button type="button" class="btn" id="mp-guardar">Guardar cambios</button>
        <button type="button" class="btn peligro" id="mp-quitar">Quitar este medio</button>
        <p class="nota">Si lo quitas, los movimientos que ya lo usan lo conservan.</p>`;
      const fallo = t => { hoja.querySelector('#mp-msg').innerHTML = `<p class="mensaje error">${esc(t)}</p>`; };
      hoja.querySelector('#mp-nombre').onkeydown = ev => { if (ev.key === 'Enter') hoja.querySelector('#mp-guardar').click(); };
      hoja.querySelector('#mp-guardar').onclick = async ev => {
        const nombre = hoja.querySelector('#mp-nombre').value.trim().replace(/\s+/g, ' ');
        const tipo = hoja.querySelector('#mp-tipo').value;
        if (!nombre) return fallo('Escribe un nombre.');
        if (otrosNombres.some(n => I.normalizar(n) === I.normalizar(nombre))) return fallo(`Ya tienes otro medio llamado "${nombre}". Usa un nombre distinto.`);
        ev.target.disabled = true;
        const err = await alGuardar(nombre, tipo);
        if (err) { ev.target.disabled = false; return fallo(err); }
        cerrar();
      };
      hoja.querySelector('#mp-quitar').onclick = async ev => {
        ev.target.disabled = true;
        const err = await alQuitar();
        if (err) { ev.target.disabled = false; return fallo(err); }
        cerrar();
      };
    });
  }

  // ---------------- onboarding: mis medios de pago (espacio personal) ----------------
  function onboarding() {
    const elegidos = J.MEDIOS_SUGERIDOS.filter(s => s.nombre === 'Efectivo' || s.nombre === 'Yape').map(s => ({ ...s }));
    let predet = 'Efectivo';
    const sugeridos = J.MEDIOS_SUGERIDOS.map(s => ({ ...s }));
    const mismo = (a, b) => I.normalizar(a) === I.normalizar(b);
    let aviso = null, borrador = '', tipoBorrador = 'debito';
    function pintar() {
      $app.innerHTML = `
      <section class="pantalla onboarding">
        ${logo(40, 26)}
        <h1>¿Con qué sueles pagar?</h1>
        <p>Toca los que usas. Puedes ponerles el nombre que quieras, así los reconozco cuando me hables.</p>
        <div class="chips" id="sug">${sugeridos.map((s, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="${elegidos.some(e => mismo(e.nombre, s.nombre))}">${esc(s.nombre)}</button>`).join('')}</div>
        ${formOtroMedio('¿Otro? Escríbelo como lo llamas', 'Ej.: Interbank crédito, tarjeta del sueldo')}
        ${aviso ? `<p class="mensaje ${aviso.tipo}">${esc(aviso.texto)}</p>` : ''}
        ${elegidos.length ? `<div><p style="margin-bottom:6px">Tus medios. La ★ marca el que uso cuando no me dices con qué pagaste:</p>
        <ul class="lista-medios">${elegidos.map((e, k) => `<li><button type="button" class="estrella" data-pred="${esc(e.nombre)}" aria-pressed="${mismo(e.nombre, predet || '')}" aria-label="Usar ${esc(e.nombre)} por defecto">★</button><span>${esc(e.nombre)}<br><small>${esc(TIPO_BASE[e.tipo_base] || '')}</small></span>
          <button type="button" class="enlace" data-ed="${k}" aria-label="Editar ${esc(e.nombre)}">Editar</button></li>`).join('')}</ul></div>` : ''}
        <div id="o-msg" role="status" aria-live="polite"></div>
        <button class="btn" id="o-listo" ${elegidos.length ? '' : 'disabled'}>Listo, empezar</button>
      </section>`;
      const inp = document.getElementById('o-nombre'), sel = document.getElementById('o-tipo');
      inp.value = borrador; sel.value = tipoBorrador;
      inp.oninput = () => { borrador = inp.value; };
      sel.onchange = () => { tipoBorrador = sel.value; };
      inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); agregar(); } };
      $app.querySelectorAll('#sug .chip').forEach(b => b.onclick = () => {
        const s = sugeridos[b.dataset.i], k = elegidos.findIndex(e => mismo(e.nombre, s.nombre));
        if (k >= 0) elegidos.splice(k, 1); else elegidos.push({ ...s });
        if (!elegidos.some(e => mismo(e.nombre, predet || ''))) predet = elegidos[0] ? elegidos[0].nombre : null;
        aviso = null; pintar();
      });
      $app.querySelectorAll('[data-pred]').forEach(b => b.onclick = () => { predet = b.dataset.pred; pintar(); });
      $app.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => {
        const k = Number(b.dataset.ed), e = elegidos[k];
        hojaMedio(e, elegidos.filter((_, j) => j !== k).map(x => x.nombre),
          async (nombre, tipo) => {
            const eraPred = mismo(e.nombre, predet || '');
            const chip = sugeridos.find(s => mismo(s.nombre, e.nombre));
            const esSugerencia = J.MEDIOS_SUGERIDOS.some(s => mismo(s.nombre, e.nombre));
            if (!mismo(nombre, e.nombre)) {
              // renombrado: la burbuja propia se renombra; si era una sugerencia, queda y se crea una propia
              if (chip && !esSugerencia) chip.nombre = nombre;
              else if (!sugeridos.some(s => mismo(s.nombre, nombre))) sugeridos.push({ nombre, tipo_base: tipo, alias: [I.normalizar(nombre)] });
              e.alias = [...new Set([...(e.alias || []), I.normalizar(nombre)])];
            }
            e.nombre = nombre; e.tipo_base = tipo;
            if (eraPred) predet = nombre;
            aviso = { tipo: 'ok', texto: `Guardamos "${nombre}".` }; pintar();
          },
          async () => {
            elegidos.splice(k, 1);
            if (!elegidos.some(x => mismo(x.nombre, predet || ''))) predet = elegidos[0] ? elegidos[0].nombre : null;
            aviso = { tipo: 'ok', texto: `Quitamos "${e.nombre}".` }; pintar();
          });
      });
      document.getElementById('o-agregar').onclick = agregar;
      conectarListo();
    }
    function agregar() {
      const n = borrador.trim().replace(/\s+/g, ' ');
      if (!n) { aviso = { tipo: 'error', texto: 'Escribe cómo se llama tu medio de pago.' }; return pintar(); }
      const sugerido = sugeridos.find(s => mismo(s.nombre, n));
      const yaElegido = elegidos.find(e => mismo(e.nombre, n));
      if (yaElegido) {
        aviso = { tipo: 'error', texto: `Ya tienes "${yaElegido.nombre}". Si es otra tarjeta, ponle un nombre distinto, por ejemplo "${yaElegido.nombre} ${tipoBorrador === 'credito' ? 'crédito' : 'débito'}".` };
        return pintar();
      }
      if (sugerido) {
        // existe como sugerencia: se marca esa (con el tipo elegido), sin duplicar
        elegidos.push({ ...sugerido, tipo_base: tipoBorrador });
        aviso = { tipo: 'ok', texto: `Marcamos "${sugerido.nombre}".` };
      } else {
        const nuevo = { nombre: n.slice(0, 40), tipo_base: tipoBorrador, alias: [I.normalizar(n)] };
        sugeridos.push(nuevo); elegidos.push({ ...nuevo });
        aviso = { tipo: 'ok', texto: `Agregamos "${nuevo.nombre}".` };
      }
      if (!predet) predet = elegidos[0].nombre;
      borrador = '';
      pintar();
    }
    function conectarListo() {
      document.getElementById('o-listo').onclick = async ev => {
        if (E.demo) { E.medios = elegidos.map((e, i) => ({ ...e, id: 'od' + i })); E.medioPred = 'od0'; return principal(); }
        ev.target.disabled = true;
        const filas = elegidos.map((e, i) => ({ nombre: e.nombre, tipo_base: e.tipo_base, alias: e.alias || [I.normalizar(e.nombre)], orden: i, espacio_id: E.espacio }));
        const { data, error } = await sb.from('medios_pago').insert(filas).select();
        if (error) { ev.target.disabled = false; document.getElementById('o-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; }
        const pm = data.find(d => I.normalizar(d.nombre) === I.normalizar(predet || '')) || data[0];
        await sb.rpc('fijar_medio_predeterminado', { p_espacio: E.espacio, p_medio: pm.id });
        E.medioPred = pm.id;
        E.medios = data.sort((a, b) => a.orden - b.orden);
        principal();
      };
    }
    pintar();
  }

  function formOtroMedio(etiqueta, ejemplo) {
    return `<div class="campo"><label for="o-nombre">${etiqueta}</label>
      <div class="otro">
        <input class="entrada" id="o-nombre" maxlength="40" placeholder="${ejemplo}">
        <button type="button" class="btn sec" id="o-agregar" style="width:auto;padding:12px 18px">Agregar</button>
        <select class="entrada" id="o-tipo" aria-label="Tipo">
          <option value="debito">Tarjeta de débito</option><option value="credito">Tarjeta de crédito</option>
          <option value="billetera">Billetera (Yape, Plin…)</option><option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option><option value="otro">Otro</option>
        </select>
      </div></div>`;
  }

  // ---------------- pantalla principal con pestañas ----------------
  const ICONOS = {
    movimientos: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    resumen: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 4"/>'),
    espacio: svg('<rect x="3" y="4" width="7" height="7" rx="2"/><rect x="14" y="4" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
    cuenta: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 14.5-4 16 0"/>')
  };
  const NOMBRES = { movimientos: 'Movimientos', resumen: 'Resumen', espacio: 'Espacio', cuenta: 'Cuenta' };

  function principal() {
    const pest = E.pestana === 'activar' || E.pestana === 'admin' ? 'cuenta' : E.pestana;
    $app.innerHTML = `<main class="pantalla" id="contenido"></main>
      <nav class="pestanas" role="tablist"><button type="button" class="nav-logo logo-inicio" data-inicio aria-label="Ir al inicio: Movimientos">${logo(36, 24)}</button>${Object.keys(NOMBRES).map(k => `<button type="button" role="tab" data-p="${k}" aria-selected="${pest === k}">${ICONOS[k]}${NOMBRES[k]}</button>`).join('')}</nav>`;
    $app.querySelectorAll('.pestanas button[data-p]').forEach(b => b.onclick = () => { E.pestana = b.dataset.p; principal(); });
    ({ movimientos: vistaMovimientos, resumen: vistaResumen, espacio: vistaEspacio, cuenta: vistaCuenta, activar: vistaActivar, admin: vistaAdmin })[E.pestana]();
    window.scrollTo(0, 0);
  }
  function irA(p) { E.pestana = p; principal(); }
  // el logo de la app lleva al inicio de la app (Movimientos), no a la portada
  $app.addEventListener('click', ev => { if (ev.target.closest('[data-inicio]') && E.perfil) irA('movimientos'); });

  // cabecera común: logo + chip del espacio
  function cabecera() {
    const e = espacioActual();
    const chip = E.espacios.length > 1 || e.tipo !== 'personal'
      ? `<button type="button" class="chip-espacio" id="b-espacio" aria-haspopup="dialog" aria-label="Espacio: ${esc(e.nombre)}. Cambiar">${iconoEspacio(e.tipo)}<span>${esc(e.nombre || '')}</span>${IC.flechaAbajo}</button>` : '';
    return `<div class="barra-sup"><button type="button" class="logo-inicio" data-inicio aria-label="Ir al inicio: Movimientos">${logo(34, 22)}</button>${chip}</div>`;
  }
  function conectarCabecera() { const b = document.getElementById('b-espacio'); if (b) b.onclick = elegirEspacio; }

  // Texto mientras revisamos un comprobante: primera vez o renovación
  function textoRevision() {
    return pagado()
      ? `Estamos revisando tu renovación. Te llegará un correo a <b>${esc(E.perfil.correo)}</b> cuando la confirmemos; tu cuenta sigue activa mientras tanto.`
      : `Estamos revisando tu pago. Te llegará un correo a <b>${esc(E.perfil.correo)}</b> cuando tu cuenta esté habilitada.`;
  }
  // Avisos de acceso y pago (arriba de cada vista principal)
  function avisosAcceso() {
    const p = E.pagoActual;
    if (p && p.estado === 'pendiente') return `<p class="aviso-fijo revision">${IC.sobre}<span>${textoRevision()}</span></p>`;
    if (!tieneAcceso()) return `<div class="aviso-fijo vencido"><span>Tu prueba gratis terminó. Tus datos siguen aquí; para seguir anotando, activa MiPlata por <b>S/ 5 al mes</b>.</span><button type="button" class="btn mini" data-ir="activar">Activar</button></div>`;
    if (!pagado() && diasRestantes() <= 7) return `<div class="aviso-fijo"><span>Te ${diasRestantes() === 1 ? 'queda 1 día' : 'quedan ' + diasRestantes() + ' días'} de prueba gratis.</span><button type="button" class="btn mini" data-ir="activar">Activar</button></div>`;
    return '';
  }

  // ---------------- Movimientos ----------------
  async function cargarMovs() {
    const desde = iso(E.mes), hasta = iso(new Date(E.mes.getFullYear(), E.mes.getMonth() + 1, 0));
    const { data, error } = await sb.from('movimientos').select('*').eq('espacio_id', E.espacio).gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).order('creado_en', { ascending: false });
    if (error) throw error;
    E.movs = data || [];
    E.movsMes = iso(E.mes);
  }

  async function vistaMovimientos() {
    const $c = document.getElementById('contenido');
    $c.innerHTML = '<div class="cargando">Cargando movimientos…</div>';
    try { await cargarMovs(); } catch (e) { $c.innerHTML = `<div class="cargando">${esc(errorEs(e))}</div>`; return; }
    pintarMovimientos();
  }

  function pintarMovimientos() {
    const $c = document.getElementById('contenido');
    if (!$c) return;
    const gastos = E.movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0);
    const ingresos = E.movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
    const sinCat = E.movs.filter(m => !m.categoria_id).length;
    const esMesActual = iso(E.mes) === iso(inicioMes(new Date()));
    const finMes = new Date(E.mes.getFullYear(), E.mes.getMonth() + 1, 0);
    const quedan = esMesActual ? finMes.getDate() - new Date().getDate() : null;
    const acceso = tieneAcceso();
    const grupos = {};
    E.movs.forEach(m => { (grupos[m.fecha] = grupos[m.fecha] || []).push(m); });
    const lista = Object.keys(grupos).sort().reverse().map(f => `<p class="dia">${esc(nombreDia(f))}</p><div class="grupo">` + grupos[f].map(filaMov).join('') + '</div>').join('');

    $c.innerHTML = `
      ${cabecera()}
      <div class="mes-nav">
        <button type="button" class="flecha" id="m-ant" aria-label="Mes anterior">${svg('<path d="M15 5l-7 7 7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>
        <button type="button" class="mes" id="m-elegir" aria-haspopup="dialog" aria-label="Elegir mes y año">${esc(MESES[E.mes.getMonth()].replace(/^./, c => c.toUpperCase()))} ${E.mes.getFullYear()}
          <span class="caret">${IC.flechaAbajo}</span>
          <small>${esMesActual ? (quedan === 0 ? 'Último día del mes' : 'Te quedan ' + quedan + ' días del mes') : E.movs.length + ' movimientos'}${sinCat ? ', ' + sinCat + ' sin categoría' : ''}</small></button>
        <button type="button" class="flecha" id="m-sig" aria-label="Mes siguiente" ${esMesActual ? 'disabled' : ''}>${svg('<path d="M9 5l7 7-7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>
      </div>
      <div class="saldo"><p class="etq">${esGrupo() ? 'Gastaron este mes' : 'Gastaste este mes'}</p><div class="monto-grande"><span>S/</span>${soles(gastos)}</div>
        ${ingresos ? `<p class="ing">${esGrupo() ? 'Entraron' : 'Te entraron'} <b>S/ ${soles(ingresos)}</b></p>` : ''}</div>
      ${esGrupo() ? filaMiembros() : ''}
      ${avisosAcceso()}
      <div class="lista" id="lista">${lista || `<div class="vacio"><b>Aún no hay movimientos${esMesActual ? ' este mes' : ''}</b>${esMesActual ? (acceso ? 'Toca el micrófono o escribe abajo, por ejemplo: <i>8 soles en Tambo con Yape</i>.' : '') : ''}</div>`}</div>
      <div class="zona-voz">
        <button type="button" class="mic" id="b-mic" aria-label="Hablar para registrar" ${acceso ? '' : 'disabled'}>${IC.mic}</button>
        <form id="f-reg" autocomplete="off">
          <input class="entrada" id="t-reg" enterkeyhint="send" placeholder="${acceso ? '8 soles en Tambo' : 'Activa MiPlata para seguir anotando'}" aria-label="Escribe tu gasto o ingreso" ${acceso ? '' : 'disabled'}>
          <button class="enviar" type="submit" aria-label="Guardar" ${acceso ? '' : 'disabled'}>${svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'width="22" height="22" stroke-width="2.6"')}</button>
        </form>
        <div class="grabando-barra" id="g-barra" hidden aria-live="polite">
          <span class="g-punto" aria-hidden="true"></span><span class="g-txt">Te escucho</span>
          <span class="onda" id="g-onda" aria-hidden="true">${'<i></i>'.repeat(16)}</span>
          <span class="g-tiempo cifra" id="g-tiempo">0:00</span>
        </div>
      </div>
      ${C.FLAGS.voz ? `<p class="mic-usado" id="mic-usado" hidden></p>` : ''}
      <p class="ayuda-registro" id="ayuda" hidden></p>`;

    conectarCabecera();
    document.getElementById('m-ant').onclick = () => { E.mes = new Date(E.mes.getFullYear(), E.mes.getMonth() - 1, 1); vistaMovimientos(); };
    document.getElementById('m-sig').onclick = () => { E.mes = new Date(E.mes.getFullYear(), E.mes.getMonth() + 1, 1); vistaMovimientos(); };
    document.getElementById('m-elegir').onclick = elegirMes;
    $c.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => irA(b.dataset.ir));
    $c.querySelectorAll('.fila').forEach(b => b.onclick = () => abrirCompletar(E.movs.find(m => m.id === b.dataset.id)));
    document.getElementById('f-reg').onsubmit = ev => { ev.preventDefault(); registrarTexto(document.getElementById('t-reg').value, 'texto'); };
    document.getElementById('b-mic').onclick = () => {
      if (C.FLAGS.voz) return tocarMic();
      document.getElementById('t-reg').focus();
      ayuda('Toca el micrófono de tu teclado y dicta, por ejemplo: "ocho soles en Tambo con Yape".', true);
    };
  }

  // ---------------- Voz (F4): toca para hablar, toca otra vez para anotar ----------------
  let grabacion = null;
  const MIC_KEY = 'miplata.mic';
  const micGuardado = () => { try { return localStorage.getItem(MIC_KEY) || ''; } catch (e) { return ''; } };
  // quita el código del fabricante que agrega Windows, ej. "(046d:0a37)"
  const nombreMic = l => (l || 'Micrófono').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '');

  async function abrirMicrofono() {
    const id = micGuardado();
    const base = { echoCancellation: true, noiseSuppression: true };
    try { return await navigator.mediaDevices.getUserMedia({ audio: id ? { ...base, deviceId: { exact: id } } : base }); }
    catch (e) {
      // el micrófono elegido ya no está (ej. desconectaste los auriculares): usamos el del equipo
      if (id && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
        try { localStorage.removeItem(MIC_KEY); } catch (x) {}
        return navigator.mediaDevices.getUserMedia({ audio: base });
      }
      throw e;
    }
  }

  function mostrarMicUsado(stream) {
    const p = document.getElementById('mic-usado'); if (!p) return;
    p.hidden = false;
    p.innerHTML = `${IC.mic}<span>Micrófono: <b>${esc(nombreMic(stream.getAudioTracks()[0]?.label))}</b></span><button type="button" class="enlace" id="mic-cambiar">Cambiar</button>`;
    p.querySelector('#mic-cambiar').onclick = elegirMicrofono;
  }

  async function elegirMicrofono() {
    let lista = [];
    try { lista = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'communications'); } catch (e) {}
    const actual = micGuardado() || 'default';
    const nombre = d => d.deviceId === 'default'
      ? 'El de tu equipo por defecto (' + nombreMic(d.label.replace(/^(Default|Predeterminado) - /i, '')) + ')'
      : nombreMic(d.label) || 'Micrófono';
    abrirHoja('Elegir micrófono', (hoja, cerrar) => {
      hoja.innerHTML = `<div class="tirador"></div><h2>¿Con qué micrófono te escucho?</h2>
        <p class="orig">Si usas auriculares con micrófono, elígelos aquí. Lo recordamos en este equipo.</p>
        <ul class="lista-elegir" role="listbox" aria-label="Micrófonos">${lista.map(d => `<li><button type="button" role="option" class="op-cat" data-mic="${esc(d.deviceId)}" aria-selected="${d.deviceId === actual}">
          ${IC.mic}<span>${esc(nombre(d))}</span>${d.deviceId === actual ? IC.check : ''}</button></li>`).join('') || '<li class="nota" style="padding:12px 0">Toca el micrófono una vez y permite el acceso para ver la lista.</li>'}</ul>`;
      hoja.querySelectorAll('[data-mic]').forEach(b => b.onclick = () => {
        try { if (b.dataset.mic === 'default') localStorage.removeItem(MIC_KEY); else localStorage.setItem(MIC_KEY, b.dataset.mic); } catch (e) {}
        const n = document.querySelector('#mic-usado b'); if (n) n.textContent = b.querySelector('span').textContent;
        cerrar(); toast('Listo, usaré ese micrófono');
      });
    });
  }

  function estadoGrabando(on) {
    const zona = document.querySelector('.zona-voz'), mic = document.getElementById('b-mic'), barra = document.getElementById('g-barra'), form = document.getElementById('f-reg');
    if (!zona) return;
    zona.classList.toggle('grabando', on);
    if (barra) barra.hidden = !on;
    if (form) form.hidden = on;
    if (mic) {
      mic.innerHTML = on ? svg('<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>', 'width="22" height="22"') : IC.mic;
      mic.setAttribute('aria-label', on ? 'Terminar y anotar' : 'Hablar para registrar');
    }
  }

  async function tocarMic() {
    if (grabacion) { if (grabacion.rec.state === 'recording') grabacion.rec.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      document.getElementById('t-reg').focus();
      return ayuda('Este navegador no deja grabar. Usa el micrófono de tu teclado o escríbelo.', true);
    }
    ayuda('Preparando el micrófono… si tu navegador pregunta, toca "Permitir".', true);
    let stream;
    try { stream = await abrirMicrofono(); }
    catch (e) {
      return ayuda(e.name === 'NotAllowedError'
        ? 'El navegador no dio permiso al micrófono. Actívalo en el candado de la barra de direcciones, o escríbelo en la caja.'
        : 'No encontré un micrófono. Revisa que esté conectado, o escríbelo en la caja.');
    }
    mostrarMicUsado(stream);
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const partes = [];
    // nivel de voz en vivo: las barras se mueven cuando hablas
    let ctx = null, raf = 0, pico = 0;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an);
      const datos = new Uint8Array(an.frequencyBinCount), barras = [...document.querySelectorAll('#g-onda i')];
      const pintar = () => {
        an.getByteFrequencyData(datos);
        barras.forEach((b, i) => { b.style.transform = `scaleY(${(0.15 + (datos[i + 1] / 255) * 0.85).toFixed(2)})`; });
        pico = Math.max(pico, ...datos);
        raf = requestAnimationFrame(pintar);
      };
      pintar();
    } catch (e) { /* sin medidor igual se graba */ }
    const t0 = Date.now();
    const reloj = setInterval(() => {
      const sg = Math.floor((Date.now() - t0) / 1000), el = document.getElementById('g-tiempo');
      if (el) el.textContent = Math.floor(sg / 60) + ':' + String(sg % 60).padStart(2, '0');
    }, 250);
    const g = grabacion = { rec, timer: setTimeout(() => rec.state === 'recording' && rec.stop(), 30000) };
    rec.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); clearTimeout(g.timer); clearInterval(reloj); cancelAnimationFrame(raf); ctx?.close?.(); grabacion = null;
      estadoGrabando(false);
      const audio = new Blob(partes, { type: rec.mimeType || mime || 'audio/webm' });
      if (audio.size < 1500) return ayuda('No te escuché. Toca el micrófono, habla y vuelve a tocar para terminar.', true);
      // casi silencio: el micrófono elegido no está captando (ej. auriculares con el micrófono silenciado)
      if (ctx && pico < 40) return ayuda('Casi no te escuché. Revisa que el micrófono no esté silenciado o toca "Cambiar" para usar otro.');
      await enviarAudio(audio);
    };
    rec.start();
    estadoGrabando(true);
    ayuda('Ya puedes hablar: di, por ejemplo, "ocho soles en Tambo con Yape". Toca el cuadrado para terminar.', true);
  }

  async function enviarAudio(audio) {
    const input = document.getElementById('t-reg');
    ayuda('Anotando…', true);
    try {
      if (E.demo) throw new Error('En el demo la voz no se envía. Escribe la frase para probar.');
      const ext = /mp4/.test(audio.type) ? 'm4a' : /ogg/.test(audio.type) ? 'ogg' : 'webm';
      const f = new FormData(); f.append('audio', audio, 'audio.' + ext);
      const pista = [...new Set([...Object.values(E.aprendidos || {}), ...(E.misLugares || []), ...E.medios.map(x => x.nombre)])].join(', ').slice(0, 250);
      if (pista) f.append('pista', pista);
      const { data: s } = await sb.auth.getSession();
      const r = await fetch(C.SUPABASE_URL + '/functions/v1/transcribir', {
        method: 'POST', headers: { Authorization: 'Bearer ' + (s.session?.access_token || ''), apikey: C.SUPABASE_KEY }, body: f
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.texto) { console.info('[voz] sin texto:', r.status, d.error); throw new Error(d.error || 'No pude escucharte. Escríbelo en la caja.'); }
      console.info('[voz] escuché:', d.texto, '(' + d.motor + ')');
      // dejamos lo que se escuchó en la caja: si no se entiende el monto, la persona solo corrige y envía
      if (input) input.value = d.texto;
      ayuda('');
      await registrarTexto(d.texto, 'voz');
    } catch (e) {
      ayuda(e.message || 'No pude escucharte. Escríbelo en la caja.');
      input?.focus();
    }
  }

  function autorDe(m) {
    if (!esGrupo()) return '';
    if (m.usuario_id === E.sesion?.user?.id) return 'Tú';
    const x = E.miembros.find(y => y.usuario_id === m.usuario_id);
    return x ? x.nombre.split(' ')[0] : 'Ex miembro';
  }

  function filaMov(m) {
    const medio = medioPorId(m.medio_pago_id), cat = catPorId(m.categoria_id);
    const ing = m.tipo === 'ingreso';
    const autor = autorDe(m);
    const izq2 = cat ? `<span class="det"><i class="punto" style="background:${colorCat(cat.color)}"></i>${esc(cat.nombre)}${m.detalle ? ', ' + esc(m.detalle) : ''}</span>` : `<span class="falta">Falta categoría</span>`;
    const der2 = [autor, medio ? medio.nombre : (ing ? '' : 'Sin medio')].filter(Boolean).join(', ');
    return `<button type="button" class="fila" data-id="${m.id}">
      <span class="lugar">${m.origen === 'voz' ? `<i class="por-voz" title="Anotado por voz" aria-label="Anotado por voz">${IC.mic}</i>` : ''}${esc(m.lugar || (ing ? 'Ingreso' : 'Gasto'))}</span><span class="monto${ing ? ' ing' : ''}">${ing ? '+' : ''}${soles(m.monto)}</span>
      ${izq2}<span class="det der">${esc(der2)}</span></button>`;
  }

  function ayuda(texto, neutral) {
    const a = document.getElementById('ayuda'); if (!a) return;
    a.hidden = !texto; a.textContent = texto || ''; a.style.color = neutral ? 'var(--tinta-suave)' : '';
  }

  // Sugerencia de categoría: primero por nombre propio que aparezca en el texto, luego por la clave del intérprete
  function sugerirCategoria(texto, clave, tipo) {
    const t = ' ' + I.normalizar(texto || '') + ' ';
    const activas = E.categorias.filter(c => !c.archivada && c.tipo === tipo);
    const porNombre = activas.filter(c => t.includes(' ' + I.normalizar(c.nombre) + ' ')).sort((a, b) => b.nombre.length - a.nombre.length)[0];
    if (porNombre) return porNombre.id;
    const porClave = clave && activas.find(c => c.clave === clave);
    return porClave ? porClave.id : null;
  }

  async function registrarTexto(texto, origen) {
    texto = (texto || '').trim();
    if (!texto) return;
    const r = I.interpretar(texto, { medios: E.medios });
    if (!r.ok) {
      if (origen === 'voz') { console.info('[voz] sin monto:', texto, r.motivo); ayuda(`Escuché «${texto}», pero no encontré el monto. Corrígelo en la caja y toca la flecha.`); }
      else ayuda('No entendí el monto. Escríbelo con números o en palabras, por ejemplo: "8 soles en Tambo".');
      return;
    }
    ayuda('');
    r.lugar = lugarAprendido(r.lugar);
    let medio = r.medio_id;
    if (!medio && !r.preguntar_medio && r.tipo === 'gasto') medio = E.medioPred;
    const hoy = iso(new Date());
    const fila = {
      espacio_id: E.espacio, tipo: r.tipo, monto: r.monto, fecha: r.fecha, lugar: r.lugar || null, detalle: r.detalle || null,
      medio_pago_id: medio || null, origen, texto_original: texto.slice(0, 500),
      hora: r.fecha === hoy ? new Date().toTimeString().slice(0, 8) : null
    };
    const input = document.getElementById('t-reg'); if (input) input.value = '';
    let data, error;
    if (E.demo) { data = { ...fila, id: 'm' + Math.random(), usuario_id: E.sesion.user.id, creado_en: new Date().toISOString() }; E.demoMovs.push(data); }
    else ({ data, error } = await sb.from('movimientos').insert(fila).select().single());
    if (error) { if (input) input.value = texto; ayuda(errorEs(error)); return; }
    data._sugerida = sugerirCategoria(texto, r.categoria_sugerida, r.tipo);
    if (iso(inicioMes(deIso(data.fecha))) !== iso(E.mes)) { E.mes = inicioMes(deIso(data.fecha)); await cargarMovs(); }
    else E.movs.unshift(data);
    E.movs.sort((a, b) => (b.fecha + b.creado_en).localeCompare(a.fecha + a.creado_en));
    pintarMovimientos();
    const donde = esGrupo() ? ` <span class="toast-esp">en ${esc(espacioActual().nombre)}</span>` : '';
    const que = `<b>${data.tipo === 'ingreso' ? '+' : ''}S/ ${soles(data.monto)}</b>${data.lugar ? ' en ' + esc(data.lugar) : ''}${data.fecha !== hoy ? ', ' + corto(data.fecha) : ''}${donde}`;
    const tope = avisoTopes(data);
    const oido = origen === 'voz' ? `<small class="toast-oido">Escuché: «${esc(texto)}»</small>` : '';
    toast((r.preguntar_medio ? que + '. ¿Con cuál tarjeta?' : que) + oido + tope, data, r.preguntar_medio || /pasado|cerca/.test(tope));
  }

  // ---------------- Topes del mes (F7) ----------------
  function nombreTope(l) {
    if (l.ambito === 'total') return 'Todo el mes';
    if (l.ambito === 'medio') return (medioPorId(l.medio_pago_id) || {}).nombre || 'Medio quitado';
    return (catPorId(l.categoria_id) || {}).nombre || 'Categoría quitada';
  }
  // gasto del mes visible que cuenta para un tope (E.movs = movimientos del mes en pantalla)
  function gastadoTope(l, movs) {
    return (movs || E.movs).filter(m => m.tipo === 'gasto' && (l.ambito === 'total' || (l.ambito === 'medio' && m.medio_pago_id === l.medio_pago_id) || (l.ambito === 'categoria' && m.categoria_id === l.categoria_id)))
      .reduce((s, m) => s + Number(m.monto), 0);
  }
  function estadoTope(l, movs) {
    const g = gastadoTope(l, movs), t = Number(l.monto_mensual), p = t ? g / t : 0;
    return { g, t, p, nivel: p > 1 ? 'pasado' : p >= 0.8 ? 'cerca' : 'ok', queda: t - g };
  }
  function textoTope(l, s) {
    return s.queda >= 0 ? `${nombreTope(l)}: S/ ${soles(s.g)} de S/ ${soles(s.t)}, quedan S/ ${soles(s.queda)}`
      : `${nombreTope(l)}: te pasaste S/ ${soles(-s.queda)} de tu tope de S/ ${soles(s.t)}`;
  }
  // tras guardar un gasto en el mes visible: el tope más comprometido que le aplica
  function avisoTopes(mov) {
    if (!mov || mov.tipo !== 'gasto' || !(E.limites || []).length) return '';
    if (iso(inicioMes(deIso(mov.fecha))) !== iso(E.mes)) return '';
    const aplican = E.limites.filter(l => l.ambito === 'total' || (l.ambito === 'medio' && l.medio_pago_id === mov.medio_pago_id) || (l.ambito === 'categoria' && l.categoria_id === mov.categoria_id));
    if (!aplican.length) return '';
    const peor = aplican.map(l => ({ l, s: estadoTope(l) })).sort((a, b) => b.s.p - a.s.p)[0];
    return `<small class="tope-aviso ${peor.s.nivel}">${esc(textoTope(peor.l, peor.s))}</small>`;
  }
  function barraTope(l, movs, editable) {
    const s = estadoTope(l, movs);
    const cuerpo = barraTopeCuerpo(l, s);
    return `<li class="tope ${s.nivel}">${editable ? `<button type="button" class="tope-btn" data-tope="${l.id}" aria-label="Editar tope ${esc(nombreTope(l))}">${cuerpo}</button>` : cuerpo}</li>`;
  }
  function barraTopeCuerpo(l, s) {
    return `<div class="rk-cab"><span class="rk-nom">${esc(nombreTope(l))}</span>
      <span class="rk-val"><b class="cifra">S/ ${soles(s.g)}</b><small>de S/ ${soles(s.t)}</small></span></div>
      <div class="rk-riel"><i style="width:${Math.min(100, s.p * 100).toFixed(1)}%"></i></div>
      <p class="tope-txt">${s.nivel === 'pasado' ? '⚠ Te pasaste S/ ' + soles(-s.queda) : s.nivel === 'cerca' ? '⚠ Quedan S/ ' + soles(s.queda) + ' (' + Math.round(s.p * 100) + '%)' : 'Quedan S/ ' + soles(s.queda)}</p>`;
  }

  function editarTope(l) {
    const nuevo = !l;
    let ambito = l ? l.ambito : 'total', ref = l ? (l.medio_pago_id || l.categoria_id) : null;
    abrirHoja(nuevo ? 'Nuevo tope' : 'Editar tope', (hoja, cerrar) => {
      function pintar() {
        const monto = hoja.querySelector('#t-monto')?.value ?? (l ? Number(l.monto_mensual).toFixed(2) : '');
        const opciones = ambito === 'medio' ? E.medios.map(x => [x.id, x.nombre]) : ambito === 'categoria' ? E.categorias.filter(c => c.tipo === 'gasto' && !c.archivada).map(c => [c.id, c.nombre]) : [];
        if (opciones.length && !opciones.some(o => o[0] === ref)) ref = opciones[0][0];
        hoja.innerHTML = `<div class="tirador"></div><h2>${nuevo ? 'Nuevo tope del mes' : 'Editar tope'}</h2>
          <p class="orig" style="margin-top:-6px">Te aviso cuando te acerques (80%) y cuando lo pases.</p>
          <div class="campo"><label>¿Para qué?</label><div class="tipo" style="grid-template-columns:1fr 1fr 1fr" role="group" aria-label="Tipo de tope">
            <button type="button" data-amb="total" aria-pressed="${ambito === 'total'}">Todo</button>
            <button type="button" data-amb="medio" aria-pressed="${ambito === 'medio'}">Medio de pago</button>
            <button type="button" data-amb="categoria" aria-pressed="${ambito === 'categoria'}">Categoría</button></div></div>
          ${opciones.length ? `<div class="campo"><label for="t-ref">${ambito === 'medio' ? 'Medio de pago' : 'Categoría'}</label>
            <select class="entrada" id="t-ref">${opciones.map(([id, n]) => `<option value="${id}" ${id === ref ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`
            : ambito !== 'total' ? '<p class="mensaje">Primero agrega ' + (ambito === 'medio' ? 'un medio de pago' : 'una categoría') + ' a este espacio.</p>' : ''}
          <div class="campo"><label for="t-monto">Tope mensual (S/)</label><input class="entrada cifra" id="t-monto" inputmode="decimal" value="${esc(monto)}" placeholder="Ej.: 500"></div>
          <div id="t-msg" role="status" aria-live="polite"></div>
          <button type="button" class="btn" id="t-guardar">${nuevo ? 'Crear tope' : 'Guardar tope'}</button>
          ${nuevo ? '' : '<button type="button" class="btn peligro" id="t-borrar">Quitar tope</button>'}`;
        hoja.querySelectorAll('[data-amb]').forEach(b => b.onclick = () => { ambito = b.dataset.amb; ref = null; pintar(); });
        hoja.querySelector('#t-ref')?.addEventListener('change', e => { ref = e.target.value; });
        hoja.querySelector('#t-guardar').onclick = guardar;
        hoja.querySelector('#t-borrar')?.addEventListener('click', borrar);
      }
      const fallo = t => { hoja.querySelector('#t-msg').innerHTML = `<p class="mensaje error">${esc(t)}</p>`; };
      async function guardar() {
        const monto = parseFloat(String(hoja.querySelector('#t-monto').value).replace(',', '.'));
        if (!(monto > 0)) return fallo('Escribe un monto mayor a cero.');
        if (ambito !== 'total' && !ref) return fallo('Elige ' + (ambito === 'medio' ? 'el medio de pago.' : 'la categoría.'));
        const fila = { espacio_id: E.espacio, ambito, medio_pago_id: ambito === 'medio' ? ref : null, categoria_id: ambito === 'categoria' ? ref : null, monto_mensual: Math.round(monto * 100) / 100 };
        const repetido = E.limites.find(x => x !== l && x.ambito === fila.ambito && (x.medio_pago_id || null) === fila.medio_pago_id && (x.categoria_id || null) === fila.categoria_id);
        if (repetido) return fallo('Ya tienes un tope para eso. Edítalo en vez de crear otro.');
        let data = { ...(l || {}), ...fila, id: l ? l.id : 't' + Math.random() }, error;
        if (!E.demo) ({ data, error } = nuevo ? await sb.from('limites').insert(fila).select().single() : await sb.from('limites').update(fila).eq('id', l.id).select().single());
        if (error) return fallo(errorEs(error));
        E.limites = nuevo ? [...E.limites, data] : E.limites.map(x => x.id === data.id ? data : x);
        cerrar(); vistaEspacio(); toast(nuevo ? 'Tope creado' : 'Tope guardado');
      }
      async function borrar() {
        if (!E.demo) { const { error } = await sb.from('limites').delete().eq('id', l.id); if (error) return fallo(errorEs(error)); }
        E.limites = E.limites.filter(x => x.id !== l.id); cerrar(); vistaEspacio(); toast('Tope quitado');
      }
      pintar();
    });
  }

  let toastTimer = null;
  function toast(html, mov, alerta) {
    document.querySelector('.toast')?.remove();
    clearTimeout(toastTimer);
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    const tope = (html.match(/<small class="tope-aviso[\s\S]*?<\/small>/) || [''])[0];
    if (tope) html = html.replace(tope, '');
    t.innerHTML = `<span class="ok${alerta ? ' alerta' : ''}">${alerta ? '!' : '✓'}</span><p>${html}</p>
      ${mov ? '<button type="button" data-a="deshacer">Deshacer</button><button type="button" data-a="completar">Completar</button>' : ''}
      ${tope ? `<div class="toast-tope">${tope}</div>` : ''}`;
    document.body.appendChild(t);
    if (mov) {
      t.querySelector('[data-a=deshacer]').onclick = async () => {
        t.remove();
        if (!E.demo) { const { error } = await sb.from('movimientos').delete().eq('id', mov.id); if (error) return toast(esc(errorEs(error)), null, true); }
        E.movs = E.movs.filter(m => m.id !== mov.id); pintarMovimientos();
        toast('Deshecho');
      };
      t.querySelector('[data-a=completar]').onclick = () => { t.remove(); abrirCompletar(mov); };
    }
    toastTimer = setTimeout(() => t.remove(), alerta ? 9000 : 6000);
  }

  // ---------------- Completar / editar ----------------
  // texto que el cliente pone en el mensaje de Plin/Yape para que el dueño reconozca el pago
  const MENSAJE_PAGO = 'Suscripción MP';

  function abrirCompletar(mov) {
    if (!mov) return;
    const m = { ...mov };
    const yo = E.sesion.user.id;
    const puedeEditar = tieneAcceso() && (m.usuario_id === yo || esAdminEspacio());
    if (!m._sugerida) m._sugerida = sugerirCategoria((m.texto_original || '') + ' ' + (m.lugar || '') + ' ' + (m.detalle || ''),
      I.interpretar((m.lugar || '') + ' ' + (m.detalle || '') + ' 1 sol', { medios: [] }).categoria_sugerida, m.tipo);
    abrirHoja('Completar movimiento', (hoja, cerrar) => {
      function pintar() {
        const cats = E.categorias.filter(c => c.tipo === m.tipo && (!c.archivada || c.id === m.categoria_id));
        const sug = !m.categoria_id && m._sugerida && cats.some(c => c.id === m._sugerida) ? m._sugerida : null;
        // a la vista: la elegida, la sugerida y las 5 más usadas (o las primeras de la lista)
        const uso = {}; E.movs.forEach(x => { if (x.categoria_id) uso[x.categoria_id] = (uso[x.categoria_id] || 0) + 1; });
        const visibles = cats.filter(c => !c.archivada);
        const frecuentes = [...visibles].sort((a, b) => (uso[b.id] || 0) - (uso[a.id] || 0) || a.orden - b.orden)
          .filter(c => c.id !== sug && c.id !== m.categoria_id).slice(0, m.categoria_id ? 4 : 5);
        const rapidas = [...(m.categoria_id ? [catPorId(m.categoria_id)] : []), ...frecuentes].filter(Boolean);
        const restantes = visibles.length - rapidas.filter(c => !c.archivada).length - (sug ? 1 : 0);
        const autor = autorDe(m);
        hoja.innerHTML = `
          <div class="tirador"></div>
          <h2>${m.tipo === 'ingreso' ? '+' : ''}S/ ${soles(m.monto)}${m.lugar ? ' en ' + esc(m.lugar) : ''}</h2>
          ${m.texto_original ? `<p class="orig">${m.origen === 'voz' ? `${IC.mic} ${autor && autor !== 'Tú' ? 'Se escuchó a ' + esc(autor) : 'Escuché'}` : (autor && autor !== 'Tú' ? esc(autor) + ' escribió' : 'Escribiste')}: «${esc(m.texto_original)}»</p>` : ''}
          ${!puedeEditar ? `<p class="mensaje">${tieneAcceso() ? 'Solo quien lo registró o el administrador del grupo puede cambiarlo.' : 'Activa MiPlata para editar tus movimientos.'}</p>` : ''}
          <fieldset ${puedeEditar ? '' : 'disabled'} style="border:0;display:flex;flex-direction:column;gap:14px">
          <div class="tipo" role="group" aria-label="Tipo">
            <button type="button" data-tipo="gasto" aria-pressed="${m.tipo === 'gasto'}">Gasto</button>
            <button type="button" class="ing" data-tipo="ingreso" aria-pressed="${m.tipo === 'ingreso'}">Ingreso</button>
          </div>
          <div class="campo"><div class="cabeza-campo"><label>Categoría</label>${esAdminEspacio() ? '<button type="button" class="enlace" id="c-miscat">Mis categorías</button>' : ''}</div>
            <div class="chips">
            ${sug ? `<button type="button" class="chip sug" data-cat="${sug}"><i class="punto" style="background:${colorCat(catPorId(sug).color)}"></i>¿${esc(catPorId(sug).nombre)}?</button>` : ''}
            ${rapidas.map(c => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${m.categoria_id === c.id}"><i class="punto" style="background:${colorCat(c.color)}"></i>${esc(c.nombre)}</button>`).join('')}
            <button type="button" class="chip mas" id="c-todas">${restantes === visibles.length ? 'Elegir categoría' : restantes > 0 ? 'Ver todas (' + visibles.length + ')' : 'Buscar o crear'}</button>
          </div></div>
          <div class="campo"><label>${m.tipo === 'ingreso' ? 'Lo recibí en' : 'Pagado con'}</label><div class="chips">
            ${E.medios.map(x => `<button type="button" class="chip" data-medio="${x.id}" aria-pressed="${m.medio_pago_id === x.id}">${esc(x.nombre)}</button>`).join('') || '<span class="det">Este espacio aún no tiene medios de pago.</span>'}
          </div></div>
          <div class="dos">
            <div class="campo"><label for="c-fecha">Fecha</label><input class="entrada" id="c-fecha" type="date" value="${m.fecha}" max="${iso(new Date())}"></div>
            <div class="campo"><label for="c-monto">Monto (S/)</label><input class="entrada cifra" id="c-monto" inputmode="decimal" value="${Number(m.monto).toFixed(2)}"></div>
          </div>
          <div class="campo"><label for="c-lugar">${m.tipo === 'ingreso' ? 'De quién o de dónde' : 'Dónde'}</label><input class="entrada" id="c-lugar" maxlength="80" value="${esc(m.lugar || '')}" placeholder="Ej.: Plaza Vea"></div>
          <div class="campo"><label for="c-detalle">Detalle (opcional)</label><input class="entrada" id="c-detalle" maxlength="300" value="${esc(m.detalle || '')}" placeholder="Ej.: frutas y carnes"></div>
          </fieldset>
          <div id="c-msg" role="status" aria-live="polite"></div>
          ${puedeEditar ? `<button type="button" class="btn" id="c-guardar">Guardar cambios</button>
          <button type="button" class="btn peligro" id="c-borrar">Eliminar movimiento</button>` : `<button type="button" class="btn sec" id="c-cerrar">Cerrar</button>`}`;
        hoja.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { leer(); if (m.tipo !== b.dataset.tipo) { m.tipo = b.dataset.tipo; m.categoria_id = null; m._sugerida = null; } pintar(); });
        hoja.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { leer(); m.categoria_id = m.categoria_id === b.dataset.cat ? null : b.dataset.cat; pintar(); });
        hoja.querySelector('#c-todas')?.addEventListener('click', () => { leer(); elegirCategoria(m.tipo, m.categoria_id, id => { m.categoria_id = id; pintar(); }); });
        hoja.querySelector('#c-miscat')?.addEventListener('click', () => { leer(); misCategorias(m.tipo, () => pintar()); });
        hoja.querySelectorAll('[data-medio]').forEach(b => b.onclick = () => { leer(); m.medio_pago_id = m.medio_pago_id === b.dataset.medio ? null : b.dataset.medio; pintar(); });
        hoja.querySelector('#c-guardar')?.addEventListener('click', guardar);
        hoja.querySelector('#c-borrar')?.addEventListener('click', borrar);
        hoja.querySelector('#c-cerrar')?.addEventListener('click', cerrar);
      }
      function leer() {
        const f = hoja.querySelector('#c-fecha'); if (!f) return;
        m.fecha = f.value || m.fecha;
        const n = parseFloat(String(hoja.querySelector('#c-monto').value).replace(',', '.'));
        if (n > 0) m.monto = Math.round(n * 100) / 100;
        m.lugar = hoja.querySelector('#c-lugar').value.trim() || null;
        m.detalle = hoja.querySelector('#c-detalle').value.trim() || null;
      }
      async function guardar() {
        leer();
        const msg = hoja.querySelector('#c-msg');
        if (!(m.monto > 0)) { msg.innerHTML = '<p class="mensaje error">Escribe un monto mayor a cero.</p>'; return; }
        const cambios = { tipo: m.tipo, monto: m.monto, fecha: m.fecha, lugar: m.lugar, detalle: m.detalle, categoria_id: m.categoria_id, medio_pago_id: m.medio_pago_id };
        let data = { ...mov, ...cambios }, error;
        if (!E.demo) ({ data, error } = await sb.from('movimientos').update(cambios).eq('id', m.id).select().single());
        if (error) { msg.innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; }
        // aprende: "Tambor" → "Tambo" (solo el lugar; el monto no, porque "cincuenta" puede ser de verdad 50)
        let aprendio = false;
        if (mov.lugar && m.lugar && I.normalizar(mov.lugar) !== I.normalizar(m.lugar) && mov.usuario_id === E.sesion.user.id) {
          E.aprendidos = E.aprendidos || {}; E.aprendidos[I.normalizar(mov.lugar)] = m.lugar; aprendio = true;
          if (!E.demo) sb.rpc('aprender_lugar', { p_de: I.normalizar(mov.lugar), p_a: m.lugar }).then(() => {}, () => {});
        }
        cerrar();
        if (iso(inicioMes(deIso(data.fecha))) !== iso(E.mes)) E.movs = E.movs.filter(x => x.id !== data.id);
        else E.movs = E.movs.map(x => x.id === data.id ? data : x);
        E.movs.sort((a, b) => (b.fecha + b.creado_en).localeCompare(a.fecha + a.creado_en));
        pintarMovimientos();
        const tope = avisoTopes(data);
        toast((aprendio ? `Cambios guardados. Aprendí que «${esc(mov.lugar)}» es <b>${esc(m.lugar)}</b>` : 'Cambios guardados') + tope, null, /pasado|cerca/.test(tope));
      }
      async function borrar() {
        if (!E.demo) {
          const { error } = await sb.from('movimientos').delete().eq('id', m.id);
          if (error) { hoja.querySelector('#c-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; }
        }
        cerrar(); E.movs = E.movs.filter(x => x.id !== m.id); pintarMovimientos(); toast('Movimiento eliminado');
      }
      pintar();
    });
  }

  // ---------------- Selector de mes y año ----------------
  const ANIO_MINIMO = 2015;
  function elegirMes(recargar) {
    const alElegir = typeof recargar === 'function' ? recargar : vistaMovimientos;
    const hoy = new Date(), anioActual = hoy.getFullYear();
    let anio = E.mes.getFullYear(), verAnios = false;
    const conDatos = {};
    abrirHoja('Elegir mes y año', (hoja, cerrar) => {
      async function marcarAnio(a) {
        if (E.demo) { conDatos[iso(hoy).slice(0, 7)] = true; return pintar(); }
        if (conDatos['_' + a]) return;
        conDatos['_' + a] = true;
        const { data } = await sb.from('movimientos').select('fecha').eq('espacio_id', E.espacio).gte('fecha', a + '-01-01').lte('fecha', a + '-12-31');
        (data || []).forEach(r => { conDatos[r.fecha.slice(0, 7)] = true; });
        if (anio === a && !verAnios) pintar();
      }
      function pintar() {
        const actual = iso(E.mes).slice(0, 7);
        if (verAnios) {
          const anios = []; for (let a = anioActual; a >= ANIO_MINIMO; a--) anios.push(a);
          hoja.innerHTML = `<div class="tirador"></div><h2 style="text-align:center">Elige el año</h2>
            <div class="meses">${anios.map(a => `<button type="button" data-y="${a}" aria-pressed="${a === anio}">${a}</button>`).join('')}</div>`;
          hoja.querySelectorAll('[data-y]').forEach(b => b.onclick = () => { anio = Number(b.dataset.y); verAnios = false; pintar(); marcarAnio(anio); });
          return;
        }
        hoja.innerHTML = `
          <div class="tirador"></div>
          <div class="anio-nav">
            <button type="button" class="flecha" data-a="-1" aria-label="Año anterior" ${anio <= ANIO_MINIMO ? 'disabled' : ''}>${svg('<path d="M15 5l-7 7 7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>
            <button type="button" class="anio" id="m-anios" aria-label="Elegir año, ahora ${anio}">${anio}${IC.flechaAbajo}</button>
            <button type="button" class="flecha" data-a="1" aria-label="Año siguiente" ${anio >= anioActual ? 'disabled' : ''}>${svg('<path d="M9 5l7 7-7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>
          </div>
          <div class="meses">${MESES.map((n, i) => {
            const clave = anio + '-' + String(i + 1).padStart(2, '0');
            const futuro = anio > anioActual || (anio === anioActual && i > hoy.getMonth());
            return `<button type="button" data-m="${i}" ${futuro ? 'disabled' : ''} aria-pressed="${clave === actual}">${n.slice(0, 3).replace(/^./, c => c.toUpperCase())}${conDatos[clave] ? '<i aria-label="con movimientos"></i>' : ''}</button>`;
          }).join('')}</div>
          <button type="button" class="btn sec" id="m-hoy">Ir a este mes</button>`;
        hoja.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { anio += Number(b.dataset.a); pintar(); marcarAnio(anio); });
        hoja.querySelector('#m-anios').onclick = () => { verAnios = true; pintar(); };
        hoja.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { E.mes = new Date(anio, Number(b.dataset.m), 1); cerrar(); alElegir(); });
        hoja.querySelector('#m-hoy').onclick = () => { E.mes = inicioMes(hoy); cerrar(); alElegir(); };
      }
      pintar();
      marcarAnio(anio);
    });
  }

  // ---------------- Selector de espacio, crear grupo, unirse ----------------
  function elegirEspacio() {
    abrirHoja('Elegir espacio', (hoja, cerrar) => {
      hoja.innerHTML = `
        <div class="tirador"></div>
        <h2>¿Dónde anotas?</h2>
        <div class="lista-espacios">${E.espacios.map(e => `
          <button type="button" class="opcion-espacio" data-e="${e.id}" aria-pressed="${e.id === E.espacio}">
            <span class="ico-esp t-${e.tipo}">${iconoEspacio(e.tipo)}</span>
            <span class="txt"><b>${esc(e.nombre)}</b><small>${e.tipo === 'personal' ? 'Solo tú lo ves' : (e.tipo === 'familia' ? 'Familia' : 'Empresa') + ', ' + e.miembros + (e.miembros === 1 ? ' persona' : ' personas') + (e.rol === 'admin' ? ', administras tú' : '')}</small></span>
            ${e.id === E.espacio ? `<span class="marca">${IC.check}</span>` : ''}
          </button>`).join('')}</div>
        <div class="dos">
          <button type="button" class="btn sec" id="e-crear">${IC.mas}Crear grupo</button>
          <button type="button" class="btn sec" id="e-unirme">Unirme con código</button>
        </div>`;
      hoja.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { cerrar(); if (b.dataset.e !== E.espacio) cambiarEspacio(b.dataset.e); });
      hoja.querySelector('#e-crear').onclick = () => { cerrar(); crearGrupo(); };
      hoja.querySelector('#e-unirme').onclick = () => { cerrar(); unirmeConCodigo(); };
    });
  }

  function crearGrupo() {
    if (!tieneAcceso()) return toast('Activa MiPlata para crear grupos.', null, true);
    let tipo = 'familia', copiar = true;
    abrirHoja('Crear grupo', (hoja, cerrar) => {
      function pintar() {
        hoja.innerHTML = `
          <div class="tirador"></div>
          <h2>Crear un grupo</h2>
          <p class="orig" style="margin-top:-6px">Para gastos que salen de una misma fuente: la casa, el negocio o un centro de costo. Todos los miembros ven los gastos del grupo. Tu espacio personal sigue siendo solo tuyo.</p>
          <div class="tipo" role="group" aria-label="Tipo de grupo">
            <button type="button" data-t="familia" aria-pressed="${tipo === 'familia'}">${IC.familia}Familia</button>
            <button type="button" data-t="empresa" aria-pressed="${tipo === 'empresa'}">${IC.empresa}Empresa</button>
          </div>
          <div class="campo"><label for="g-nombre">Nombre del grupo</label>
            <input class="entrada" id="g-nombre" maxlength="60" placeholder="${tipo === 'familia' ? 'Ej.: Familia Quispe' : 'Ej.: Piedras SAC - Centro de costo 12'}"></div>
          <label class="check"><input type="checkbox" id="g-copiar" ${copiar ? 'checked' : ''}><span>Copiar mis categorías al grupo</span></label>
          <div id="g-msg" role="status" aria-live="polite"></div>
          <button type="button" class="btn" id="g-crear">Crear grupo</button>`;
        hoja.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tipo = b.dataset.t; copiar = hoja.querySelector('#g-copiar').checked; const n = hoja.querySelector('#g-nombre').value; pintar(); hoja.querySelector('#g-nombre').value = n; });
        hoja.querySelector('#g-crear').onclick = async ev => {
          const nombre = hoja.querySelector('#g-nombre').value.trim();
          if (!nombre) { hoja.querySelector('#g-msg').innerHTML = '<p class="mensaje error">Ponle un nombre al grupo.</p>'; return; }
          ev.target.disabled = true;
          const { data, error } = await sb.rpc('crear_espacio', { p_nombre: nombre, p_tipo: tipo, p_copiar_categorias: hoja.querySelector('#g-copiar').checked });
          if (error) { ev.target.disabled = false; hoja.querySelector('#g-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; }
          cerrar();
          await cargarEspacios();
          await cargarEspacio(data);
          E.pestana = 'espacio'; principal();
          toast(`Grupo "${esc(nombre)}" creado. Ahora agrega a los miembros.`);
        };
      }
      pintar();
    });
  }

  function unirmeConCodigo() {
    abrirHoja('Unirme a un grupo', (hoja, cerrar) => {
      hoja.innerHTML = `
        <div class="tirador"></div>
        <h2>Unirme a un grupo</h2>
        <p class="orig" style="margin-top:-6px">Escribe el código de 6 letras que te compartió quien administra el grupo.</p>
        <input class="entrada codigo" id="u-codigo" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC234" aria-label="Código de invitación">
        <div id="u-msg" role="status" aria-live="polite"></div>
        <button type="button" class="btn" id="u-unirme">Unirme</button>`;
      const inp = hoja.querySelector('#u-codigo');
      inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
      hoja.querySelector('#u-unirme').onclick = async ev => {
        if (inp.value.length < 6) { hoja.querySelector('#u-msg').innerHTML = '<p class="mensaje error">El código tiene 6 letras o números.</p>'; return; }
        ev.target.disabled = true;
        const { data, error } = await sb.rpc('unirse_con_codigo', { p_codigo: inp.value });
        if (error) { ev.target.disabled = false; hoja.querySelector('#u-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; }
        cerrar();
        await cargarEspacios(); await cargarEspacio(data);
        E.pestana = 'movimientos'; principal();
        toast(`Te uniste a ${esc(espacioActual().nombre)}`);
      };
    });
  }

  // ---------------- Pestaña Espacio: categorías, medios, miembros ----------------
  let tipoCatVista = 'gasto';
  async function vistaEspacio() {
    const $c = document.getElementById('contenido');
    // los topes son del mes en curso: asegurar sus movimientos
    if ((E.limites || []).length && E.movsMes !== iso(inicioMes(new Date()))) { E.mes = inicioMes(new Date()); try { await cargarMovs(); } catch (e) {} }
    const e = espacioActual(), admin = esAdminEspacio();
    let pendientes = [];
    if (admin && e.tipo !== 'personal' && !E.demo) {
      const { data } = await sb.from('invitaciones').select('id, correo, vence_en').eq('espacio_id', E.espacio)
        .eq('anulada', false).is('usada_por', null).not('correo', 'is', null).gt('vence_en', new Date().toISOString()).order('creado_en');
      pendientes = data || [];
    }
    const quienAdmin = (E.miembros.find(m => m.rol === 'admin' && m.estado === 'activo') || {}).nombre;
    const cats = E.categorias.filter(c => c.tipo === tipoCatVista && !c.archivada);
    const archivadas = E.categorias.filter(c => c.tipo === tipoCatVista && c.archivada);
    $c.innerHTML = `
      ${cabecera()}
      <section class="seccion">
        <div class="titulo-espacio">
          <span class="ico-esp t-${e.tipo}">${iconoEspacio(e.tipo)}</span>
          <div><h1>${esc(e.nombre)}</h1><p>${e.tipo === 'personal' ? 'Tu espacio personal. Solo tú lo ves.' : (e.tipo === 'familia' ? 'Grupo familiar' : 'Grupo de empresa') + (admin ? '. Tú lo administras: agregas o retiras miembros y cambias categorías, topes y medios de pago.' : '. Lo administra ' + esc(quienAdmin || 'otra persona') + '. Todos ven los gastos del grupo y cada uno edita los suyos.')}</p></div>
        </div>
        ${e.tipo === 'personal' && E.espacios.length === 1 ? `<button type="button" class="tarjeta-accion" id="e-crear">
          <span class="ico-esp t-familia">${IC.familia}</span><span><b>¿Gastos en familia o en tu empresa?</b><small>Crea un grupo y agrega a los miembros con su correo.</small></span></button>` : ''}

        ${e.tipo !== 'personal' ? seccionMiembros(admin, pendientes) : ''}

        <div class="bloque-sec">
          <div class="cabeza-sec"><h2>Categorías</h2>
            <div class="tipo mini" role="group" aria-label="Tipo de categoría">
              <button type="button" data-tc="gasto" aria-pressed="${tipoCatVista === 'gasto'}">Gastos</button>
              <button type="button" class="ing" data-tc="ingreso" aria-pressed="${tipoCatVista === 'ingreso'}">Ingresos</button>
            </div></div>
          <ul class="lista-cats">${cats.map(c => `<li><button type="button" class="fila-cat" data-cat="${c.id}" ${admin ? '' : 'disabled'}>
            <i class="punto grande" style="background:${colorCat(c.color)}"></i><span>${esc(c.nombre)}</span>${admin ? '<small>Editar</small>' : ''}</button></li>`).join('')}</ul>
          ${admin ? `<button type="button" class="btn sec" id="cat-nueva">${IC.mas}Nueva categoría</button>` : '<p class="nota">Solo quien administra el grupo puede cambiar las categorías.</p>'}
          ${admin && archivadas.length ? `<details class="archivadas"><summary>${archivadas.length} quitada${archivadas.length === 1 ? '' : 's'}</summary>
            <ul class="lista-cats">${archivadas.map(c => `<li><span class="fila-cat apagada"><i class="punto grande" style="background:${colorCat(c.color)}"></i><span>${esc(c.nombre)}</span><button type="button" class="enlace" data-restaurar="${c.id}">Recuperar</button></span></li>`).join('')}</ul></details>` : ''}
        </div>

        <div class="bloque-sec">
          <div class="cabeza-sec"><h2>Topes del mes</h2></div>
          ${E.limites.length ? `<ul class="ranking topes">${E.limites.map(l => barraTope(l, null, admin)).join('')}</ul>`
            : `<p class="nota">${admin ? 'Ponle un límite al mes, a una tarjeta o a una categoría. Te aviso cuando te acerques.' : 'Este espacio no tiene topes.'}</p>`}
          ${admin ? `<button type="button" class="btn sec" id="tope-nuevo">${IC.mas}Nuevo tope</button>` : ''}
        </div>

        <div class="bloque-sec">
          <div class="cabeza-sec"><h2>Medios de pago</h2></div>
          <p class="nota">La ★ marca el que uso cuando no me dices con qué pagaste${e.tipo === 'personal' ? '' : ' (es tu preferencia en este grupo)'}.</p>
          <ul class="lista-medios">${E.medios.map(x => `<li>
            <button type="button" class="estrella" data-pred="${x.id}" aria-pressed="${E.medioPred === x.id}" aria-label="Usar ${esc(x.nombre)} por defecto">★</button>
            <span>${esc(x.nombre)}<br><small>${esc(TIPO_BASE[x.tipo_base] || '')}</small></span>
            ${admin ? `<button type="button" class="enlace" data-quitar="${x.id}" aria-label="Editar ${esc(x.nombre)}">Editar</button>` : ''}</li>`).join('') || '<li><span class="nota">Aún no hay medios de pago en este espacio.</span></li>'}</ul>
          ${admin ? formOtroMedio('Agregar medio de pago', e.tipo === 'empresa' ? 'Ej.: Caja chica, Tarjeta empresa' : 'Ej.: BBVA crédito') : ''}
        </div>

        ${e.tipo !== 'personal' ? `<div class="bloque-sec">
          ${admin ? `<button type="button" class="btn sec" id="g-renombrar">Cambiar nombre del grupo</button>
          <button type="button" class="btn peligro" id="g-archivar">Archivar grupo</button>` : `<button type="button" class="btn peligro" id="g-salir">Salir del grupo</button>`}
        </div>` : ''}
        <div id="o-msg" role="status" aria-live="polite"></div>
      </section>`;
    conectarCabecera();
    const msg = (t, ok) => { const m = document.getElementById('o-msg'); if (m) m.innerHTML = t ? `<p class="mensaje ${ok ? 'ok' : 'error'}">${esc(t)}</p>` : ''; };
    $c.querySelector('#e-crear')?.addEventListener('click', crearGrupo);
    $c.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => { tipoCatVista = b.dataset.tc; vistaEspacio(); });
    $c.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => editarCategoria(catPorId(b.dataset.cat)));
    $c.querySelector('#cat-nueva')?.addEventListener('click', () => editarCategoria(null));
    $c.querySelector('#tope-nuevo')?.addEventListener('click', () => editarTope(null));
    $c.querySelectorAll('[data-tope]').forEach(b => b.onclick = () => editarTope(E.limites.find(x => x.id === b.dataset.tope)));
    $c.querySelectorAll('[data-restaurar]').forEach(b => b.onclick = async () => {
      const { error } = await sb.from('categorias').update({ archivada: false }).eq('id', b.dataset.restaurar);
      if (error) return msg(errorEs(error));
      catPorId(b.dataset.restaurar).archivada = false; vistaEspacio();
    });
    $c.querySelectorAll('[data-pred]').forEach(b => b.onclick = async () => {
      if (!E.demo) { const { error } = await sb.rpc('fijar_medio_predeterminado', { p_espacio: E.espacio, p_medio: b.dataset.pred }); if (error) return msg(errorEs(error)); }
      E.medioPred = b.dataset.pred; vistaEspacio();
    });
    $c.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => {
      const medio = E.medios.find(x => x.id === b.dataset.quitar);
      hojaMedio(medio, E.medios.filter(x => x.id !== medio.id).map(x => x.nombre),
        async (nombre, tipo) => {
          const cambios = { nombre, tipo_base: tipo, alias: [...new Set([...(medio.alias || []), I.normalizar(nombre)])] };
          if (!E.demo) { const { error } = await sb.from('medios_pago').update(cambios).eq('id', medio.id); if (error) return errorEs(error); }
          Object.assign(medio, cambios); vistaEspacio(); toast('Medio de pago actualizado');
        },
        async () => {
          if (!E.demo) { const { error } = await sb.from('medios_pago').update({ activo: false }).eq('id', medio.id); if (error) return errorEs(error); }
          E.medios = E.medios.filter(x => x.id !== medio.id);
          if (E.medioPred === medio.id) E.medioPred = null;
          vistaEspacio(); toast(`Quitamos "${esc(medio.nombre)}"`);
        });
    });
    $c.querySelector('#o-agregar')?.addEventListener('click', async () => {
      const n = document.getElementById('o-nombre').value.trim();
      if (!n) return;
      if (E.medios.some(x => I.normalizar(x.nombre) === I.normalizar(n))) return msg('Ya hay un medio con ese nombre.');
      const sug = J.MEDIOS_SUGERIDOS.find(s => I.normalizar(s.nombre) === I.normalizar(n));
      const fila = { nombre: n, tipo_base: sug ? sug.tipo_base : document.getElementById('o-tipo').value, alias: sug ? sug.alias : [I.normalizar(n)], orden: E.medios.length, espacio_id: E.espacio };
      let data = { ...fila, id: 'x' + Math.random() }, error;
      if (!E.demo) ({ data, error } = await sb.from('medios_pago').insert(fila).select().single());
      if (error) return msg(errorEs(error));
      E.medios.push(data);
      if (!E.medioPred) { E.medioPred = data.id; if (!E.demo) sb.rpc('fijar_medio_predeterminado', { p_espacio: E.espacio, p_medio: data.id }).then(() => {}); }
      vistaEspacio();
    });
    conectarMiembros($c, msg);
    $c.querySelector('#g-renombrar')?.addEventListener('click', renombrarGrupo);
    $c.querySelector('#g-archivar')?.addEventListener('click', () => confirmar('¿Archivar este grupo?', 'Nadie podrá registrar más gastos en él. Los datos no se borran.', 'Archivar grupo', async () => {
      const { error } = await sb.rpc('archivar_espacio', { p_espacio: E.espacio });
      if (error) return msg(errorEs(error));
      await cargarEspacios(); await cargarEspacio(null); principal(); toast('Grupo archivado');
    }));
    $c.querySelector('#g-salir')?.addEventListener('click', () => confirmar('¿Salir del grupo?', 'Tus gastos registrados se quedan en el grupo. Puedes volver si te invitan de nuevo.', 'Salir del grupo', async () => {
      const { error } = await sb.rpc('salir_de_espacio', { p_espacio: E.espacio });
      if (error) return msg(errorEs(error));
      await cargarEspacios(); await cargarEspacio(null); principal(); toast('Saliste del grupo');
    }));
  }

  // Quiénes están en el grupo, a la vista en Movimientos (toca para ir a Espacio)
  function filaMiembros() {
    const activos = E.miembros.filter(m => m.estado === 'activo');
    if (!activos.length) return '';
    const caras = activos.slice(0, 5).map(m => `<span class="avatar" title="${esc(m.nombre)}">${esc((m.nombre || '?').charAt(0).toUpperCase())}</span>`).join('');
    const nombres = activos.map(m => m.usuario_id === E.sesion.user.id ? 'tú' : (m.nombre || '').split(' ')[0]).slice(0, 3).join(', ') + (activos.length > 3 ? ' y ' + (activos.length - 3) + ' más' : '');
    return `<button type="button" class="fila-miembros" data-ir="espacio" aria-label="Ver los ${activos.length} miembros del grupo">
      <span class="caras">${caras}${activos.length > 5 ? `<span class="avatar mas">+${activos.length - 5}</span>` : ''}</span>
      <span class="txt"><b>${activos.length} ${activos.length === 1 ? 'persona' : 'personas'} en el grupo</b><small>${esc(nombres)}</small></span>${svg('<path d="M9 5l7 7-7 7"/>', 'width="18" height="18" stroke-width="2.4"')}</button>`;
  }

  function seccionMiembros(admin, pendientes = []) {
    const activos = E.miembros.filter(m => m.estado === 'activo');
    return `<div class="bloque-sec">
      <div class="cabeza-sec"><h2>Miembros</h2><span class="nota">${activos.length} ${activos.length === 1 ? 'persona' : 'personas'}</span></div>
      <ul class="lista-miembros">${activos.map(m => `<li>
        <span class="avatar">${esc((m.nombre || '?').charAt(0).toUpperCase())}</span>
        <span class="txt"><b>${esc(m.nombre)}${m.usuario_id === E.sesion.user.id ? ' (tú)' : ''}</b><small>${m.rol === 'admin' ? 'Administra' : 'Miembro'}${m.con_acceso ? '' : ', sin acceso activo'}</small></span>
        ${admin && m.usuario_id !== E.sesion.user.id ? `<button type="button" class="enlace" data-miembro="${m.usuario_id}">Opciones</button>` : ''}
      </li>`).join('')}</ul>
      ${admin && pendientes.length ? `<div class="pendientes"><p class="nota"><b>Invitados que aún no crean su cuenta</b><br>Les llegó un correo con la invitación. Cuando se registren con ese correo, entran solos al grupo.</p>
        <ul class="lista-miembros">${pendientes.map(i => `<li><span class="avatar pend">${IC.sobre}</span>
          <span class="txt"><b>${esc(i.correo)}</b><small>Invitación vigente hasta el ${fechaLarga(i.vence_en)}</small></span>
          <button type="button" class="enlace" data-anular="${i.id}">Anular</button></li>`).join('')}</ul></div>` : ''}
      ${admin ? `
      <div class="campo"><label for="m-correo">Agregar por correo</label>
        <div class="otro"><input class="entrada" id="m-correo" type="email" inputmode="email" placeholder="correo@ejemplo.com">
        <button type="button" class="btn" id="m-agregar" style="width:auto;padding:12px 18px">Agregar</button></div>
        <small>Si aún no tiene cuenta, le llega una invitación con 30 días gratis.</small></div>
      <button type="button" class="btn sec" id="m-enlace">${IC.compartir}Compartir enlace de invitación</button>` : ''}
    </div>`;
  }

  function conectarMiembros($c, msg) {
    $c.querySelector('#m-agregar')?.addEventListener('click', async ev => {
      const correo = document.getElementById('m-correo').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(correo)) return toast(esc('Escribe un correo válido.'));
      ev.target.disabled = true;
      const { data, error } = await sb.rpc('agregar_miembro_por_correo', { p_espacio: E.espacio, p_correo: correo });
      ev.target.disabled = false;
      if (error) return toast(esc(errorEs(error)));
      const r = await sb.rpc('miembros_de', { p_espacio: E.espacio }); E.miembros = r.data || E.miembros;
      await cargarEspacios();
      await vistaEspacio();
      // aviso visible junto al campo (el bloque de mensajes del final queda lejos)
      toast(esc(data === 'agregado' ? `Listo: ${correo} ya está en el grupo y le avisamos por correo.`
        : data === 'ya_es_miembro' ? `${correo} ya estaba en el grupo.`
        : `Le enviamos una invitación a ${correo}. Cuando cree su cuenta con ese correo, entrará al grupo automáticamente.`));
    });
    $c.querySelector('#m-enlace')?.addEventListener('click', async () => {
      const { data, error } = await sb.rpc('crear_enlace_invitacion', { p_espacio: E.espacio });
      if (error) return msg(errorEs(error));
      const url = location.origin + location.pathname + '?unirme=' + data;
      const texto = `Únete a "${espacioActual().nombre}" en MiPlata para anotar los gastos juntos. Código: ${data}`;
      abrirHoja('Invitación', (hoja, cerrar) => {
        hoja.innerHTML = `<div class="tirador"></div><h2>Invitación al grupo</h2>
          <p class="orig" style="margin-top:-6px">Sirve 7 días. Compártela solo con quienes deben ver los gastos del grupo.</p>
          <p class="codigo-grande" aria-label="Código ${data.split('').join(' ')}">${data}</p>
          <button type="button" class="btn" id="i-compartir">${IC.compartir}Compartir por WhatsApp u otra app</button>
          <button type="button" class="btn sec" id="i-copiar">${IC.copiar}Copiar enlace</button>`;
        hoja.querySelector('#i-compartir').onclick = async () => {
          if (navigator.share) { try { await navigator.share({ title: 'MiPlata', text: texto, url }); } catch (e) {} }
          else window.open('https://wa.me/?text=' + encodeURIComponent(texto + '\n' + url), '_blank', 'noopener');
        };
        hoja.querySelector('#i-copiar').onclick = async () => {
          try { await navigator.clipboard.writeText(texto + '\n' + url); toast('Enlace copiado'); } catch (e) { toast('No se pudo copiar: ' + esc(url), null, true); }
        };
      });
    });
    $c.querySelectorAll('[data-anular]').forEach(b => b.onclick = () => confirmar('¿Anular esta invitación?', 'El enlace del correo dejará de funcionar. Si se registra igual, no entrará al grupo.', 'Anular invitación', async () => {
      const { error } = await sb.rpc('anular_invitacion', { p_invitacion: b.dataset.anular });
      if (error) return toast(esc(errorEs(error)));
      vistaEspacio(); toast('Invitación anulada');
    }));
    $c.querySelectorAll('[data-miembro]').forEach(b => b.onclick = () => {
      const m = E.miembros.find(x => x.usuario_id === b.dataset.miembro);
      abrirHoja('Opciones del miembro', (hoja, cerrar) => {
        hoja.innerHTML = `<div class="tirador"></div><h2>${esc(m.nombre)}</h2><p class="orig" style="margin-top:-6px">${esc(m.correo || '')}</p>
          <button type="button" class="btn sec" id="x-admin">Pasarle la administración</button>
          <button type="button" class="btn peligro" id="x-retirar">Retirar del grupo</button>
          <div id="x-msg" role="status" aria-live="polite"></div>`;
        const fallo = e => { hoja.querySelector('#x-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(e))}</p>`; };
        hoja.querySelector('#x-admin').onclick = async () => {
          const { error } = await sb.rpc('pasar_administracion', { p_espacio: E.espacio, p_usuario: m.usuario_id });
          if (error) return fallo(error);
          cerrar(); await cargarEspacios(); await cargarEspacio(E.espacio); vistaEspacio(); toast(`${esc(m.nombre)} ahora administra el grupo`);
        };
        hoja.querySelector('#x-retirar').onclick = () => confirmar(`¿Retirar a ${m.nombre} del grupo?`, 'Ya no verá ni podrá anotar gastos en este grupo. Los gastos que registró se quedan. Puedes volver a invitarlo cuando quieras.', 'Retirar del grupo', async () => {
          const { error } = await sb.rpc('retirar_miembro', { p_espacio: E.espacio, p_usuario: m.usuario_id });
          if (error) return fallo(error);
          cerrar(); await cargarEspacios(); await cargarEspacio(E.espacio); vistaEspacio(); toast(`${esc(m.nombre)} ya no está en el grupo. Sus gastos se quedan.`);
        });
      });
    });
  }

  // ---------------- Elegir categoría: todas, con buscador y "Crear" ----------------
  function elegirCategoria(tipo, actual, alElegir) {
    const admin = esAdminEspacio();
    abrirHoja('Elegir categoría', (hoja, cerrar) => {
      let q = '';
      function pintar() {
        const activas = E.categorias.filter(c => c.tipo === tipo && !c.archivada);
        const nq = I.normalizar(q);
        const lista = nq ? activas.filter(c => I.normalizar(c.nombre).includes(nq)) : activas;
        const exacta = activas.some(c => I.normalizar(c.nombre) === nq);
        hoja.innerHTML = `<div class="tirador"></div>
          <div class="cabeza-sec"><h2>Elige una categoría</h2>${admin ? '<button type="button" class="enlace" id="ec-mis">Mis categorías</button>' : ''}</div>
          <div class="con-icono buscador">${svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>')}<input class="entrada" id="ec-q" placeholder="Buscar categoría" autocomplete="off" value="${esc(q)}"></div>
          <ul class="lista-elegir" role="listbox" aria-label="Categorías">${lista.map(c => `<li><button type="button" role="option" class="op-cat" data-c="${c.id}" aria-selected="${c.id === actual}">
            <i class="punto grande" style="background:${colorCat(c.color)}"></i><span>${esc(c.nombre)}</span>${c.id === actual ? IC.check : ''}</button></li>`).join('')}</ul>
          ${!lista.length && !q ? '<p class="nota">No tienes categorías de este tipo.</p>' : ''}
          ${q.trim() && !exacta && admin ? `<button type="button" class="btn sec" id="ec-crear">${IC.mas}Crear "${esc(q.trim())}"</button>` : ''}
          ${q.trim() && !lista.length && !admin ? '<p class="nota">No hay una categoría así. Pídele a quien administra el grupo que la cree.</p>' : ''}
          ${actual ? '<button type="button" class="enlace" id="ec-sin">Dejar sin categoría</button>' : ''}`;
        const inp = hoja.querySelector('#ec-q');
        inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; pintar(); const n = hoja.querySelector('#ec-q'); n.focus(); n.setSelectionRange(pos, pos); };
        hoja.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cerrar(); alElegir(b.dataset.c); });
        hoja.querySelector('#ec-crear')?.addEventListener('click', () => { cerrar(); editarCategoria(null, { tipo, nombre: q.trim(), alTerminar: c => { if (c) alElegir(c.id); } }); });
        hoja.querySelector('#ec-sin')?.addEventListener('click', () => { cerrar(); alElegir(null); });
        hoja.querySelector('#ec-mis')?.addEventListener('click', () => { cerrar(); misCategorias(tipo, () => alElegir(actual)); });
      }
      pintar();
    });
  }

  // ---------------- Mis categorías: mostrar u ocultar con un interruptor, renombrar, crear ----------------
  function misCategorias(tipo, alCerrar) {
    abrirHoja('Mis categorías', (hoja, cerrar) => {
      function pintar() {
        const todas = E.categorias.filter(c => c.tipo === tipo).sort((a, b) => (a.archivada - b.archivada) || (a.orden - b.orden));
        const visibles = todas.filter(c => !c.archivada).length;
        hoja.innerHTML = `<div class="tirador"></div>
          <h2>Mis categorías de ${tipo === 'gasto' ? 'gastos' : 'ingresos'}</h2>
          <p class="orig" style="margin-top:-6px">Deja visibles solo las que usas. Las ocultas no se borran: los movimientos que ya las tienen las conservan.</p>
          <p class="nota">${visibles} visibles de ${todas.length}</p>
          <ul class="lista-gestion">${todas.map(c => `<li class="${c.archivada ? 'oculta' : ''}">
            <button type="button" class="nom-cat" data-ren="${c.id}" aria-label="Renombrar ${esc(c.nombre)}"><i class="punto grande" style="background:${colorCat(c.color)}"></i><span>${esc(c.nombre)}</span></button>
            <button type="button" class="interruptor" role="switch" data-sw="${c.id}" aria-checked="${!c.archivada}" aria-label="${c.archivada ? 'Mostrar' : 'Ocultar'} ${esc(c.nombre)}"><i></i></button></li>`).join('')}</ul>
          <button type="button" class="btn sec" id="mc-nueva">${IC.mas}Nueva categoría</button>
          <button type="button" class="btn" id="mc-listo">Listo</button>
          <div id="mc-msg" role="status" aria-live="polite"></div>`;
        hoja.querySelectorAll('[data-sw]').forEach(b => b.onclick = async () => {
          const c = catPorId(b.dataset.sw), nuevo = !c.archivada;
          if (!nuevo && E.categorias.filter(x => x.tipo === tipo && !x.archivada).length === 1) { hoja.querySelector('#mc-msg').innerHTML = '<p class="mensaje error">Deja al menos una categoría visible.</p>'; return; }
          b.disabled = true;
          if (!E.demo) { const { error } = await sb.from('categorias').update({ archivada: nuevo }).eq('id', c.id); if (error) { b.disabled = false; hoja.querySelector('#mc-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; } }
          c.archivada = nuevo; pintar();
        });
        hoja.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => editarCategoria(catPorId(b.dataset.ren), { alTerminar: () => pintar() }));
        hoja.querySelector('#mc-nueva').onclick = () => editarCategoria(null, { tipo, alTerminar: () => pintar() });
        hoja.querySelector('#mc-listo').onclick = cerrar;
      }
      pintar();
    }, alCerrar);
  }

  // opts: { tipo, nombre (inicial), alTerminar(cat|null) } — por defecto vuelve a pintar la pestaña Espacio
  function editarCategoria(cat, opts) {
    opts = opts || {};
    const nueva = !cat;
    const tipoNueva = opts.tipo || tipoCatVista;
    const alTerminar = opts.alTerminar || (() => vistaEspacio());
    let color = cat ? cat.color : COLORES[E.categorias.filter(c => !c.archivada).length % (COLORES.length - 1)];
    abrirHoja(nueva ? 'Nueva categoría' : 'Editar categoría', (hoja, cerrar) => {
      function pintar() {
        const nombre = hoja.querySelector('#k-nombre')?.value ?? (cat ? cat.nombre : (opts.nombre || ''));
        hoja.innerHTML = `<div class="tirador"></div>
          <h2>${nueva ? 'Nueva categoría de ' + (tipoNueva === 'gasto' ? 'gasto' : 'ingreso') : 'Editar categoría'}</h2>
          <div class="campo"><label for="k-nombre">Nombre</label><input class="entrada" id="k-nombre" maxlength="40" value="${esc(nombre)}" placeholder="Ej.: Gasolina del carro"></div>
          <div class="campo"><label>Color</label><div class="paleta">${COLORES.map(c => `<button type="button" class="color" data-color="${c}" aria-pressed="${c === color}" aria-label="Color ${c}" style="background:${colorCat(c)}"></button>`).join('')}</div></div>
          <div id="k-msg" role="status" aria-live="polite"></div>
          <button type="button" class="btn" id="k-guardar">${nueva ? 'Agregar categoría' : 'Guardar cambios'}</button>
          ${nueva ? '' : '<button type="button" class="btn peligro" id="k-quitar">Ocultar categoría</button><p class="nota">Si la ocultas, los movimientos que ya la usan la conservan. Puedes volver a mostrarla en "Mis categorías".</p>'}`;
        hoja.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { color = b.dataset.color; pintar(); });
        hoja.querySelector('#k-guardar').onclick = guardar;
        hoja.querySelector('#k-quitar')?.addEventListener('click', quitar);
      }
      const fallo = e => { hoja.querySelector('#k-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(e))}</p>`; };
      async function guardar() {
        const nombre = hoja.querySelector('#k-nombre').value.trim();
        if (!nombre) return fallo('Escribe un nombre.');
        if (E.categorias.some(c => !c.archivada && c.tipo === (cat ? cat.tipo : tipoNueva) && c.id !== (cat && cat.id) && I.normalizar(c.nombre) === I.normalizar(nombre))) return fallo('Ya tienes una categoría con ese nombre.');
        let resultado = cat;
        if (nueva) {
          const fila = { espacio_id: E.espacio, nombre, tipo: tipoNueva, color, orden: E.categorias.length + 1 };
          let data = { ...fila, id: 'k' + Math.random(), archivada: false }, error;
          if (!E.demo) ({ data, error } = await sb.from('categorias').insert(fila).select().single());
          if (error) return fallo(error);
          E.categorias.push(data); resultado = data;
        } else {
          if (!E.demo) { const { error } = await sb.from('categorias').update({ nombre, color }).eq('id', cat.id); if (error) return fallo(error); }
          cat.nombre = nombre; cat.color = color;
        }
        cerrar(); alTerminar(resultado); toast(nueva ? 'Categoría agregada' : 'Categoría actualizada');
      }
      async function quitar() {
        if (!E.demo) { const { error } = await sb.from('categorias').update({ archivada: true }).eq('id', cat.id); if (error) return fallo(error); }
        cat.archivada = true; cerrar(); alTerminar(null); toast('Categoría ocultada');
      }
      pintar();
    });
  }

  function renombrarGrupo() {
    abrirHoja('Cambiar nombre del grupo', (hoja, cerrar) => {
      hoja.innerHTML = `<div class="tirador"></div><h2>Nombre del grupo</h2>
        <input class="entrada" id="r-nombre" maxlength="60" value="${esc(espacioActual().nombre)}" aria-label="Nombre del grupo">
        <div id="r-msg" role="status" aria-live="polite"></div>
        <button type="button" class="btn" id="r-guardar">Guardar nombre</button>`;
      hoja.querySelector('#r-guardar').onclick = async () => {
        const n = hoja.querySelector('#r-nombre').value.trim();
        if (!n) return;
        const { error } = await sb.from('espacios').update({ nombre: n }).eq('id', E.espacio);
        if (error) { hoja.querySelector('#r-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(error))}</p>`; return; }
        cerrar(); await cargarEspacios(); vistaEspacio(); toast('Nombre guardado');
      };
    });
  }

  function confirmar(titulo, texto, accion, alConfirmar) {
    abrirHoja(titulo, (hoja, cerrar) => {
      hoja.innerHTML = `<div class="tirador"></div><h2>${esc(titulo)}</h2><p class="orig" style="margin-top:-6px">${esc(texto)}</p>
        <button type="button" class="btn peligro" id="cf-si">${esc(accion)}</button>
        <button type="button" class="btn sec" id="cf-no">Cancelar</button>`;
      hoja.querySelector('#cf-si').onclick = () => { cerrar(); alConfirmar(); };
      hoja.querySelector('#cf-no').onclick = cerrar;
    });
  }

  // ---------------- Resumen (F5) ----------------
  function htmlMesNav(sub) {
    const esMesActual = iso(E.mes) === iso(inicioMes(new Date()));
    return `<div class="mes-nav">
        <button type="button" class="flecha" id="m-ant" aria-label="Mes anterior">${svg('<path d="M15 5l-7 7 7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>
        <button type="button" class="mes" id="m-elegir" aria-haspopup="dialog" aria-label="Elegir mes y año">${esc(MESES[E.mes.getMonth()].replace(/^./, c => c.toUpperCase()))} ${E.mes.getFullYear()}
          <span class="caret">${IC.flechaAbajo}</span><small>${esc(sub || '')}</small></button>
        <button type="button" class="flecha" id="m-sig" aria-label="Mes siguiente" ${esMesActual ? 'disabled' : ''}>${svg('<path d="M9 5l7 7-7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>
      </div>`;
  }
  function conectarMesNav(recargar) {
    document.getElementById('m-ant').onclick = () => { E.mes = new Date(E.mes.getFullYear(), E.mes.getMonth() - 1, 1); recargar(); };
    document.getElementById('m-sig').onclick = () => { E.mes = new Date(E.mes.getFullYear(), E.mes.getMonth() + 1, 1); recargar(); };
    document.getElementById('m-elegir').onclick = () => elegirMes(recargar);
  }

  async function totalesMes(mes) {
    if (E.demo) {
      const k = iso(mes).slice(0, 7);
      const ms = E.demoMovs.filter(m => m.espacio_id === E.espacio && m.fecha.slice(0, 7) === k);
      return { gasto: ms.filter(m => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0), hay: ms.length > 0 };
    }
    const desde = iso(mes), hasta = iso(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    const { data } = await sb.from('movimientos').select('monto, tipo').eq('espacio_id', E.espacio).gte('fecha', desde).lte('fecha', hasta);
    return { gasto: (data || []).filter(m => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0), hay: (data || []).length > 0 };
  }

  async function vistaResumen() {
    const $c = document.getElementById('contenido');
    $c.innerHTML = '<div class="cargando">Armando tu resumen…</div>';
    const anterior = new Date(E.mes.getFullYear(), E.mes.getMonth() - 1, 1);
    let previo;
    try { [, previo] = await Promise.all([cargarMovs(), totalesMes(anterior)]); }
    catch (e) { $c.innerHTML = `<div class="cargando">${esc(errorEs(e))}</div>`; return; }
    if (E.demo && !previo.hay && iso(E.mes) === iso(inicioMes(new Date()))) previo = { gasto: 412.3, hay: true };
    pintarResumen(previo, anterior);
  }

  function pintarResumen(previo, anterior) {
    const $c = document.getElementById('contenido');
    const gastos = E.movs.filter(m => m.tipo === 'gasto');
    const totalG = gastos.reduce((s, m) => s + Number(m.monto), 0);
    const totalI = E.movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
    const nomAnt = MESES[anterior.getMonth()];
    const dif = totalG - previo.gasto;
    const pct = v => totalG ? Math.round(v / totalG * 100) : 0;
    const agrupar = (clave, nombre) => {
      const m = new Map();
      gastos.forEach(g => { const k = clave(g); const x = m.get(k) || { k, nombre: nombre(g), monto: 0, n: 0 }; x.monto += Number(g.monto); x.n++; m.set(k, x); });
      return [...m.values()].sort((a, b) => b.monto - a.monto);
    };

    // En qué gastas: hasta 7 categorías + "Otras"; "Sin categoría" siempre aparte, en gris
    const porCat = agrupar(g => g.categoria_id || '_sin', g => { const c = catPorId(g.categoria_id); return c ? c.nombre : 'Sin categoría'; });
    const sinCat = porCat.find(x => x.k === '_sin');
    const conCat = porCat.filter(x => x.k !== '_sin');
    const filasCat = conCat.slice(0, 7).map(x => ({ ...x, color: colorCat((catPorId(x.k) || {}).color) }));
    if (conCat.length > 7) {
      const resto = conCat.slice(7);
      filasCat.push({ k: '_otras', nombre: `Otras (${resto.length})`, monto: resto.reduce((s, x) => s + x.monto, 0), n: resto.reduce((s, x) => s + x.n, 0), color: colorCat('#8a9690') });
    }
    if (sinCat) filasCat.push({ ...sinCat, color: colorCat(null) });

    const porMedio = agrupar(g => g.medio_pago_id || '_sin', g => { const x = medioPorId(g.medio_pago_id); return x ? x.nombre : 'Sin medio'; });
    const porLugar = agrupar(g => g.lugar_norm || I.lugarNorm(g.lugar || '') || '_sin', g => g.lugar || 'Sin lugar').filter(x => x.k !== '_sin').slice(0, 5);
    const porAutor = esGrupo() ? agrupar(g => g.usuario_id, g => g.usuario_id === E.sesion.user.id ? 'Tú' : ((E.miembros.find(y => y.usuario_id === g.usuario_id) || {}).nombre || 'Ex miembro')) : [];

    // Día a día
    const nomMes = MESES[E.mes.getMonth()];
    const diasMes = new Date(E.mes.getFullYear(), E.mes.getMonth() + 1, 0).getDate();
    const porDia = Array.from({ length: diasMes }, (_, i) => ({ dia: i + 1, monto: 0 }));
    gastos.forEach(g => { porDia[deIso(g.fecha).getDate() - 1].monto += Number(g.monto); });
    const maxDia = Math.max(...porDia.map(d => d.monto), 0);
    const diaTop = porDia.reduce((a, b) => b.monto > a.monto ? b : a, porDia[0]);

    const barras = (lista, color) => `<ul class="ranking">${lista.map(x => {
      const ancho = lista[0].monto ? Math.max(2, x.monto / lista[0].monto * 100) : 0;
      return `<li><div class="rk-cab"><span class="rk-nom">${x.color ? `<i class="punto" style="background:${x.color}"></i>` : ''}${esc(x.nombre)}</span>
        <span class="rk-val"><b class="cifra">S/ ${soles(x.monto)}</b><small>${pct(x.monto)}%</small></span></div>
        <div class="rk-riel"><i style="width:${ancho.toFixed(1)}%;background:${x.color || color}"></i></div></li>`;
    }).join('')}</ul>`;

    const comparacion = !previo.hay ? `Sin datos de ${nomAnt} para comparar`
      : Math.abs(dif) < 0.005 ? `Igual que en ${nomAnt}`
      : `${dif > 0 ? '▲' : '▼'} S/ ${soles(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'} que en ${nomAnt}`;

    const vacio = !gastos.length;
    const balance = totalI - totalG;
    const hoy = new Date();
    const diasCorridos = E.mes.getFullYear() === hoy.getFullYear() && E.mes.getMonth() === hoy.getMonth() ? hoy.getDate() : diasMes;
    const promedio = totalG / Math.max(1, diasCorridos);
    const conGasto = porDia.filter(d => d.monto > 0).length;
    const top1 = filasCat.find(x => x.k !== '_sin') || filasCat[0], top2 = filasCat.filter(x => x.k !== '_sin' && x !== top1)[0];
    const frase = vacio ? '' : `${esGrupo() ? 'El mayor gasto fue' : 'Tu mayor gasto fue'} <b>${esc(top1.nombre)}</b>, el ${pct(top1.monto)}% del total.${top2 ? ` Le sigue <b>${esc(top2.nombre)}</b> con ${pct(top2.monto)}%.` : ''}`;

    // dona de categorías (porciones separadas por el color de la tarjeta)
    function dona() {
      const R = 84, r = 58, c = 95; let a0 = -Math.PI / 2, s = '';
      const pt = (a, rad) => (c + rad * Math.cos(a)).toFixed(2) + ' ' + (c + rad * Math.sin(a)).toFixed(2);
      filasCat.forEach(x => {
        const f = x.monto / totalG;
        if (f >= 0.9999) { s += `<circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${x.color}" stroke-width="${R - r}"/>`; return; }
        const a1 = a0 + f * Math.PI * 2, l = f > 0.5 ? 1 : 0;
        s += `<path d="M ${pt(a0, R)} A ${R} ${R} 0 ${l} 1 ${pt(a1, R)} L ${pt(a1, r)} A ${r} ${r} 0 ${l} 0 ${pt(a0, r)} Z" fill="${x.color}" class="porcion"><title>${esc(x.nombre)}: S/ ${soles(x.monto)} (${pct(x.monto)}%)</title></path>`;
        a0 = a1;
      });
      return `<svg class="dona" viewBox="0 0 190 190" role="img" aria-label="Gasto por categoría">${s}
        <text x="${c}" y="${c - 8}" text-anchor="middle" class="d-et">${esGrupo() ? 'Gastaron' : 'Gastaste'}</text>
        <text x="${c}" y="${c + 14}" text-anchor="middle" class="d-num">S/ ${totalG >= 10000 ? Math.round(totalG).toLocaleString('es-PE') : soles(totalG)}</text></svg>`;
    }

    // columnas por día con cuadrícula, promedio y día pico
    function columnas() {
      const W = 340, H = 170, izq = 34, abajo = 20, arriba = 20, n = porDia.length;
      const pasoN = (v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; })(maxDia / 3);
      const tope = Math.ceil(maxDia / pasoN) * pasoN || 1, y = v => arriba + (H - arriba - abajo) * (1 - v / tope);
      const an = (W - izq) / n, bw = Math.max(3, Math.min(9, an - 3));
      let s = '';
      for (let v = 0; v <= tope + 1e-9; v += pasoN) s += `<line x1="${izq}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${izq - 5}" y="${y(v) + 3}" text-anchor="end" class="ax">${v >= 1000 ? (v / 1000).toLocaleString('es-PE') + ' mil' : v.toLocaleString('es-PE')}</text>`;
      porDia.forEach((d, k) => {
        const x = izq + an * k + (an - bw) / 2, pico = d === diaTop;
        if (d.monto > 0) {
          const yy = y(d.monto), rr = Math.min(3, bw / 2, H - abajo - yy);
          s += `<path d="M${x} ${H - abajo} V${yy + rr} Q${x} ${yy} ${x + rr} ${yy} H${x + bw - rr} Q${x + bw} ${yy} ${x + bw} ${yy + rr} V${H - abajo} Z" class="bar${pico ? ' pico' : ''}" data-i="${k}"/>`;
        }
        if (pico || ((k === 0 || (k + 1) % 5 === 0) && Math.abs(k - (diaTop.dia - 1)) > 1)) s += `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" class="ax${pico ? ' fuerte' : ''}">${d.dia}</text>`;
        s += `<rect x="${izq + an * k}" y="${arriba}" width="${an}" height="${H - arriba - abajo}" class="hit" data-i="${k}"/>`;
      });
      s += `<line x1="${izq}" x2="${W}" y1="${y(promedio)}" y2="${y(promedio)}" class="prom"/>`;
      const px = izq + an * (diaTop.dia - 1) + an / 2;
      s += `<text x="${Math.min(W - 26, Math.max(izq + 26, px))}" y="${y(diaTop.monto) - 6}" text-anchor="middle" class="ax fuerte">S/ ${soles(diaTop.monto)}</text>`;
      return `<svg class="cols-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto por día de ${nomMes}">${s}<line x1="${izq}" x2="${W}" y1="${H - abajo}" y2="${H - abajo}" class="base"/></svg>`;
    }

    // filas tipo reporte: nombre, barra, monto y porcentaje
    const filasRep = (lista, color) => `<ul class="rep-filas">${lista.map(x => `<li>
      <span class="rf-nom">${x.color ? `<i style="background:${x.color}"></i>` : ''}${esc(x.nombre)}</span>
      <span class="rf-riel"><i style="width:${lista[0].monto ? Math.max(3, x.monto / lista[0].monto * 100).toFixed(1) : 0}%;background:${x.color || color}"></i></span>
      <b class="cifra">S/ ${soles(x.monto)}</b><small>${pct(x.monto)}%</small></li>`).join('')}</ul>`;

    $c.innerHTML = `
      ${cabecera()}
      ${htmlMesNav(E.movs.length + (E.movs.length === 1 ? ' movimiento' : ' movimientos'))}
      <section class="seccion resumen rep">
        <div class="rep-heroe">
          <small>${esGrupo() ? 'Gastaron' : 'Gastaste'} en ${nomMes}</small>
          <b class="cifra">S/ ${soles(totalG)}</b>
          <span class="delta ${previo.hay && dif > 0 ? 'sube' : previo.hay && dif < 0 ? 'baja' : ''}">${esc(comparacion)}</span>
          ${frase ? `<p class="rep-frase">${frase}</p>` : ''}
        </div>
        <div class="rep-kpis">
          <div><small>${esGrupo() ? 'Entraron' : 'Te entró'}</small><b class="cifra">S/ ${soles(totalI)}</b></div>
          <div class="${balance >= 0 ? 'pos' : 'neg'}"><small>${balance >= 0 ? 'Te queda' : 'Te pasaste'}</small><b class="cifra">S/ ${soles(Math.abs(balance))}</b></div>
          <div><small>Promedio por día</small><b class="cifra">S/ ${soles(promedio)}</b></div>
          <div><small>Movimientos</small><b class="cifra">${E.movs.length}</b></div>
        </div>
        ${(E.limites || []).length ? `<div class="bloque-sec"><div class="cabeza-sec"><h2>Tus topes</h2><button type="button" class="enlace" data-p="espacio">Editar</button></div>
          <ul class="ranking topes">${E.limites.map(l => barraTope(l)).join('')}</ul></div>` : ''}
        ${vacio ? `<div class="vacio"><b>Aún no hay gastos este mes</b>Cuando anotes tus gastos, aquí verás en qué se va tu plata.</div>` : `
        <div class="rep-panel p-cat">
          <div class="cabeza-sec"><h2>¿En qué se fue tu plata?</h2>${sinCat ? `<button type="button" class="enlace" data-p="movimientos">${sinCat.n} sin categoría</button>` : ''}</div>
          <div class="rep-cats">${dona()}${filasRep(filasCat)}</div>
        </div>
        <div class="rep-panel p-dia">
          <div class="cabeza-sec"><h2>¿Cuándo gastaste?</h2><small class="sub">por día</small></div>
          <div class="cols-caja" id="columnas">${columnas()}<div class="col-tip" id="col-tip" role="status" hidden></div></div>
          <p class="nota">El día con más gasto fue el <b>${diaTop.dia} de ${nomMes}</b> (S/ ${soles(diaTop.monto)}). Gastaste en ${conGasto} de ${diasMes} días. La línea punteada es tu promedio: S/ ${soles(promedio)} al día.</p>
          <details class="tabla-dias"><summary>Ver como tabla</summary>
            <table><thead><tr><th scope="col">Día</th><th scope="col">Gasto</th></tr></thead><tbody>
            ${porDia.filter(d => d.monto).map(d => `<tr><td>${d.dia} ${nomMes.slice(0, 3)}</td><td class="cifra">S/ ${soles(d.monto)}</td></tr>`).join('')}</tbody></table></details>
        </div>
        <div class="rep-dos">
          <div class="rep-panel"><h2>¿Con qué pagaste?</h2>${filasRep(porMedio, 'var(--serie-1)')}</div>
          ${porLugar.length ? `<div class="rep-panel"><h2>¿Dónde gastaste más?</h2>${filasRep(porLugar, 'var(--serie-2)')}</div>` : ''}
        </div>
        ${porAutor.length > 1 ? `<div class="rep-panel"><h2>¿Quién gastó?</h2>${filasRep(porAutor, 'var(--serie-3)')}</div>` : ''}`}
        <button type="button" class="btn-descarga ancho" id="r-pdf"><span class="ico-formato pdf" aria-hidden="true">PDF</span>
          <span><b>Descargar el reporte en PDF</b><small>Con estos gráficos y todos tus movimientos, listo para guardar o imprimir.</small></span></button>
      </section>`;
    conectarCabecera();
    conectarMesNav(vistaResumen);
    $c.querySelector('#r-pdf').onclick = () => abrirExportar('pdf');
    $c.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { E.pestana = b.dataset.p; principal(); });
    const tip = $c.querySelector('#col-tip'), cont = $c.querySelector('#columnas');
    if (tip) {
      const mostrar = el => {
        const d = porDia[Number(el.dataset.i)], r = el.getBoundingClientRect(), rc = cont.getBoundingClientRect();
        tip.textContent = `${d.dia} ${nomMes.slice(0, 3)}: S/ ${soles(d.monto)}`;
        tip.hidden = false;
        tip.style.left = Math.min(Math.max(r.left - rc.left + r.width / 2, 56), rc.width - 56) + 'px';
        cont.querySelectorAll('.bar').forEach(o => o.classList.toggle('activa', o.dataset.i === el.dataset.i));
      };
      cont.querySelectorAll('.hit').forEach(h => { h.onmouseenter = () => mostrar(h); h.onclick = () => mostrar(h); });
      cont.onmouseleave = () => { tip.hidden = true; cont.querySelectorAll('.bar').forEach(o => o.classList.remove('activa')); };
    }
  }

  // ---------------- Exportar a Excel y PDF (F6) ----------------
  function abrirExportar(formato) {
    let periodo = 'mes';
    const nomMes = MESES[E.mes.getMonth()], anio = E.mes.getFullYear();
    const esExcel = formato === 'excel';
    abrirHoja(esExcel ? 'Descargar Excel' : 'Descargar PDF', (hoja, cerrar) => {
      function pintar() {
        hoja.innerHTML = `<div class="tirador"></div>
          <div class="titulo-formato"><span class="ico-formato ${formato}" aria-hidden="true">${esExcel ? 'XLS' : 'PDF'}</span>
            <div><h2>${esExcel ? 'Descargar en Excel' : 'Descargar en PDF'}</h2>
            <p class="orig">${esExcel ? 'Una hoja con tus movimientos y otra por categoría, para trabajarla a tu gusto.' : 'Un reporte listo para imprimir o guardar, con totales y categorías.'} De ${esc(espacioActual().nombre)}.</p></div></div>
          <div class="campo"><label>¿De qué periodo?</label><div class="tipo" role="group" aria-label="Periodo">
            <button type="button" data-per="mes" aria-pressed="${periodo === 'mes'}">${nomMes.replace(/^./, c => c.toUpperCase())} ${anio}</button>
            <button type="button" data-per="anio" aria-pressed="${periodo === 'anio'}">Todo ${anio}</button></div></div>
          <div id="x-msg" role="status" aria-live="polite"></div>
          <button type="button" class="btn" id="x-bajar">${esExcel ? 'Descargar Excel' : 'Abrir PDF para guardar o imprimir'}</button>`;
        hoja.querySelectorAll('[data-per]').forEach(b => b.onclick = () => { periodo = b.dataset.per; pintar(); });
        hoja.querySelector('#x-bajar').onclick = async ev => {
          ev.target.disabled = true; ev.target.textContent = 'Preparando…';
          const ventana = formato === 'pdf' ? window.open('', '_blank') : null; // en el mismo toque, para que no la bloqueen
          try {
            if (formato === 'pdf' && !ventana) throw new Error('Tu navegador bloqueó la ventana. Permite ventanas emergentes para MiPlata y vuelve a intentar.');
            if (ventana) ventana.document.write('<p style="font:16px Arial;margin:30px">Preparando tu PDF…</p>');
            const desde = periodo === 'mes' ? E.mes : new Date(anio, 0, 1);
            const hasta = periodo === 'mes' ? new Date(anio, E.mes.getMonth() + 1, 0) : new Date(anio, 11, 31);
            const movs = await movimientosRango(desde, hasta);
            if (!movs.length) throw new Error('No hay movimientos en ese periodo.');
            const titulo = periodo === 'mes' ? `${nomMes} ${anio}` : `año ${anio}`;
            if (formato === 'excel') await exportarExcel(movs, titulo); else exportarPdf(movs, titulo, ventana, { desde, hasta, periodo });
            cerrar(); if (formato === 'excel') toast('Excel descargado');
          } catch (e) {
            if (ventana) ventana.close();
            ev.target.disabled = false; pintar();
            hoja.querySelector('#x-msg').innerHTML = `<p class="mensaje error">${esc(errorEs(e))}</p>`;
          }
        };
      }
      pintar();
    });
  }

  async function movimientosRango(desde, hasta) {
    if (E.demo) return E.demoMovs.filter(m => m.espacio_id === E.espacio && m.fecha >= iso(desde) && m.fecha <= iso(hasta)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const filas = [];
    for (let desdeFila = 0; ; desdeFila += 1000) {
      const { data, error } = await sb.from('movimientos').select('*').eq('espacio_id', E.espacio).gte('fecha', iso(desde)).lte('fecha', iso(hasta))
        .order('fecha').order('creado_en').range(desdeFila, desdeFila + 999);
      if (error) throw error;
      filas.push(...data);
      if (data.length < 1000) break;
    }
    return filas;
  }

  function filasExport(movs) {
    return movs.map(m => ({
      Fecha: m.fecha.split('-').reverse().join('/'),
      Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      'Monto (S/)': Number(m.monto),
      Lugar: m.lugar || '',
      Categoría: (catPorId(m.categoria_id) || {}).nombre || 'Sin categoría',
      'Medio de pago': (medioPorId(m.medio_pago_id) || {}).nombre || '',
      Detalle: m.detalle || '',
      ...(esGrupo() ? { Registró: autorDe(m) } : {}),
      'Lo que dijiste': m.texto_original || ''
    }));
  }

  function resumenCategorias(movs) {
    const g = movs.filter(m => m.tipo === 'gasto'), tot = g.reduce((s, m) => s + Number(m.monto), 0);
    const mapa = new Map();
    g.forEach(m => { const k = (catPorId(m.categoria_id) || {}).nombre || 'Sin categoría'; mapa.set(k, (mapa.get(k) || 0) + Number(m.monto)); });
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ Categoría: k, 'Gasto (S/)': Math.round(v * 100) / 100, '%': tot ? Math.round(v / tot * 1000) / 10 : 0 }));
  }

  function cargarScript(src) {
    return new Promise((ok, mal) => { if ([...document.scripts].some(s => s.src.endsWith(src.replace('../', '')))) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar la librería')); document.head.appendChild(s); });
  }

  async function exportarExcel(movs, titulo) {
    await cargarScript('../lib/xlsx-0.18.5.full.min.js');
    const X = window.XLSX, libro = X.utils.book_new();
    const h1 = X.utils.json_to_sheet(filasExport(movs));
    h1['!cols'] = [{ wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 30 }, ...(esGrupo() ? [{ wch: 14 }] : []), { wch: 40 }];
    X.utils.book_append_sheet(libro, h1, 'Movimientos');
    X.utils.book_append_sheet(libro, X.utils.json_to_sheet(resumenCategorias(movs)), 'Por categoría');
    const nombre = `MiPlata - ${espacioActual().nombre} - ${titulo}.xlsx`.replace(/[\\/:*?"<>|]/g, '-');
    X.writeFile(libro, nombre);
  }

  // Reporte PDF: página HTML imprimible (A4) con gráficos SVG propios, sin librerías.
  function exportarPdf(movs, titulo, w, rango) {
    const gastos = movs.filter(m => m.tipo === 'gasto'), ingresos = movs.filter(m => m.tipo === 'ingreso');
    const g = gastos.reduce((s, m) => s + Number(m.monto), 0), i = ingresos.reduce((s, m) => s + Number(m.monto), 0);
    const espacio = espacioActual().nombre, Titulo = titulo.replace(/^./, c => c.toUpperCase());
    const porMes = !!rango && rango.periodo === 'anio';
    const pct = v => g ? Math.round(v / g * 1000) / 10 : 0;
    const S = n => 'S/ ' + soles(n);
    const GRIS = '#8a9690', SIN = '#b4c2ba', VERDE = '#1FAE6A';

    // por categoría (máx. 7 porciones + "Otras")
    const mapaCat = new Map();
    gastos.forEach(m => {
      const c = catPorId(m.categoria_id), k = c ? c.id : 'sin';
      const x = mapaCat.get(k) || { nombre: c ? c.nombre : 'Sin categoría', color: c && c.color ? c.color.toLowerCase() : SIN, total: 0 };
      x.total += Number(m.monto); mapaCat.set(k, x);
    });
    let cats = [...mapaCat.values()].sort((a, b) => b.total - a.total);
    if (cats.length > 8) {
      const resto = cats.slice(7);
      cats = [...cats.slice(0, 7), { nombre: 'Otras (' + resto.length + ')', color: GRIS, total: resto.reduce((s, c) => s + c.total, 0) }];
    }

    const agrupar = (lista, clave) => {
      const mp = new Map();
      lista.forEach(m => { const k = clave(m); if (!k) return; mp.set(k, (mp.get(k) || 0) + Number(m.monto)); });
      return [...mp.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
    };
    const medios = agrupar(gastos, m => (medioPorId(m.medio_pago_id) || {}).nombre || 'Sin medio');
    const lugares = agrupar(gastos, m => (m.lugar || '').trim()).slice(0, 6);
    const autores = esGrupo() ? agrupar(gastos, m => autorDe(m)) : [];

    // en el tiempo: por día (mes) o por mes (año)
    let tiempo;
    const hoy = new Date();
    let unidades;
    if (porMes) {
      tiempo = MESES.map((n, k) => ({ etq: n.slice(0, 3), largo: n, total: 0, k }));
      gastos.forEach(m => { tiempo[Number(m.fecha.slice(5, 7)) - 1].total += Number(m.monto); });
      unidades = rango.desde.getFullYear() === hoy.getFullYear() ? hoy.getMonth() + 1 : 12;
    } else {
      const ref = rango ? rango.desde : new Date(movs[0].fecha + 'T12:00:00');
      const dias = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      tiempo = Array.from({ length: dias }, (_, k) => ({ etq: String(k + 1), largo: (k + 1) + ' de ' + MESES[ref.getMonth()], total: 0, k }));
      gastos.forEach(m => { tiempo[Number(m.fecha.slice(8, 10)) - 1].total += Number(m.monto); });
      unidades = ref.getFullYear() === hoy.getFullYear() && ref.getMonth() === hoy.getMonth() ? hoy.getDate() : dias;
    }
    const pico = tiempo.reduce((a, b) => (b.total > a.total ? b : a), tiempo[0]);
    const conGasto = tiempo.filter(t => t.total > 0).length;
    const promedio = g / Math.max(1, unidades);

    const top = cats[0], seg = cats[1], balance = i - g;
    const frase = !g ? 'No registraste gastos en este periodo.'
      : `Tu mayor gasto fue <b>${esc(top.nombre)}</b>: ${S(top.total)}, el ${pct(top.total)}% del total.` +
        (seg ? ` Le sigue <b>${esc(seg.nombre)}</b> con ${pct(seg.total)}%.` : '');

    function dona() {
      if (!g) return '<p class="vacio">Sin gastos en este periodo.</p>';
      const R = 84, r = 56, cx = 95, cy = 95;
      let a0 = -Math.PI / 2, partes = '';
      const pt = (a, rad) => (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2);
      cats.forEach(c => {
        const frac = c.total / g;
        if (frac >= 0.9999) { partes += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${c.color}" stroke-width="${R - r}"/>`; return; }
        const a1 = a0 + frac * Math.PI * 2, largo = frac > 0.5 ? 1 : 0;
        partes += `<path d="M ${pt(a0, R)} A ${R} ${R} 0 ${largo} 1 ${pt(a1, R)} L ${pt(a1, r)} A ${r} ${r} 0 ${largo} 0 ${pt(a0, r)} Z" fill="${c.color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
        a0 = a1;
      });
      return `<svg class="dona" viewBox="0 0 190 190" role="img" aria-label="Gastos por categoría">${partes}
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="d-et">Gastaste</text>
        <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="d-num">${S(g)}</text></svg>`;
    }
    const leyenda = cats.map(c => `<tr><td class="nom"><i style="background:${c.color}"></i>${esc(c.nombre)}</td>
      <td class="barra-c"><span style="width:${Math.max(2, c.total / cats[0].total * 100)}%;background:${c.color}"></span></td>
      <td class="n">${S(c.total)}</td><td class="n pc">${pct(c.total)}%</td></tr>`).join('');

    function paso(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
    function columnas() {
      const W = 680, H = 180, izq = 44, abajo = 22, arriba = 22, n = tiempo.length;
      const max = Math.max(...tiempo.map(t => t.total)), st = paso(max / 3), tope = Math.ceil(max / st) * st || 1;
      const ancho = (W - izq) / n, bw = Math.max(3, Math.min(porMes ? 30 : 14, ancho - 4));
      const y = v => arriba + (H - arriba - abajo) * (1 - v / tope);
      let s = '';
      for (let v = 0; v <= tope + 1e-9; v += st) s += `<line x1="${izq}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${izq - 6}" y="${y(v) + 3}" text-anchor="end" class="ax">${v.toLocaleString('es-PE')}</text>`;
      if (promedio > 0 && !porMes) s += `<line x1="${izq}" x2="${W}" y1="${y(promedio)}" y2="${y(promedio)}" class="prom"/><text x="${W}" y="${y(promedio) - 4}" text-anchor="end" class="ax prom-t">promedio ${S(promedio)} al día</text>`;
      tiempo.forEach((t, k) => {
        const x = izq + ancho * k + (ancho - bw) / 2;
        if (t.total > 0) {
          const yy = y(t.total), h = Math.max(1.5, H - abajo - yy), rr = Math.min(4, bw / 2, h);
          s += `<path d="M${x} ${H - abajo} V${yy + rr} Q${x} ${yy} ${x + rr} ${yy} H${x + bw - rr} Q${x + bw} ${yy} ${x + bw} ${yy + rr} V${H - abajo} Z" fill="${t === pico ? '#0F6B45' : VERDE}"><title>${esc(t.largo)}: ${S(t.total)}</title></path>`;
        }
        if (porMes || t === pico || ((k === 0 || (k + 1) % 5 === 0) && Math.abs(k - pico.k) > 1)) s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="ax${t === pico ? ' fuerte' : ''}">${t.etq}</text>`;
      });
      const px = izq + ancho * pico.k + ancho / 2;
      s += `<text x="${Math.min(W - 30, Math.max(izq + 30, px))}" y="${y(pico.total) - 6}" text-anchor="middle" class="ax fuerte">${S(pico.total)}</text>`;
      return `<svg class="cols" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gastos ${porMes ? 'por mes' : 'por día'}">${s}<line x1="${izq}" x2="${W}" y1="${H - abajo}" y2="${H - abajo}" class="base"/></svg>`;
    }

    const barras = (lista, color) => !lista.length ? '<p class="vacio">Sin datos.</p>' : `<table class="barras">${lista.map(x => `<tr><td class="nom">${esc(x.nombre)}</td>
      <td class="barra-c"><span style="width:${Math.max(2, x.total / lista[0].total * 100)}%;background:${color}"></span></td><td class="n">${S(x.total)}</td><td class="n pc">${pct(x.total)}%</td></tr>`).join('')}</table>`;

    const filas = movs.map(m => {
      const c = catPorId(m.categoria_id), ing = m.tipo === 'ingreso';
      return `<tr class="${ing ? 'ing' : ''}"><td class="fecha">${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)}</td>
        <td><b>${esc(m.lugar || (ing ? 'Ingreso' : 'Gasto'))}</b>${m.detalle ? `<small>${esc(m.detalle)}</small>` : ''}</td>
        <td>${ing ? '<span class="tag-ing">Ingreso</span>' : `<i style="background:${c && c.color ? c.color : SIN}"></i>${esc(c ? c.nombre : 'Sin categoría')}`}</td>
        <td>${esc((medioPorId(m.medio_pago_id) || {}).nombre || '')}</td>
        ${esGrupo() ? `<td>${esc(autorDe(m))}</td>` : ''}
        <td class="n monto">${ing ? '+' : ''}${soles(m.monto)}</td></tr>`;
    }).join('');

    const logoSvg = LOGO_SVG.replace('<svg ', '<svg width="38" height="38" ');
    w.document.open();
    w.document.write(`<!doctype html><html lang="es-PE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>MiPlata - ${esc(espacio)} - ${esc(Titulo)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
      <style>
        :root{--tinta:#0A3324;--suave:#557566;--linea:#DCEAE1;--fondo:#F1F7F3}
        *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        html{background:#E4ECE7}
        body{margin:0;font:12px/1.5 "Plus Jakarta Sans",Arial,sans-serif;color:var(--tinta)}
        .barra-imp{position:sticky;top:0;z-index:2;display:flex;gap:14px;align-items:center;justify-content:center;padding:10px;background:#0A3324;color:#fff;font:500 13px "Plus Jakarta Sans",Arial}
        .barra-imp button{font:700 13px "Plus Jakarta Sans",Arial;background:#3DD68C;color:#0A3324;border:0;border-radius:999px;padding:9px 18px;cursor:pointer}
        .hoja{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding-bottom:12mm;box-shadow:0 6px 30px rgba(10,51,36,.18)}
        .cab{background:#0A3324;color:#fff;padding:20px 14mm 22px;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}
        .cab::after{content:"";position:absolute;right:-70px;top:-90px;width:250px;height:250px;border-radius:50%;background:#0F4A33}
        .marca{display:flex;align-items:center;gap:10px;position:relative;z-index:1}
        .marca b{font:800 25px Poppins,Arial;letter-spacing:-.01em}.marca b span{color:#3DD68C}
        .cab-der{text-align:right;position:relative;z-index:1}
        .cab-der small{display:block;color:#9FD9BC;font-size:11px}
        .cab-der h1{margin:0;font:700 18px/1.25 Poppins,Arial}
        .cab-der p{margin:0;color:#CFE9DC}
        .cuerpo{padding:0 14mm}
        .heroe{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;align-items:center;margin:22px 0 4px}
        .heroe .et{color:var(--suave);margin:0}
        .heroe .grande{font:800 40px/1.05 Poppins,Arial;margin:2px 0 8px;letter-spacing:-.02em}
        .heroe .frase{margin:0;font-size:13px;max-width:46ch}
        .kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .kpi{background:var(--fondo);border-radius:12px;padding:9px 12px}
        .kpi small{display:block;color:var(--suave);font-size:10.5px}
        .kpi b{font:700 15px Poppins,Arial}
        .kpi.pos b{color:#0F7A4A}.kpi.neg b{color:#C8343A}
        h2{font:700 14px Poppins,Arial;margin:24px 0 10px;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
        h2 small{font:500 11px "Plus Jakarta Sans",Arial;color:var(--suave)}
        .bloque{break-inside:avoid;page-break-inside:avoid}
        .cats{display:grid;grid-template-columns:190px 1fr;gap:22px;align-items:center}
        .dona{width:190px;height:190px;display:block}
        .d-et{font:500 11px "Plus Jakarta Sans",Arial;fill:#557566}.d-num{font:800 17px Poppins,Arial;fill:#0A3324}
        table{width:100%;border-collapse:collapse}
        .ley td,.barras td{padding:5px 4px;border-bottom:1px solid var(--linea);vertical-align:middle}
        .nom{white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis}
        i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px;vertical-align:-1px}
        .barra-c{width:36%}.barra-c span{display:block;height:8px;border-radius:0 4px 4px 0}
        .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.pc{color:var(--suave);width:46px}
        .cols{width:100%;height:auto;display:block}
        .grid{stroke:#E6EFEA;stroke-width:1}.base{stroke:#9DB5A8;stroke-width:1}
        .prom{stroke:#C98500;stroke-width:1.2;stroke-dasharray:4 3}.prom-t{fill:#8A5B00}
        .ax{font:500 9.5px "Plus Jakarta Sans",Arial;fill:#6B8579}.ax.fuerte{fill:#0A3324;font-weight:700}
        .nota{color:var(--suave);font-size:11px;margin:6px 0 0}.nota b{color:var(--tinta)}
        .dos{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        .dos .barra-c{width:30%}
        .vacio{color:var(--suave)}
        .movs th{font:700 10.5px "Plus Jakarta Sans",Arial;color:var(--suave);text-align:left;padding:6px 4px;border-bottom:1.5px solid var(--tinta)}
        .movs th.n{text-align:right}
        .movs td{padding:6px 4px;border-bottom:1px solid var(--linea);vertical-align:top}
        .movs td small{display:block;color:var(--suave);font-size:10.5px}
        .movs .fecha{color:var(--suave);white-space:nowrap;width:44px}
        .movs .monto{font-weight:700}
        .movs tr.ing .monto{color:#0F7A4A}
        .tag-ing{font-size:10.5px;font-weight:700;color:#0F7A4A;background:#E3F6EC;border-radius:999px;padding:1px 8px}
        .movs tfoot td{font-weight:700;border-bottom:0;border-top:1.5px solid var(--tinta)}
        thead{display:table-header-group}tr{break-inside:avoid}
        .pie{margin:20px 14mm 0;padding-top:10px;border-top:1px solid var(--linea);color:var(--suave);font-size:10px;display:flex;justify-content:space-between}
        @page{size:A4;margin:12mm 0}@page :first{margin-top:0}
        @media print{html{background:#fff}.barra-imp{display:none}.hoja{margin:0;box-shadow:none;width:auto;min-height:0}}
        @media screen and (max-width:820px){.hoja{width:auto;margin:0;min-height:0}.heroe,.cats,.dos{grid-template-columns:1fr}}
      </style></head><body>
      <div class="barra-imp"><span>En la ventana de impresión elige <b>Guardar como PDF</b>.</span><button type="button" onclick="print()">Guardar o imprimir</button></div>
      <div class="hoja">
        <header class="cab"><div class="marca">${logoSvg}<b>Mi<span>Plata</span></b></div>
          <div class="cab-der"><small>Reporte de gastos e ingresos</small><h1>${esc(espacio)}</h1><p>${esc(Titulo)}</p></div></header>
        <div class="cuerpo">
          <section class="heroe">
            <div><p class="et">${porMes ? 'En el ' : 'En '}${esc(titulo)} gastaste</p><p class="grande">${S(g)}</p><p class="frase">${frase}</p></div>
            <div class="kpis">
              <div class="kpi"><small>Te entró</small><b>${S(i)}</b></div>
              <div class="kpi ${balance >= 0 ? 'pos' : 'neg'}"><small>${balance >= 0 ? 'Te quedó' : 'Gastaste de más'}</small><b>${S(Math.abs(balance))}</b></div>
              <div class="kpi"><small>Promedio ${porMes ? 'por mes' : 'por día'}</small><b>${S(promedio)}</b></div>
              <div class="kpi"><small>Movimientos</small><b>${movs.length}</b></div>
            </div>
          </section>
          ${g ? `<section class="bloque"><h2>¿En qué se fue tu plata? <small>${mapaCat.size} ${mapaCat.size === 1 ? 'categoría' : 'categorías'}</small></h2>
            <div class="cats">${dona()}<table class="ley">${leyenda}</table></div></section>
          <section class="bloque"><h2>¿Cuándo gastaste? <small>${porMes ? 'por mes' : 'por día'}</small></h2>${columnas()}
            <p class="nota">${porMes ? 'El mes' : 'El día'} con más gasto fue <b>${esc(pico.largo)}</b> (${S(pico.total)}). Gastaste en ${conGasto} de ${tiempo.length} ${porMes ? 'meses' : 'días'}.</p></section>
          <section class="bloque dos"><div><h2>¿Con qué pagaste?</h2>${barras(medios, '#2a78d6')}</div>
            <div><h2>¿Dónde gastaste más?</h2>${barras(lugares, '#eb6834')}</div></section>
          ${autores.length > 1 ? `<section class="bloque"><h2>¿Quién gastó?</h2>${barras(autores, '#6250d6')}</section>` : ''}` : ''}
          <section><h2>Todos los movimientos <small>${movs.length} en total</small></h2>
            <table class="movs"><thead><tr><th>Fecha</th><th>Lugar</th><th>Categoría</th><th>Pago</th>${esGrupo() ? '<th>Registró</th>' : ''}<th class="n">S/</th></tr></thead>
            <tbody>${filas}</tbody>
            <tfoot><tr><td colspan="${esGrupo() ? 5 : 4}">Total de gastos${i ? ' e ingresos' : ''}</td><td class="n">${soles(g)}${i ? `<br><span style="color:#0F7A4A">+${soles(i)}</span>` : ''}</td></tr></tfoot></table></section>
        </div>
        <footer class="pie"><span>Generado con MiPlata el ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span>cuantics.pe/miplata</span></footer>
      </div>
      ${E.demo ? '' : '<script>window.onload=()=>(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(()=>window.print(),250))<\/script>'}</body></html>`);
    w.document.close();
  }

  // ---------------- Cuenta ----------------
  function vistaCuenta() {
    const p = E.perfil, hasta = accesoHasta();
    const estado = pagado() ? 'Activa hasta el ' + fechaLarga(p.pagado_hasta)
      : tieneAcceso() ? 'Prueba gratis hasta el ' + fechaLarga(hasta) + ' (' + diasRestantes() + (diasRestantes() === 1 ? ' día)' : ' días)')
      : 'Tu prueba terminó el ' + fechaLarga(hasta);
    const tema = (() => { try { return localStorage.getItem('miplata.tema') || p.tema || 'auto'; } catch (e) { return p.tema || 'auto'; } })();
    const pend = E.pagoActual && E.pagoActual.estado === 'pendiente';
    document.getElementById('contenido').innerHTML = `${cabecera()}<section class="seccion">
      <h1>${esc(p.nombre)}</h1>
      <div class="tarjeta"><div class="dato"><span>Correo</span>${esc(p.correo || '')}</div>
      ${p.telefono ? `<div class="dato"><span>Celular</span>${esc(p.telefono)}</div>` : ''}
      <div class="dato"><span>Tu cuenta</span><b style="text-align:right">${esc(estado)}</b></div></div>
      ${C.FLAGS.pagos ? (pend
        ? `<p class="aviso-fijo revision">${IC.sobre}<span>${textoRevision()}</span></p>`
        : pagado() ? (diasRestantes() <= 30
          ? `<button type="button" class="tarjeta-activar" data-ir="activar">
            <span><b>Renueva tu MiPlata</b><small>Tu cuenta vence el ${fechaLarga(p.pagado_hasta)}. Renueva y sumas 12 meses, sin perder días.</small></span><span class="btn mini">Renovar</span></button>`
          : `<button type="button" class="enlace centro" data-ir="activar">Renovar por adelantado</button>`)
        : `<button type="button" class="tarjeta-activar" data-ir="activar">
            <span><b>Sigue anotando por S/ 5 al mes</b><small>Un solo pago al año de S/ 60. Precio de lanzamiento.</small></span><span class="btn mini">Activar</span></button>`) : ''}
      ${instalada() ? '' : `<button type="button" class="tarjeta-accion" id="instalar">
        <span class="ico-esp">${svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7v7M9 11l3 3 3-3"/>')}</span>
        <span><b>Agregar MiPlata a tu pantalla de inicio</b><small>Ábrela como una app, con un toque.</small></span></button>`}
      ${p.es_admin && C.FLAGS.admin ? `<button type="button" class="btn sec" data-ir="admin">Panel de administración</button>` : ''}
      <div class="campo"><label>Apariencia</label>
        <div class="tipo" style="grid-template-columns:1fr 1fr 1fr" role="group" aria-label="Apariencia">
          ${['auto', 'claro', 'oscuro'].map(t => `<button type="button" data-tema="${t}" aria-pressed="${tema === t}">${{ auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }[t]}</button>`).join('')}
        </div><small>Automático sigue la configuración de tu celular.</small></div>
      <button type="button" class="btn sec" id="salir">Cerrar sesión</button>
      <a class="enlace centro" href="../">Ver la página de MiPlata: precios y preguntas</a>
    </section>`;
    conectarCabecera();
    document.querySelectorAll('#contenido [data-ir]').forEach(b => b.onclick = () => irA(b.dataset.ir));
    document.querySelectorAll('[data-tema]').forEach(b => b.onclick = async () => {
      aplicarTema(b.dataset.tema); E.perfil.tema = b.dataset.tema; vistaCuenta();
      if (!E.demo) await sb.from('perfiles').update({ tema: b.dataset.tema }).eq('id', p.id);
    });
    document.getElementById('salir').onclick = async () => { if (E.demo) return; await sb.auth.signOut(); };
    document.getElementById('instalar')?.addEventListener('click', instalarApp);
  }

  // ---------------- Instalar en la pantalla de inicio (F10) ----------------
  function instalada() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  async function instalarApp() {
    const aviso = window.__instalarMiPlata;
    if (aviso) {
      aviso.prompt();
      const r = await aviso.userChoice.catch(() => ({}));
      window.__instalarMiPlata = null;
      if (r.outcome === 'accepted') { toast('Listo: MiPlata está en tu pantalla de inicio'); vistaCuenta(); }
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    abrirHoja('Agregar a la pantalla de inicio', (hoja) => {
      hoja.innerHTML = `<div class="tirador"></div><h2>Agrégala a tu pantalla de inicio</h2>
        <ol class="pasos-instalar">${ios
          ? `<li>Abre MiPlata en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li><li>Elige <b>Agregar a inicio</b> y luego <b>Agregar</b>.</li>`
          : `<li>Toca el menú del navegador (los <b>tres puntos</b>).</li><li>Elige <b>Instalar app</b> o <b>Agregar a la pantalla de inicio</b>.</li><li>Confirma con <b>Instalar</b>.</li>`}</ol>
        <p class="nota">Después la abres desde el ícono de MiPlata, como cualquier app.</p>`;
    });
  }

  // ---------------- Activar MiPlata (pago con Plin) ----------------
  async function vistaActivar() {
    const $c = document.getElementById('contenido');
    $c.innerHTML = '<div class="cargando">Cargando…</div>';
    let precio = { monto: 60, es_fundador: true };
    if (!E.demo) { const r = await sb.rpc('precio_para_mi'); if (r.data && r.data[0]) precio = r.data[0]; }
    const mes = Math.round(precio.monto / 12);
    const pend = E.pagoActual && E.pagoActual.estado === 'pendiente';
    const rech = E.pagoActual && E.pagoActual.estado === 'rechazado';
    if (pend) return pintarEnviado($c, E.pagoActual.monto);
    // quien ya pagó está renovando: se le habla de renovación, no como cliente nuevo
    const renueva = pagado();
    let modo = 'numero', foto = null;
    $c.innerHTML = `
      <div class="barra-sup"><button type="button" class="flecha" data-ir="cuenta" aria-label="Volver">${svg('<path d="M15 5l-7 7 7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>${logo(34, 22)}</div>
      <section class="seccion activar">
        <div class="activar-heroe">
          ${renueva ? `<h1>Renueva tu MiPlata</h1>
          <p>Tu cuenta está activa hasta el <b>${fechaLarga(E.perfil.pagado_hasta)}</b>. Si renuevas ahora, sumamos <b>12 meses desde esa fecha</b>: no pierdes ningún día.</p>
          <p>La renovación es de <b>S/ ${soles(precio.monto)} al año</b> (S/ ${mes} al mes).</p>
          <ul class="beneficios-mini">
            <li>${IC.check}Sigues con tus movimientos, grupos y categorías</li>
            <li>${IC.check}Sin cobros automáticos: renuevas solo si quieres</li>
            <li>${IC.check}Tus datos siempre son tuyos</li>
          </ul>` : `<h1>Sigue anotando por <span class="cifra">S/ ${mes}</span> al mes</h1>
          <p>Un solo pago al año de <b>S/ ${soles(precio.monto)}</b>${precio.es_fundador ? ', con precio de lanzamiento' : ''}. Úsala sola, en familia o con tu empresa.</p>
          <ul class="beneficios-mini">
            <li>${IC.check}Anota hablando o escribiendo, en segundos</li>
            <li>${IC.check}Grupos de familia o empresa</li>
            <li>${IC.check}Tus datos siempre son tuyos</li>
          </ul>`}
        </div>
        ${rech ? `<p class="mensaje error">Tu último comprobante no pudo validarse${E.pagoActual.nota ? ': ' + esc(E.pagoActual.nota) : ''}. Revisa los datos y vuelve a enviarlo.</p>` : ''}
        <ol class="pasos-pago">
          <li>
            <h2>Paga con el QR</h2>
            <div class="comprobante">
              <img src="../img/qr-plin-codigo.png" alt="Código QR de Plin para pagar a Jonathan Ortiz" class="qr">
              <div class="comp-datos">
                <p class="comp-monto"><small>Monto exacto</small><b class="cifra">S/ ${soles(precio.monto)}</b></p>
                <p class="comp-ref"><small>Escribe en el mensaje del pago</small><b>${MENSAJE_PAGO}</b>
                  <button type="button" class="copiar" id="p-copiar" aria-label="Copiar ${MENSAJE_PAGO}">${IC.copiar}</button></p>
              </div>
            </div>
            <a class="btn sec" href="../img/qr-plin.jpg" download="MiPlata-QR-Plin.jpg">${svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>')}Guardar QR en mi celular</a>
            <p class="nota">Escanéalo con Plin, Yape o la app de tu banco. ¿Estás en el celular? Guarda el QR y ábrelo en tu app con "Pagar desde galería". El pago le llega a Jonathan Ortiz (MiPlata).</p>
          </li>
          <li>
            <h2>Envía tu comprobante</h2>
            <div class="tipo" role="group" aria-label="Cómo enviarlo">
              <button type="button" data-modo="numero" aria-pressed="true">Número de operación</button>
              <button type="button" data-modo="foto" aria-pressed="false">Foto del comprobante</button>
            </div>
            <div id="p-numero" class="campo"><label for="p-nro">Número de operación</label>
              <input class="entrada cifra" id="p-nro" inputmode="numeric" maxlength="40" placeholder="Ej.: 12345678" autocomplete="off">
              <small>Lo ves en la constancia de pago de tu app.</small></div>
            <div id="p-foto" class="campo" hidden>
              <label class="subir-foto" for="p-archivo">${IC.camara}<span id="p-foto-txt">Tomar o elegir la foto de la constancia</span></label>
              <input type="file" id="p-archivo" accept="image/*" hidden>
              <img id="p-vista" alt="Vista previa del comprobante" hidden></div>
            <div id="p-msg" role="status" aria-live="polite"></div>
            <button type="button" class="btn" id="p-enviar">${renueva ? 'Enviar comprobante de renovación' : 'Enviar comprobante'}</button>
            <p class="nota centro">Revisamos tu comprobante y te avisamos a tu correo, <b>${esc(E.perfil.correo)}</b>, cuando tu cuenta esté habilitada.</p>
          </li>
        </ol>
      </section>`;
    $c.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => irA(b.dataset.ir));
    $c.querySelector('#p-copiar').onclick = async () => { try { await navigator.clipboard.writeText(MENSAJE_PAGO); toast('Copiado: ' + MENSAJE_PAGO); } catch (e) {} };
    $c.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
      modo = b.dataset.modo;
      $c.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-pressed', x === b));
      $c.querySelector('#p-foto').hidden = modo !== 'foto';
      $c.querySelector('#p-numero label').textContent = modo === 'foto' ? 'Número de operación (opcional)' : 'Número de operación';
      if (modo === 'foto') $c.querySelector('#p-foto').after($c.querySelector('#p-numero'));
      else $c.querySelector('#p-foto').before($c.querySelector('#p-numero'));
    });
    // el botón se ve apagado hasta que haya número de operación o foto (sigue tocable para explicar qué falta)
    const listoPago = () => {
      const hay = ($c.querySelector('#p-nro').value || '').trim().length >= 3 || !!foto;
      const b = $c.querySelector('#p-enviar'); b.classList.toggle('apagado', !hay); b.setAttribute('aria-disabled', String(!hay));
    };
    $c.querySelector('#p-nro').addEventListener('input', listoPago); listoPago();
    $c.querySelector('#p-archivo').onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      try {
        foto = await comprimirImagen(f, 1600, 0.82);
        const v = $c.querySelector('#p-vista'); v.src = URL.createObjectURL(foto); v.hidden = false;
        $c.querySelector('#p-foto-txt').textContent = 'Cambiar foto'; listoPago();
      } catch (e) { $c.querySelector('#p-msg').innerHTML = '<p class="mensaje error">No pude leer esa imagen. Prueba con otra foto.</p>'; }
    };
    $c.querySelector('#p-enviar').onclick = async ev => {
      const msg = t => { $c.querySelector('#p-msg').innerHTML = t ? `<p class="mensaje error">${esc(t)}</p>` : ''; };
      const nro = ($c.querySelector('#p-nro').value || '').trim();
      if (!nro && !foto) { $c.querySelector(modo === 'foto' ? '.subir-foto' : '#p-nro').focus?.(); return msg('Para enviar, escribe el número de operación o sube la foto de la constancia.'); }
      if (nro && nro.replace(/[^0-9A-Za-z]/g, '').length < 3) return msg('El número de operación parece muy corto.');
      ev.target.disabled = true; ev.target.textContent = 'Enviando…'; msg('');
      try {
        let ruta = null;
        if (foto && !E.demo) {
          ruta = E.sesion.user.id + '/' + Date.now() + '.jpg';
          const up = await sb.storage.from('pagos').upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
          if (up.error) throw up.error;
        }
        if (!E.demo) {
          const { data, error } = await sb.rpc('registrar_pago', { p_nro_operacion: nro || null, p_captura_path: ruta });
          if (error) throw error;
          await cargarPagoActual();
          pintarEnviado($c, data.monto);
        } else pintarEnviado($c, precio.monto);
      } catch (e) { ev.target.disabled = false; ev.target.textContent = 'Enviar comprobante'; msg(errorEs(e)); }
    };
  }

  function pintarEnviado($c, monto) {
    $c.innerHTML = `
      <div class="barra-sup">${logo(34, 22)}</div>
      <section class="seccion enviado">
        <div class="sobre-grande" aria-hidden="true">${IC.sobre}</div>
        <h1>¡Recibido!</h1>
        <p>${pagado() ? `Estamos revisando tu renovación de <b>S/ ${soles(monto)}</b>. Cuando la confirmemos te llegará un correo a <b>${esc(E.perfil.correo)}</b>, y tu cuenta sumará 12 meses más.` : `Estamos revisando tu pago de <b>S/ ${soles(monto)}</b>. Cuando tu cuenta esté habilitada te llegará un correo a <b>${esc(E.perfil.correo)}</b>.`}</p>
        <p class="nota">Suele tomar poco tiempo. Mientras tanto puedes seguir usando MiPlata${tieneAcceso() ? '' : ' para ver y exportar tus datos'}.</p>
        <button type="button" class="btn" data-ir="movimientos">Volver a mis movimientos</button>
      </section>`;
    $c.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => irA(b.dataset.ir));
  }

  function comprimirImagen(archivo, maxLado, calidad) {
    return new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxLado / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(b => b ? ok(b) : mal(new Error('imagen')), 'image/jpeg', calidad);
      };
      img.onerror = mal;
      img.src = URL.createObjectURL(archivo);
    });
  }

  // ---------------- Panel Admin ----------------
  async function vistaAdmin() {
    const $c = document.getElementById('contenido');
    if (!E.perfil.es_admin) return irA('cuenta');
    $c.innerHTML = '<div class="cargando">Cargando panel…</div>';
    const [k, p] = await Promise.all([sb.rpc('kpis_admin'), sb.rpc('pagos_pendientes')]);
    const K = k.data || {}, pend = p.data || [];
    const fotos = {};
    await Promise.all(pend.filter(x => x.captura_path).map(async x => {
      const r = await sb.storage.from('pagos').createSignedUrl(x.captura_path, 600); fotos[x.id] = r.data && r.data.signedUrl;
    }));
    const kpi = (n, t) => `<div class="kpi"><b class="cifra">${n}</b><small>${t}</small></div>`;
    $c.innerHTML = `
      <div class="barra-sup"><button type="button" class="flecha" data-ir="cuenta" aria-label="Volver">${svg('<path d="M15 5l-7 7 7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>${logo(34, 22)}</div>
      <section class="seccion">
        <h1>Administración</h1>
        <div class="kpis-admin">
          ${kpi(K.pagos_pendientes ?? 0, 'pagos por revisar')}${kpi(K.suscriptores ?? 0, 'cuentas activas')}
          ${kpi(K.en_prueba ?? 0, 'en prueba')}${kpi('S/ ' + soles(K.ingresos_mes), 'ingresos del mes')}
          ${kpi((K.lanzamiento_usados ?? 0) + ' / ' + (K.cupo_lanzamiento ?? 0), 'cupos de lanzamiento')}${kpi(K.grupos ?? 0, 'grupos')}
          ${kpi((K.conversion_pct ?? 0) + '%', 'de prueba a pago')}${kpi(K.correos_con_error ?? 0, 'correos con error')}
        </div>
        <h2>Pagos por revisar</h2>
        <p class="nota">Antes de aprobar, verifica en tu app de Plin que entró el pago con ese monto y número de operación.</p>
        ${pend.length ? pend.map(x => `<div class="pago-admin" data-pago="${x.id}">
          <div class="pa-cab"><b>${esc(x.nombre)}</b><span class="cifra">S/ ${soles(x.monto)}</span></div>
          <p class="det">${esc(x.correo)}, ${new Date(x.creado_en).toLocaleString('es-PE')}</p>
          <p>Operación: <b class="cifra">${esc(x.nro_operacion || 'no la escribió')}</b></p>
          ${fotos[x.id] ? `<a href="${fotos[x.id]}" target="_blank" rel="noopener"><img src="${fotos[x.id]}" alt="Comprobante de ${esc(x.nombre)}" class="pa-foto"></a>` : ''}
          <div class="dos"><button type="button" class="btn" data-aprobar="${x.id}">Aprobar y habilitar</button><button type="button" class="btn peligro" data-rechazar="${x.id}">Rechazar</button></div>
        </div>`).join('') : '<p class="vacio"><b>No hay pagos por revisar</b>Cuando alguien envíe su comprobante, te llegará un correo y aparecerá aquí.</p>'}
      </section>`;
    $c.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => irA(b.dataset.ir));
    $c.querySelectorAll('[data-aprobar]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb.rpc('aprobar_pago', { p_pago: b.dataset.aprobar });
      if (error) { b.disabled = false; return toast(esc(errorEs(error)), null, true); }
      toast('Pago aprobado. Le enviamos el correo de cuenta habilitada.'); vistaAdmin();
    });
    $c.querySelectorAll('[data-rechazar]').forEach(b => b.onclick = () => abrirHoja('Rechazar pago', (hoja, cerrar) => {
      hoja.innerHTML = `<div class="tirador"></div><h2>Rechazar pago</h2>
        <div class="campo"><label for="rz-nota">Motivo (le llega por correo)</label><input class="entrada" id="rz-nota" maxlength="200" placeholder="Ej.: no encontramos ese número de operación"></div>
        <button type="button" class="btn peligro" id="rz-si">Rechazar y avisarle</button>`;
      hoja.querySelector('#rz-si').onclick = async () => {
        const { error } = await sb.rpc('rechazar_pago', { p_pago: b.dataset.rechazar, p_nota: hoja.querySelector('#rz-nota').value.trim() || null });
        if (error) return toast(esc(errorEs(error)), null, true);
        cerrar(); toast('Pago rechazado. Le avisamos por correo.'); vistaAdmin();
      };
    }));
  }

  // ---------------- Modo demo (solo localhost, ?demo) ----------------
  function demo() {
    E.demo = true;
    const hoy = new Date(), d = n => iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n));
    const uid = 'u-yo';
    E.sesion = { user: { id: uid } };
    E.perfil = { id: uid, nombre: 'Cliente de prueba', correo: 'demo@miplata.test', prueba_hasta: new Date(Date.now() + 5 * 864e5).toISOString(), pagado_hasta: null, tema: null, es_admin: true, codigo_pago: 'MP-48213' };
    E.espacios = [
      { id: 'e-pers', nombre: 'Personal', tipo: 'personal', rol: 'admin', miembros: 1 },
      { id: 'e-fam', nombre: 'Familia Quispe', tipo: 'familia', rol: 'admin', miembros: 3 },
      { id: 'e-emp', nombre: 'Piedras SAC - CC 12', tipo: 'empresa', rol: 'miembro', miembros: 6 }
    ];
    const catsBase = [['Mercado y alimentos', 'mercado', '#1baf7a'], ['Restaurantes y comida', 'restaurantes', '#eda100'], ['Transporte', 'transporte', '#2a78d6'], ['Hogar y servicios', 'hogar', '#008300'], ['Salud y farmacia', 'salud', '#e87ba4'], ['Otros', 'otros', '#8a9690']];
    const porEsp = {};
    E.espacios.forEach(e => {
      porEsp[e.id] = {
        categorias: catsBase.map(([n, k, c], i) => ({ id: e.id + '-c' + i, espacio_id: e.id, nombre: n, clave: k, color: c, tipo: 'gasto', archivada: false, orden: i }))
          .concat([{ id: e.id + '-ci', espacio_id: e.id, nombre: 'Sueldo', clave: 'sueldo', color: '#2A63B8', tipo: 'ingreso', archivada: false, orden: 1 }]),
        medios: e.tipo === 'empresa' ? [{ id: e.id + '-m0', nombre: 'Caja chica', tipo_base: 'efectivo' }, { id: e.id + '-m1', nombre: 'Tarjeta empresa', tipo_base: 'credito' }]
          : [{ id: e.id + '-m0', nombre: 'Efectivo', tipo_base: 'efectivo' }, { id: e.id + '-m1', nombre: 'Yape', tipo_base: 'billetera' }, { id: e.id + '-m2', nombre: 'BCP débito', tipo_base: 'debito' }],
        miembros: e.tipo === 'personal' ? [] : [
          { usuario_id: uid, nombre: 'Cliente de prueba', correo: 'demo@miplata.test', rol: e.rol, estado: 'activo', con_acceso: true },
          { usuario_id: 'u-rosa', nombre: 'Rosa Quispe', correo: 'rosa@correo.com', rol: e.rol === 'admin' ? 'miembro' : 'admin', estado: 'activo', con_acceso: true },
          { usuario_id: 'u-luis', nombre: 'Luis Quispe', correo: 'luis@correo.com', rol: 'miembro', estado: 'activo', con_acceso: false }]
      };
    });
    const mk = (e, n, tipo, monto, lugar, ci, mi, autor, det) => ({ id: 'm' + Math.random(), espacio_id: e, usuario_id: autor || uid, tipo, monto, fecha: d(n), lugar, categoria_id: ci == null ? null : e + '-c' + ci, medio_pago_id: e + '-m' + mi, detalle: det, creado_en: new Date(hoy - n * 864e5).toISOString(), texto_original: null });
    E.demoMovs = [mk('e-pers', 0, 'gasto', 8, 'Tambo', null, 1), mk('e-pers', 0, 'gasto', 50, 'Mercado', 0, 0, null, 'frutas, carnes'), mk('e-pers', 1, 'gasto', 12.5, 'Taxi', 2, 0),
      mk('e-fam', 0, 'gasto', 250, 'Plaza Vea', 0, 2, 'u-rosa'), mk('e-fam', 0, 'gasto', 35, 'Pollería', 1, 1), mk('e-fam', 1, 'gasto', 120, 'Luz del Sur', 3, 2, 'u-luis'),
      mk('e-emp', 0, 'gasto', 45, 'Primax', 2, 1, 'u-rosa', 'combustible camioneta')];
    // más gastos repartidos en el mes para el Resumen
    [[2, 18, 'Tambo', 0, 1], [3, 64.9, 'Plaza Vea', 0, 2], [4, 15, 'Menú', 1, 0], [5, 9.5, 'Combi', 2, 0], [6, 42, 'Inkafarma', 4, 1], [7, 120, 'Luz del Sur', 3, 2],
     [8, 25, 'Bembos', 1, 1], [9, 30, 'Mercado', 0, 0], [10, 14, 'Taxi', 2, 0], [11, 76, 'Tottus', 0, 2], [12, 22, 'Chifa', 1, 0], [13, 8, 'Bodega', null, 0]]
      .forEach(([n, monto, lugar, ci, mi]) => { if (hoy.getDate() - n >= 1) E.demoMovs.push(mk('e-pers', n, 'gasto', monto, lugar, ci, mi)); });
    E.demoMovs.push(mk('e-pers', Math.min(hoy.getDate() - 1, 14), 'ingreso', 3200, 'Sueldo', null, 2));
    E.demoMovs[E.demoMovs.length - 1].categoria_id = 'e-pers-ci';
    const topesDemo = { 'e-pers': [{ id: 't1', espacio_id: 'e-pers', ambito: 'total', monto_mensual: 900 }, { id: 't2', espacio_id: 'e-pers', ambito: 'medio', medio_pago_id: 'e-pers-m2', monto_mensual: 300 }, { id: 't3', espacio_id: 'e-pers', ambito: 'categoria', categoria_id: 'e-pers-c1', monto_mensual: 60 }] };
    demoCambiar = id => {
      E.limites = topesDemo[id] || [];
      E.espacio = id; E.rol = espacioActual().rol;
      Object.assign(E, { categorias: porEsp[id].categorias, medios: porEsp[id].medios, miembros: porEsp[id].miembros, medioPred: id + '-m0' });
      E.mes = inicioMes(new Date()); principal();
    };
    cargarMovs = async () => { E.movs = E.demoMovs.filter(m => m.espacio_id === E.espacio && m.fecha.slice(0, 7) === iso(E.mes).slice(0, 7)); E.movsMes = iso(E.mes); };
    const vistaAdminReal = vistaAdmin;
    vistaAdmin = async () => {
      document.getElementById('contenido').innerHTML = `<div class="barra-sup"><button type="button" class="flecha" data-ir="cuenta" aria-label="Volver">${svg('<path d="M15 5l-7 7 7 7"/>', 'width="20" height="20" stroke-width="2.4"')}</button>${logo(34, 22)}</div>
        <section class="seccion"><h1>Administración</h1><div class="kpis-admin">${[['2', 'pagos por revisar'], ['37', 'cuentas activas'], ['112', 'en prueba'], ['S/ 1,380.00', 'ingresos del mes'], ['37 / 300', 'cupos de lanzamiento'], ['9', 'grupos'], ['24.8%', 'de prueba a pago'], ['0', 'correos con error']].map(([n, t]) => `<div class="kpi"><b class="cifra">${n}</b><small>${t}</small></div>`).join('')}</div>
        <h2>Pagos por revisar</h2><p class="nota">Antes de aprobar, verifica en tu app de Plin que entró el pago con ese monto y número de operación.</p>
        <div class="pago-admin"><div class="pa-cab"><b>Rosa Quispe</b><span class="cifra">S/ 60.00</span></div><p class="det">rosa@correo.com, hoy 10:42</p><p>Operación: <b class="cifra">00123456</b></p>
        <div class="dos"><button type="button" class="btn">Aprobar y habilitar</button><button type="button" class="btn peligro">Rechazar</button></div></div></section>`;
      document.querySelectorAll('#contenido [data-ir]').forEach(b => b.onclick = () => irA(b.dataset.ir));
    };
    void vistaAdminReal;
    E.pagoActual = null;
    demoCambiar('e-pers');
    if (/onboarding/.test(location.search)) onboarding();
  }
  let demoCambiar = () => {};

  iniciar();
})();
