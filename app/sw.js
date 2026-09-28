/* Service worker: aplikacja działa bez internetu. Zmień VERSION przy każdej aktualizacji plików (razem z version w config.js). */
var VERSION = 'lt-2026.09.28-4';
var CACHE = VERSION + '@' + self.registration.scope;   // osobna pamięć dla każdej kopii aplikacji (stabilna, testowa)
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'views.js', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
});
// Nowa wersja czeka, aż użytkownik dotknie „Zaktualizuj” na ekranie startowym (nigdy w trakcie treningu).
self.addEventListener('message', function (e) { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== 'lt-fonts' && k.indexOf('@' + self.registration.scope) > -1; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  // Zapytania do skryptu Google idą zawsze prosto do sieci.
  if (u.hostname === 'script.google.com' || u.hostname.slice(-18) === 'googleusercontent.com') return;
  // Czcionki: zapamiętaj przy pierwszym użyciu, potem działają offline.
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('lt-fonts').then(function (c) {
      return c.match(req).then(function (m) {
        var net = fetch(req).then(function (r) { c.put(req, r.clone()); return r; }).catch(function () { return m; });
        return m || net;
      });
    }));
    return;
  }
  // Pliki aplikacji: zawsze z pamięci tej samej wersji (spójnie), z sieci tylko gdy czegoś brakuje.
  if (u.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (m) {
        return m || fetch(req).catch(function () { return c.match('index.html'); });
      });
    }));
  }
});
