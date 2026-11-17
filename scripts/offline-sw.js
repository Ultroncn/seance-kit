// Service worker template for offline use after the first load (requirement R4.3).
// scripts/vite-offline.ts prepends OFFLINE_VERSION and OFFLINE_FILES at build time and writes the
// result to the app's dist/sw.js. Registered at <base>sw.js, so its scope is the app's own path.
//
// - Install: precache every file of the app's build, keyed by URL inside the scope.
// - Navigations: network first, so an online user always gets the latest deploy; offline, the
//   cached app shell answers every deep link.
// - Other requests inside the scope: cache first, then network.
// - Anything else (other apps on this origin, provider APIs on other origins) is not intercepted.
/* global OFFLINE_VERSION, OFFLINE_FILES */
const SCOPE = self.registration.scope;
// All apps share one origin and one CacheStorage, so cache names carry the scope. An app only
// ever deletes its own old caches.
const PREFIX = `seance-offline:${new URL(SCOPE).pathname}:`;
const CACHE = PREFIX + OFFLINE_VERSION;
const SHELL = SCOPE;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" skips the HTTP cache, so a new version never precaches stale files.
      .then((cache) =>
        cache.addAll(
          OFFLINE_FILES.map((file) => new Request(new URL(file, SCOPE), { cache: "reload" })),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(SCOPE)) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(CACHE)
          .then((cache) => cache.match(SHELL))
          .then((hit) => hit ?? Response.error()),
      ),
    );
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request))
      .then((hit) => hit ?? fetch(request)),
  );
});
