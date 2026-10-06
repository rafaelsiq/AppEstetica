// Worker mínimo para o aplicativo poder ser instalado no celular.
// Não guarda arquivos e não pede para a página recarregar.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const openClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const current = openClients.find((client) => client.url === target) || openClients[0];
    if (current) {
      await current.focus();
      return;
    }
    await clients.openWindow(target);
  })());
});
