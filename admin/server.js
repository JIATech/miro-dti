const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const fs = require('fs');
const winston = require('winston');
const cron = require('node-cron');
const Docker = require('dockerode');
const basicAuth = require('express-basic-auth');
const os = require('os');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');

// Configuración
const PORT = process.env.ADMIN_PORT || 8090;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_RETENTION_DAYS = 7; // Días que se mantienen los logs
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/intercom';
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

// Configuración de política de retención de datos para tablets
const DEFAULT_RETENTION_POLICY = {
  callHistory: 60, // 60 días para historial de llamadas
  standardLogs: 14, // 14 días para logs estándar
  errorLogs: 30, // 30 días para logs de errores
  detailedMetrics: 7, // 7 días para métricas detalladas
  aggregatedMetrics: 30, // 30 días para métricas agregadas
};

// Asegurar que existe el directorio de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Configuración del logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'admin' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'admin.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Cliente Docker para interactuar con contenedores
const docker = new Docker();

// Conexión a MongoDB
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info('Conexión a MongoDB establecida');
  })
  .catch((err) => {
    logger.error('Error al conectar a MongoDB:', err);
  });

// Esquemas y Modelos
const TabletSchema = new mongoose.Schema({
  deviceName: { type: String, required: true, unique: true },
  deviceType: { type: String, required: true },
  userName: { type: String },
  displayName: { type: String },
  status: { type: String, default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  lastSync: { type: Date },
  ipAddress: { type: String },
  wallpanel: {
    deviceId: String,
    androidId: String,
    manufacturer: String,
    model: String,
    ip: String,
    batteryLevel: Number,
    isCharging: Boolean,
    screenOn: Boolean,
    version: String,
    lastPing: Date,
  },
  metrics: { type: Object, default: {} },
  logs: { type: Array, default: [] },
  callHistory: { type: Array, default: [] },
});

// Esquema para políticas de retención de datos
const RetentionPolicySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, default: 'default' },
  callHistory: { type: Number, default: 60 }, // días
  standardLogs: { type: Number, default: 14 }, // días
  errorLogs: { type: Number, default: 30 }, // días
  detailedMetrics: { type: Number, default: 7 }, // días
  aggregatedMetrics: { type: Number, default: 30 }, // días
  lastUpdated: { type: Date, default: Date.now },
  createdBy: { type: String },
});

const Tablet = mongoose.model('Tablet', TabletSchema);
const RetentionPolicy = mongoose.model('RetentionPolicy', RetentionPolicySchema);

// Verificar si existe una política de retención por defecto, si no, crearla
const initDefaultRetentionPolicy = async () => {
  try {
    const defaultPolicy = await RetentionPolicy.findOne({ name: 'default' });
    if (!defaultPolicy) {
      logger.info('Creando política de retención por defecto');
      const newPolicy = new RetentionPolicy({
        name: 'default',
        ...DEFAULT_RETENTION_POLICY,
        createdBy: 'system',
      });
      await newPolicy.save();
    }
  } catch (error) {
    logger.error('Error al crear política de retención por defecto', { error: error.message });
  }
};

initDefaultRetentionPolicy();

