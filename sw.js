/* Gulf Fishing Planner service worker. Built by tools/build-site.mjs, which fills in VERSION.
   Shell (the app, icons, MapLibre): stale-while-revalidate from a versioned cache, so it opens offline.
   Fonts: runtime cache. Weather, tiles, photos and AI calls: always network (the app handles failures). */
const VERSION = '8fb6782fa3';
const SHELL_CACHE = 'shell-' + VERSION, RUNTIME_CACHE = 'runtime-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];
const LIBS = ['https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', 'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css'];

function strategyFor(url, origin){
  if(url.origin === origin) return 'shell';
  if(url.origin === 'https://unpkg.com' && url.pathname.startsWith('/maplibre-gl@')) return 'shell';
  if(url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') return 'runtime';
  return 'network';
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL).then(() => c.addAll(LIBS).catch(() => {}))));   // libraries are best-effort
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if(e.data === 'skipWaiting') self.skipWaiting(); });   // the page asks after the user taps Reload

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url), kind = strategyFor(url, self.location.origin);
  if(kind === 'network') return;
  const cacheName = kind === 'shell' ? SHELL_CACHE : RUNTIME_CACHE;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(cacheName).then(async c => {
    const hit = await c.match(key, { ignoreSearch:req.mode === 'navigate' });
    const fresh = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) c.put(key, res.clone()); return res; }).catch(() => null);
    if(hit){ e.waitUntil(fresh); return hit; }
    return (await fresh) || Response.error();
  }));
});
