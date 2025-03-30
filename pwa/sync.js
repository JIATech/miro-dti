/**
 * Sistema de sincronización para enviar datos locales al panel de administración
 * Este módulo recopila información de IndexedDB y la envía periódicamente
 * al servidor de administración para monitoreo remoto
 */

const IntercomSync = (function () {
  // Configuración por defecto
  const config = {
    adminServer: 'http://localhost:8090',
    syncInterval: 30 * 60 * 1000, // 30 minutos por defecto
    deviceName: null,
    deviceType: 'tablet', // 'portero' o 'departamento'
    syncEnabled: true,
    lastSyncTime: null,
  };

  let syncIntervalId = null;

  // Inicializar la sincronización
  async function init() {
    console.log('Inicializando sistema de sincronización...');

    // Cargar configuración guardada
    await loadConfig();

    // Configurar nombre de dispositivo si no está definido
    if (!config.deviceName) {
      // Generar un nombre aleatorio si no hay uno guardado
      config.deviceName = `Tablet-${Math.floor(Math.random() * 10000)}`;
      await saveConfig();
    }

    // Iniciar sincronización si está habilitada
    if (config.syncEnabled) {
      startSync();
    }

    // Devolver configuración actual
    return { ...config };
  }

  // Cargar configuración desde IndexedDB
  async function loadConfig() {
    try {
      // Cargar cada propiedad individual
      const savedAdminServer = await IntercomDB.getSetting('sync.adminServer');
      if (savedAdminServer) config.adminServer = savedAdminServer;

      const savedSyncInterval = await IntercomDB.getSetting('sync.interval');
      if (savedSyncInterval) config.syncInterval = savedSyncInterval;

      const savedDeviceName = await IntercomDB.getSetting('sync.deviceName');
      if (savedDeviceName) config.deviceName = savedDeviceName;

      const savedDeviceType = await IntercomDB.getSetting('sync.deviceType');
      if (savedDeviceType) config.deviceType = savedDeviceType;

      const savedSyncEnabled = await IntercomDB.getSetting('sync.enabled');
      if (savedSyncEnabled !== null) config.syncEnabled = savedSyncEnabled;

      const savedLastSyncTime = await IntercomDB.getSetting('sync.lastSyncTime');
      if (savedLastSyncTime) config.lastSyncTime = new Date(savedLastSyncTime);

      console.log('Configuración de sincronización cargada', config);
    } catch (error) {
      console.error('Error al cargar configuración de sincronización:', error);
      IntercomDB.addErrorEntry('syncConfig', 'Error al cargar configuración', {
        error: error.message,
      });
    }
  }

  // Guardar configuración en IndexedDB
  async function saveConfig() {
    try {
      await IntercomDB.saveSetting('sync.adminServer', config.adminServer);
      await IntercomDB.saveSetting('sync.interval', config.syncInterval);
      await IntercomDB.saveSetting('sync.deviceName', config.deviceName);
      await IntercomDB.saveSetting('sync.deviceType', config.deviceType);
      await IntercomDB.saveSetting('sync.enabled', config.syncEnabled);

      if (config.lastSyncTime) {
        await IntercomDB.saveSetting('sync.lastSyncTime', config.lastSyncTime.toISOString());
      }

      console.log('Configuración de sincronización guardada');
    } catch (error) {
      console.error('Error al guardar configuración de sincronización:', error);
      IntercomDB.addErrorEntry('syncConfig', 'Error al guardar configuración', {
        error: error.message,
      });
    }
  }

  // Iniciar proceso de sincronización periódica
  function startSync() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
    }

    // Realizar una sincronización inmediata
    syncData();

    // Programar sincronizaciones periódicas
    syncIntervalId = setInterval(syncData, config.syncInterval);
    console.log(`Sincronización automática iniciada: cada ${config.syncInterval / 60000} minutos`);
  }

  // Detener sincronización periódica
  function stopSync() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
      console.log('Sincronización automática detenida');
    }
  }

  // Sincronizar datos con el servidor de administración
  async function syncData() {
    if (!config.syncEnabled) return;

    console.log('Iniciando sincronización con el servidor de administración...');
    IntercomDB.addLogEntry('info', 'Iniciando sincronización de datos');

    try {
      // Recopilar datos para enviar
      const syncData = await collectSyncData();

      // Enviar datos al servidor
      const response = await fetch(`${config.adminServer}/api/tablet/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceName: config.deviceName,
          deviceType: config.deviceType,
          data: syncData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error de servidor: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Actualizar tiempo de última sincronización
        config.lastSyncTime = new Date();
        await saveConfig();

        console.log('Sincronización completada con éxito');
        IntercomDB.addLogEntry('info', 'Sincronización completada con éxito');

        return true;
      } else {
        throw new Error(result.message || 'Error desconocido en la sincronización');
      }
    } catch (error) {
      console.error('Error durante la sincronización:', error);
      IntercomDB.addErrorEntry('sync', 'Error durante la sincronización', { error: error.message });

      return false;
    }
  }

  // Recopilar todos los datos necesarios para la sincronización
  async function collectSyncData() {
    // Obtener estadísticas de llamadas
    const callStats = await IntercomDB.getCallStats();

    // Obtener logs recientes (últimos 50)
    const logs = await IntercomDB.getLogs(50);

    // Obtener errores recientes (últimos 20)
    const errors = await IntercomDB.getErrors(20);

    // Obtener configuraciones de audio y video
    const audioSettings = await IntercomDB.getSetting('audio', {});
    const videoSettings = await IntercomDB.getSetting('video', {});

    // Recopilar información del dispositivo
    const deviceInfo = await collectDeviceInfo();

    return {
      calls: {
        total: callStats.total,
        success: callStats.success,
        failed: callStats.failed,
        duration: callStats.duration,
      },
      device: deviceInfo,
      settings: {
        audio: audioSettings,
        video: videoSettings,
      },
      logs,
      errors,
    };
  }

  // Recopilar información sobre el dispositivo
  async function collectDeviceInfo() {
    const deviceInfo = {
      batteryLevel: null,
      networkType: 'unknown',
      networkStrength: null,
      diskSpace: null,
      memoryUsage: null,
    };

    try {
      // Obtener nivel de batería si está disponible
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        deviceInfo.batteryLevel = Math.round(battery.level * 100);
      }

      // Obtener tipo de conexión si está disponible
      if ('connection' in navigator) {
        const connection = navigator.connection;
        deviceInfo.networkType = connection.type || connection.effectiveType || 'unknown';
        deviceInfo.networkStrength = connection.downlink;
      }

      // Estimar uso de memoria
      if ('memory' in performance) {
        const memory = performance.memory;
        deviceInfo.memoryUsage = {
          total: memory.jsHeapSizeLimit,
          used: memory.usedJSHeapSize,
          percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100),
        };
      }

      // Estimar espacio en disco usando la API Storage
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        deviceInfo.diskSpace = {
          quota: estimate.quota,
          usage: estimate.usage,
          percentage: Math.round((estimate.usage / estimate.quota) * 100),
        };
      }
    } catch (error) {
      console.error('Error al recopilar información del dispositivo:', error);
    }

    return deviceInfo;
  }

  // Establecer nombre de dispositivo
  async function setDeviceName(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Nombre de dispositivo inválido');
    }

    config.deviceName = name.trim();
    await saveConfig();

    return config.deviceName;
  }

  // Establecer tipo de dispositivo
  async function setDeviceType(type) {
    if (type !== 'portero' && type !== 'departamento' && type !== 'tablet') {
      throw new Error('Tipo de dispositivo inválido');
    }

    config.deviceType = type;
    await saveConfig();

    return config.deviceType;
  }

  // Configurar servidor de administración
  async function setAdminServer(serverUrl) {
    if (!serverUrl || typeof serverUrl !== 'string' || !serverUrl.startsWith('http')) {
      throw new Error('URL de servidor inválida');
    }

    config.adminServer = serverUrl;
    await saveConfig();

    return config.adminServer;
  }

  // Configurar intervalo de sincronización
  async function setSyncInterval(minutes) {
    const interval = parseInt(minutes);

    if (isNaN(interval) || interval < 1) {
      throw new Error('Intervalo de sincronización inválido');
    }

    config.syncInterval = interval * 60 * 1000;
    await saveConfig();

    // Reiniciar sincronización con el nuevo intervalo
    if (config.syncEnabled) {
      stopSync();
      startSync();
    }

    return config.syncInterval;
  }

  // Habilitar/deshabilitar sincronización
  async function enableSync(enabled) {
    config.syncEnabled = !!enabled;
    await saveConfig();

    if (config.syncEnabled) {
      startSync();
    } else {
      stopSync();
    }

    return config.syncEnabled;
  }

  // Métodos públicos
  return {
    init,
    syncData,
    startSync,
    stopSync,
    setDeviceName,
    setDeviceType,
    setAdminServer,
    setSyncInterval,
    enableSync,
    getConfig: () => ({ ...config }),
  };
})();

// Exportar módulo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntercomSync;
} else {
  window.IntercomSync = IntercomSync;
}
