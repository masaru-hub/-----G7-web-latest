const CACHE_NAME = 'kiseki-kizuna-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './core.js',
  './actions.js',
  './analysis.js',
  './manifest.json'
];

// インストール時にリソースをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// 古いキャッシュを掃除して常に最新の魔法を届ける
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
    })
  );
});

// オフラインでもキャッシュから返却
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});