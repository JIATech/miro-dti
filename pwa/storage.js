/**
 * Sistema de almacenamiento local para las tablets del sistema Intercom
 * Utiliza IndexedDB para guardar historial de llamadas, configuraciones y logs
 */

const IntercomDB = (function () {
  const DB_NAME = 'IntercomDB';
  const DB_VERSION = 1;
  const STORES = {
    CALLS: 'calls',
    SETTINGS: 'settings',
    LOGS: 'logs',
    ERRORS: 'errors',
  };

  let db = null;

  // Inicializar la base de datos
  async function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Error al abrir IntercomDB:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        console.log('IntercomDB abierto con éxito');
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para historial de llamadas
        if (!db.objectStoreNames.contains(STORES.CALLS)) {
          const callsStore = db.createObjectStore(STORES.CALLS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          callsStore.createIndex('timestamp', 'timestamp', { unique: false });
          callsStore.createIndex('callType', 'callType', { unique: false });
          callsStore.createIndex('targetRole', 'targetRole', { unique: false });
        }

        // Store para configuraciones
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          // eslint-disable-next-line no-unused-vars
          const settingsStore = db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        // Store para logs
        if (!db.objectStoreNames.contains(STORES.LOGS)) {
          const logsStore = db.createObjectStore(STORES.LOGS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          logsStore.createIndex('timestamp', 'timestamp', { unique: false });
          logsStore.createIndex('level', 'level', { unique: false });
        }

        // Store para errores
        if (!db.objectStoreNames.contains(STORES.ERRORS)) {
          const errorsStore = db.createObjectStore(STORES.ERRORS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          errorsStore.createIndex('timestamp', 'timestamp', { unique: false });
          errorsStore.createIndex('errorType', 'errorType', { unique: false });
        }
      };
    });
  }

  // REGISTROS DE LLAMADAS

  // Añadir un registro de llamada
  async function addCallRecord(callData) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CALLS], 'readwrite');
      const store = transaction.objectStore(STORES.CALLS);

      // Asegurar que tiene timestamp
      if (!callData.timestamp) {
        callData.timestamp = new Date();
      }

      const request = store.add(callData);

      request.onsuccess = () => {
        console.log('Registro de llamada guardado:', callData);
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error('Error al guardar registro de llamada:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener historial de llamadas
  async function getCallHistory(limit = 50, filter = {}) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CALLS], 'readonly');
      const store = transaction.objectStore(STORES.CALLS);
      const calls = [];

      // Usar índice si hay filtro por tipo
      let request;
      if (filter.callType) {
        const index = store.index('callType');
        request = index.openCursor(IDBKeyRange.only(filter.callType));
      } else if (filter.targetRole) {
        const index = store.index('targetRole');
        request = index.openCursor(IDBKeyRange.only(filter.targetRole));
      } else {
        // Sin filtro, usar el índice de timestamp para ordenar por fecha descendente
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev');
      }

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && calls.length < limit) {
          // Si hay filtro de fecha, verificar
          if (filter.startDate && new Date(cursor.value.timestamp) < new Date(filter.startDate)) {
            cursor.continue();
            return;
          }
          if (filter.endDate && new Date(cursor.value.timestamp) > new Date(filter.endDate)) {
            cursor.continue();
            return;
          }

          calls.push(cursor.value);
          cursor.continue();
        } else {
          resolve(calls);
        }
      };

      request.onerror = (event) => {
        console.error('Error al obtener historial de llamadas:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener estadísticas de llamadas
  async function getCallStats() {
    if (!db) await initDB();

    const calls = await getCallHistory(1000);

    const stats = {
      total: calls.length,
      success: calls.filter((call) => call.status === 'success').length,
      failed: calls.filter((call) => call.status === 'failed').length,
      duration: calls.reduce((total, call) => total + (call.duration || 0), 0),
      byRole: {},
    };

    // Agrupar por rol
    calls.forEach((call) => {
      const role = call.targetRole || 'unknown';
      if (!stats.byRole[role]) {
        stats.byRole[role] = {
          total: 0,
          success: 0,
          failed: 0,
          duration: 0,
        };
      }

      stats.byRole[role].total++;
      if (call.status === 'success') stats.byRole[role].success++;
      if (call.status === 'failed') stats.byRole[role].failed++;
      stats.byRole[role].duration += call.duration || 0;
    });

    return stats;
  }

  // CONFIGURACIONES

  // Guardar configuración
  async function saveSetting(key, value) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);

      const request = store.put({ key, value, updatedAt: new Date() });

      request.onsuccess = () => {
        console.log(`Configuración guardada: ${key}`);
        resolve(true);
      };

      request.onerror = (event) => {
        console.error(`Error al guardar configuración ${key}:`, event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener configuración
  async function getSetting(key, defaultValue = null) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);

      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(result.value);
        } else {
          resolve(defaultValue);
        }
      };

      request.onerror = (event) => {
        console.error(`Error al obtener configuración ${key}:`, event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener todas las configuraciones
  async function getAllSettings() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);

      const request = store.getAll();

      request.onsuccess = () => {
        const settings = {};
        request.result.forEach((item) => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };

      request.onerror = (event) => {
        console.error('Error al obtener configuraciones:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // LOGS Y ERRORES

  // Añadir entrada de log
  async function addLogEntry(level, message, details = {}) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.LOGS], 'readwrite');
      const store = transaction.objectStore(STORES.LOGS);

      const logEntry = {
        timestamp: new Date(),
        level,
        message,
        details,
      };

      const request = store.add(logEntry);

      request.onsuccess = () => {
        // Para logs de nivel error, guardar también en el store de errores
        if (level === 'error') {
          addErrorEntry('log', message, details);
        }
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error('Error al guardar log:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Añadir entrada de error
  async function addErrorEntry(errorType, message, details = {}) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ERRORS], 'readwrite');
      const store = transaction.objectStore(STORES.ERRORS);

      const errorEntry = {
        timestamp: new Date(),
        errorType,
        message,
        details,
      };

      const request = store.add(errorEntry);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error('Error al guardar error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener logs
  async function getLogs(limit = 100, filter = {}) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.LOGS], 'readonly');
      const store = transaction.objectStore(STORES.LOGS);
      const logs = [];

      // Usar índice si hay filtro por nivel
      let request;
      if (filter.level) {
        const index = store.index('level');
        request = index.openCursor(IDBKeyRange.only(filter.level));
      } else {
        // Sin filtro, usar el índice de timestamp para ordenar por fecha descendente
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev');
      }

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && logs.length < limit) {
          // Si hay filtro de fecha, verificar
          if (filter.startDate && new Date(cursor.value.timestamp) < new Date(filter.startDate)) {
            cursor.continue();
            return;
          }
          if (filter.endDate && new Date(cursor.value.timestamp) > new Date(filter.endDate)) {
            cursor.continue();
            return;
          }

          logs.push(cursor.value);
          cursor.continue();
        } else {
          resolve(logs);
        }
      };

      request.onerror = (event) => {
        console.error('Error al obtener logs:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Obtener errores
  async function getErrors(limit = 50, filter = {}) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.ERRORS], 'readonly');
      const store = transaction.objectStore(STORES.ERRORS);
      const errors = [];

      // Usar índice si hay filtro por tipo
      let request;
      if (filter.errorType) {
        const index = store.index('errorType');
        request = index.openCursor(IDBKeyRange.only(filter.errorType));
      } else {
        // Sin filtro, usar el índice de timestamp para ordenar por fecha descendente
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev');
      }

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && errors.length < limit) {
          // Si hay filtro de fecha, verificar
          if (filter.startDate && new Date(cursor.value.timestamp) < new Date(filter.startDate)) {
            cursor.continue();
            return;
          }
          if (filter.endDate && new Date(cursor.value.timestamp) > new Date(filter.endDate)) {
            cursor.continue();
            return;
          }

          errors.push(cursor.value);
          cursor.continue();
        } else {
          resolve(errors);
        }
      };

      request.onerror = (event) => {
        console.error('Error al obtener errores:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Limpiar datos antiguos
  async function cleanOldData(maxAge = 30) {
    // maxAge en días
    if (!db) await initDB();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    // Limpiar llamadas antiguas
    await cleanStore(STORES.CALLS, 'timestamp', cutoffDate);

    // Limpiar logs antiguos
    await cleanStore(STORES.LOGS, 'timestamp', cutoffDate);

    // Limpiar errores antiguos
    await cleanStore(STORES.ERRORS, 'timestamp', cutoffDate);
  }

  // Función auxiliar para limpiar un store
  async function cleanStore(storeName, timestampField, cutoffDate) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index(timestampField);

      const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = (event) => {
        console.error(`Error al limpiar ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Métodos públicos
  return {
    initDB,
    // Llamadas
    addCallRecord,
    getCallHistory,
    getCallStats,
    // Configuraciones
    saveSetting,
    getSetting,
    getAllSettings,
    // Logs y errores
    addLogEntry,
    addErrorEntry,
    getLogs,
    getErrors,
    // Mantenimiento
    cleanOldData,
  };
})();

// Exportar módulo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntercomDB;
} else {
  window.IntercomDB = IntercomDB;
}
