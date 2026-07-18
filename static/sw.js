// Este es un Service Worker básico. 
// Su única función por ahora es cumplir el requisito de Chrome para permitir la instalación de la App.

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
});

self.addEventListener('fetch', (e) => {
    // No interceptamos nada, dejamos que la red fluya normal
});