// Service Worker para Intercom DTI - JIATech
// Gestiona la actualización automática de la PWA

const CACHE_NAME = 'intercom-dti-cache-v1';
let currentVersion = 'initial';

// Archivos a cachear inicialmente 
const INITIAL_CACHED_RESOURCES = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/main.js',
  '/images/logo.png',
  '/config/version.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching app shell');
        return cache.addAll(INITIAL_CACHED_RESOURCES);
      })
      .then(() => {
        return fetch('/config/version.json')
          .then(response => response.json())
          .then(data => {
            currentVersion = data.version;
            console.log(`[Service Worker] Installed version: ${currentVersion}`);
          })
          .catch(err => {
            console.log('[Service Worker] Error fetching version info:', err);
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Estrategia de caché: network first, fallback a cache
self.addEventListener('fetch', (event) => {
  // No interceptar peticiones a APIs
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // Para versión.json siempre ir a la red
  if (event.request.url.includes('version.json')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar en caché una copia de la respuesta
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseClone);
          });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Verificar actualizaciones periódicamente
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

function checkForUpdates() {
  console.log('[Service Worker] Checking for updates...');
  
  fetch('/config/version.json?_=' + new Date().getTime(), {
    cache: 'no-store'
  })
    .then(response => response.json())
    .then(data => {
      const newVersion = data.version;
      console.log(`[Service Worker] Current: ${currentVersion}, Server: ${newVersion}`);
      
      if (newVersion && newVersion !== currentVersion) {
        console.log('[Service Worker] New version available:', newVersion);
        
        // Notificar a los clientes sobre la actualización
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'UPDATE_AVAILABLE',
              version: newVersion,
              force: data.forceUpdate || false
            });
          });
        });
        
        // Actualizar versión actual
        currentVersion = newVersion;
        
        // Si es actualización forzada, borrar cache y recargar
        if (data.forceUpdate) {
          console.log('[Service Worker] Force update requested, clearing cache');
          caches.delete(CACHE_NAME).then(() => {
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'RELOAD_PAGE',
                });
              });
            });
          });
        }
      }
    })
    .catch(err => {
      console.log('[Service Worker] Error checking for updates:', err);
    });
}

// Escuchar mensajes de los clientes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    checkForUpdates();
  }
});

// Iniciar verificación periódica de actualizaciones
setInterval(checkForUpdates, CHECK_INTERVAL);

// Verificar al inicio
self.addEventListener('activate', event => {
  event.waitUntil(checkForUpdates());
});
