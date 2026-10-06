// Worker mínimo para o aplicativo poder ser instalado no celular.
// Não guarda arquivos e não pede para a página recarregar.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  const title = data.title || "Aviso da clínica";
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "clinica",
      renotify: true,
      lang: "pt-BR",
      icon: new URL("/icon-192.png", self.location.origin).href,
      data: { url: data.url || "/" }
    });
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: "clinica-push", title }));
  })());
});

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
