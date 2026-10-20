/* MiPlata — diccionario de jerga peruana.
   Todo en minúsculas y sin tildes (el intérprete normaliza antes de buscar).
   Para sumar expresiones nuevas basta con agregarlas aquí. */
(function (g) {
  'use strict';

  // Palabras que significan "soles"
  const MONEDA = ['sol', 'soles', 'luca', 'lucas', 'luka', 'lukas', 'mango', 'mangos', 'lempira', 'lempiras'];

  // Céntimos (se suman como /100 cuando aparecen tras un monto)
  const CENTIMOS = ['centimo', 'centimos', 'centavo', 'centavos', 'cents'];

  // "china" = moneda de S/ 0.50
  const CHINA = ['china', 'chinas'];

  // Palabras de número en español
  const UNIDADES = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
    veintinueve: 29
  };
  const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
  const CENTENAS = {
    cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
    cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
    setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900
  };

  // Frases que indican INGRESO (se buscan sobre el texto normalizado)
  const INGRESO = [
    /\bme (yapearon|yapiaron|plinearon|depositaron|pagaron|transfirieron|abonaron|cayo|cayeron|dieron|mandaron|enviaron|yapeo|yapio|plineo|deposito|transfirio|abono|dio|mando|envio)\b/,
    /\b(me han|me ha) (yapeado|depositado|pagado|transferido|abonado)\b/,
    /\b(cobre|recibi|gane|ingreso|ingresaron|entraron|entro)\b/,
    /\b(sueldo|quincena|gratificacion|grati|cts|aguinaldo|propina recibida)\b/,
    /\b(vendi|venta|ventas)\b/
  ];

  // Medios de pago genéricos: palabra dicha → tipo y nombre sugerido
  const MEDIOS_GENERICOS = [
    { tipo: 'yape', palabras: ['yape', 'yapee', 'yapie', 'yapeo', 'yapear', 'yapeado', 'yapeando', 'yapearon', 'yapiaron', 'yapeaste'] },
    { tipo: 'plin', palabras: ['plin', 'plinee', 'plinie', 'plineo', 'plinear', 'plinearon'] },
    { tipo: 'efectivo', palabras: ['efectivo', 'cash', 'sencillo', 'billete', 'contado', 'cache'] },
    { tipo: 'debito', palabras: ['debito'] },
    { tipo: 'credito', palabras: ['credito'] },
    { tipo: 'transferencia', palabras: ['transferencia', 'transferi', 'deposite', 'depositaron', 'transfirieron'] },
    { tipo: 'tarjeta', palabras: ['tarjeta', 'tarjetita', 'visa', 'mastercard', 'master'] }
  ];

  // Sugerencias para "Mis medios de pago" (onboarding). tipo_base: efectivo | billetera | debito | credito | transferencia
  const MEDIOS_SUGERIDOS = [
    { nombre: 'Efectivo', tipo_base: 'efectivo', alias: ['efectivo', 'cash', 'sencillo', 'contado'] },
    { nombre: 'Yape', tipo_base: 'billetera', alias: ['yape', 'yapee', 'yapie', 'yapeo', 'yapearon'] },
    { nombre: 'Plin', tipo_base: 'billetera', alias: ['plin', 'plinee', 'plinearon'] },
    { nombre: 'BCP débito', tipo_base: 'debito', alias: ['bcp debito', 'debito bcp', 'bcp'] },
    { nombre: 'BCP crédito', tipo_base: 'credito', alias: ['bcp credito', 'credito bcp'] },
    { nombre: 'Interbank', tipo_base: 'debito', alias: ['interbank'] },
    { nombre: 'BBVA', tipo_base: 'debito', alias: ['bbva', 'continental'] },
    { nombre: 'Scotiabank', tipo_base: 'debito', alias: ['scotiabank', 'scotia'] },
    { nombre: 'Ripley', tipo_base: 'credito', alias: ['ripley', 'tarjeta ripley'] },
    { nombre: 'CMR Saga Falabella', tipo_base: 'credito', alias: ['cmr', 'saga', 'falabella', 'tarjeta saga'] },
    { nombre: 'Oh!', tipo_base: 'credito', alias: ['oh', 'tarjeta oh'] },
    { nombre: 'Cuenta sueldo', tipo_base: 'debito', alias: ['cuenta sueldo', 'tarjeta sueldo', 'tarjeta del sueldo'] },
    { nombre: 'Transferencia', tipo_base: 'transferencia', alias: ['transferencia', 'transferi'] }
  ];

  // Lugares conocidos: alias normalizados → nombre bonito y categoría sugerida
  const LUGARES = [
    ['Tambo', 'mercado', ['tambo', 'tambo+']],
    ['Oxxo', 'mercado', ['oxxo']],
    ['Mass', 'mercado', ['mass', 'tienda mass']],
    ['Plaza Vea', 'mercado', ['plaza vea', 'plazavea', 'plaza bea']],
    ['Tottus', 'mercado', ['tottus', 'totus']],
    ['Metro', 'mercado', ['metro', 'supermercado metro']],
    ['Wong', 'mercado', ['wong']],
    ['Vivanda', 'mercado', ['vivanda']],
    ['Makro', 'mercado', ['makro', 'macro']],
    ['Mercado', 'mercado', ['mercado', 'mercadito', 'el mercado']],
    ['Bodega', 'mercado', ['bodega', 'bodeguita', 'la bodega', 'tienda de la esquina']],
    ['Panadería', 'mercado', ['panaderia']],
    ['Inkafarma', 'salud', ['inkafarma', 'inka farma']],
    ['Mifarma', 'salud', ['mifarma', 'mi farma']],
    ['Farmacia', 'salud', ['farmacia', 'botica']],
    ['KFC', 'restaurantes', ['kfc']],
    ['Bembos', 'restaurantes', ['bembos']],
    ['Starbucks', 'restaurantes', ['starbucks']],
    ['Pardos', 'restaurantes', ['pardos']],
    ['Norky\'s', 'restaurantes', ['norkys', 'norky']],
    ['Pollería', 'restaurantes', ['polleria', 'pollo a la brasa']],
    ['Chifa', 'restaurantes', ['chifa']],
    ['Menú', 'restaurantes', ['menu', 'menucito']],
    ['Rappi', 'delivery', ['rappi']],
    ['PedidosYa', 'delivery', ['pedidosya', 'pedidos ya']],
    ['Uber', 'transporte', ['uber']],
    ['Cabify', 'transporte', ['cabify']],
    ['DiDi', 'transporte', ['didi']],
    ['InDrive', 'transporte', ['indrive', 'indriver', 'in drive']],
    ['Taxi', 'transporte', ['taxi']],
    ['Combi', 'transporte', ['combi', 'micro', 'custer', 'coaster']],
    ['Metropolitano', 'transporte', ['metropolitano']],
    ['Tren', 'transporte', ['tren', 'linea 1', 'metro de lima']],
    ['Mototaxi', 'transporte', ['mototaxi', 'moto']],
    ['Grifo', 'combustible', ['grifo', 'gasolinera']],
    ['Primax', 'combustible', ['primax']],
    ['Repsol', 'combustible', ['repsol']],
    ['Pecsa', 'combustible', ['pecsa']],
    ['Sodimac', 'ferreteria', ['sodimac']],
    ['Promart', 'ferreteria', ['promart']],
    ['Maestro', 'ferreteria', ['maestro']],
    ['Ferretería', 'ferreteria', ['ferreteria']],
    ['Oechsle', 'ropa', ['oechsle', 'oeschle']],
    ['Saga Falabella', 'ropa', ['saga falabella']],
    ['Ripley', 'ropa', ['tienda ripley']],
    ['Gamarra', 'ropa', ['gamarra']],
    ['Cineplanet', 'entretenimiento', ['cineplanet']],
    ['Cinemark', 'entretenimiento', ['cinemark']],
    ['Cine', 'entretenimiento', ['cine']],
    ['Netflix', 'suscripciones', ['netflix']],
    ['Spotify', 'suscripciones', ['spotify']],
    ['Disney+', 'suscripciones', ['disney']],
    ['Luz del Sur', 'hogar', ['luz del sur']],
    ['Enel', 'hogar', ['enel']],
    ['Sedapal', 'hogar', ['sedapal']],
    ['Cálidda', 'hogar', ['calidda']],
    ['Movistar', 'hogar', ['movistar']],
    ['Claro', 'hogar', ['claro']],
    ['Entel', 'hogar', ['entel']],
    ['Bitel', 'hogar', ['bitel']],
    ['Veterinaria', 'mascotas', ['veterinaria', 'veterinario']]
  ].map(([nombre, categoria, alias]) => ({ nombre, categoria, alias }));

  // Palabras sueltas que ayudan a sugerir categoría (no son lugar)
  const PISTAS_CATEGORIA = {
    mercado: ['frutas', 'fruta', 'verduras', 'carne', 'carnes', 'pollo', 'pescado', 'pan', 'leche', 'huevos', 'arroz', 'abarrotes', 'viveres', 'compras', 'gaseosa', 'agua mineral'],
    restaurantes: ['almuerzo', 'desayuno', 'cena', 'lonche', 'cafe', 'ceviche', 'hamburguesa', 'pizza', 'helado', 'comida', 'cerveza', 'chela', 'chelas'],
    delivery: ['delivery'],
    transporte: ['pasaje', 'pasajes', 'peaje', 'estacionamiento', 'cochera', 'colectivo', 'bus'],
    combustible: ['gasolina', 'petroleo', 'diesel', 'gas vehicular', 'glp', 'combustible'],
    hogar: ['luz', 'agua', 'gas', 'internet', 'cable', 'celular', 'recibo', 'limpieza', 'detergente'],
    alquiler: ['alquiler', 'renta', 'mantenimiento del edificio', 'arbitrios'],
    salud: ['pastillas', 'medicina', 'medicinas', 'doctor', 'consulta', 'clinica', 'dentista', 'analisis'],
    educacion: ['colegio', 'pension', 'universidad', 'curso', 'libros', 'utiles', 'matricula'],
    entretenimiento: ['entradas', 'concierto', 'juego', 'partido', 'discoteca', 'fiesta'],
    ropa: ['ropa', 'zapatillas', 'zapatos', 'polo', 'pantalon', 'peluqueria', 'corte', 'barberia'],
    ferreteria: ['clavos', 'pintura', 'tornillos', 'herramienta', 'gasfitero', 'electricista'],
    viajes: ['pasaje aereo', 'vuelo', 'hotel', 'hostal', 'viaje'],
    banco: ['cuota', 'prestamo', 'deuda', 'tarjeta de credito', 'interes', 'comision'],
    suscripciones: ['suscripcion', 'membresia', 'plan'],
    mascotas: ['perro', 'gato', 'croquetas', 'mascota'],
    regalos: ['regalo', 'cumpleanos', 'cumple', 'donacion', 'ofrenda']
  };

  const CATEGORIAS_GASTO = [
    { id: 'mercado', nombre: 'Mercado y alimentos' },
    { id: 'restaurantes', nombre: 'Restaurantes y comida' },
    { id: 'delivery', nombre: 'Delivery' },
    { id: 'transporte', nombre: 'Transporte' },
    { id: 'combustible', nombre: 'Combustible' },
    { id: 'hogar', nombre: 'Hogar y servicios' },
    { id: 'alquiler', nombre: 'Alquiler y vivienda' },
    { id: 'salud', nombre: 'Salud y farmacia' },
    { id: 'educacion', nombre: 'Educación' },
    { id: 'entretenimiento', nombre: 'Entretenimiento' },
    { id: 'ropa', nombre: 'Ropa y cuidado personal' },
    { id: 'ferreteria', nombre: 'Ferretería y mantenimiento' },
    { id: 'viajes', nombre: 'Viajes' },
    { id: 'banco', nombre: 'Pagos de banco y deudas' },
    { id: 'suscripciones', nombre: 'Suscripciones' },
    { id: 'mascotas', nombre: 'Mascotas' },
    { id: 'regalos', nombre: 'Regalos y familia' },
    { id: 'otros', nombre: 'Otros' }
  ];
  const CATEGORIAS_INGRESO = [
    { id: 'sueldo', nombre: 'Sueldo' },
    { id: 'billetera', nombre: 'Yape o Plin recibido' },
    { id: 'ventas', nombre: 'Ventas o negocio' },
    { id: 'freelance', nombre: 'Freelance' },
    { id: 'otros_ingresos', nombre: 'Otros ingresos' }
  ];

  const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const MESES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, setiembre: 8, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

  // Palabras de relleno que no son lugar ni detalle
  const RELLENO = ['gaste', 'gasto', 'gastos', 'gastar', 'compre', 'compra', 'pague', 'pago', 'pagado', 'pagada', 'pagando', 'con', 'en', 'de', 'del', 'el', 'la', 'los', 'las', 'un', 'una', 'por', 'para', 'al', 'a', 'y', 'mi', 'me', 'hoy', 'ayer', 'anteayer', 'antier', 'nomas', 'no', 'mas', 'total', 'fue', 'fueron', 'son', 'que', 'tarjeta', 'registra', 'registrar', 'anota', 'apunta', 'ponle', 'pon', 'eh', 'este', 'osea', 'o', 'sea', 'ya'];

  g.MiPlataJerga = {
    MONEDA, CENTIMOS, CHINA, UNIDADES, DECENAS, CENTENAS, INGRESO, MEDIOS_GENERICOS, MEDIOS_SUGERIDOS,
    LUGARES, PISTAS_CATEGORIA, CATEGORIAS_GASTO, CATEGORIAS_INGRESO, DIAS, MESES, RELLENO
  };
})(typeof window !== 'undefined' ? window : globalThis);
