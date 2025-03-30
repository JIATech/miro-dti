/**
 * Módulo para gestión de limpieza de datos en tablets
 * Se encarga de aplicar políticas de retención y mantener
 * el almacenamiento local dentro de límites razonables
 */

class StorageCleaner {
  constructor(storage) {
    this.storage = storage;
    this.defaultPolicy = {
      callHistory: 60, // 60 días para historial de llamadas
      standardLogs: 14, // 14 días para logs estándar
      errorLogs: 30, // 30 días para logs de errores
      detailedMetrics: 7, // 7 días para métricas detalladas
      aggregatedMetrics: 30, // 30 días para métricas agregadas
    };

    // Registrar la última limpieza
    this.lastCleanup = localStorage.getItem('lastDataCleanup')
      ? new Date(localStorage.getItem('lastDataCleanup'))
      : null;

    // Inicializar métricas de almacenamiento
    this.storageMetrics = {
      lastCheck: null,
      used: 0,
      total: 0,
      items: {},
    };
  }

  /**
   * Inicializar el módulo de limpieza
   * @param {Object} socket - Socket.io para comunicación
   */
  init(socket) {
    this.socket = socket;

    // Escuchar eventos del servidor para limpieza de datos
    socket.on('tablet:clean-data', async (data) => {
      console.log('Recibida solicitud de limpieza de datos:', data);

      // Usar política recibida o la por defecto
      const policy = data.policy || this.defaultPolicy;

      // Ejecutar limpieza
      await this.cleanData(policy);

      // Informar al servidor sobre la limpieza
      this.reportCleanupComplete(data.requestedBy || 'scheduler');
    });

    // Verificar almacenamiento al inicio
    this.checkStorageUsage();

    // Programar verificación periódica de almacenamiento
    setInterval(() => this.checkStorageUsage(), 12 * 60 * 60 * 1000); // Cada 12 horas

    // Programar limpieza automática diaria (si no hay servidor central)
    this.scheduleAutoCleanup();
  }

  /**
   * Programar limpieza automática (fallback si el servidor no envía eventos)
   */
  scheduleAutoCleanup() {
    const now = new Date();
    const lastCleanup = this.lastCleanup || new Date(0);
    const daysSinceLastCleanup = (now - lastCleanup) / (1000 * 60 * 60 * 24);

    // Si han pasado más de 3 días desde la última limpieza, ejecutar ahora
    if (daysSinceLastCleanup > 3) {
      setTimeout(() => this.cleanData(this.defaultPolicy), 5 * 60 * 1000); // 5 minutos después del inicio
    }

    // Programar verificación diaria a las 3 AM
    const scheduleNextCleanup = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(3, 0, 0, 0);

      const timeUntilNextCheck = tomorrow - now;
      setTimeout(() => {
        this.checkAndCleanIfNeeded();
        scheduleNextCleanup(); // Re-programar para el día siguiente
      }, timeUntilNextCheck);
    };

