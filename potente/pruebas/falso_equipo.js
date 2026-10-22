/* ============================================================================
   POTENTE · doble de Supabase para la plataforma del equipo
   ----------------------------------------------------------------------------
   Reemplaza lib/supabase-js-*.js en potente/equipo/. Cubre lo que esa página
   usa: auth y el constructor de consultas sobre perfiles, ferias, bloques,
   disponibilidad, asignaciones y envios — incluidos insert, update, upsert y
   delete, que ahí sí se usan de verdad.

   La feria de prueba dura tres días a propósito: la tabla de turnos no entra
   en pantalla y aparece la barra horizontal, que es donde vivía el error de
   perder el desplazamiento al asignar a alguien.

   window.__E deja los datos y el registro de escrituras a la vista.
   ========================================================================== */
(function(){
  const TZ = "America/Lima";
  const fDia = new Intl.DateTimeFormat("en-CA", { timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit" });
  const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return fDia.format(d) };
  const quien = new URLSearchParams(location.search).get("quien") || "admin";
  const _admin = quien !== "feriante";

  const D1 = dias(2), D2 = dias(3), D3 = dias(4);   // viernes, sábado, domingo

  const perfiles = [
    { id:"u-admin", nombre:"Jonathan Ortiz",  correo:"admin@potente.pe", rol:"admin",    activo:true },
    { id:"u-ivana", nombre:"Ivana Panduro",   correo:"ivana@potente.pe", rol:"feriante", activo:true },
    { id:"u-sami",  nombre:"Samira Panduro",  correo:"sami@potente.pe",  rol:"feriante", activo:true },
    { id:"u-lucho", nombre:"Luis Caballero",  correo:"lucho@potente.pe", rol:"feriante", activo:true },
    { id:"u-rosa",  nombre:"Rosa Medina",     correo:"rosa@potente.pe",  rol:"feriante", activo:true }
  ];

  /* Tres días de feria + los dos bloques de Dark Kitchen: seis columnas, que
     es justo lo que no entra en una pantalla de laptop. */
  const bloques = [
    { id:"b-dkp", feria_id:"f1", fecha:D1, tipo:"dk_prep",     etiqueta:"",       hora_inicio:"08:00:00", hora_fin:"14:00:00", personas_necesarias:1, condicional:false },
    { id:"b-v1",  feria_id:"f1", fecha:D1, tipo:"feria",       etiqueta:"Mañana", hora_inicio:"10:00:00", hora_fin:"16:00:00", personas_necesarias:4, condicional:false },
    { id:"b-v2",  feria_id:"f1", fecha:D1, tipo:"feria",       etiqueta:"Tarde",  hora_inicio:"16:00:00", hora_fin:"22:00:00", personas_necesarias:4, condicional:false },
    { id:"b-dkd", feria_id:"f1", fecha:D2, tipo:"dk_despacho", etiqueta:"",       hora_inicio:"08:00:00", hora_fin:"11:00:00", personas_necesarias:1, condicional:true  },
    { id:"b-s1",  feria_id:"f1", fecha:D2, tipo:"feria",       etiqueta:"Mañana", hora_inicio:"10:00:00", hora_fin:"16:00:00", personas_necesarias:4, condicional:false },
    { id:"b-s2",  feria_id:"f1", fecha:D2, tipo:"feria",       etiqueta:"Tarde",  hora_inicio:"16:00:00", hora_fin:"22:00:00", personas_necesarias:4, condicional:false },
    { id:"b-d1",  feria_id:"f1", fecha:D3, tipo:"feria",       etiqueta:"Mañana", hora_inicio:"10:00:00", hora_fin:"16:00:00", personas_necesarias:4, condicional:false },
    { id:"b-d2",  feria_id:"f1", fecha:D3, tipo:"feria",       etiqueta:"Tarde",  hora_inicio:"16:00:00", hora_fin:"22:00:00", personas_necesarias:4, condicional:false }
  ];

  /* Todo el equipo dijo que sí a todos los bloques: así el desplegable de
     cualquier casilla tiene a quién ofrecer. */
  const disponibilidad = [];
  bloques.forEach(b => perfiles.filter(p => p.rol === "feriante").forEach((p, n) => {
    disponibilidad.push({ id:"d-" + b.id + "-" + p.id, bloque_id:b.id, perfil_id:p.id,
                          estado: n === 3 ? "quizas" : "si", actualizado_en:new Date().toISOString() });
  }));

  window.__E = {
    perfil: _admin ? perfiles[0] : perfiles[1],
    perfiles,
    ferias: [
      { id:"f1", nombre:"PERU BEBE Y SABE", lugar:"Parque de la Amistad (Surco)", direccion_dk:"Ca. Frisancho Melchor 376, Surco",
        fecha_inicio:D1, fecha_fin:D3, estado:"abierta", dias_definicion:3, punto0:0, bono_pct:50, mostrar_equipo:true }
    ],
    bloques, disponibilidad,
    asignaciones: [],
    envios: [],
    escrituras: []
  };
  const _E = window.__E;

  function tabla(nombre){
    switch (nombre){
      case "perfiles":       return _E.perfiles;
      case "ferias":         return _E.ferias;
      case "bloques":        return _E.bloques;
      case "disponibilidad": return _E.disponibilidad;
      case "asignaciones":   return _E.asignaciones;
      case "envios":         return _E.envios;
      default: return null;
    }
  }

  const ok  = data => ({ data, error:null });
  const mal = (msg, code) => ({ data:null, error:{ message:msg, code:code || "PGRST000", hint:"" } });
  const uid = () => "x" + Math.random().toString(36).slice(2, 9);

  function builder(nombre){
    const filtros = [];
    const ordenes = [];
    let modo = "select", carga = null;

    const filtrar = () => {
      let f = tabla(nombre);
      if (f == null) return null;
      f = f.slice();
      filtros.forEach(t => {
        if (t.op === "eq")  f = f.filter(r => String(r[t.c]) === String(t.v));
        if (t.op === "neq") f = f.filter(r => String(r[t.c]) !== String(t.v));
        if (t.op === "in")  f = f.filter(r => t.v.map(String).indexOf(String(r[t.c])) >= 0);
      });
      ordenes.forEach(o => f.sort((a, b) => {
        const x = a[o.c], y = b[o.c];
        if (x === y) return 0;
        return ((x > y) ? 1 : -1) * (o.asc ? 1 : -1);
      }));
      return f;
    };

    const correr = () => {
      const base = tabla(nombre);
      if (base == null) return mal('relation "public.' + nombre + '" does not exist', "42P01");
      const f = filtrar();

      if (modo === "insert" || modo === "upsert"){
        const filas = (Array.isArray(carga) ? carga : [carga]).map(x => Object.assign({ id:uid() }, x));
        filas.forEach(nueva => {
          const i = modo === "upsert" ? base.findIndex(r => r.id === nueva.id) : -1;
          if (i >= 0) Object.assign(base[i], nueva); else base.push(nueva);
        });
        _E.escrituras.push({ tipo:modo, tabla:nombre, filas:filas.length });
        return ok(filas);
      }
      if (modo === "update"){
        f.forEach(r => Object.assign(r, carga));
        _E.escrituras.push({ tipo:"update", tabla:nombre, cambios:carga, filas:f.length });
        return ok(f);
      }
      if (modo === "delete"){
        f.forEach(r => { const i = base.indexOf(r); if (i >= 0) base.splice(i, 1) });
        _E.escrituras.push({ tipo:"delete", tabla:nombre, filas:f.length });
        return ok(f);
      }
      if (modo === "single")      return f.length === 1 ? ok(f[0]) : mal("no rows", "PGRST116");
      if (modo === "maybeSingle") return ok(f.length ? f[0] : null);
      return ok(f);
    };

    const api = {
      select(){ return api },
      eq(c, v){ filtros.push({ op:"eq", c, v }); return api },
      neq(c, v){ filtros.push({ op:"neq", c, v }); return api },
      in(c, v){ filtros.push({ op:"in", c, v:v || [] }); return api },
      order(c, o){ ordenes.push({ c, asc:!o || o.ascending !== false }); return api },
      limit(){ return api },
      single(){ modo = "single"; return api },
      maybeSingle(){ modo = "maybeSingle"; return api },
      insert(x){ modo = "insert"; carga = x; return api },
      upsert(x){ modo = "upsert"; carga = x; return api },
      update(x){ modo = "update"; carga = x; return api },
      delete(){ modo = "delete"; return api },
      then(res, rej){
        try { return Promise.resolve(correr()).then(res, rej) }
        catch(e){ return Promise.resolve(mal(e.message)).then(res, rej) }
      }
    };
    return api;
  }

  function createClient(){
    const u = () => ({ id:_E.perfil.id, email:_E.perfil.correo });
    return {
      auth: {
        getSession: async () => ({ data:{ session:{ user:u() } }, error:null }),
        getUser:    async () => ({ data:{ user:u() }, error:null }),
        signOut:    async () => ({ error:null }),
        onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
        signInWithPassword: async () => ({ data:{ user:u() }, error:null }),
        resetPasswordForEmail: async () => ({ data:{}, error:null }),
        updateUser: async () => ({ data:{ user:u() }, error:null })
      },
      from: nombre => builder(nombre),
      rpc: async nombre => mal('function public.' + nombre + ' does not exist', "PGRST202")
    };
  }

  window.supabase = { createClient };
})();
