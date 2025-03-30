/**
 * Servidor para la PWA Intercom
 *
 * Proporciona los endpoints necesarios para la PWA y expone una API
 * para el panel de administración
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

// Configuración del servidor
const app = express();
const server = http.createServer(app);
const PORT = process.env.PWA_PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos en memoria para dispositivos registrados
// En producción, debería usar una base de datos persistente
const connectedTablets = {};

// Endpoint para registrar una tablet
app.post('/api/tablet/register', (req, res) => {
  try {
    const { deviceId, deviceName, deviceType, ip } = req.body;

    if (!deviceId || !deviceName) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere deviceId y deviceName',
      });
    }

    // Registrar o actualizar la tablet
    connectedTablets[deviceId] = {
      deviceId,
      deviceName,
      deviceType: deviceType || 'tablet',
      ip: ip || req.ip,
      lastSeen: new Date(),
      online: true,
      registered: new Date(),
      performance: {},
      hardware: {},
      stats: {
        callCount: 0,
        errorCount: 0,
      },
    };

    console.log(`Tablet registrada: ${deviceName} (${deviceId})`);

    return res.json({
      success: true,
      message: 'Dispositivo registrado correctamente',
    });
  } catch (error) {
    console.error('Error al registrar tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Endpoint para actualizar estado y métricas de una tablet
app.post('/api/tablet/update', (req, res) => {
  try {
    const { deviceId, metrics } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere deviceId',
      });
    }

    // Verificar si la tablet existe
    if (!connectedTablets[deviceId]) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no registrada',
      });
    }

    // Actualizar métricas
    if (metrics) {
      const tablet = connectedTablets[deviceId];

      // Actualizar timestamp de última actividad
      tablet.lastSeen = new Date();
      tablet.online = true;

      // Actualizar métricas específicas
      if (metrics.performance) {
        tablet.performance = {
          ...tablet.performance,
          ...metrics.performance,
        };
      }

      if (metrics.hardware) {
        tablet.hardware = {
          ...tablet.hardware,
          ...metrics.hardware,
        };
      }

      if (metrics.stats) {
        tablet.stats = {
          ...tablet.stats,
          ...metrics.stats,
        };
      }

      // Actualizar propiedades individuales
      if (metrics.role) tablet.role = metrics.role;
      if (metrics.version) tablet.version = metrics.version;
      if (metrics.battery) tablet.battery = metrics.battery;
    }

    return res.json({
      success: true,
      message: 'Dispositivo actualizado correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Endpoint para enviar datos de sincronización
app.post('/api/tablet/sync', (req, res) => {
  try {
    const { deviceId, deviceName, data } = req.body;

    if (!deviceId || !data) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere deviceId y data',
      });
    }

    // Actualizar tablet si existe, o registrarla si no
    if (!connectedTablets[deviceId] && deviceName) {
      connectedTablets[deviceId] = {
        deviceId,
        deviceName,
        lastSeen: new Date(),
        online: true,
        registered: new Date(),
      };
    }

    if (connectedTablets[deviceId]) {
      const tablet = connectedTablets[deviceId];

      // Actualizar última actividad
      tablet.lastSeen = new Date();
      tablet.online = true;

      // Procesar datos sincronizados
      if (data.device) {
        tablet.hardware = data.device.hardware || {};
        tablet.battery = data.device.battery?.level || 0;
        tablet.version = data.device.appVersion || 'Desconocida';
        tablet.deviceType = data.device.deviceType || tablet.deviceType;
      }

      if (data.calls) {
        tablet.stats = {
          ...tablet.stats,
          callCount: data.calls.total || 0,
          successCalls: data.calls.success || 0,
          failedCalls: data.calls.failed || 0,
          totalDuration: data.calls.duration || 0,
        };
      }

      // Almacenar logs y errores (implementar según sea necesario)
      console.log(`Datos sincronizados para ${tablet.deviceName} (${deviceId})`);
    }

    return res.json({
      success: true,
      message: 'Datos sincronizados correctamente',
    });
  } catch (error) {
    console.error('Error al sincronizar datos de tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Endpoints para panel de administración

// Obtener lista de todas las tablets
app.get('/api/tablets', (req, res) => {
  try {
    // Convertir objeto a array
    const tablets = Object.values(connectedTablets);

    // Marcar tablets que no han reportado actividad en más de 5 minutos como offline
    const now = new Date();
    tablets.forEach((tablet) => {
      const lastSeen = new Date(tablet.lastSeen);
      const timeDiff = now - lastSeen;
      if (timeDiff > 5 * 60 * 1000) {
        // 5 minutos
        tablet.online = false;
      }
    });

    return res.json(tablets);
  } catch (error) {
    console.error('Error al obtener lista de tablets:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Obtener información detallada de una tablet
app.get('/api/tablets/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!connectedTablets[deviceId]) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no encontrada',
      });
    }

    return res.json(connectedTablets[deviceId]);
  } catch (error) {
    console.error(`Error al obtener información de tablet ${req.params.deviceId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Obtener estadísticas del sistema
app.get('/api/dashboard/stats', (req, res) => {
  try {
    // Calcular estadísticas de llamadas por hora (simulación)
    const callsByHour = Array(24).fill(0);
    const now = new Date();

    // Definir categorías de errores para el gráfico
    const errors = {
      conexión: 0,
      audio: 0,
      video: 0,
      usuario: 0,
      sistema: 0,
    };

    // Contar tablets por rol y estado
    const tabletStats = {
      total: Object.keys(connectedTablets).length,
      online: Object.values(connectedTablets).filter((t) => t.online).length,
      portero: Object.values(connectedTablets).filter((t) => t.deviceType === 'portero').length,
      departamento: Object.values(connectedTablets).filter((t) => t.deviceType === 'departamento')
        .length,
    };

    // Obtener información del sistema
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      hostname: os.hostname(),
      platform: os.platform(),
      cpu: os.cpus()[0]?.model || 'Desconocido',
      loadavg: os.loadavg(),
    };

    return res.json({
      calls: callsByHour,
      errors,
      tablets: tabletStats,
      system: systemInfo,
      lastUpdate: new Date(),
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Obtener estado de los servicios
app.get('/api/services/status', (req, res) => {
  try {
    // Verificar estado de servicios (simulación)
    const services = {
      pwa: {
        running: true,
        uptime: process.uptime(),
        memory: process.memoryUsage().rss,
        pid: process.pid,
        port: PORT,
        status: 'running',
        version: '1.0.0',
      },
      signaling: {
        running: true,
        status: 'running',
        uptime: 12345,
        memory: 52428800,
        pid: 12345,
        port: 3000,
      },
      mirotalksfu: {
        running: true,
        status: 'running',
        uptime: 12345,
        memory: 104857600,
        pid: 12346,
        port: 8080,
      },
      admin: {
        running: true,
        status: 'running',
        uptime: 12345,
        memory: 78643200,
        pid: 12347,
        port: 8090,
      },
    };

    return res.json(services);
  } catch (error) {
    console.error('Error al obtener estado de servicios:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Enviar ping a una tablet específica
app.post('/api/tablets/:deviceId/ping', (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!connectedTablets[deviceId]) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no encontrada',
      });
    }

    // Aquí implementarías la lógica para enviar un ping real
    // En este ejemplo solo actualizamos el registro

    connectedTablets[deviceId].lastPing = new Date();

    return res.json({
      success: true,
      message: 'Ping enviado correctamente',
    });
  } catch (error) {
    console.error(`Error al enviar ping a tablet ${req.params.deviceId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message,
    });
  }
});

// Ruta principal para la PWA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor PWA escuchando en puerto ${PORT}`);
});

module.exports = {
  server,
  app,
};
