'use strict';
/* Oddiy xizmat ishchisi: avval internetdan oladi, internet bo'lmasa saqlangan nusxani ko'rsatadi. */
const KESH = 'totli-baliq-v3';
const FAYLLAR = ['./', 'index.html', 'style.css', 'app.js', 'admin.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(KESH).then((c) => c.addAll(FAYLLAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== KESH).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;   // server so'rovlariga tegmaymiz
  if (req.destination === 'video' || req.headers.has('range')) return;   // video bo'laklarini saqlamaymiz
  e.respondWith(
    fetch(req).then((res) => {
      const nusxa = res.clone();
      caches.open(KESH).then((c) => c.put(req, nusxa));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
