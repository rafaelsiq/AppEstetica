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
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(clients.openWindow(target || "/"));
});
