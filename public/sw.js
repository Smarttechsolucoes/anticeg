// Push desligado (03/11, contenção de itens duplicados): este service worker não mostra mais notificações
// e cancela a própria inscrição do aparelho. Para religar, restaurar o showNotification da versão anterior (git).
self.addEventListener("push", function (event) {
  event.waitUntil(
    self.registration.pushManager.getSubscription().then(function (sub) { return sub ? sub.unsubscribe() : null; }).catch(function () {})
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
