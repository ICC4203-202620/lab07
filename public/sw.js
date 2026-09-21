/*
 * Service worker de la Weather App.
 *
 * Se registra desde src/registerServiceWorker.js y solo corre en la aplicación
 * construida (`yarn build && yarn preview`), nunca en `yarn dev`.
 *
 * Su responsabilidad es guardar los ARCHIVOS de la aplicación para que ésta
 * pueda abrirse sin conexión. Los DATOS del clima los guarda la aplicación por
 * su cuenta, en src/api/weatherCache.js.
 */

// El nombre del caché lleva versión. Al cambiarlo, el service worker nuevo
// precachea todo otra vez y borra el caché anterior en su evento activate.
const CACHE = 'weather-app-v1';

// Archivos de rutas fijas, que conocemos al escribir este archivo.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// El bundle de la aplicación, en cambio, lleva un hash en el nombre que cambia
// en cada build, así que no podemos escribirlo aquí. Vite deja la lista de los
// archivos que generó en assets-manifest.json (ver vite.config.js) y la leemos
// al instalarnos. Los empaquetadores serios hacen exactamente esto, solo que
// inyectan la lista dentro del service worker en tiempo de build.
const ASSETS_MANIFEST = '/assets-manifest.json';

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(APP_SHELL);

  try {
    const response = await fetch(ASSETS_MANIFEST, { cache: 'no-store' });
    const manifest = await response.json();
    const assets = Object.values(manifest)
      .flatMap((entry) => [entry.file, ...(entry.css ?? [])])
      .filter(Boolean)
      .map((file) => '/' + file);
    await cache.addAll(assets);
  } catch (err) {
    console.warn('[sw] no se pudo precachear el bundle:', err);
  }
}

// 1) install: se ejecuta una sola vez por versión del service worker.
self.addEventListener('install', (event) => {
  // skipWaiting evita que la versión nueva se quede esperando a que el usuario
  // cierre todas las pestañas que están usando la anterior.
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

// 2) activate: el momento de limpiar lo que dejó la versión anterior.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name))
      );
      // clients.claim toma el control de las pestañas que ya estaban abiertas,
      // sin esperar a que se recarguen.
      await self.clients.claim();
    })()
  );
});

const isGoogleFont = (url) =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

// 3) fetch: aquí se decide, petición por petición, qué se responde desde el
// caché y qué se pide a la red.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo nos interesan las lecturas. Un POST o un PUT siempre va a la red.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Las llamadas a Open-Meteo NO se interceptan, a propósito. Si las
  // respondiéramos desde el caché, la aplicación no tendría manera de saber si
  // el dato que muestra es de ahora o de anteayer, y justamente queremos
  // mostrarle al usuario cuándo se obtuvo. Ese caché vive en weatherCache.js.
  if (url.hostname.endsWith('open-meteo.com')) return;

  // Navegación: incluye las rutas del router (/, /search), que no existen como
  // archivo en el servidor.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Todo lo demás de nuestro propio origen, más las tipografías de Google.
  if (url.origin === self.location.origin || isGoogleFont(url)) {
    event.respondWith(cacheFirst(request));
  }
});

// Red primero: el usuario ve siempre la versión más nueva de la aplicación, y
// solo si la red falla recurrimos al index.html guardado. Cualquier ruta del
// router se resuelve con ese mismo archivo.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    cache.put('/index.html', response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match('/index.html');
    if (cached) return cached;

    console.warn('[sw] sin red y sin index.html en caché:', err);
    return new Response('La aplicación no está disponible sin conexión.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// Caché primero: los nombres de los archivos del bundle incluyen un hash del
// contenido, de modo que una misma URL siempre devuelve lo mismo. Si ya está
// guardada, consultar la red sería trabajo perdido.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);

  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone());
  }
  return response;
}
