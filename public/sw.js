const VERSION = 3
const CACHE = `tunisia-wnt-v${VERSION}`
const STATIC = ["/manifest.json", "/icon.svg", "/ftf-logo.png"]

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// NETWORK-FIRST for every page navigation → fresh build always wins.
// Cache-first only for immutable hashed assets (webpack chunks) + app shell.
self.addEventListener("fetch", (e) => {
  const req = e.request
  const url = new URL(req.url)

  if (req.method !== "GET" || url.origin !== location.origin) return

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put("/", copy))
          return res
        })
        .catch(() => caches.match("/"))
    )
    return
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(req, copy))
      return res
    }))
  )
})
