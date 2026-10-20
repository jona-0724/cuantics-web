/* ============================================================================
   POTENTE · doble de Supabase para las pruebas
   ----------------------------------------------------------------------------
   Reemplaza lib/supabase-js-*.js dentro de Playwright. Imita lo que la página
   usa de verdad: auth, el constructor de consultas (select/eq/neq/in/order/
   single/maybeSingle/update) y las funciones (rpc).

   Reglas que respeta, porque son las que hacen fallar a la página de verdad:
   · el día se calcula en hora de Lima, igual que la página;
   · cola_feria NO trae montos; cola_caja sí, y solo del día;
   · cada vista filtra por feria, así que dos ferias en paralelo no se mezclan;
   · crear_orden numera con max(numero)+1 POR FERIA.

   window.__D deja los datos y el registro de llamadas a la vista de la prueba.
   ========================================================================== */
(function(){
  const TZ = "America/Lima";
  const fDia = new Intl.DateTimeFormat("en-CA", { timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit" });
  const HOY  = fDia.format(new Date());
  const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return fDia.format(d); };
  const ahora = min => new Date(Date.now() - min * 60000).toISOString();
  const quien = new URLSearchParams(location.search).get("quien") || "feriante";
  const _admin = quien === "admin";

  /* ---------------------------------------------------------------- datos */
  window.__D = {
    perfil: _admin
      ? { id:"u-admin", nombre:"Jonathan Ortiz", correo:"admin@potente.pe", rol:"admin", activo:true }
      : { id:"u-feri",  nombre:"Fabricio Salvago", correo:"feri@potente.pe", rol:"feriante", activo:true },

    productos: [
      { sku:"combo", nombre:"Combo Potente", categoria:"Combos", descripcion:"Sándwich + papas + refresco", precio:25, lleva_salsas:true, activo:true, posicion:10,
        opciones:[ { id:"sandwich", etiqueta:"¿Qué sándwich?", valores:["Choripán Criollo","Hotdog Callejero","Burger Potente"] },
                   { id:"sabor",    etiqueta:"Sabor del refresco", valores:["Chicha morada","Maracuyá"] } ] },
      { sku:"combo_salchipapa", nombre:"Combo Salchipapa", categoria:"Combos", descripcion:"Salchipapa + refresco 12 oz", precio:23, lleva_salsas:true, activo:true, posicion:11,
        opciones:[ { id:"salchipapa", etiqueta:"¿Cuál salchipapa?", valores:["Salchipapa Potente","Choripapa Potente","Salchipapa Mixta"] },
                   { id:"sabor",      etiqueta:"Sabor del refresco", valores:["Chicha morada","Maracuyá"] } ] },
      { sku:"combo_pancho", nombre:"Combo Pancho", categoria:"Combos", descripcion:"Pancho + refresco 9 oz", precio:5, lleva_salsas:true, activo:true, posicion:12,
        opciones:[ { id:"sabor", etiqueta:"Sabor del refresco", valores:["Chicha morada","Maracuyá"] } ] },
      { sku:"choripan", nombre:"Choripán Criollo",  categoria:"Sándwiches", descripcion:"Chorizo",    precio:15, lleva_salsas:true,  activo:true, posicion:20, opciones:null },
      { sku:"hotdog",   nombre:"Hotdog Callejero",  categoria:"Sándwiches", descripcion:"Salchicha",  precio:15, lleva_salsas:true,  activo:true, posicion:21, opciones:null },
      { sku:"burger",   nombre:"Burger Potente",    categoria:"Sándwiches", descripcion:"Doble carne",precio:18, lleva_salsas:true,  activo:true, posicion:22, opciones:null },
      { sku:"pancho",   nombre:"Pancho Hot-Dog",    categoria:"Panchos",    descripcion:"En palo",    precio:5,  lleva_salsas:true,  activo:true, posicion:30, opciones:null },
      { sku:"papas",    nombre:"Papas Crujientes",  categoria:"Acompañamientos", descripcion:"Porción", precio:8, lleva_salsas:true, activo:true, posicion:40, opciones:null },
      { sku:"refresco12", nombre:"Refresco 12 oz",  categoria:"Bebidas", descripcion:"Casero", precio:5,   lleva_salsas:false, activo:true, posicion:50,
        opciones:[ { id:"sabor", etiqueta:"Sabor", valores:["Chicha morada","Maracuyá"] } ] },
      { sku:"refresco9",  nombre:"Refresco 9 oz",   categoria:"Bebidas", descripcion:"Casero", precio:3.5, lleva_salsas:false, activo:true, posicion:51,
        opciones:[ { id:"sabor", etiqueta:"Sabor", valores:["Chicha morada","Maracuyá"] } ] },
      { sku:"salchipapa", nombre:"Salchipapa Potente", categoria:"Salchipapas", descripcion:"Salchicha", precio:20, lleva_salsas:true, activo:true, posicion:60, opciones:null },
      { sku:"choripapa",  nombre:"Choripapa Potente",  categoria:"Salchipapas", descripcion:"Chorizo",   precio:20, lleva_salsas:true, activo:true, posicion:61, opciones:null },
      { sku:"salchipapa_mixta", nombre:"Salchipapa Mixta", categoria:"Salchipapas", descripcion:"Salchicha y chorizo", precio:20, lleva_salsas:true, activo:true, posicion:62, opciones:[] }
    ],

    /* fa y fb están en curso HOY: el feriante tiene turno en las dos y debe
       poder elegir. fc todavía no empieza (solo el admin entra). fd terminó
       la semana pasada y el feriante trabajó ahí: inventario atrasado. */
    ferias: [
      { id:"fa", nombre:"FERIA MARCIANA",  lugar:"Costa Verde",   fecha_inicio:HOY,      fecha_fin:HOY,      estado:"publicada", punto0:0,    bono_pct:50, mostrar_equipo:true },
      { id:"fb", nombre:"EXPO MIRAFLORES", lugar:"Parque Kennedy",fecha_inicio:HOY,      fecha_fin:HOY,      estado:"publicada", punto0:1000, bono_pct:50, mostrar_equipo:true },
      { id:"fc", nombre:"OTAKULAND",       lugar:"Explanada",     fecha_inicio:dias(30), fecha_fin:dias(32), estado:"publicada", punto0:0,    bono_pct:50, mostrar_equipo:false },
      { id:"fd", nombre:"GEEKFESTIVAL",    lugar:"Jockey",        fecha_inicio:dias(-9), fecha_fin:dias(-7), estado:"publicada", punto0:0,    bono_pct:50, mostrar_equipo:true }
    ],

    turnos: [
      { feria_id:"fa", bloque_id:"b1", rol:"caja",   publicado:true, hora_inicio:"10:00:00", hora_fin:"16:00:00" },
      { feria_id:"fb", bloque_id:"b2", rol:"cocina", publicado:true, hora_inicio:"16:00:00", hora_fin:"22:00:00" }
    ],
    invFerias: ["fd"],   // ferias pasadas donde trabajé: puedo completar su inventario

    ordenes: [
      { id:"o1", feria_id:"fa", bloque_id:"b1", numero:1, creado_en:ahora(9), dia:HOY, medio_pago:"qrpos",    estado:"cola", nota:"",         cliente:"Carlos", total:50, pos_ok:false, editada_en:null },
      { id:"o2", feria_id:"fa", bloque_id:"b1", numero:2, creado_en:ahora(5), dia:HOY, medio_pago:"efectivo", estado:"prep", nota:"sin ají",  cliente:"",       total:15, pos_ok:false, editada_en:null, iniciada_en:ahora(4) },
      { id:"o3", feria_id:"fb", bloque_id:"b2", numero:1, creado_en:ahora(3), dia:HOY, medio_pago:"tarjeta",  estado:"cola", nota:"",         cliente:"Rosa",   total:8,  pos_ok:true,  editada_en:null },
      { id:"o4", feria_id:"fb", bloque_id:"b2", numero:2, creado_en:ahora(20),dia:HOY, medio_pago:"efectivo", estado:"entregado", nota:"",    cliente:"Miguel", total:15, pos_ok:true,  editada_en:null,
        iniciada_en:ahora(18), lista_en:ahora(14), entregada_en:ahora(12) }
    ],
    items: [
      { id:"i1", orden_id:"o1", sku:"combo",    nombre:"Combo Potente",    categoria:"Combos",         cantidad:2, precio:25, subtotal:50, opciones:{ sandwich:"Burger Potente", sabor:"Maracuyá" }, salsas:["Kétchup"], nota:"" },
      { id:"i2", orden_id:"o2", sku:"choripan", nombre:"Choripán Criollo", categoria:"Sándwiches",     cantidad:1, precio:15, subtotal:15, opciones:{}, salsas:["Sin salsa"], nota:"bien dorado" },
      { id:"i3", orden_id:"o3", sku:"papas",    nombre:"Papas Crujientes", categoria:"Acompañamientos",cantidad:1, precio:8,  subtotal:8,  opciones:{}, salsas:[], nota:"" },
      { id:"i4", orden_id:"o4", sku:"hotdog",   nombre:"Hotdog Callejero", categoria:"Sándwiches",     cantidad:1, precio:15, subtotal:15, opciones:{}, salsas:["Mayonesa"], nota:"" }
    ],
    inventarios: [
      { id:"inv1", feria_id:"fd", fecha:dias(-9), datos:{ cant:{ hotdog:2, pan:1 }, nivel:{ mayonesa:"medio" }, repo:{ mayonesa:1 } },
        nota:"faltó pan", perfil_id:"u-feri", por_nombre:"Fabricio Salvago", actualizado_en:ahora(60*24*8) }
    ],

    HOY, dias, llamadas: []
  };
  const _D = window.__D;

  /* ------------------------------------------------- vistas de la operación */
  const vivas = () => _D.ordenes.filter(o => o.estado !== "anulado");

  function filaCola(o){               // cola_feria: sin un solo monto
    return { id:o.id, feria_id:o.feria_id, bloque_id:o.bloque_id, numero:o.numero, dia:o.dia,
             estado:o.estado, nota:o.nota, cajero_id:o.cajero_id || null, cocinero_id:o.cocinero_id || null,
             creado_en:o.creado_en, iniciada_en:o.iniciada_en || null, lista_en:o.lista_en || null,
             entregada_en:o.entregada_en || null, cliente:o.cliente || "", medio_pago:o.medio_pago,
             editada_en:o.editada_en || null };
  }
  const filaCaja = o => Object.assign(filaCola(o), { total:o.total, pos_ok:!!o.pos_ok });
  const itemCola = i => ({ id:i.id, orden_id:i.orden_id, sku:i.sku, nombre:i.nombre, categoria:i.categoria,
                           cantidad:i.cantidad, opciones:i.opciones, salsas:i.salsas, nota:i.nota });
  const itemCaja = i => Object.assign(itemCola(i), { precio:i.precio, subtotal:i.subtotal });

  function tabla(nombre){
    switch (nombre){
      case "perfiles":    return [_D.perfil];
      case "productos":   return _D.productos;
      case "ferias":      return _D.ferias;
      case "ordenes":     return _D.ordenes;
      case "orden_items": return _D.items;
      case "inventarios": return _D.inventarios;
      case "cola_feria":        return vivas().map(filaCola);
      case "cola_feria_items":  return _D.items.filter(i => vivas().some(o => o.id === i.orden_id)).map(itemCola);
      /* cola_caja SÍ trae los anulados: caja tiene que poder verlos para
         restaurarlos. La que los esconde es cola_feria, la de cocina. */
      case "cola_caja":         return _D.ordenes.filter(o => o.dia === HOY).map(filaCaja);
      case "cola_caja_items":   return _D.items.filter(i => _D.ordenes.some(o => o.id === i.orden_id && o.dia === HOY)).map(itemCaja);
      default: return null;
    }
  }

  /* ------------------------------------------------ constructor de consultas */
  const ok  = data  => ({ data, error:null });
  const mal = (msg, code) => ({ data:null, error:{ message:msg, code:code || "PGRST000", hint:"" } });

  function builder(nombre){
    const filtros = [];
    let orden = null, modo = "select", cambios = null, limite = null;
    const aplicar = () => {
      let f = tabla(nombre);
      if (f == null) return null;
      f = f.slice();
      filtros.forEach(t => {
        if (t.op === "eq")  f = f.filter(r => String(r[t.c]) === String(t.v));
        if (t.op === "neq") f = f.filter(r => String(r[t.c]) !== String(t.v));
        if (t.op === "in")  f = f.filter(r => t.v.map(String).indexOf(String(r[t.c])) >= 0);
      });
      if (orden){
        const asc = orden.asc !== false;
        f.sort((a, b) => {
          const x = a[orden.c], y = b[orden.c];
          if (x === y) return 0;
          return ((x > y) ? 1 : -1) * (asc ? 1 : -1);
        });
      }
      if (limite != null) f = f.slice(0, limite);
      return f;
    };
    const correr = () => {
      const f = aplicar();
      if (f === null) return mal('relation "public.' + nombre + '" does not exist', "42P01");
      if (modo === "update"){
        const reales = aplicar();
        reales.forEach(r => {
          const orig = tabla(nombre).find(x => x.id === r.id) || r;
          Object.assign(orig, cambios);
        });
        _D.llamadas.push({ tipo:"update", tabla:nombre, cambios, filas:reales.length });
        return ok(reales);
      }
      if (modo === "single")      return f.length === 1 ? ok(f[0]) : mal("no rows", "PGRST116");
      if (modo === "maybeSingle") return ok(f.length ? f[0] : null);
      return ok(f);
    };
    const api = {
      select(){ return api; },
      eq(c, v){ filtros.push({ op:"eq", c, v }); return api; },
      neq(c, v){ filtros.push({ op:"neq", c, v }); return api; },
      in(c, v){ filtros.push({ op:"in", c, v:v || [] }); return api; },
      order(c, o){ orden = { c, asc:!o || o.ascending !== false }; return api; },
      limit(n){ limite = n; return api; },
      single(){ modo = "single"; return api; },
      maybeSingle(){ modo = "maybeSingle"; return api; },
      update(obj){ modo = "update"; cambios = obj; return api; },
      insert(obj){ modo = "insert"; cambios = obj; return api; },
      upsert(obj){ modo = "insert"; cambios = obj; return api; },
      delete(){ modo = "delete"; return api; },
      then(res, rej){ try { return Promise.resolve(correr()).then(res, rej) } catch(e){ return Promise.resolve(mal(e.message)).then(res, rej) } }
    };
    return api;
  }

  /* ----------------------------------------------------------- funciones */
  const uid = () => "n" + Math.random().toString(36).slice(2, 9);

  function crearOrden(a){
    const feria = a.p_feria;
    const mias = _D.ordenes.filter(o => o.feria_id === feria);
    const numero = mias.reduce((n, o) => Math.max(n, o.numero), 0) + 1;
    const items = a.p_items || [];
    const total = Math.round(items.reduce((s, i) => s + (+i.subtotal || 0), 0) * 100) / 100;
    const id = uid();
    _D.ordenes.push({ id, feria_id:feria, bloque_id:a.p_bloque || null, numero, creado_en:new Date().toISOString(),
      dia:HOY, medio_pago:a.p_medio, estado:"cola", nota:a.p_nota || "", cliente:a.p_cliente || "",
      total, pos_ok:false, editada_en:null, cajero_id:_D.perfil.id });
    items.forEach(i => _D.items.push({ id:uid(), orden_id:id, sku:i.sku, nombre:i.nombre, categoria:i.categoria,
      cantidad:i.cantidad, precio:i.precio, subtotal:i.subtotal, opciones:i.opciones || {}, salsas:i.salsas || [], nota:i.nota || "" }));
    return numero;
  }

  function editarOrden(a){
    const o = _D.ordenes.find(x => x.id === a.p_orden);
    if (!o) throw new Error("no existe la orden");
    if (o.dia !== HOY)           throw new Error("solo se corrigen los pedidos de hoy");
    if (o.estado === "anulado")  throw new Error("el pedido está anulado");
    if (o.estado === "entregado")throw new Error("el pedido ya se entregó");
    const items = a.p_items || [];
    _D.items = _D.items.filter(i => i.orden_id !== o.id);
    items.forEach(i => _D.items.push({ id:uid(), orden_id:o.id, sku:i.sku, nombre:i.nombre, categoria:i.categoria,
      cantidad:i.cantidad, precio:i.precio, subtotal:i.subtotal, opciones:i.opciones || {}, salsas:i.salsas || [], nota:i.nota || "" }));
    o.medio_pago = a.p_medio;
    o.nota    = a.p_nota || "";
    if ("p_cliente" in a) o.cliente = a.p_cliente || "";
    o.total   = Math.round(items.reduce((s, i) => s + (+i.subtotal || 0), 0) * 100) / 100;
    o.editada_en = new Date().toISOString();
  }

  function anularOrden(a){
    const o = _D.ordenes.find(x => x.id === a.p_orden);
    if (!o) throw new Error("no existe la orden");
    if (a.p_anular === false){
      o.estado = o.entregada_en ? "entregado" : o.lista_en ? "listo" : o.iniciada_en ? "prep" : "cola";
    } else o.estado = "anulado";
  }

  const RPC = {
    mi_turno_hoy: () => _admin ? [] : _D.turnos,
    mis_ferias_inventario: () => _admin ? [] : _D.invFerias.map(id => ({ feria_id:id })),
    avance_bono: a => {
      const f = _D.ferias.find(x => x.id === a.p_feria);
      if (!f || !f.punto0) return null;
      const vendido = vivas().filter(o => o.feria_id === a.p_feria).reduce((s, o) => s + (+o.total || 0), 0);
      return Math.round(vendido / f.punto0 * 100);
    },
    crear_orden:  crearOrden,
    editar_orden: editarOrden,
    anular_orden: anularOrden,
    marcar_pos: a => { const o = _D.ordenes.find(x => x.id === a.p_orden); if (o) o.pos_ok = a.p_ok !== false; },
    marcar_estado: a => {
      const o = _D.ordenes.find(x => x.id === a.p_orden); if (!o) return;
      o.estado = a.p_estado;
      const t = new Date().toISOString();
      if (a.p_estado === "prep")      o.iniciada_en  = t;
      if (a.p_estado === "listo")     o.lista_en     = t;
      if (a.p_estado === "entregado"){ o.entregada_en = t; o.cocinero_id = _D.perfil.id; }
    },
    guardar_inventario: a => {
      const fecha = a.p_fecha || HOY;
      let r = _D.inventarios.find(x => x.feria_id === a.p_feria && x.fecha === fecha);
      if (!r){ r = { id:uid(), feria_id:a.p_feria, fecha }; _D.inventarios.push(r); }
      r.datos = a.p_datos || {};
      r.nota  = a.p_nota || null;
      r.perfil_id = _D.perfil.id;
      r.por_nombre = _D.perfil.nombre;
      r.actualizado_en = new Date().toISOString();
    }
  };

  /* ------------------------------------------------------------- cliente */
  function createClient(){
    return {
      auth: {
        getSession: async () => ({ data:{ session:{ user:{ id:_D.perfil.id, email:_D.perfil.correo } } }, error:null }),
        getUser:    async () => ({ data:{ user:{ id:_D.perfil.id, email:_D.perfil.correo } }, error:null }),
        signOut:    async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        updateUser: async () => ({ data:{}, error:null }),
        signInWithPassword: async () => ({ data:{}, error:null }),
        resetPasswordForEmail: async () => ({ data:{}, error:null })
      },
      from: nombre => builder(nombre),
      rpc: async (nombre, args) => {
        _D.llamadas.push({ tipo:"rpc", nombre, args:args || {} });
        const fn = RPC[nombre];
        if (!fn) return mal('function public.' + nombre + ' does not exist', "PGRST202");
        try { return ok(fn(args || {})) } catch(e){ return mal(e.message) }
      }
    };
  }

  window.supabase = { createClient };
})();