// Inicialización del cliente MQTT
let mqttClient;
const initMQTT = () => {
  try {
    const mqttOptions = {
      clientId: `admin-panel-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
    };

    // Añadir credenciales si están configuradas
    if (MQTT_USERNAME && MQTT_PASSWORD) {
      mqttOptions.username = MQTT_USERNAME;
      mqttOptions.password = MQTT_PASSWORD;
    }

    mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions);

    mqttClient.on('connect', () => {
      logger.info('Conectado al broker MQTT:', MQTT_BROKER);
      // Suscribirse a respuestas y actualizaciones de estado de dispositivos
      mqttClient.subscribe('intercom/+/response/#');
      mqttClient.subscribe('intercom/+/status/#');
    });

    mqttClient.on('message', async (topic, message) => {
      try {
        // Formato esperado: intercom/DEVICE-ID/tipo/subtipo
        const parts = topic.split('/');
        if (parts.length < 3) return;

        const deviceId = parts[1];
        const messageType = parts[2];

        // Procesar mensajes según tipo
        if (messageType === 'response') {
          const command = parts[3] || 'unknown';
          const data = JSON.parse(message.toString());
          logger.info(`Respuesta de ${deviceId} para comando ${command}:`, data);

          // Emitir al socket para actualizar UI en tiempo real
          io.emit('device:response', { deviceId, command, data });

          // Registrar respuesta en base de datos
          const tablet = await Tablet.findOne({ 'wallpanel.deviceId': deviceId });
          if (tablet) {
            await Tablet.updateOne(
              { 'wallpanel.deviceId': deviceId },
              {
                $push: {
                  logs: {
                    timestamp: new Date(),
                    level: 'info',
                    message: `Respuesta ${command}: ${JSON.stringify(data)}`,
                  },
                },
              }
            );
          }
        } else if (messageType === 'status') {
          const statusType = parts[3] || 'general';
          const data = JSON.parse(message.toString());

          // Actualizar estado del dispositivo en base de datos
          const tablet = await Tablet.findOne({ 'wallpanel.deviceId': deviceId });

          if (tablet) {
            const update = {
              lastSeen: new Date(),
              status: 'online',
            };

            // Actualizar campos específicos según el tipo de estado
            if (statusType === 'battery') {
              update['wallpanel.batteryLevel'] = data.value || 0;
              update['wallpanel.isCharging'] = data.charging || false;
            } else if (statusType === 'screen') {
              update['wallpanel.screenOn'] = data.value || false;
            }

            await Tablet.updateOne({ 'wallpanel.deviceId': deviceId }, { $set: update });

            // Emitir actualización a UI
            io.emit('device:status', { deviceId, statusType, data });
          }
        }
      } catch (error) {
        logger.error('Error procesando mensaje MQTT:', error);
      }
    });

    mqttClient.on('error', (error) => {
      logger.error('Error en conexión MQTT:', error);
    });
  } catch (error) {
    logger.error('Error inicializando MQTT:', error);
  }
};

// Iniciar MQTT
initMQTT();

// Inicialización de servidor Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Archivo de configuración para almacenar la contraseña de administrador
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Cargar o crear la configuración
let adminConfig = { username: ADMIN_USER, password: ADMIN_PASSWORD };
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
    const storedConfig = JSON.parse(configData);
    if (storedConfig.username && storedConfig.password) {
      adminConfig = storedConfig;
      logger.info('Configuración de administrador cargada correctamente.');
    }
  } else {
    // Crear archivo de configuración inicial
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(adminConfig, null, 2));
    logger.info('Archivo de configuración de administrador creado con valores predeterminados.');
  }
} catch (error) {
  logger.error('Error al cargar la configuración de administrador:', error);
}

// Configuración de seguridad
app.use(
  basicAuth({
    users: { [adminConfig.username]: adminConfig.password },
    challenge: true,
    realm: 'Sistema Intercom - Panel de Administración',
  })
);

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Variables de estado
const stats = {
  startTime: new Date(),
  eventStats: {
    calls: {
      total: 0,
      success: 0,
      failed: 0,
    },
    errors: {
      total: 0,
      byType: {},
    },
  },
  system: {
    uptime: 0,
    memory: {},
    logRotation: {
      maxDays: LOG_RETENTION_DAYS,
      nextCleanup: null,
    },
  },
};

// Timestamp de próxima limpieza
updateNextCleanupTime();

// Rutas API
app.get('/api/services', async (req, res) => {
  try {
    const services = await getServicesStatus();
    res.json(services);
  } catch (error) {
    logger.error('Error al obtener estado de servicios', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estado de servicios' });
  }
});

app.get('/api/stats', (req, res) => {
  updateSystemInfo();
  res.json(stats);
});

app.post('/api/actions/restart/:service', async (req, res) => {
  const { service } = req.params;

  try {
    await restartService(service);
    logger.info(`Servicio ${service} reiniciado con éxito`);

    // Notificar a clientes
    io.emit('system-event', {
      type: 'success',
      message: `Servicio ${service} reiniciado correctamente`,
    });

    res.json({ success: true, message: `Servicio ${service} reiniciado correctamente` });
  } catch (error) {
    logger.error(`Error al reiniciar servicio ${service}`, { error: error.message });

    // Notificar a clientes
    io.emit('system-event', {
      type: 'error',
      message: `Error al reiniciar ${service}: ${error.message}`,
    });

    res.status(500).json({ error: `Error al reiniciar servicio: ${error.message}` });
  }
});

app.post('/api/actions/clean-logs', async (req, res) => {
  try {
    const result = await cleanupOldLogs();
    logger.info('Limpieza manual de logs iniciada', { result });

    // Notificar a clientes
    io.emit('system-event', {
      type: 'success',
      message: `Limpieza manual de logs completada: ${result.removed} archivos eliminados`,
    });

    res.json({
      success: true,
      message: `Limpieza de logs completada: ${result.removed} archivos eliminados`,
    });
  } catch (error) {
    logger.error('Error en limpieza manual de logs', { error: error.message });

    // Notificar a clientes
    io.emit('system-event', {
      type: 'error',
      message: `Error en limpieza de logs: ${error.message}`,
    });

    res.status(500).json({ error: `Error en la limpieza de logs: ${error.message}` });
  }
});

// Rutas públicas (no requieren autenticación)
app.post('/api/tablet/sync', async (req, res) => {
  try {
    const { deviceName, deviceType, data } = req.body;

    if (!deviceName || !deviceType) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos (deviceName, deviceType)',
      });
    }

    // Buscar tablet existente o crear uno nuevo
    let tablet = await Tablet.findOne({ deviceName });

    if (!tablet) {
      tablet = new Tablet({
        deviceName,
        deviceType,
      });
    }

    // Actualizar estadísticas
    tablet.lastSeen = new Date();

    // Actualizar datos si se proporcionan
    if (data) {
      if (data.calls) {
        if (data.calls.total !== undefined) tablet.totalCalls = data.calls.total;
        if (data.calls.duration !== undefined) tablet.callDuration = data.calls.duration;
        if (data.calls.success !== undefined) tablet.callsSuccess = data.calls.success;
        if (data.calls.failed !== undefined) tablet.callsFailed = data.calls.failed;
      }

      if (data.device) {
        if (data.device.batteryLevel !== undefined) tablet.batteryLevel = data.device.batteryLevel;
        if (data.device.networkType !== undefined) tablet.networkType = data.device.networkType;
        if (data.device.networkStrength !== undefined)
          tablet.networkStrength = data.device.networkStrength;
        if (data.device.diskSpace !== undefined) tablet.diskSpace = data.device.diskSpace;
        if (data.device.memoryUsage !== undefined) tablet.memoryUsage = data.device.memoryUsage;
      }

      if (data.settings) {
        if (data.settings.audio !== undefined) tablet.audioSettings = data.settings.audio;
        if (data.settings.video !== undefined) tablet.videoSettings = data.settings.video;
      }

      // Añadir nuevos logs si existen
      if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
        // Añadir solo logs nuevos
        tablet.logs.push(
          ...data.logs.map((log) => ({
            timestamp: log.timestamp || new Date(),
            level: log.level || 'info',
            message: log.message,
            details: log.details || {},
          }))
        );
      }

      // Añadir nuevos errores si existen
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        tablet.errors.push(
          ...data.errors.map((error) => ({
            timestamp: error.timestamp || new Date(),
            errorType: error.errorType || 'unknown',
            message: error.message,
            details: error.details || {},
          }))
        );
      }
    }

    // Guardar cambios
    await tablet.save();

    // Notificar a clientes conectados por WebSocket
    io.emit('tablet:update', {
      deviceName: tablet.deviceName,
      deviceType: tablet.deviceType,
      lastSeen: tablet.lastSeen,
      batteryLevel: tablet.batteryLevel,
      networkType: tablet.networkType,
    });

    return res.json({
      success: true,
      message: 'Datos sincronizados correctamente',
    });
  } catch (error) {
    logger.error('Error en sincronización de tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar datos',
      error: error.message,
    });
  }
});

// Rutas para dashboard (requieren autenticación)
app.get('/api/tablets', async (req, res) => {
  try {
    const tablets = await Tablet.find({})
      .select('-logs -errors') // Excluir logs y errores para reducir tamaño
      .sort({ lastSeen: -1 });

    return res.json({
      success: true,
      count: tablets.length,
      tablets,
    });
  } catch (error) {
    logger.error('Error al obtener tablets:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener datos',
      error: error.message,
    });
  }
});

app.get('/api/tablets/:deviceName', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const tablet = await Tablet.findOne({ deviceName });

    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no encontrado',
      });
    }

    return res.json({
      success: true,
      tablet,
    });
  } catch (error) {
    logger.error('Error al obtener detalles de tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener datos',
      error: error.message,
    });
  }
});

app.get('/api/tablets/:deviceName/logs', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const { limit = 50, level } = req.query;

    const tablet = await Tablet.findOne({ deviceName });

    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no encontrado',
      });
    }

    let logs = tablet.logs;

    // Filtrar por nivel si se especifica
    if (level) {
      logs = logs.filter((log) => log.level === level);
    }

    // Limitar cantidad de logs
    logs = logs.slice(-Math.min(parseInt(limit), 100));

    return res.json({
      success: true,
      deviceName,
      count: logs.length,
      logs,
    });
  } catch (error) {
    logger.error('Error al obtener logs de tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener datos',
      error: error.message,
    });
  }
});

app.get('/api/tablets/:deviceName/errors', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const { limit = 50, type } = req.query;

    const tablet = await Tablet.findOne({ deviceName });

    if (!tablet) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no encontrado',
      });
    }

    let errors = tablet.errors;

    // Filtrar por tipo si se especifica
    if (type) {
      errors = errors.filter((error) => error.errorType === type);
    }

    // Limitar cantidad de errores
    errors = errors.slice(-Math.min(parseInt(limit), 100));

    return res.json({
      success: true,
      deviceName,
      count: errors.length,
      errors,
    });
  } catch (error) {
    logger.error('Error al obtener errores de tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener datos',
      error: error.message,
    });
  }
});

app.post('/api/admin/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos (oldPassword, newPassword)',
      });
    }

    if (adminConfig.password !== oldPassword) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta',
      });
    }

    adminConfig.password = newPassword;

    // Guardar cambios en el archivo de configuración
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(adminConfig, null, 2));

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
    });
  } catch (error) {
    logger.error('Error al cambiar la contraseña de administrador:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar la contraseña',
      error: error.message,
    });
  }
});

// Rutas para políticas de retención
app.get('/api/retention-policies', async (req, res) => {
  try {
    const policies = await RetentionPolicy.find();
    return res.json({
      success: true,
      policies,
    });
  } catch (error) {
    logger.error('Error al obtener políticas de retención:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener políticas de retención',
      error: error.message,
    });
  }
});

app.get('/api/retention-policies/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const policy = await RetentionPolicy.findOne({ name });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Política de retención no encontrada',
      });
    }

    return res.json({
      success: true,
      policy,
    });
  } catch (error) {
    logger.error('Error al obtener política de retención:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener política de retención',
      error: error.message,
    });
  }
});

app.post('/api/retention-policies', async (req, res) => {
  try {
    const { name, callHistory, standardLogs, errorLogs, detailedMetrics, aggregatedMetrics } =
      req.body;

    if (
      !name ||
      !callHistory ||
      !standardLogs ||
      !errorLogs ||
      !detailedMetrics ||
      !aggregatedMetrics
    ) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos para crear política de retención',
      });
    }

    const policy = new RetentionPolicy({
      name,
      callHistory,
      standardLogs,
      errorLogs,
      detailedMetrics,
      aggregatedMetrics,
      createdBy: 'admin',
    });

    await policy.save();

    return res.json({
      success: true,
      message: 'Política de retención creada correctamente',
    });
  } catch (error) {
    logger.error('Error al crear política de retención:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear política de retención',
      error: error.message,
    });
  }
});

app.put('/api/retention-policies/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { callHistory, standardLogs, errorLogs, detailedMetrics, aggregatedMetrics } = req.body;

    if (!callHistory || !standardLogs || !errorLogs || !detailedMetrics || !aggregatedMetrics) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos para actualizar política de retención',
      });
    }

    const policy = await RetentionPolicy.findOneAndUpdate(
      { name },
      {
        callHistory,
        standardLogs,
        errorLogs,
        detailedMetrics,
        aggregatedMetrics,
        lastUpdated: Date.now(),
      },
      { new: true }
    );

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Política de retención no encontrada',
      });
    }

    return res.json({
      success: true,
      message: 'Política de retención actualizada correctamente',
    });
  } catch (error) {
    logger.error('Error al actualizar política de retención:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar política de retención',
      error: error.message,
    });
  }
});

app.delete('/api/retention-policies/:name', async (req, res) => {
  try {
    const { name } = req.params;

    await RetentionPolicy.findOneAndDelete({ name });

    return res.json({
      success: true,
      message: 'Política de retención eliminada correctamente',
    });
  } catch (error) {
    logger.error('Error al eliminar política de retención:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar política de retención',
      error: error.message,
    });
  }
});

// Endpoint para forzar limpieza en una o todas las tablets
app.post('/api/tablets/clean-data', async (req, res) => {
  try {
    const { deviceName, policyOverride } = req.body;

    // Obtener la política de retención actual
    const retentionPolicy = await RetentionPolicy.findOne({ name: 'default' });
    if (!retentionPolicy) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró la política de retención por defecto',
      });
    }

    // Determinar la política a usar (por defecto o override)
    const policy = policyOverride || {
      callHistory: retentionPolicy.callHistory,
      standardLogs: retentionPolicy.standardLogs,
      errorLogs: retentionPolicy.errorLogs,
      detailedMetrics: retentionPolicy.detailedMetrics,
      aggregatedMetrics: retentionPolicy.aggregatedMetrics,
    };

    // Si se especifica un dispositivo, limpiar solo ese
    if (deviceName) {
      const tablet = await Tablet.findOne({ deviceName });
      if (!tablet) {
        return res.status(404).json({
          success: false,
          message: `No se encontró la tablet con nombre: ${deviceName}`,
        });
      }

      // Emitir evento a esa tablet específica
      io.to(`tablet:${deviceName}`).emit('tablet:clean-data', {
        policy,
        requestedAt: new Date(),
        requestedBy: 'admin-manual',
      });

      logger.info(`Solicitud de limpieza manual enviada a tablet: ${deviceName}`);

      return res.json({
        success: true,
        message: `Solicitud de limpieza enviada a tablet: ${deviceName}`,
      });
    }
    // Si no se especifica dispositivo, limpiar todas
    else {
      // Emitir evento a todas las tablets
      io.emit('tablet:clean-data', {
        policy,
        requestedAt: new Date(),
        requestedBy: 'admin-manual',
      });

      logger.info('Solicitud de limpieza manual enviada a todas las tablets');

      return res.json({
        success: true,
        message: 'Solicitud de limpieza enviada a todas las tablets',
      });
    }
  } catch (error) {
    logger.error('Error al solicitar limpieza de datos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al solicitar limpieza de datos',
      error: error.message,
    });
  }
});

// Endpoint para ver estado de almacenamiento de tablets
app.get('/api/tablets/storage-status', async (req, res) => {
  try {
    const tablets = await Tablet.find(
      {},
      'deviceName deviceType metrics.storage metrics.lastCleanup'
    );

    return res.json({
      success: true,
      tablets: tablets.map((tablet) => ({
        deviceName: tablet.deviceName,
        deviceType: tablet.deviceType,
        storageUsed: tablet.metrics?.storage?.used || 'N/A',
        storageTotal: tablet.metrics?.storage?.total || 'N/A',
        lastCleanup: tablet.metrics?.lastCleanup || null,
      })),
    });
  } catch (error) {
    logger.error('Error al obtener estado de almacenamiento:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estado de almacenamiento',
      error: error.message,
    });
  }
});

// Rutas para control de dispositivos WallPanel
app.post('/api/wallpanel/update', async (req, res) => {
  try {
    const { deviceId, androidId, status } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'ID de dispositivo requerido',
      });
    }

    // Buscar tablet por deviceId o androidId
    let tablet = await Tablet.findOne({
      $or: [{ 'wallpanel.deviceId': deviceId }, { 'wallpanel.androidId': androidId }],
    });

    // Si no existe, crearlo con nombre por defecto
    if (!tablet) {
      tablet = new Tablet({
        deviceName: `tablet-${deviceId.substring(0, 8)}`,
        deviceType: 'wallpanel',
        wallpanel: {
          deviceId,
          androidId,
          lastPing: new Date(),
        },
      });
    }

    // Actualizar información de estado
    if (status) {
      tablet.wallpanel = {
        ...tablet.wallpanel,
        ...status,
        lastPing: new Date(),
      };
    }

    tablet.status = 'online';
    tablet.lastSeen = new Date();

    await tablet.save();

    // Notificar a clientes conectados
    io.emit('device:update', { deviceName: tablet.deviceName });

    return res.json({
      success: true,
      message: 'Estado actualizado',
      deviceName: tablet.deviceName,
    });
  } catch (error) {
    logger.error('Error al actualizar estado de WallPanel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno',
      error: error.message,
    });
  }
});

app.post('/api/tablets/:deviceName/command', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const { command, value } = req.body;

    // Validar comandos permitidos
    const allowedCommands = ['reload', 'relaunch', 'brightness', 'wake', 'volume', 'speak', 'url'];
    if (!allowedCommands.includes(command)) {
      return res.status(400).json({
        success: false,
        message: 'Comando no válido',
      });
    }

    // Buscar dispositivo
    const tablet = await Tablet.findOne({ deviceName });

    if (!tablet || !tablet.wallpanel || !tablet.wallpanel.deviceId) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo no encontrado o no es WallPanel',
      });
    }

    // Enviar comando vía MQTT
    const topic = `intercom/${tablet.wallpanel.deviceId}/command/${command}`;
    mqttClient.publish(topic, JSON.stringify({ value }));

    // Registrar comando en historial
    await Tablet.updateOne(
      { deviceName },
      {
        $push: {
          logs: {
            timestamp: new Date(),
            level: 'info',
            message: `Comando enviado: ${command} - ${JSON.stringify(value)}`,
          },
        },
      }
    );

    logger.info(`Comando enviado a ${deviceName}: ${command}`, { value });

    return res.json({
      success: true,
      message: `Comando ${command} enviado a ${deviceName}`,
    });
  } catch (error) {
    logger.error('Error al enviar comando:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar comando',
      error: error.message,
    });
  }
});

app.post('/api/tablets/:deviceName/assign', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const { userName, displayName } = req.body;

    if (!userName) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de usuario requerido',
      });
    }

    // Actualizar tablet con información de usuario
    const result = await Tablet.updateOne(
      { deviceName },
      {
        $set: {
          userName,
          displayName: displayName || `Tablet de ${userName}`,
        },
      }
    );

    if (result.nModified === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tablet no encontrado',
      });
    }

    logger.info(`Tablet ${deviceName} asignado a usuario ${userName}`);

    return res.json({
      success: true,
      message: `Tablet asignado a ${userName}`,
    });
  } catch (error) {
    logger.error('Error al asignar tablet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al asignar tablet',
      error: error.message,
    });
  }
});

// API para notificar actualizaciones a las tablets
app.post('/api/notify-update', async (req, res) => {
  try {
    const { version, force = false } = req.body;

    if (!version) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere versión para la notificación de actualización',
      });
    }

    logger.info(`Notificando actualización versión ${version} a todas las tablets`, { force });

    // Actualizar archivo de versión
    const versionData = {
      version,
      buildDate: new Date().toISOString(),
      forceUpdate: force,
    };

    // Publicar mensaje MQTT para notificar a todas las tablets
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('intercom/update/notification', JSON.stringify(versionData));
      logger.info('Mensaje MQTT de actualización enviado');
    } else {
      logger.warn('Cliente MQTT no conectado, no se pudo enviar notificación');
    }

    // Registrar el evento de actualización
    const tablets = await Tablet.find({});
    for (const tablet of tablets) {
      addLog('system', {
        timestamp: new Date(),
        level: 'info',
        message: `Notificación de actualización enviada: versión ${version}, forzada: ${force}`,
        device: tablet.deviceName,
        component: 'update-manager',
      });
    }

    return res.json({
      success: true,
      message: 'Notificación de actualización enviada',
      notifiedTablets: tablets.length,
      version,
      force,
    });
  } catch (error) {
    logger.error('Error al notificar actualización:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Error al notificar actualización', error: error.message });
  }
});

// Captura de ruta por defecto para la SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO - conexiones y eventos
io.on('connection', (socket) => {
  logger.info('Nueva conexión de cliente', { socketId: socket.id });

  // Enviar estadísticas iniciales
  updateSystemInfo();
  socket.emit('stats-update', stats);

  // Desconexión
  socket.on('disconnect', () => {
    logger.info('Cliente desconectado', { socketId: socket.id });
  });
});

// Monitoreo de logs
setupLogWatchers();

// Programar limpieza de logs antiguos
cron.schedule('0 0 * * *', async () => {
  // A la medianoche
  logger.info('Ejecutando limpieza programada de logs');

  try {
    const result = await cleanupOldLogs();
    logger.info('Limpieza programada de logs completada', result);

    // Actualizar tiempo de próxima limpieza
    updateNextCleanupTime();

    // Notificar a clientes
    io.emit('system-event', {
      type: 'info',
      message: `Limpieza automática de logs completada: ${result.removed} archivos eliminados`,
    });
  } catch (error) {
    logger.error('Error en limpieza programada de logs', { error: error.message });

    // Notificar a clientes
    io.emit('system-event', {
      type: 'error',
      message: `Error en limpieza automática de logs: ${error.message}`,
    });
  }
});

// Programar limpieza de datos en tablets cada noche
cron.schedule('0 2 * * *', async () => {
  // A las 2 AM
  logger.info('Iniciando notificación de limpieza programada para tablets');

  try {
    // Obtener la política de retención actual
    const retentionPolicy = await RetentionPolicy.findOne({ name: 'default' });
    if (!retentionPolicy) {
      throw new Error('No se encontró la política de retención por defecto');
    }

    // Enviar mensaje a todas las tablets conectadas para iniciar limpieza
    io.emit('tablet:clean-data', {
      policy: {
        callHistory: retentionPolicy.callHistory,
        standardLogs: retentionPolicy.standardLogs,
        errorLogs: retentionPolicy.errorLogs,
        detailedMetrics: retentionPolicy.detailedMetrics,
        aggregatedMetrics: retentionPolicy.aggregatedMetrics,
      },
      requestedAt: new Date(),
    });

    logger.info('Notificación de limpieza enviada a todas las tablets');
  } catch (error) {
    logger.error('Error al programar limpieza de tablets', { error: error.message });
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`Servidor de administración iniciado en puerto ${PORT}`);
});

// Actualizar infomación de sistema
function updateSystemInfo() {
  const now = new Date();

  // Actualizar uptime en segundos
  stats.system.uptime = Math.floor((now - stats.startTime) / 1000);

  // Actualizar información de memoria
  stats.system.memory = {
    heapTotal: process.memoryUsage().heapTotal,
    heapUsed: process.memoryUsage().heapUsed,
    rss: process.memoryUsage().rss,
  };
}

// Funciones auxiliares para logs
function addLog(type, message, data = {}) {
  const logEntry = {
    timestamp: new Date(),
    type,
    message,
    data,
    service: 'admin',
  };

  logger.info(message, { type, ...data });

  // Emitir a través de socket.io si está disponible
  if (io) {
    io.emit('log', logEntry);
  }

  return logEntry;
}

// Obtener estado de servicios
async function getServicesStatus() {
  try {
    const containers = await docker.listContainers({
      all: true,
    });

    // Nombres de servicios que nos interesan
    const serviceNames = ['pwa', 'signaling', 'mirotalksfu'];

    // Filtrar y formatear información
    const services = containers
      .filter((container) => {
        const name = container.Names[0].replace('/', '');
        return serviceNames.some((service) => name.includes(service));
      })
      .map((container) => {
        const fullName = container.Names[0].replace('/', '');

        // Extraer el nombre del servicio
        let serviceName = 'unknown';
        for (const name of serviceNames) {
          if (fullName.includes(name)) {
            serviceName = name;
            break;
          }
        }

        // Calcular tiempo activo
        const uptimeSeconds = container.Status.includes('Up')
          ? parseDurationToSeconds(container.Status)
          : 0;

        return {
          id: container.Id,
          name: serviceName,
          running: container.State === 'running',
          status: container.Status,
          uptime: formatUptime(uptimeSeconds),
        };
      });

    return services;
  } catch (error) {
    logger.error('Error al obtener estado de contenedores', { error: error.message });
    throw new Error('Error al obtener estado de servicios: ' + error.message);
  }
}

// Reiniciar un servicio
async function restartService(serviceName) {
  try {
    const containers = await docker.listContainers();

    const targetContainer = containers.find((container) => {
      const name = container.Names[0].replace('/', '');
      return name.includes(serviceName);
    });

    if (!targetContainer) {
      throw new Error(`Servicio ${serviceName} no encontrado`);
    }

    const container = docker.getContainer(targetContainer.Id);
    await container.restart();

    return { success: true };
  } catch (error) {
    logger.error(`Error al reiniciar servicio ${serviceName}`, { error: error.message });
    throw new Error(`Error al reiniciar ${serviceName}: ${error.message}`);
  }
}

// Configurar observadores de logs
function setupLogWatchers() {
  // Definir archivos de log a monitorear
  const logFiles = [
    { service: 'pwa', path: '/logs/pwa.log' },
    { service: 'signaling', path: '/logs/signaling.log' },
    { service: 'mirotalksfu', path: '/logs/mirotalksfu.log' },
  ];

  logFiles.forEach((logFile) => {
    // Comprobar si el archivo existe, o crearlo
    const fullPath = path.join(__dirname, logFile.path);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '');
    }

    // Observar cambios en el archivo
    const watcher = fs.watch(fullPath, (eventType) => {
      if (eventType === 'change') {
        // Leer las nuevas líneas
        const fileSize = fs.statSync(fullPath).size;
        const stream = fs.createReadStream(fullPath, {
          start: Math.max(0, fileSize - 4096), // Leer últimos 4KB
          end: fileSize,
        });

        let buffer = '';

        stream.on('data', (chunk) => {
          buffer += chunk.toString();

          // Procesar líneas completas
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Guardar la última línea incompleta

          lines.forEach((line) => {
            if (line.trim()) {
              processLogLine(logFile.service, line);
            }
          });
        });
      }
    });

    // Registrar el observador para limpieza si el servidor se cierra
    process.on('exit', () => {
      watcher.close();
    });
  });
}

// Procesar línea de log
function processLogLine(service, line) {
  // Crear objeto de log
  const logObj = {
    timestamp: new Date(),
    service,
    message: line,
  };

  // Emitir a través de socket.io si está disponible
  if (io) {
    io.emit('log', logObj);
  }

  // Actualizar estadísticas
  updateStats(service, line);
}

// Actualizar estadísticas basadas en logs
function updateStats(service, line) {
  // Detectar llamada
  if (line.includes('call initiated') || line.includes('callRequest')) {
    stats.eventStats.calls.total++;

    // Notificar a clientes
    io.emit('stats-update', stats);
  }

  // Detectar llamada exitosa
  if (line.includes('call connected') || line.includes('callAccepted')) {
    stats.eventStats.calls.success++;

    // Notificar a clientes
    io.emit('stats-update', stats);
  }

  // Detectar llamada fallida
  if (line.includes('call failed') || line.includes('callRejected')) {
    stats.eventStats.calls.failed++;

    // Notificar a clientes
    io.emit('stats-update', stats);
  }

  // Detectar error
  if (line.toLowerCase().includes('error')) {
    stats.eventStats.errors.total++;

    // Clasificar el tipo de error
    let errorType = 'general';

    if (line.includes('connection error') || line.includes('network')) {
      errorType = 'network';
    } else if (line.includes('timeout')) {
      errorType = 'timeout';
    } else if (line.includes('auth') || line.includes('permission')) {
      errorType = 'authorization';
    } else if (line.includes('database') || line.includes('db')) {
      errorType = 'database';
    }

    // Incrementar contador de este tipo de error
    stats.eventStats.errors.byType[errorType] =
      (stats.eventStats.errors.byType[errorType] || 0) + 1;

    // Notificar a clientes
    io.emit('stats-update', stats);

    // Enviar evento de sistema para errores críticos
    if (errorType === 'network' || errorType === 'database' || line.includes('critical')) {
      io.emit('system-event', {
        type: 'error',
        message: `Error en ${service}: ${line}`,
      });
    }
  }
}

// Limpiar logs antiguos
async function cleanupOldLogs() {
  try {
    logger.info('Iniciando limpieza de logs antiguos');

    const now = new Date();
    const cutoffDate = new Date(now.setDate(now.getDate() - LOG_RETENTION_DAYS));

    let removedCount = 0;

    // Buscar archivos de log recursivamente
    const logFiles = findLogFiles(LOG_DIR);

    // Filtrar y eliminar archivos antiguos
    for (const file of logFiles) {
      const stats = fs.statSync(file);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(file);
        removedCount++;
        logger.info(`Eliminado log antiguo: ${file}`);
      }
    }

    // Actualizar tiempo de próxima limpieza
    updateNextCleanupTime();

    return {
      success: true,
      removed: removedCount,
      nextCleanup: stats.system.logRotation.nextCleanup,
    };
  } catch (error) {
    logger.error('Error al limpiar logs antiguos', { error: error.message });
    throw new Error(`Error al limpiar logs: ${error.message}`);
  }
}

// Buscar archivos de log recursivamente
function findLogFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursión para directorios
      results = results.concat(findLogFiles(filePath));
    } else if (file.endsWith('.log')) {
      results.push(filePath);
    }
  });

  return results;
}

// Actualizar timestamp de próxima limpieza
function updateNextCleanupTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  stats.system.logRotation.nextCleanup = tomorrow;
}

// Analizar duración desde texto de Docker
function parseDurationToSeconds(durationText) {
  if (!durationText || !durationText.includes('Up ')) {
    return 0;
  }

  let totalSeconds = 0;
  const durationPart = durationText.split('Up ')[1].split(' (')[0];

  // Patrones para diferentes unidades de tiempo
  const days = durationPart.match(/(\d+)\s+days?/);
  const hours = durationPart.match(/(\d+)\s+hours?/);
  const minutes = durationPart.match(/(\d+)\s+minutes?/);
  const seconds = durationPart.match(/(\d+)\s+seconds?/);

  if (days) totalSeconds += parseInt(days[1]) * 86400;
  if (hours) totalSeconds += parseInt(hours[1]) * 3600;
  if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
  if (seconds) totalSeconds += parseInt(seconds[1]);

  return totalSeconds;
}

// Formatear tiempo de actividad
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push('menos de 1m');

  return parts.join(' ');
}
