// Swellness offline cache. Bump comes from the build hash.
const CACHE = 'swellness-a5a9345077';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
// Exercise photos (ours in ex/, and ones found in the free-exercise-db library) survive app updates
const LIB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/';
const keepAcross = (url) => url.startsWith(LIB) || new URL(url).pathname.includes('/ex/');
const save = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = await caches.open(CACHE);
    for (const k of await caches.keys()) {
      if (k === CACHE) continue;
      const old = await caches.open(k);
      for (const req of await old.keys()) {
        if (keepAcross(req.url)) { const r = await old.match(req); if (r) await keep.put(req, r); }
      }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // library photos and steps: cache-first, saved the first time they are seen
  if (req.url.startsWith(LIB)) { e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => save(req, res)))); return; }
  if (new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // network first for the page so updates arrive, cache when offline
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  const path = new URL(req.url).pathname;
  // instructions and the library index: network first so updates arrive, cached copy when offline
  if (path.includes('/ex/') && path.endsWith('.json')) {
    e.respondWith(fetch(req).then((res) => save(req, res)).catch(() => caches.match(req)));
    return;
  }
  // cache-first; exercise photos are cached the first time they are viewed
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => (path.includes('/ex/') ? save(req, res) : res))));
});
