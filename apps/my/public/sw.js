// My Thread service worker — the app opening with no connection at all.
//
// Sjoerd, 2026-09-23: "can it be a real webapp". v1.14.0 made it installable;
// this is the half that makes an installed icon behave like an app rather
// than a bookmark that fails.
//
// Shape copied from apps/connections/public/sw.js, not invented. Deliberately
// small, because a service worker is STICKY: a broken one stays on somebody's
// phone until it updates, and it sits between them and every page. So it does
// as little as possible, and each thing it does NOT do is a decision.
//
// ── What it does ────────────────────────────────────────────────────────────
//
//   * Navigations go to the network first. Only when the network FAILS does it
//     answer with /offline.html.
//   * /_next/static files are cached as they load and served from cache after.
//     They are content-hashed and immutable, so a cached copy can never be
//     stale, and they hold no personal data — they are the app's code.
//
// ── What it deliberately does NOT do, and this matters MORE here ────────────
//
//   * Cache a signed-in PAGE, or a ticket. Every page below the sign-in is one
//     person's tickets, enrolments and memberships — the most personal data
//     the platform holds, on the one app whose whole purpose is showing it to
//     its subject. A cached copy would outlive sign-out and show yesterday's
//     answer as though it were today's.
//
//     THIS IS THE OPEN PRODUCT DECISION, not an oversight. Holding a check-in
//     code on the device is what would make a ticket work at a door with no
//     signal — which is the reason this surface exists — and it is a choice
//     about personal data on a device, so it is Sjoerd's to make and not a
//     side effect of a caching strategy. The better answer to that problem is
//     the WALLET PASSES, which are written and inert: offline by nature, and
//     they live where people already look for a ticket.
//
//   * Touch anything but same-origin GET. The API is on another origin and
//     intercepting it would be a second, invisible network layer to debug.
//
//   * Answer Next's client-side navigations (the RSC request a link click
//     makes) with HTML. Handing the router a page where it expects a flight
//     payload breaks the app worse than a failed request does.
//
// ── Turning it off ──────────────────────────────────────────────────────────
//
// If this ever needs removing from phones in a hurry, replace this file's body
// with `self.registration.unregister()` inside an activate handler and deploy.
// Deleting the file does NOT remove an installed worker; it only stops updates.

// Bump this whenever ANY file in PRECACHE changes — the offline page or the
// icons. A browser only reinstalls a worker whose OWN bytes changed, so an
// edit to a precached FILE alone leaves the old copy on every phone, for ever.
// That is not hypothetical: it happened to Connect's icon on 2026-09-22 and
// nothing could tell you, because the server was right and the home screen was
// wrong. `scripts/check-sw-freshness.mjs` now fails a release that repeats it.
const VERSION = 'v1';
const SHELL = `my-shell-${VERSION}`;
const STATIC = `my-static-${VERSION}`;
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
            .filter((k) => k.startsWith('my-') && k !== SHELL && k !== STATIC)
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
