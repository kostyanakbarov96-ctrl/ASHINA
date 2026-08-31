const CACHE_NAME = "ashina-cache-1-8";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./audio.wav"
];


/* =========================
   ASHINA GUARD
========================= */

const GUARD_FILES = [
  "./index.html",
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

  event.respondWith(

    caches.match(event.request)

      .then(cached => {

        if (cached) {

          return cached;

        }

        return fetch(event.request)

          .then(response => {

            return response;

          })

          .catch(() => {

            return caches.match("./index.html");

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


  if (event.data.type === "ASHINA_GUARD_CHECK") {

    event.waitUntil(

      checkGuardFiles()

        .then(result => {

          if (event.ports && event.ports[0]) {

            event.ports[0].postMessage({

              type: "ASHINA_GUARD_RESULT",

              files: result,

              time: Date.now()

            });

          }

        })

    );

  }

});