    scheduleNextCleanup();
  }

  /**
   * Verificar si es necesaria una limpieza
   */
  async checkAndCleanIfNeeded() {
    const now = new Date();
    const lastCleanup = this.lastCleanup || new Date(0);
    const daysSinceLastCleanup = (now - lastCleanup) / (1000 * 60 * 60 * 24);

    // Si han pasado al menos 1 día desde la última limpieza
    if (daysSinceLastCleanup >= 1) {
      await this.cleanData(this.defaultPolicy);
      this.reportCleanupComplete('auto');
    }
  }

  /**
   * Comprobar uso de almacenamiento
   */
  async checkStorageUsage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        this.storageMetrics = {
          lastCheck: new Date(),
          used: estimate.usage || 0,
          total: estimate.quota || 0,
          percentUsed: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0,
        };

        // Si hay socket disponible, reportar al servidor
        if (this.socket && this.socket.connected) {
          this.socket.emit('tablet:storage-update', {
            storage: this.storageMetrics,
            lastCleanup: this.lastCleanup,
          });
        }

        // Si el almacenamiento está por encima del 80%, sugerir limpieza
        if (this.storageMetrics.percentUsed > 80) {
          console.warn(
            'Almacenamiento crítico: ' + this.storageMetrics.percentUsed.toFixed(2) + '%'
          );
          // Forzar limpieza si es crítico
          if (this.storageMetrics.percentUsed > 90) {
            await this.cleanData(this.defaultPolicy);
            this.reportCleanupComplete('critical-storage');
          }
        }
      }
    } catch (error) {
      console.error('Error al verificar almacenamiento:', error);
    }
  }

  /**
   * Limpiar datos según política de retención
   * @param {Object} policy - Política de retención en días
   */
  async cleanData(policy) {
    console.log('Iniciando limpieza de datos con política:', policy);
    const results = {
      callHistoryRemoved: 0,
      standardLogsRemoved: 0,
      errorLogsRemoved: 0,
      detailedMetricsRemoved: 0,
      aggregatedMetricsRemoved: 0,
    };

    try {
      // Registro de inicio de limpieza
      // eslint-disable-next-line no-unused-vars
      const cleanupStart = new Date().toISOString();

      // 1. Limpieza de historial de llamadas
      results.callHistoryRemoved = await this.cleanCallHistory(policy.callHistory);

      // 2. Limpieza de logs estándar
      results.standardLogsRemoved = await this.cleanStandardLogs(policy.standardLogs);

      // 3. Limpieza de logs de errores
      results.errorLogsRemoved = await this.cleanErrorLogs(policy.errorLogs);

      // 4. Limpieza de métricas detalladas
      results.detailedMetricsRemoved = await this.cleanDetailedMetrics(policy.detailedMetrics);

      // 5. Limpieza de métricas agregadas
      results.aggregatedMetricsRemoved = await this.cleanAggregatedMetrics(
        policy.aggregatedMetrics
      );

      // Registrar la limpieza
      this.lastCleanup = new Date();
      localStorage.setItem('lastDataCleanup', this.lastCleanup.toISOString());

      // Actualizar métricas de almacenamiento después de la limpieza
      await this.checkStorageUsage();

      console.log('Limpieza completada:', results);
      return results;
    } catch (error) {
      console.error('Error durante la limpieza de datos:', error);
      throw error;
    }
  }

  /**
   * Limpiar historial de llamadas
   * @param {Number} retentionDays - Días a conservar
   * @returns {Number} - Cantidad de registros eliminados
   */
  async cleanCallHistory(retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const callHistory = await this.storage.getCallHistory();
      const initialCount = callHistory.length;

      // Filtrar llamadas para mantener solo las posteriores a la fecha límite
      const filteredHistory = callHistory.filter((call) => {
        const callDate = new Date(call.timestamp);
        return callDate >= cutoffDate;
      });

      // Guardar historial filtrado
      await this.storage.saveCallHistory(filteredHistory);

      return initialCount - filteredHistory.length;
    } catch (error) {
      console.error('Error al limpiar historial de llamadas:', error);
      return 0;
    }
  }

  /**
   * Limpiar logs estándar
   * @param {Number} retentionDays - Días a conservar
   * @returns {Number} - Cantidad de logs eliminados
   */
  async cleanStandardLogs(retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const logs = await this.storage.getLogs();
      const initialCount = logs.length;

      // Filtrar logs para mantener solo los posteriores a la fecha límite
      // y que no sean errores (esos se manejan por separado)
      const filteredLogs = logs.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate || log.level === 'error';
      });

      // Guardar logs filtrados
      await this.storage.saveLogs(filteredLogs);

      return initialCount - filteredLogs.length;
    } catch (error) {
      console.error('Error al limpiar logs estándar:', error);
      return 0;
    }
  }

  /**
   * Limpiar logs de errores
   * @param {Number} retentionDays - Días a conservar
   * @returns {Number} - Cantidad de logs de error eliminados
   */
  async cleanErrorLogs(retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const logs = await this.storage.getLogs();
      const initialErrorCount = logs.filter((log) => log.level === 'error').length;

      // Actualizar solo los logs de error
      const updatedLogs = logs.filter((log) => {
        if (log.level !== 'error') return true;

        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
      });

      // Guardar logs actualizados
      await this.storage.saveLogs(updatedLogs);

      return initialErrorCount - updatedLogs.filter((log) => log.level === 'error').length;
    } catch (error) {
      console.error('Error al limpiar logs de errores:', error);
      return 0;
    }
  }

  /**
   * Limpiar métricas detalladas
   * @param {Number} retentionDays - Días a conservar
   * @returns {Number} - Cantidad de métricas eliminadas
   */
  async cleanDetailedMetrics(retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const metrics = await this.storage.getMetrics('detailed');
      const initialCount = metrics.length;

      // Filtrar métricas para mantener solo las posteriores a la fecha límite
      const filteredMetrics = metrics.filter((metric) => {
        const metricDate = new Date(metric.timestamp);
        return metricDate >= cutoffDate;
      });

      // Guardar métricas filtradas
      await this.storage.saveMetrics('detailed', filteredMetrics);

      return initialCount - filteredMetrics.length;
    } catch (error) {
      console.error('Error al limpiar métricas detalladas:', error);
      return 0;
    }
  }

  /**
   * Limpiar métricas agregadas
   * @param {Number} retentionDays - Días a conservar
   * @returns {Number} - Cantidad de métricas eliminadas
   */
  async cleanAggregatedMetrics(retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const metrics = await this.storage.getMetrics('aggregated');
      const initialCount = metrics.length;

      // Filtrar métricas para mantener solo las posteriores a la fecha límite
      const filteredMetrics = metrics.filter((metric) => {
        const metricDate = new Date(metric.timestamp);
        return metricDate >= cutoffDate;
      });

      // Guardar métricas filtradas
      await this.storage.saveMetrics('aggregated', filteredMetrics);

      return initialCount - filteredMetrics.length;
    } catch (error) {
      console.error('Error al limpiar métricas agregadas:', error);
      return 0;
    }
  }

  /**
   * Reportar al servidor que la limpieza se completó
   * @param {String} trigger - Lo que originó la limpieza
   */
  reportCleanupComplete(trigger) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('tablet:cleanup-complete', {
        timestamp: new Date(),
        trigger,
        storage: this.storageMetrics,
      });
    }
  }
}

// Exportar para uso en el módulo principal
window.StorageCleaner = StorageCleaner;
