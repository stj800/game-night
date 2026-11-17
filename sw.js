/* Offline cache. Bump VERSION on every deploy. */
var VERSION = 'gn-v15';
var FILES = ['./', 'index.html', 'styles.css', 'manifest.json', 'icon-180.png', 'icon-512.png',
  'js/ui.js', 'js/audio.js', 'js/chess-engine.js', 'js/chess.js', 'js/checkers.js', 'js/sudoku.js', 'js/blocks.js', 'js/mahjong.js', 'js/swap-engine.js', 'js/swap.js', 'js/app.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Network first so updates show up right away; fall back to the cache offline.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
