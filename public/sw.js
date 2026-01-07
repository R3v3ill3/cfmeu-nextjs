// Service Worker for CFMEU Employer Rating System PWA
// Enhanced with Mobile Performance Optimizations
// Version 2.3.0 - Fixed deployment version mismatch by using network-first for JS chunks

const CACHE_NAME = 'cfmeu-ratings-v2.3.0'
const STATIC_CACHE = 'cfmeu-static-v2.3.0'
const API_CACHE = 'cfmeu-api-v2.3.0'
const DYNAMIC_CACHE = 'cfmeu-dynamic-v2.3.0'
const MOBILE_CACHE = 'cfmeu-mobile-v2.3.0'
const CRITICAL_DATA_CACHE = 'cfmeu-critical-v2.3.0'

// ONLY truly static assets that don't require authentication
// Auth-protected routes will be cached dynamically after user logs in
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/auth'  // Auth page is public
]

// API endpoints to cache with network-first strategy (after user is authenticated)
const API_ENDPOINTS = [
  '/api/employers',
  '/api/ratings',
  '/api/weights',
  '/api/employers/bulk-aliases',
  '/api/employers/eba-quick-list'
]

// Critical mobile endpoints for offline access (cached dynamically after auth)
const CRITICAL_MOBILE_APIS = [
  '/api/employers/quick-list',
  '/api/projects/quick-list',
  '/api/eba/quick-list',
  '/api/employers/bulk-aliases'
]

// Mobile-specific static assets only (no auth-protected routes)
const MOBILE_ASSETS = [
  '/manifest.json'
]

// Install event - cache ONLY truly static assets (no auth-protected routes)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2.3.0')

  event.waitUntil(
    // Only cache truly static assets that don't require authentication
    // Auth-protected routes will be cached dynamically when user navigates after login
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets (auth-free only)')
        // Use individual cache.add() calls to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(err => {
              console.warn(`[SW] Failed to cache ${asset}:`, err.message)
              return null // Continue even if one asset fails
            })
          )
        )
      })
      .then(() => {
        console.log('[SW] Static assets cached, skipping waiting')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error)
        // Still skip waiting to activate the SW even on cache failure
        return self.skipWaiting()
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2.3.0')

  // List of current cache names to keep
  const currentCaches = [STATIC_CACHE, API_CACHE, DYNAMIC_CACHE, MOBILE_CACHE, CRITICAL_DATA_CACHE]

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete ANY cache that isn't in our current list
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Service worker v2.3.0 activated - claiming clients')
        // Claim clients immediately so the new SW takes control
        return self.clients.claim()
      })
      .then(() => {
        // Notify all clients that they should refresh for the best experience
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: '2.3.0',
              message: 'Service worker updated. Please refresh for best experience.'
            })
          })
        })
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

// Network-first for JS chunks to prevent deployment version conflicts
// Chunks have unique hashes so we don't need aggressive caching
async function networkFirstForChunks(request) {
  try {
    console.log('[SW] Network-first chunk:', request.url)
    const networkResponse = await fetch(request)
    return networkResponse
  } catch (error) {
    // Only fall back to cache if offline
    console.log('[SW] Chunk fetch failed, trying cache:', request.url)
    const cache = await caches.open(STATIC_CACHE)
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
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

// Network-first strategy for navigation requests (HTML pages)
// This ensures auth state is always correct - critical for PWA
async function networkFirstForNavigation(request) {
  try {
    console.log('[SW] Network-first navigation:', request.url)
    const networkResponse = await fetch(request)
    
    // Don't cache HTML navigation responses - they're auth-dependent
    // The browser will re-request on each navigation
    return networkResponse
  } catch (error) {
    console.log('[SW] Navigation network failed, trying cache:', request.url)
    
    // Try to find any cached version as fallback for offline
    const cache = await caches.open(DYNAMIC_CACHE)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CFMEU - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                 padding: 20px; text-align: center; background: #f5f5f5; }
          .message { color: #666; margin: 20px 0; }
          .retry-btn { background: #2563eb; color: white; border: none;
                       padding: 12px 24px; border-radius: 8px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>You're offline</h2>
        <p class="message">Please check your internet connection and try again.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
      </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    })
  }
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
      clients.openWindow(event.notification.data.url || '/settings')
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
        return clients.openWindow('/settings')
      })
    )
  }
})

