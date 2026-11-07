/* ==========================================================================
   CUANTICS · ERP — Piezas comunes
   · ERP.entrar()   sesión + perfil; sin sesión manda al panel a entrar.
   · ERP.menu()     barra lateral para moverse entre módulos.
   · formatos (montos, fechas, letras) y avisos.
   Se carga después de lib/supabase-js y lib/conexion.js.
   ========================================================================== */
(function () {
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/lib\/erp\.js.*$/, '')

  const $ = id => document.getElementById(id)
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const SIM = { USD: 'US$ ', PEN: 'S/ ', EUR: '€ ' }
  const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmt0 = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
  const mon = (n, m, dec) => (SIM[m] || '') + (dec ? fmt(n) : fmt0(n))
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
  // Hoy con la hora de Lima, no en UTC.
  const hoy = () => { const f = new Date(); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
  const fFecha = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : ''
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const fCorta = d => { if (!d) return ''; const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${+dd} ${MESES[+m - 1]}` + (+a !== new Date().getFullYear() ? ` ${a}` : '') }
  const fHora = t => { const f = new Date(t); return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()} · ${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}` }

  function enLetras (n, moneda) {
    const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
    const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
    const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
    const c999 = x => { if (x === 0) return ''; if (x === 100) return 'CIEN'; const c = Math.floor(x / 100), r = x % 100; let s = C[c]; if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : '')); return s }
    const un = x => c999(x).replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN')
    n = r2(n); const ent = Math.floor(n), cent = Math.round((n - ent) * 100)
    const mill = Math.floor(ent / 1e6), miles = Math.floor(ent % 1e6 / 1000), res = ent % 1000
    let s = ''
    if (mill) s += (mill === 1 ? 'UN MILLÓN' : un(mill) + ' MILLONES') + ' '
    if (miles) s += (miles === 1 ? 'MIL' : un(miles) + ' MIL') + ' '
    s += c999(res); s = s.trim() || 'CERO'
    return `${s} Y ${String(cent).padStart(2, '0')}/100 ${{ USD: 'DÓLARES AMERICANOS', PEN: 'SOLES', EUR: 'EUROS' }[moneda] || ''}`.trim()
  }

  function toast (m, malo) {
    let t = $('erpToast')
    if (!t) { t = document.createElement('div'); t.id = 'erpToast'; t.className = 'erp-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t) }
    t.textContent = m; t.classList.toggle('malo', !!malo); t.classList.add('on')
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), malo ? 4500 : 2400)
  }

  /* ---------- Sesión ---------- */
  async function entrar () {
    const bloqueo = $('bloqueo')
    let sb
    try { sb = window.erpConectar() } catch (e) { if (bloqueo) bloqueo.textContent = e.message; throw e }
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      const ruta = location.pathname.slice(new URL(BASE).pathname.length) + location.search
      location.replace(BASE + '?volver=' + encodeURIComponent(ruta))
      throw new Error('sin sesión')
    }
    const { data: yo, error } = await sb.from('perfiles').select('*').eq('id', session.user.id).single()
    if (error || !yo || !yo.activo) {
      if (bloqueo) bloqueo.innerHTML = `Tu cuenta no tiene acceso al ERP. <a href="${BASE}">Volver</a>`
      throw new Error('sin acceso')
    }
    yo.correo = session.user.email
    return { sb, yo }
  }
  function listo () { const b = $('bloqueo'); if (b) b.remove() }
  function falla (msg) { const b = $('bloqueo'); if (b) b.innerHTML = msg + `<br><a href="${BASE}">Volver al panel</a>`; else toast(msg, true) }
  const faltaTabla = (err, archivo) => /does not exist|schema cache|relation|column/i.test(err?.message || '')
    ? `Falta actualizar la base de datos.<br>Corre <code>equipo/supabase/migrations/${archivo}</code> en Supabase → SQL Editor.`
    : 'No se pudo leer la base: ' + esc(err?.message)

  /* ---------- Menú ---------- */
  const I = {
    inicio: 'M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z',
    leads: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 8a6 6 0 0 1 12 0',
    oportunidades: 'M3 4h14l-5 6v5l-4 2v-7z',
    cotizaciones: 'M5 2h7l4 4v12H5zM12 2v4h4M8 10h5M8 13h5',
    clientes: 'M3 18V6l7-3 7 3v12M7 18v-4h6v4M7 8h1M12 8h1M7 11h1M12 11h1',
    productos: 'M10 2 3 6v8l7 4 7-4V6zM3 6l7 4 7-4M10 10v8',
    compras: 'M2 3h3l2 10h10l2-7H6M8 17a1 1 0 1 0 0 .01M16 17a1 1 0 1 0 0 .01',
    facturas: 'M5 2h10v16l-2.5-1.5L10 18l-2.5-1.5L5 18zM8 6h4M8 9h4M8 12h2'
  }
  const MENU = [
    ['', [['inicio', 'Inicio', '']]],
    ['Ventas', [['leads', 'Leads', 'ventas/?vista=leads'], ['oportunidades', 'Oportunidades', 'ventas/?vista=oportunidades'],
      ['cotizaciones', 'Cotizaciones', 'ventas/cotizaciones/'], ['clientes', 'Clientes', 'clientes/']]],
    ['Catálogo', [['productos', 'Productos', 'productos/']]],
    ['Compras', [['compras', 'Órdenes de compra', 'compras/']]],
    ['Finanzas', [['facturas', 'Facturas', null]]]
  ]
  const CSS = `
  body.con-menu{padding-left:var(--menu-w)}
  :root{--menu-w:212px}
  .erp-menu{position:fixed;inset:0 auto 0 0;width:var(--menu-w);z-index:8;background:#091016;border-right:1px solid #1d2c36;display:flex;flex-direction:column;font:14px/1.4 "IBM Plex Sans",system-ui,sans-serif}
  .erp-menu__marca{display:flex;align-items:center;gap:9px;padding:16px 18px 14px;color:#D8E3EA;text-decoration:none}
  .erp-menu__marca b{font-family:"Open Sans",system-ui,sans-serif;font-weight:700;font-stretch:125%;font-variation-settings:"wdth" 125;letter-spacing:.12em;font-size:16px}
  .erp-menu__marca b span{color:#22C7D6}
  .erp-menu nav{flex:1;overflow-y:auto;padding:4px 10px 12px}
  .erp-menu h4{margin:16px 10px 4px;font-size:11.5px;font-weight:500;color:#5f7583;letter-spacing:.01em}
  .erp-menu a.it,.erp-menu span.it{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;color:#9fb2be;text-decoration:none;position:relative}
  .erp-menu a.it:hover{background:#121d25;color:#D8E3EA}
  .erp-menu a.it:focus-visible{outline:2px solid #22C7D6;outline-offset:-2px}
  .erp-menu .it svg{flex:none;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  .erp-menu a.it.on{background:#132630;color:#fff}
  .erp-menu a.it.on::before{content:"";position:absolute;left:-10px;top:7px;bottom:7px;width:3px;border-radius:0 3px 3px 0;background:#22C7D6}
  .erp-menu a.it.on svg{color:#22C7D6}
  .erp-menu span.it{opacity:.45;cursor:default}
  .erp-menu span.it small{margin-left:auto;font-size:10.5px}
  .erp-menu__yo{border-top:1px solid #1d2c36;padding:12px 18px;display:flex;align-items:center;gap:10px}
  .erp-menu__yo div{flex:1;min-width:0;line-height:1.25}
  .erp-menu__yo b{display:block;font-weight:600;font-size:13px;color:#D8E3EA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .erp-menu__yo small{color:#7F94A2;font-size:11.5px}
  .erp-menu__yo button{font:inherit;font-size:12px;background:none;border:1px solid #263945;color:#9fb2be;border-radius:6px;padding:5px 9px;cursor:pointer}
  .erp-menu__yo button:hover{border-color:#E5636B;color:#E5636B}
  .erp-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:60;background:#22C7D6;color:#06181c;padding:8px 16px;border-radius:6px;font:600 13.5px "IBM Plex Sans",system-ui,sans-serif;opacity:0;transition:opacity .25s;pointer-events:none;max-width:92vw}
  .erp-toast.on{opacity:1}.erp-toast.malo{background:#E5636B;color:#fff}
  /* Las páginas que traían su propia marca arriba la esconden: ya está en el menú. */
  body.con-menu .top .brand-row,body.con-menu a.volver,body.con-menu .barra .marca{display:none!important}
  @media (max-width:900px){
    body.con-menu{padding-left:0}
    .erp-menu{position:static;width:auto;flex-direction:row;align-items:center;border-right:none;border-bottom:1px solid #1d2c36}
    .erp-menu__marca{padding:10px 12px}.erp-menu__marca b{display:none}
    .erp-menu nav{display:flex;gap:2px;overflow-x:auto;padding:6px 6px;scrollbar-width:none}
    .erp-menu h4,.erp-menu span.it,.erp-menu__yo div{display:none}
    .erp-menu a.it{white-space:nowrap;padding:6px 9px;font-size:13px}
    .erp-menu a.it.on::before{left:8px;right:8px;top:auto;bottom:0;width:auto;height:2px}
    .erp-menu__yo{border:none;padding:6px 10px}
  }
  @media (prefers-reduced-motion:reduce){.erp-toast{transition:none}}
  @media print{.erp-menu,.erp-toast{display:none!important}body.con-menu{padding-left:0}}`

  function menu (activo, ctx = {}) {
    if (document.querySelector('.erp-menu')) return
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st)
    const ic = k => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${I[k]}"/></svg>`
    const nav = MENU.map(([g, its]) => (g ? `<h4>${esc(g)}</h4>` : '') + its.map(([k, t, href]) =>
      href === null
        ? `<span class="it" title="Próximamente">${ic(k)}${esc(t)}<small>pronto</small></span>`
        : `<a class="it${k === activo ? ' on' : ''}" data-k="${k}" href="${BASE + href}"${k === activo ? ' aria-current="page"' : ''}>${ic(k)}${esc(t)}</a>`).join('')).join('')
    const a = document.createElement('aside'); a.className = 'erp-menu'; a.setAttribute('aria-label', 'Módulos del ERP')
    a.innerHTML = `<a class="erp-menu__marca" href="${BASE}"><b>C<span>U</span>ANTICS</b><img src="${BASE}img/libelula.png" width="24" height="25" alt=""></a>
      <nav>${nav}</nav>
      <div class="erp-menu__yo"><div><b>${esc(ctx.yo?.nombre || '')}</b><small>${esc(ctx.yo?.cargo || (ctx.yo?.rol === 'admin' ? 'Administrador' : ''))}</small></div><button type="button">Salir</button></div>`
    document.body.prepend(a); document.body.classList.add('con-menu')
    a.querySelector('.erp-menu__yo button').onclick = async () => { if (ctx.sb) await ctx.sb.auth.signOut(); location.replace(BASE) }
  }

  function menuActivo (k) {
    document.querySelectorAll('.erp-menu a.it').forEach(a => { const on = a.dataset.k === k; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current') })
  }

  /* ---------- Etiquetas (las líneas de producto, con su color) ----------
     En la base se guardan como texto: "Ignition, Litmus". En pantalla son
     chips de color, como las etiquetas de Odoo. */
  const PALETA = ['#60A5FA', '#F2A93B', '#A78BFA', '#FB923C', '#5CD18B', '#F472B6', '#22C7D6', '#A3E635', '#F87171', '#2DD4BF']
  let LINEAS = []
  const ETQ_CSS = `
  .etq{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:1px 9px;border-radius:99px;font-size:11.5px;line-height:1.6;font-weight:500;
    color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);border:1px solid color-mix(in srgb,var(--c) 40%,transparent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .etq button{font:inherit;line-height:1;background:none;border:none;color:inherit;opacity:.7;cursor:pointer;padding:0 0 0 2px;font-size:13px}
  .etq button:hover{opacity:1}
  .etqs{display:flex;flex-wrap:wrap;gap:4px}
  .etq-sel{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-height:34px;padding:3px 6px;background:var(--ink,#0C1218);border:1px solid var(--line,#263945);border-radius:5px;cursor:text}
  .etq-sel:focus-within{border-color:var(--cyan,#22C7D6)}
  .etq-sel input.etq-in{flex:1;min-width:90px;border:none!important;background:transparent!important;padding:3px 2px!important;outline:none;font-size:13px;width:auto}
  .etq-menu{position:absolute;z-index:40;left:-1px;right:-1px;top:calc(100% + 3px);margin:0;padding:4px;list-style:none;background:#18242E;border:1px solid #263945;border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-height:240px;overflow-y:auto}
  .etq-menu li{padding:6px 8px;border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;color:#D8E3EA}
  .etq-menu li[aria-selected=true],.etq-menu li:hover{background:#21323e}
  .etq-menu li i{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none}
  .etq-menu li small{margin-left:auto;color:#7F94A2;font-size:11px}
  .etq-menu li.nueva{color:#22C7D6}
  .etq-pal{display:flex;gap:5px;flex-wrap:wrap}
  .etq-pal button{width:20px;height:20px;border-radius:50%;border:2px solid transparent;background:var(--c);cursor:pointer;padding:0}
  .etq-pal button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 1px var(--c)}`
  ;(function () { const st = document.createElement('style'); st.textContent = ETQ_CSS; document.head.appendChild(st) })()

  const colorPorNombre = n => { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETA[h % PALETA.length] }
  const lineaDe = n => LINEAS.find(l => l.nombre.toLowerCase() === String(n).trim().toLowerCase())
  const colorDe = n => (lineaDe(n)?.color) || (lineaDe(n) ? colorPorNombre(n) : '#8A9AA5')
  const partir = t => String(t || '').split(',').map(s => s.trim()).filter(Boolean)
  const chip = (n, quitar) => `<span class="etq" style="--c:${esc(colorDe(n))}" title="${esc(n)}">${esc(lineaDe(n)?.nombre || n)}${quitar ? `<button type="button" data-quitar="${esc(n)}" aria-label="Quitar ${esc(n)}">×</button>` : ''}</span>`
  const chips = t => { const ns = partir(t); return ns.length ? `<span class="etqs">${ns.map(n => chip(n)).join('')}</span>` : '' }

  async function cargarEtiquetas (sb) {
    const r = await sb.from('lineas_producto').select('*').order('orden')
    if (!r.error) LINEAS = r.data.filter(l => l.activo !== false).map(l => ({ ...l, color: l.color || colorPorNombre(l.nombre) }))
    return LINEAS
  }

  /* Convierte un <input> de texto en selector de etiquetas. El input queda
     oculto con el valor "A, B" y dispara 'input' al cambiar. Con sb, una
     etiqueta escrita que no existe se crea como línea nueva. */
  function selectorEtiquetas (input, sb) {
    if (input._etq) { input._etq.pintar(); return input._etq }
    input.type = 'hidden'
    const caja = document.createElement('div'); caja.className = 'etq-sel'
    const txt = document.createElement('input'); txt.className = 'etq-in'; txt.placeholder = input.placeholder || 'Agregar…'
    txt.setAttribute('aria-label', input.getAttribute('aria-label') || 'Agregar etiqueta'); txt.autocomplete = 'off'
    const menu = document.createElement('ul'); menu.className = 'etq-menu'; menu.setAttribute('role', 'listbox'); menu.hidden = true
    input.after(caja)
    let marcado = 0, opciones = []
    const valor = () => partir(input.value)
    const fijar = ns => { input.value = ns.join(', '); pintar(); input.dispatchEvent(new Event('input', { bubbles: true })) }
    function pintar () {
      caja.querySelectorAll('.etq').forEach(e => e.remove())
      caja.insertAdjacentHTML('afterbegin', valor().map(n => chip(n, !input.readOnly && !input.disabled)).join(''))
      txt.hidden = input.readOnly || input.disabled
      if (!caja.contains(txt)) { caja.append(txt, menu) }
    }
    function abrir () {
      const q = txt.value.trim().toLowerCase(), ya = valor().map(v => v.toLowerCase())
      opciones = LINEAS.filter(l => !ya.includes(l.nombre.toLowerCase()) && (!q || l.nombre.toLowerCase().includes(q) || (l.fabricante || '').toLowerCase().includes(q)))
        .map(l => ({ n: l.nombre, c: l.color, f: l.fabricante }))
      if (q && !LINEAS.some(l => l.nombre.toLowerCase() === q) && !ya.includes(q)) opciones.push({ n: txt.value.trim(), nueva: true })
      marcado = Math.min(marcado, Math.max(0, opciones.length - 1))
      menu.innerHTML = opciones.map((o, i) => o.nueva
        ? `<li role="option" class="nueva" data-i="${i}" aria-selected="${i === marcado}">Crear la etiqueta «${esc(o.n)}»</li>`
        : `<li role="option" data-i="${i}" aria-selected="${i === marcado}" style="--c:${esc(o.c)}"><i></i>${esc(o.n)}${o.f && o.f !== o.n ? `<small>${esc(o.f)}</small>` : ''}</li>`).join('')
      menu.hidden = !opciones.length
    }
    async function elegir (i) {
      const o = opciones[i]; if (!o) return
      if (o.nueva && sb) {
        const color = PALETA[LINEAS.length % PALETA.length]
        const r = await sb.from('lineas_producto').insert({ nombre: o.n, color, orden: LINEAS.length + 1 }).select().single()
        if (r.error) { toast('No se pudo crear la etiqueta: ' + r.error.message, true); return }
        LINEAS.push({ ...r.data, color: r.data.color || color }); toast(`Etiqueta «${o.n}» creada`)
      }
      fijar([...valor(), o.n]); txt.value = ''; marcado = 0; abrir(); txt.focus()
    }
    caja.addEventListener('mousedown', e => { if (e.target === caja) { e.preventDefault(); txt.focus() } })
    caja.addEventListener('click', e => { const b = e.target.closest('[data-quitar]'); if (b) fijar(valor().filter(v => v !== b.dataset.quitar)) })
    menu.addEventListener('mousedown', e => { e.preventDefault(); const li = e.target.closest('li'); if (li) elegir(+li.dataset.i) })
    txt.addEventListener('focus', abrir)
    txt.addEventListener('input', () => { marcado = 0; abrir() })
    txt.addEventListener('blur', () => { menu.hidden = true; txt.value = '' })
    txt.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (menu.hidden) abrir(); marcado = (marcado + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % Math.max(1, opciones.length); abrir() }
      else if (e.key === 'Enter') { e.preventDefault(); if (!menu.hidden) elegir(marcado) }
      else if (e.key === 'Escape') { if (!menu.hidden) { e.stopPropagation(); e.preventDefault(); menu.hidden = true } }
      else if (e.key === 'Backspace' && !txt.value && valor().length) fijar(valor().slice(0, -1))
    })
    pintar()
    input._etq = { pintar }
    return input._etq
  }
  const etiquetas = { cargar: cargarEtiquetas, chips, chip, colorDe, partir, PALETA, lista: () => LINEAS }

  window.ERP = { BASE, $, esc, SIM, fmt, fmt0, mon, r2, hoy, fFecha, fCorta, fHora, enLetras, toast, entrar, listo, falla, faltaTabla, menu, menuActivo, selectorEtiquetas, etiquetas }
})()
