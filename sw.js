/* Service worker do MeuCaixa — carrega o app offline (o shell). Os dados vêm do IndexedDB (store.js),
 * não daqui. Requisições ao Supabase (cross-origin) passam direto pela rede, nunca são cacheadas. */
const CACHE = "meucaixa-v6";
const SHELL = ["./", "./index.html", "./manifest.json", "./favicon.ico", "./vendor/supabase.js", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase e afins → rede direto

  // navegação (HTML): network-first, cai no shell cacheado quando offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return r; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // demais assets same-origin: stale-while-revalidate (rápido offline, atualiza em background)
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => cached);
      return cached || net;
    })
  );
});
