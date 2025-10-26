// Service Worker for CFMEU Employer Rating System PWA
// Version 1.0.0

const CACHE_NAME = 'cfmeu-ratings-v1.0.0'
const STATIC_CACHE = 'cfmeu-static-v1.0.0'
const API_CACHE = 'cfmeu-api-v1.0.0'
const DYNAMIC_CACHE = 'cfmeu-dynamic-v1.0.0'

// Critical assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/mobile/ratings',
  '/mobile/ratings/dashboard',
  '/mobile/ratings/wizard',
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/favicon.ico',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/styles/mobile.css'
]

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
  '/api/employers',
  '/api/ratings',
  '/api/weights',
  '/api/employers/bulk-aliases',
  '/api/employers/eba-quick-list'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v1.0.0')

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v1.0.0')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE &&
                cacheName !== API_CACHE &&
                cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Service worker activated')
        return self.clients.claim()
      })
  )
})

// Network-first strategy for API calls
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE)

  try {
    console.log('[SW] Network-first:', request.url)
    const networkResponse = await fetch(request)

    // Cache successful responses
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone()
      await cache.put(request, responseClone)
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html') || new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable'
      })
    }

    throw error
  }
}

// Cache-first strategy for static assets
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    console.log('[SW] Cache hit:', request.url)
    return cachedResponse
  }

  console.log('[SW] Cache miss, fetching:', request.url)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const responseClone = networkResponse.clone()
      await cache.put(request, responseClone)
    }

    return networkResponse
  } catch (error) {
    console.error('[SW] Failed to fetch:', request.url, error)
    throw error
  }
}

// Stale-while-revalidate strategy for dynamic content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cachedResponse = await cache.match(request)

  // Always try to update from network
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone()
        cache.put(request, responseClone)
      }
      return networkResponse
    })
    .catch((error) => {
      console.warn('[SW] Network fetch failed:', request.url, error)
    })

  // Return cached version immediately if available
  if (cachedResponse) {
    console.log('[SW] Stale-while-revalidate: serving cached version')
    return cachedResponse
  }

  // Otherwise wait for network
  return fetchPromise
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)

  if (event.tag === 'background-sync-ratings') {
    event.waitUntil(syncRatings())
  } else if (event.tag === 'background-sync-employers') {
    event.waitUntil(syncEmployers())
  }
})

// Sync rating data
async function syncRatings() {
  console.log('[SW] Syncing rating data...')

  try {
    const offlineRatings = await getOfflineData('ratings')

    for (const rating of offlineRatings) {
      try {
        const response = await fetch('/api/ratings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rating)
        })

        if (response.ok) {
          await removeOfflineData('ratings', rating.id)
          console.log('[SW] Successfully synced rating:', rating.id)
        }
      } catch (error) {
        console.error('[SW] Failed to sync rating:', rating.id, error)
      }
    }
  } catch (error) {
    console.error('[SW] Sync ratings failed:', error)
  }
}

// Sync employer data
async function syncEmployers() {
  console.log('[SW] Syncing employer data...')

  try {
    const offlineEmployers = await getOfflineData('employers')

    for (const employer of offlineEmployers) {
      try {
        const response = await fetch('/api/employers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(employer)
        })

        if (response.ok) {
          await removeOfflineData('employers', employer.id)
          console.log('[SW] Successfully synced employer:', employer.id)
        }
      } catch (error) {
        console.error('[SW] Failed to sync employer:', employer.id, error)
      }
    }
  } catch (error) {
    console.error('[SW] Sync employers failed:', error)
  }
}

// IndexedDB helpers for offline storage
async function getOfflineData(store) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cfmeu-offline-db', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction([store], 'readonly')
      const storeObj = transaction.objectStore(store)
      const getAllRequest = storeObj.getAll()

      getAllRequest.onsuccess = () => resolve(getAllRequest.result)
      getAllRequest.onerror = () => reject(getAllRequest.error)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store, { keyPath: 'id' })
      }
    }
  })
}

async function removeOfflineData(store, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cfmeu-offline-db', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction([store], 'readwrite')
      const storeObj = transaction.objectStore(store)
      const deleteRequest = storeObj.delete(id)

      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => reject(deleteRequest.error)
    }
  })
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')

  if (!event.data) {
    return
  }

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data,
    actions: [
      {
        action: 'view',
        title: 'View Details'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.data)

  event.notification.close()

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/mobile/ratings')
    )
  } else if (event.action === 'dismiss') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' || client.url.includes('/mobile/')) {
            return client.focus()
          }
        }
        return clients.openWindow('/mobile/ratings')
      })
    )
  }
})

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
      // Handle offline POST requests
      event.respondWith(handleOfflinePost(request))
    }
    return
  }

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Static assets - cache first
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/static/') ||
      url.pathname.includes('.js') ||
      url.pathname.includes('.css') ||
      url.pathname.includes('.woff') ||
      url.pathname.includes('.woff2') ||
      url.pathname.includes('.ttf') ||
      url.pathname.includes('.ico') ||
      url.pathname.includes('.png') ||
      url.pathname.includes('.jpg') ||
      url.pathname.includes('.jpeg') ||
      url.pathname.includes('.svg') ||
      url.pathname.includes('.webp')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Dynamic content - stale while revalidate
  if (url.pathname.startsWith('/mobile/') ||
      url.pathname === '/' ||
      url.pathname.includes('/ratings')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Default - network request
  event.respondWith(fetch(request))
})

// Handle offline POST requests
async function handleOfflinePost(request) {
  try {
    const networkResponse = await fetch(request.clone())
    return networkResponse
  } catch (error) {
    console.log('[SW] Offline POST - storing for later sync')

    // Store request for background sync
    const requestData = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    }

    // Store in IndexedDB for later sync
    await storeOfflineRequest(requestData)

    // Trigger background sync if available
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register('background-sync-ratings')
    }

    // Return offline response
    return new Response(JSON.stringify({
      success: false,
      message: 'Request saved for when you\'re back online',
      offline: true
    }), {
      status: 202,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

// Store offline request in IndexedDB
async function storeOfflineRequest(requestData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cfmeu-offline-db', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['offline-requests'], 'readwrite')
      const store = transaction.objectStore('offline-requests')
      const addRequest = store.add({
        ...requestData,
        id: `offline-${Date.now()}-${Math.random()}`
      })

      addRequest.onsuccess = () => resolve()
      addRequest.onerror = () => reject(addRequest.error)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('offline-requests')) {
        db.createObjectStore('offline-requests', { keyPath: 'id' })
      }
    }
  })
}

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Update specific cache
    updateCache(event.data.url)
  }
})

// Update specific cache
async function updateCache(url) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE)
    const response = await fetch(url)
    if (response.ok) {
      await cache.put(url, response)
      console.log('[SW] Cache updated for:', url)
    }
  } catch (error) {
    console.error('[SW] Failed to update cache:', url, error)
  }
}

// Cleanup old cached data
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered')

  if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupCache())
  }
})

// Clean up old cache entries
async function cleanupCache() {
  const cachesToClean = [STATIC_CACHE, API_CACHE, DYNAMIC_CACHE]

  for (const cacheName of cachesToClean) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()

    // Remove entries older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const dateHeader = response.headers.get('date')
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime()
          if (responseDate < sevenDaysAgo) {
            await cache.delete(request)
            console.log('[SW] Removed old cache entry:', request.url)
          }
        }
      }
    }
  }
}

console.log('[SW] Service worker script loaded')