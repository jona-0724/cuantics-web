/* MiPlata — service worker
   - Guarda la "cáscara" de la app (HTML, estilos, scripts, íconos) para abrir rápido y sin señal.
   - Los datos (Supabase) y las Edge Functions NUNCA se guardan en caché: siempre van a la red.
   - Cambiar VERSION en cada publicación para que los celulares tomen la versión nueva. */
const VERSION = 'miplata-v1-2026-10-20h';
const CASCARA = [
  './', './index.html', './estilo.css', './estilo-v1.css', './config.js', './jerga.js', './interprete.js', './app.js',
  './manifest.webmanifest', './icons/icono-192.png', './icons/icono-512.png', './icons/favicon-32.png',
  '../lib/supabase-2.45.4.min.js', '../img/qr-plin-codigo.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(CASCARA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // datos, autenticación, funciones y almacenamiento: siempre por red, sin caché
  if (url.hostname.endsWith('supabase.co')) return;
  // HTML: primero la red (para tener siempre la última versión), si no hay señal, la copia guardada
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  const guardar = r => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); } return r; };
  // librerías y fuentes (no cambian): primero la caché
  if (url.pathname.includes('/lib/') || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    ev.respondWith(caches.match(req).then(g => g || fetch(req).then(guardar)));
    return;
  }
  // archivos propios (app.js, estilos, íconos): primero la red para tener siempre la última versión; sin señal, la copia
  if (url.origin === location.origin) {
    ev.respondWith(fetch(req).then(guardar).catch(() => caches.match(req)));
  }
});
