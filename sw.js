/**
 * SUT Service Worker — estrategia Cache-First para assets estáticos,
 * Network-First para datos dinámicos (Firebase).
 */
const CACHE_NAME = 'sut-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/store.js',
  '/js/tasks.js',
  '/js/courses.js',
  '/js/tags.js',
  '/js/calendar.js',
  '/js/events.js',
  '/js/theme.js',
  '/js/onboarding.js',
  '/js/notifications.js',
  '/js/search.js',
  '/js/toasts.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/spaces.js',
  '/js/firebase-config.js',
  '/assets/icon.svg',
  '/assets/favicon.svg',
  '/assets/logo.svg',
];

/* ── Install: pre-cachear assets estáticos ─────────────────────── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch((err) => console.warn('[SW] Pre-cache parcial:', err))
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate: limpiar caches viejas ───────────────────────────── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache-First para assets, Network-First para el resto ─ */
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Ignorar Firebase, Google APIs, y peticiones externas
  if (
    !url.origin.includes(self.location.origin) ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('googleapis')
  ) {
    return; // dejar pasar sin interceptar
  }

  // Cache-First para assets estáticos
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    STATIC_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a))
  ) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Network-First para el HTML principal (para que siempre esté actualizado)
  if (request.destination === 'document') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }
});

/* ── Mensaje para forzar actualización ────────────────────────── */
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
