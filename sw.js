const CACHE = 'knicks-2627-v13';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // network-first for logos/CDN, cache-first for app shell
  if (e.request.method !== 'GET') return;
  // sync API calls (Cloudflare Worker) must always hit the network, never the cache
  const reqUrl = new URL(e.request.url);
  if (reqUrl.pathname === '/pull' || reqUrl.pathname === '/push') return;
  // the app page itself: network-first so a new deploy shows up on the next open
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return resp;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(networkResp => {
        if (e.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then(c => c.put(e.request, networkResp.clone()));
        }
        return networkResp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
