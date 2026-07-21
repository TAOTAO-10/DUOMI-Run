const CACHE_NAME = "domi-run-v19";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/main.js",
  "./js/mobile.js",
  "./manifest.webmanifest",
  "./assets/icons/domi-icon.svg",
  "./assets/icons/domi-icon-192.png",
  "./assets/icons/domi-icon-512.png",
  "./assets/sprites/domi-steve-sprites-v1.png",
  "./assets/sprites/domi-run-cycle-v2.png",
  "./assets/sprites/domi-duck-run-v1.png",
  "./assets/sprites/domi-obstacles-v1.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
