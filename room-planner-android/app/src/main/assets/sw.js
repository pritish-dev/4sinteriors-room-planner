// Offline cache for the web version (GitHub Pages / iPhone home-screen app).
// The deploy workflow replaces __BUILD__ with the commit id, so each release gets a
// fresh cache and old files are dropped. The login call itself is never cached.
const CACHE = 'room-planner-__BUILD__';
const CORE = ['./', './index.html', './three.min.js', './catalog.js', './images.js', './cutouts/index.js',
  './manifest.json', './icon-192.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // never touch the login backend
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  })));
});
