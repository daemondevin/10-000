// Service worker for the installable game. The server (pwa.js) fills in VERSION and PRECACHE
// when it serves /sw.js, so this file is a template and is never served as it is.
//
// Pages: the network first, so online games and rule changes are always current, and the
// stored copy when there is no connection. Room pages fall back to the lobby, which says
// online games need a connection.
// Everything else: the stored copy at once, refreshed in the background.
// Never stored: the socket.io connection and the /api/ calls, they only make sense live.

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL = `farkle-shell-${VERSION}`;
const RUNTIME = `farkle-runtime-${VERSION}`;
const PAGES = ["/", "/rules", "/farkle.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
  // A new version waits until the page says the player is ready (see app.js), unless this is
  // the first install
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("farkle-") && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/socket.io/") || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(page(request, url));
    return;
  }
  event.respondWith(asset(event, request, url));
});

async function page(request, url) {
  try {
    const response = await fetch(request);
    // Keep the latest copy of the pages that work offline
    if (response.ok && !response.redirected && PAGES.includes(url.pathname)) {
      const cache = await caches.open(SHELL);
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch (err) {
    const stored = (await caches.match(url.pathname, { ignoreSearch: true })) || (await caches.match("/"));
    return stored || Response.error();
  }
}

async function asset(event, request, url) {
  // Fonts are asked for with a version query (?v=...), the stored copy has none
  const ignoreSearch = /\.(woff2?|png|svg)$/.test(url.pathname);
  const stored = await caches.match(request, { ignoreSearch });
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(PRECACHE.includes(url.pathname) ? SHELL : RUNTIME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Keep the worker alive until the refreshed copy is stored
  event.waitUntil(refresh);
  if (stored) return stored;
  const fresh = await refresh;
  return fresh || Response.error();
}
