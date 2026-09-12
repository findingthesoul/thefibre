// Connections service worker — the app opening with no connection at all.
//
// Build-order step 7, the remaining half. Deliberately small, because a service
// worker is sticky: a broken one stays on somebody's phone until it updates,
// and it sits between them and every page. So it does as little as possible,
// and each thing it does NOT do is a decision rather than an omission.
//
// ── What it does ────────────────────────────────────────────────────────────
//
//   * Navigations go to the network first. Only when the network FAILS does it
//     answer with /offline.html, a self-contained page that lets somebody pick
//     a person and write a note into the device queue.
//   * /_next/static files are cached as they load and served from cache after.
//     They are content-hashed and immutable, so a cached copy can never be
//     stale, and they contain no personal data — they are the app's code.
//
// ── What it deliberately does NOT do ────────────────────────────────────────
//
//   * Cache a signed-in PAGE. Every page here is rendered on the server for one
//     person, full of names and notes. A cached copy would keep that on the
//     device past sign-out and show yesterday's data as though it were current.
//   * Touch anything but same-origin GET. Server actions are POSTs, the API
//     lives on another origin, and a service worker that intercepted either
//     would be a second, invisible network layer to debug.
//   * Answer Next's client-side navigations (the RSC requests a link click
//     makes) with HTML. Handing the router an HTML page where it expects a
//     flight payload breaks the app worse than a failed request does, so those
//     are left to fail normally and the app handles it.
//
// ── Turning it off ──────────────────────────────────────────────────────────
//
// If this ever needs removing from phones in a hurry, replace this file's body
// with `self.registration.unregister()` inside an activate handler and deploy.
// Deleting the file does NOT remove an installed worker; it only stops updates.

const VERSION = 'v1';
const SHELL = `connections-shell-${VERSION}`;
const STATIC = `connections-static-${VERSION}`;
const PRECACHE = ['/offline.html', '/icon-192.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only our own caches, and only old versions of them. Anything
            // another app on this origin might own is left alone.
            .filter((k) => k.startsWith('connections-') && k !== SHELL && k !== STATIC)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** A client-side navigation made by the Next router rather than the browser. */
function isRscRequest(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isRscRequest(request, url)) return;

  // The app's code: immutable, hashed, safe to keep.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // A full page load. Network first, and never cached — see the header.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match('/offline.html');
        return offline ?? Response.error();
      }),
    );
  }
});
