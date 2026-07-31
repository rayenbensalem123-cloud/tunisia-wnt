const CACHE = "tunisia-wnt-v1"
const STATIC = ["/", "/manifest.json", "/icon.svg", "/ftf-logo.png"]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
})

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const c = caches.open(CACHE).then((c) => c.put(e.request, r.clone()))
        return r
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
  )
})
