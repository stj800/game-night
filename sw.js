/* Offline cache. Bump VERSION on every deploy. */
var VERSION = 'gn-v36';
var FILES = ['./', 'index.html', 'styles.css', 'manifest.json', 'icon-180.png', 'icon-512.png',
  'js/ui.js', 'js/audio.js', 'js/classical.js', 'js/chinese.js', 'js/chess-engine.js', 'js/chess.js', 'js/checkers.js', 'js/sudoku.js', 'js/blocks.js', 'js/breakout.js', 'js/rocks.js', 'js/invaders.js', 'js/mahjong.js', 'js/memory.js', 'js/cardprefs.js', 'js/rummy-engine.js', 'js/rummy.js', 'js/pitch-engine.js', 'js/pitch.js', 'js/swap-engine.js', 'js/swap.js', 'js/app.js'];
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
  // Always ask the server for the newest copy (no-cache revalidates instead of using a stale HTTP cache)
  var fresh = new URL(e.request.url).origin === self.location.origin ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(e.request);
  e.respondWith(fresh.then(function (r) {
    var copy = r.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
