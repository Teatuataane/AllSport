// AllSport service worker: weekly game notices only (v0.55.0.0).
// No caching and no fetch handler, so it never stands between a player and the
// live site. It shows a push the send route made (app/api/notices/send) and
// opens AllSport when the notification is tapped.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'AllSport'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    // One notification per notice; a correction replaces, not stacks.
    tag: data.tag || 'allsport-notice',
    renotify: true,
    data: { url: data.url || '/dashboard' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  // Same-site paths only: a push can never send a player somewhere else.
  const path = (event.notification.data && event.notification.data.url) || '/dashboard'
  const url = new URL(path.startsWith('/') ? path : '/dashboard', self.location.origin).href
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        await c.focus()
        if ('navigate' in c) await c.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
