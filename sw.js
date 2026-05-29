/**
 * Pylon Mobile — Service Worker
 *
 * Strategy:
 *  - Shell (HTML, manifest, icons): stale-while-revalidate. Boots instantly even
 *    offline, then fetches the latest in the background.
 *  - Pylon API + CORS proxy: NEVER cache. Always go to the network so data is
 *    fresh and writes always reach Pylon.
 *  - On new SW version, postMessage to clients so they can show an "Update
 *    available" prompt and reload when the user is ready.
 */

const VERSION = 'pylon-mobile-v16';
const SHELL_CACHE = `${VERSION}-shell`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon.svg',
];

// Hosts we should always bypass the cache for (live data)
const NEVER_CACHE_HOSTS = [
  'api.usepylon.com',
  'app.usepylon.com',
  // Any *.workers.dev CORS proxy
  /\.workers\.dev$/,
];

function isLiveDataRequest(url) {
  for (const h of NEVER_CACHE_HOSTS) {
    if (typeof h === 'string') {
      if (url.hostname === h) return true;
    } else if (h instanceof RegExp) {
      if (h.test(url.hostname)) return true;
    }
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only GET requests are cacheable
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Live data: bypass cache entirely
  if (isLiveDataRequest(url)) return;

  // Only handle same-origin and known CDN assets
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate for the shell + same-origin assets
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Refresh in background; serve cached now
        event.waitUntil(networkFetch);
        return cached;
      }
      const live = await networkFetch;
      return live || cache.match('./index.html'); // offline fallback to shell
    })
  );
});

// Allow the page to ask the SW to skipWaiting (i.e., activate the new version now)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});
