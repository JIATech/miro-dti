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

// Configuración
const PORT = process.env.ADMIN_PORT || 8090;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_RETENTION_DAYS = 7; // Días que se mantienen los logs
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/intercom';

// Asegurar que existe el directorio de logs
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Configuración del logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'admin' },
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: path.join(LOG_DIR, 'admin.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Cliente Docker para interactuar con contenedores
const docker = new Docker();

// Conexión a MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    logger.info('Conexión a MongoDB establecida');
}).catch(err => {
    logger.error('Error al conectar a MongoDB:', err);
});

// Esquema para almacenar datos de tablets
const tabletSchema = new mongoose.Schema({
    deviceName: { type: String, required: true, unique: true },
    deviceType: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    totalCalls: { type: Number, default: 0 },
    callDuration: { type: Number, default: 0 }, // En segundos
    callsSuccess: { type: Number, default: 0 },
    callsFailed: { type: Number, default: 0 },
    batteryLevel: { type: Number },
    networkType: { type: String },
    networkStrength: { type: Number },
    diskSpace: { type: Object },
    memoryUsage: { type: Object },
    audioSettings: { type: Object },
    videoSettings: { type: Object },
    errors: [{ 
        timestamp: Date,
        errorType: String,
        message: String,
        details: Object
    }],
    logs: [{ 
        timestamp: Date,
        level: String, 
        message: String,
        details: Object
    }]
});

// Limitar la cantidad de logs almacenados
tabletSchema.pre('save', function(next) {
    // Mantener solo los últimos 100 logs
    if (this.logs && this.logs.length > 100) {
        this.logs = this.logs.slice(-100);
    }
    
    // Mantener solo los últimos 50 errores
    if (this.errors && this.errors.length > 50) {
        this.errors = this.errors.slice(-50);
    }
    
    next();
});

const Tablet = mongoose.model('Tablet', tabletSchema);

