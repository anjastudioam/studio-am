// Studio AM service worker. It only makes the app installable and keeps the app shell
// (page frame, scripts, styles, fonts, icons) available. It NEVER stores API responses,
// so no client information is ever kept on the device by the app.
const CACHE = "studio-am-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/logo.png", "/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always try the network first so updates arrive; fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }
  // Built assets have hashed names, so cache-first is safe.
  if (url.pathname.startsWith("/assets/") || /\.(png|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
  }
});
