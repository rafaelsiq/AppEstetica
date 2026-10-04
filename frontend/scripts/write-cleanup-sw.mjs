import { writeFile } from "node:fs/promises";

const serviceWorker = `self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      await self.registration.unregister();
    })()
  );
});
`;

await writeFile(new URL("../dist/sw.js", import.meta.url), serviceWorker);
