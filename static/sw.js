// Service Worker actualizado para forzar limpieza de caché y errores fantasma

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Fuerza a reemplazar el Service Worker viejo al instante
    console.log('[Service Worker] Instalado y actualizado');
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim()); // Toma el control inmediato de la app en el celular
    console.log('[Service Worker] Activado y en control');
});

self.addEventListener('fetch', (e) => {
    // Permite que el tráfico fluya normalmente hacia Render sin bloquear nada
    e.respondWith(fetch(e.request));
});