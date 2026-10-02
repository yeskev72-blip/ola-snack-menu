/**
 * Service worker minimal. Il existe pour deux raisons : Chrome n'offre « Installer
 * l'application » que si le site en déclare un, et il permet d'ouvrir l'app même sans réseau.
 *
 * La stratégie est « réseau d'abord, cache en secours » : l'app se met donc à jour toute seule
 * dès qu'il y a du réseau, et reste ouvrable quand il n'y en a pas. Jamais l'inverse — une PWA
 * qui sert un vieux cache en priorité est impossible à mettre à jour à distance.
 */
const CACHE = 'calbasse-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Seules les lectures sont mises en cache : jamais un envoi vers Supabase.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((rep) => {
        if (rep.ok) {
          const copie = rep.clone();
          void caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return rep;
      })
      .catch(async () => (await caches.match(req)) ?? (await caches.match('/')) ?? Response.error()),
  );
});
