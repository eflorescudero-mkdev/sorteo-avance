// Guarda la ruleta para que funcione sin internet en el salón.
// - La página: primero intenta internet (para recibir cambios) y si no hay, usa la copia guardada.
// - Escudo y letras: usa la copia guardada (no cambian).

const CACHE = 'ruleta-avance-v1';
const LOGO = 'https://static.wixstatic.com/media/9f5347_9b28551ad03d468a9a8337d084499f6e~mv2.png';
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Raleway:wght@500;700;800;900&display=swap';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(['./', './index.html']);
    // El escudo viene de otro sitio: llega "opaco" y cache.add() lo rechaza, pero put() sí lo guarda
    await cache.put(LOGO, await fetch(LOGO, { mode: 'no-cors' }));
    // Las letras son opcionales: si fallan, la ruleta funciona con la letra del sistema
    try {
      const res = await fetch(FONTS_CSS);
      const css = await res.clone().text();
      await cache.put(FONTS_CSS, res);
      // Raleway usa el mismo archivo para varios grosores; addAll() falla con repetidos
      const archivos = new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]));
      await cache.addAll([...archivos]);
    } catch (e) { /* sin letras guardadas */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    try {
      const res = await fetch(req);
      if (req.url.startsWith('https://fonts.') || req.url === LOGO) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
