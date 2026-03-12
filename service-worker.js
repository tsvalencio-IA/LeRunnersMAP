/* =================================================================== */
/* SERVICE WORKER - V12.0 (FORCE UPDATE - CACHE BUSTER MASTER)
/* =================================================================== */

const CACHE_NAME = 'lerunners-cache-v12.0'; // Alterar este número força a limpeza do cache no dispositivo

const FILES_TO_CACHE = [
    './',
    './index.html',
    './app.html',
    './aluno-ia.html',
    './nutri-ia.html',
    './css/styles.css',
    './js/config.js',
    './js/app.js',
    './js/panels.js',
    './js/aluno-ia.js',
    './js/nutri-ia.js',
    './manifest.json',
    './img/logo-192.png',
    './img/logo-512.png',
    'https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css', 
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',
    'https://upload-widget.cloudinary.com/global/all.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(FILES_TO_CACHE))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Ignora APIs e domínios dinâmicos para não os meter no cache
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('cloudinary.com') ||
        event.request.url.includes('vercel.app')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