// Inicialización de servidor Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de seguridad
app.use(basicAuth({
    users: { [ADMIN_USER]: ADMIN_PASSWORD },
    challenge: true,
    realm: 'Sistema Intercom - Panel de Administración'
}));

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
            failed: 0
        },
        errors: {
            total: 0,
            byType: {}
        }
    },
    system: {
        uptime: 0,
        memory: {},
        logRotation: {
            maxDays: LOG_RETENTION_DAYS,
            nextCleanup: null
        }
    }
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
            message: `Servicio ${service} reiniciado correctamente`
        });
        
        res.json({ success: true, message: `Servicio ${service} reiniciado correctamente` });
    } catch (error) {
        logger.error(`Error al reiniciar servicio ${service}`, { error: error.message });
        
        // Notificar a clientes
        io.emit('system-event', {
            type: 'error',
            message: `Error al reiniciar ${service}: ${error.message}`
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
            message: `Limpieza manual de logs completada: ${result.removed} archivos eliminados`
        });
        
        res.json({ success: true, message: `Limpieza de logs completada: ${result.removed} archivos eliminados` });
    } catch (error) {
        logger.error('Error en limpieza manual de logs', { error: error.message });
        
        // Notificar a clientes
        io.emit('system-event', {
            type: 'error',
            message: `Error en limpieza de logs: ${error.message}`
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
                message: 'Faltan datos requeridos (deviceName, deviceType)'
            });
        }
        
        // Buscar tablet existente o crear uno nuevo
        let tablet = await Tablet.findOne({ deviceName });
        
        if (!tablet) {
            tablet = new Tablet({
                deviceName,
                deviceType
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
                if (data.device.networkStrength !== undefined) tablet.networkStrength = data.device.networkStrength;
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
                tablet.logs.push(...data.logs.map(log => ({
                    timestamp: log.timestamp || new Date(),
                    level: log.level || 'info',
                    message: log.message,
                    details: log.details || {}
                })));
            }
            
            // Añadir nuevos errores si existen
            if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                tablet.errors.push(...data.errors.map(error => ({
                    timestamp: error.timestamp || new Date(),
                    errorType: error.errorType || 'unknown',
                    message: error.message,
                    details: error.details || {}
                })));
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
            networkType: tablet.networkType
        });
        
        return res.json({
            success: true,
            message: 'Datos sincronizados correctamente'
        });
    } catch (error) {
        logger.error('Error en sincronización de tablet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar datos',
            error: error.message
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
            tablets
        });
    } catch (error) {
        logger.error('Error al obtener tablets:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener datos',
            error: error.message
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
                message: 'Tablet no encontrado'
            });
        }
        
        return res.json({
            success: true,
            tablet
        });
    } catch (error) {
        logger.error('Error al obtener detalles de tablet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener datos',
            error: error.message
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
                message: 'Tablet no encontrado'
            });
        }
        
        let logs = tablet.logs;
        
        // Filtrar por nivel si se especifica
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        // Limitar cantidad de logs
        logs = logs.slice(-Math.min(parseInt(limit), 100));
        
        return res.json({
            success: true,
            deviceName,
            count: logs.length,
            logs
        });
    } catch (error) {
        logger.error('Error al obtener logs de tablet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener datos',
            error: error.message
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
                message: 'Tablet no encontrado'
            });
        }
        
        let errors = tablet.errors;
        
        // Filtrar por tipo si se especifica
        if (type) {
            errors = errors.filter(error => error.errorType === type);
        }
        
        // Limitar cantidad de errores
        errors = errors.slice(-Math.min(parseInt(limit), 100));
        
        return res.json({
            success: true,
            deviceName,
            count: errors.length,
            errors
        });
    } catch (error) {
        logger.error('Error al obtener errores de tablet:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener datos',
            error: error.message
        });
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
cron.schedule('0 0 * * *', async () => {  // A la medianoche
    logger.info('Ejecutando limpieza programada de logs');
    
    try {
        const result = await cleanupOldLogs();
        logger.info('Limpieza programada de logs completada', result);
        
        // Actualizar tiempo de próxima limpieza
        updateNextCleanupTime();
        
        // Notificar a clientes
        io.emit('system-event', {
            type: 'info',
            message: `Limpieza automática de logs completada: ${result.removed} archivos eliminados`
        });
    } catch (error) {
        logger.error('Error en limpieza programada de logs', { error: error.message });
        
        // Notificar a clientes
        io.emit('system-event', {
            type: 'error',
            message: `Error en limpieza automática de logs: ${error.message}`
        });
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
        rss: process.memoryUsage().rss
    };
}

// ======== FUNCIONES AUXILIARES ========

// Obtener estado de servicios
async function getServicesStatus() {
    try {
        const containers = await docker.listContainers({
            all: true
        });
        
        // Nombres de servicios que nos interesan
        const serviceNames = ['pwa', 'signaling', 'mirotalksfu'];
        
        // Filtrar y formatear información
        const services = containers
            .filter(container => {
                const name = container.Names[0].replace('/', '');
                return serviceNames.some(service => name.includes(service));
            })
            .map(container => {
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
                    uptime: formatUptime(uptimeSeconds)
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
        
        const targetContainer = containers.find(container => {
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
        logger.error(`Error al reiniciar ${serviceName}`, { error: error.message });
        throw new Error(`Error al reiniciar ${serviceName}: ${error.message}`);
    }
}

// Configurar observadores de logs
function setupLogWatchers() {
    // Definir archivos de log a monitorear
    const logFiles = [
        { service: 'pwa', path: '/logs/pwa.log' },
        { service: 'signaling', path: '/logs/signaling.log' },
        { service: 'mirotalksfu', path: '/logs/mirotalksfu.log' }
    ];
    
    logFiles.forEach(logFile => {
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
                    end: fileSize
                });
                
                let buffer = '';
                
                stream.on('data', (chunk) => {
                    buffer += chunk.toString();
                    
                    // Procesar líneas completas
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Guardar la última línea incompleta
                    
                    lines.forEach(line => {
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
        message: line
    };
    
    // Emitir a clientes conectados
    io.emit('log', logObj);
    
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
        stats.eventStats.errors.byType[errorType] = (stats.eventStats.errors.byType[errorType] || 0) + 1;
        
        // Notificar a clientes
        io.emit('stats-update', stats);
        
        // Enviar evento de sistema para errores críticos
        if (errorType === 'network' || errorType === 'database' || line.includes('critical')) {
            io.emit('system-event', {
                type: 'error',
                message: `Error en ${service}: ${line}`
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
            nextCleanup: stats.system.logRotation.nextCleanup
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
    
    list.forEach(file => {
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
