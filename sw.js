const CACHE_NAME = "ashina-cache-1-7";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./audio.wav"
];

/* Установка нового Service Worker */

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => cache.addAll(APP_FILES))

      .then(() => self.skipWaiting())

  );

});


/* Активация нового Service Worker */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()

      .then(keys =>

        Promise.all(

          keys

            .filter(key => key !== CACHE_NAME)

            .map(key => caches.delete(key))

        )

      )

      .then(() => self.clients.claim())

  );

});


/* Обработка запросов */

self.addEventListener("fetch", event => {

  event.respondWith(

    caches.match(event.request)

      .then(cachedResponse => {

        if (cachedResponse) {

          return cachedResponse;

        }

        return fetch(event.request)

          .then(networkResponse => {

            return networkResponse;

          })

          .catch(() => {

            return caches.match("./index.html");

          });

      })

  );

});
