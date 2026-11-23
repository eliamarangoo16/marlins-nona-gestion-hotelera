/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA: toda navegación devuelve index.html precacheado
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
} catch {
  /* sin index precacheado en desarrollo */
}

self.skipWaiting()
clientsClaim()

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'Marlins & Nona', body: event.data?.text() }
  }
  const title = data.title || 'Marlins & Nona'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: new URL('icon-192.png', self.registration.scope).href,
      badge: new URL('icon-192.png', self.registration.scope).href,
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = (event.notification.data && event.notification.data.url) || '/'
  // Los enlaces vienen como '/reservas/..': se resuelven dentro del alcance de la app (soporta subcarpeta)
  const target = new URL(url.replace(/^\//, ''), self.registration.scope).href
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await (client as WindowClient).navigate(target)
            } catch {
              /* ignorar */
            }
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