// Fetch event - handle all network requests with mobile optimizations
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

  // Detect mobile user agent for optimizations
  const isMobile = request.headers.get('user-agent')?.includes('Mobile')
  const isSlowConnection = request.headers.get('X-Connection-Speed') === 'slow'

  // Critical mobile APIs - network first with longer cache for slow connections
  if (CRITICAL_MOBILE_APIS.some(api => url.pathname.startsWith(api))) {
    if (isSlowConnection) {
      event.respondWith(cacheFirstWithLongTTL(request))
    } else {
      event.respondWith(networkFirstWithMobileOptimization(request))
    }
    return
  }

  // API requests - network first with mobile optimizations
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithMobileOptimization(request))
    return
  }

  // Mobile routes - NETWORK FIRST to ensure auth state is correct
  // Only fallback to cache if offline
  if (url.pathname.startsWith('/mobile/') ||
      url.pathname.includes('/mobile/')) {
    event.respondWith(networkFirstForNavigation(request))
    return
  }

  // Next.js chunks - NETWORK FIRST to prevent deployment version mismatches
  // These files have unique hashes and deployment query params, so caching them
  // across deployments causes version conflicts. Let the browser's HTTP cache handle them.
  if (url.pathname.startsWith('/_next/static/chunks/')) {
    // Use network-first for chunks to avoid cross-deployment version conflicts
    event.respondWith(networkFirstForChunks(request))
    return
  }

  // Other static assets - cache first (fonts, images, CSS are safe to cache)
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/static/') ||
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

  // HTML navigation requests - always network first to ensure correct auth state
  if (request.headers.get('accept')?.includes('text/html') ||
      request.mode === 'navigate') {
    event.respondWith(networkFirstForNavigation(request))
    return
  }

  // Dynamic content - stale while revalidate
  if (url.pathname === '/' ||
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

// Mobile-optimized caching strategies

// Pre-cache critical mobile data
async function preCacheCriticalMobileData() {
  console.log('[SW] Pre-caching critical mobile data...')

  try {
    const cache = await caches.open(CRITICAL_DATA_CACHE)

    // Cache critical mobile APIs with mobile-optimized parameters
    const criticalDataPromises = CRITICAL_MOBILE_APIS.map(async (api) => {
      try {
        const response = await fetch(`${api}?mobile=true&optimized=true&limit=50`, {
          headers: {
            'Cache-Control': 'max-age=3600',
            'Mobile-Optimized': 'true',
            'X-Mobile-Cache': 'critical'
          }
        })

        if (response.ok) {
          await cache.put(api, response.clone())
          console.log(`[SW] Cached critical mobile data: ${api}`)
        }
      } catch (error) {
        console.warn(`[SW] Failed to cache ${api}:`, error)
      }
    })

    await Promise.all(criticalDataPromises)
    console.log('[SW] Critical mobile data caching complete')
  } catch (error) {
    console.error('[SW] Failed to pre-cache critical mobile data:', error)
  }
}

// Network first with mobile optimization
async function networkFirstWithMobileOptimization(request) {
  const cache = await caches.open(API_CACHE)

  try {
    console.log('[SW] Network-first (mobile optimized):', request.url)

    // Add mobile optimization headers
    const mobileHeaders = {
      'Mobile-Optimized': 'true',
      'X-Connection-Speed': 'detect',
      'Accept-Encoding': 'gzip, deflate, br'
    }

    const networkResponse = await fetch(request, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        ...mobileHeaders
      }
    })

    // Cache successful responses with mobile-specific TTL
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone()
      const cacheControl = request.url.includes('quick-list')
        ? 'max-age=1800' // 30 minutes for quick lists
        : 'max-age=600'  // 10 minutes for other APIs

      const modifiedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...responseClone.headers,
          'Cache-Control': cacheControl,
          'X-Mobile-Cached': 'true'
        }
      })

      await cache.put(request, modifiedResponse)
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed, trying mobile cache:', request.url)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Try critical data cache as fallback
    const criticalCache = await caches.open(CRITICAL_DATA_CACHE)
    const criticalResponse = await criticalCache.match(request.url)

    if (criticalResponse) {
      return criticalResponse
    }

    // Return offline response for mobile
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'No cached data available',
      mobileOffline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Cache first for mobile routes
