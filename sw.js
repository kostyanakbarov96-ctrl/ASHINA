```javascript
const CACHE_NAME = "ashina-cache-1-9";

const APP_FILES = [
  "./",
  "./index.html",
  "./ai-test.html",
  "./jarvis-core.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./audio.wav"
];


/* =========================
   ASHINA GUARD
========================= */

const GUARD_FILES = [
  "./index.html",
  "./ai-test.html",
  "./jarvis-core.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./audio.wav"
];


/* =========================
   INSTALL
========================= */

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => cache.addAll(APP_FILES))

      .then(() => self.skipWaiting())

  );

});


/* =========================
   ACTIVATE
========================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()

      .then(keys => {

        return Promise.all(

          keys

            .filter(key => key !== CACHE_NAME)

            .map(key => caches.delete(key))

        );

      })

      .then(() => self.clients.claim())

  );

});


/* =========================
   REQUESTS
========================= */

self.addEventListener("fetch", event => {

  /*
     Сначала проверяем кэш.
     Если файла нет — пытаемся
     получить его из сети.
  */

  event.respondWith(

    caches.match(event.request)

      .then(cached => {

        if (cached) {

          return cached;

        }

        return fetch(event.request)

          .then(response => {

            /*
               Кэшируем только успешные
               ответы нашего приложения.
            */

            if (
              response &&
              response.status === 200 &&
              response.type === "basic"
            ) {

              const copy = response.clone();

              caches.open(CACHE_NAME)

                .then(cache => {

                  cache.put(
                    event.request,
                    copy
                  );

                });

            }

            return response;

          })

          .catch(() => {

            /*
               Если сеть недоступна,
               возвращаем главный экран.
            */

            return caches.match(
              "./index.html"
            );

          });

      })

  );

});


/* =========================
   ASHINA GUARD CHECK
========================= */

async function checkGuardFiles() {

  const result = {};

  for (const file of GUARD_FILES) {

    try {

      const response = await fetch(
        file,
        {
          cache: "no-store"
        }
      );

      result[file] = response.ok;

    } catch (error) {

      result[file] = false;

    }

  }

  return result;

}


/* =========================
   MESSAGE SYSTEM
========================= */

self.addEventListener("message", event => {

  if (!event.data) {

    return;

  }


  /* =========================
     GUARD CHECK
  ========================= */

  if (
    event.data.type ===
    "ASHINA_GUARD_CHECK"
  ) {

    event.waitUntil(

      checkGuardFiles()

        .then(result => {

          if (
            event.ports &&
            event.ports[0]
          ) {

            event.ports[0].postMessage({

              type:
                "ASHINA_GUARD_RESULT",

              files:
                result,

              time:
                Date.now()

            });

          }

        })

    );

  }


  /* =========================
     FORCE UPDATE
  ========================= */

  if (
    event.data.type ===
    "ASHINA_SKIP_WAITING"
  ) {

    self.skipWaiting();

  }

});
```
