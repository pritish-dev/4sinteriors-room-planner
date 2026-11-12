// Offline copy + automatic updates for the web app (GitHub Pages, iPhone home screen,
// and the Android app, which opens the same live page).
//  • Small app files (HTML/JS): network first, so a new release shows up as soon as the
//    phone is online; the cached copy is used offline.
//  • Big files (catalogue photos, 3D engine, cut-outs, recogniser model): cache first,
//    refreshed in the background, kept across releases.
// The deploy workflow replaces __BUILD__ with the commit id on every release.
const BUILD = '__BUILD__';
const APP = 'rp-app-' + BUILD, BIG = 'rp-big-v1';
const CORE = ['./', './index.html', './auth.js', './flow.js', './detect.js', './share.js', './catalog.js', './colours.js',
  './cutouts/index.js', './models/index.js', './manifest.json', './icon-192.png', './apple-touch-icon.png'];
const isBig = p => /\/(images\.js|three\.min\.js|GLTFLoader\.js)$|\/cutouts\/.+\.webp$|\/vendor\//.test(p);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== BIG).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;   // never touch the login backend
  if (isBig(u.pathname)) {
    e.respondWith(caches.open(BIG).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(APP).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