async function cacheFirstForMobile(request) {
  const cache = await caches.open(MOBILE_CACHE)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    console.log('[SW] Mobile cache hit:', request.url)
    return cachedResponse
  }

  console.log('[SW] Mobile cache miss, fetching:', request.url)

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const responseClone = networkResponse.clone()
      await cache.put(request, responseClone)
      console.log('[SW] Mobile route cached:', request.url)
    }

    return networkResponse
  } catch (error) {
    console.error('[SW] Failed to fetch mobile route:', request.url, error)

    // Return offline page for mobile routes
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>CFMEU - Offline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   padding: 20px; text-align: center; background: #f5f5f5; }
            .offline-icon { width: 80px; height: 80px; margin: 20px auto; }
            .message { color: #666; margin: 20px 0; }
            .retry-btn { background: #2563eb; color: white; border: none;
                         padding: 12px 24px; border-radius: 8px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="offline-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414a1 1 0 00-1.414 0"/>
            </svg>
          </div>
          <h2>You're offline</h2>
          <p class="message">Please check your internet connection and try again.</p>
          <button class="retry-btn" onclick="window.location.reload()">Retry</button>
        </body>
        </html>
      `, {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      })
    }

    throw error
  }
}

// Cache first with longer TTL for slow connections
async function cacheFirstWithLongTTL(request) {
  const cache = await caches.open(CRITICAL_DATA_CACHE)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    console.log('[SW] Long TTL cache hit:', request.url)
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const responseClone = networkResponse.clone()
      const modifiedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...responseClone.headers,
          'Cache-Control': 'max-age=3600', // 1 hour for slow connections
          'X-Slow-Connection-Cached': 'true'
        }
      })

      await cache.put(request, modifiedResponse)
    }

    return networkResponse
  } catch (error) {
    console.error('[SW] Long TTL cache failed:', request.url, error)
    throw error
  }
}

// Enhanced background sync for mobile
self.addEventListener('sync', (event) => {
  console.log('[SW] Mobile background sync triggered:', event.tag)

  if (event.tag === 'background-sync-ratings') {
    event.waitUntil(syncRatings())
  } else if (event.tag === 'background-sync-employers') {
    event.waitUntil(syncEmployers())
  } else if (event.tag === 'mobile-sync-critical-data') {
    event.waitUntil(preCacheCriticalMobileData())
  } else if (event.tag === 'mobile-offline-requests') {
    event.waitUntil(syncMobileOfflineRequests())
  }
})

// Sync mobile offline requests
async function syncMobileOfflineRequests() {
  console.log('[SW] Syncing mobile offline requests...')

  try {
    const db = await openIndexedDB()
    const offlineRequests = await getMobileOfflineRequests(db)

    if (offlineRequests.length === 0) {
      console.log('[SW] No mobile offline requests to sync')
      return
    }

    console.log(`[SW] Syncing ${offlineRequests.length} mobile offline requests`)

    for (const requestData of offlineRequests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: {
            ...requestData.headers,
            'X-Mobile-Sync': 'true',
            'X-Offline-Sync': 'true'
          },
          body: requestData.body
        })

        if (response.ok) {
          await deleteMobileOfflineRequest(db, requestData.id)
          console.log(`[SW] ✅ Synced mobile request: ${requestData.url}`)
        } else {
          console.warn(`[SW] ❌ Failed to sync mobile request: ${requestData.url}`, response.status)
        }
      } catch (error) {
        console.error(`[SW] ❌ Error syncing mobile request: ${requestData.url}`, error)
      }
    }

    // Notify mobile clients about sync completion
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'mobile-sync-complete',
        syncedCount: offlineRequests.length,
        timestamp: Date.now()
      })
    })
  } catch (error) {
    console.error('[SW] Error during mobile background sync:', error)
  }
}

// Enhanced IndexedDB helpers for mobile
async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cfmeu-mobile-offline-db', 2)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Create stores for different types of offline data
      if (!db.objectStoreNames.contains('mobile-offline-requests')) {
        db.createObjectStore('mobile-offline-requests', { keyPath: 'id', autoIncrement: true })
      }

      if (!db.objectStoreNames.contains('mobile-critical-data')) {
        db.createObjectStore('mobile-critical-data', { keyPath: 'url' })
      }

      if (!db.objectStoreNames.contains('mobile-user-preferences')) {
        db.createObjectStore('mobile-user-preferences', { keyPath: 'key' })
      }
    }
  })
}

async function getMobileOfflineRequests(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['mobile-offline-requests'], 'readonly')
    const store = transaction.objectStore('mobile-offline-requests')
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function deleteMobileOfflineRequest(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['mobile-offline-requests'], 'readwrite')
    const store = transaction.objectStore('mobile-offline-requests')
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Enhanced message handling for mobile clients
self.addEventListener('message', (event) => {
  console.log('[SW] Mobile message received:', event.data)

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
    case 'MOBILE_SYNC_NOW':
      event.waitUntil(preCacheCriticalMobileData())
      break
    case 'MOBILE_CLEAR_CACHE':
      event.waitUntil(clearMobileCaches())
      break
    case 'MOBILE_OFFLINE_STATUS':
      event.ports[0].postMessage({
        type: 'offline-status',
        online: navigator.onLine,
        cachedRequests: 'count', // Would need to be implemented
        lastSync: Date.now()
      })
      break
  }
})

// Clear mobile-specific caches
async function clearMobileCaches() {
  console.log('[SW] Clearing mobile caches...')

  const mobileCaches = [MOBILE_CACHE, CRITICAL_DATA_CACHE]

  for (const cacheName of mobileCaches) {
    await caches.delete(cacheName)
    console.log(`[SW] Cleared mobile cache: ${cacheName}`)
  }

  console.log('[SW] Mobile caches cleared')
}

console.log('[SW] Mobile-optimized service worker script loaded')