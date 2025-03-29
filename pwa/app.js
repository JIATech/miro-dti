/**
 * Intercom PWA - App Logic
 * 
 * This file contains the client-side logic for the intercom system
 * using MiroTalkSFU for WebRTC communication
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const roleSelector = document.getElementById('role');
    const porteroInterface = document.getElementById('portero-interface');
    const administracionInterface = document.getElementById('administracion-interface');
    const callInterface = document.getElementById('call-interface');
    const callButtons = document.querySelectorAll('.call-button');
    const callTargetEl = document.getElementById('call-target');
    const hangupBtn = document.getElementById('hangup-btn');
    const muteBtn = document.getElementById('mute-btn');
    const callLogContainer = document.getElementById('call-log');
    
    // Socket.IO para comunicación con el servidor de señalización
    let socket;
    
    // Configuración del sistema
    const config = {
        signalingServer: 'http://localhost:3000',
        adminServer: 'http://localhost:8090',
        pwaServer: 'http://localhost:8000', // Servidor para la PWA que maneja API para admin
        mirotalksfu: {
            local: {
                enabled: true,
                url: 'http://localhost:8080',
                timeout: 5000,
                retries: 3
            },
            fallback: {
                enabled: true,
                url: 'https://fallback-server.example.com:8080', // Cambiar en producción
                timeout: 5000
            },
            currentServer: 'local', // 'local' o 'fallback'
            params: {
                audio: true,
                video: true,
                screen: false,
                notify: true
            }
        }
    };
    
    // Sonidos del sistema
    const sounds = {
        ringtone: null, // new Audio('sounds/ringtone.mp3'), // Pendiente: añadir sonidos
        callEnd: null, // new Audio('sounds/end.mp3'),
    };
    
    // App State
    const appState = {
        currentRole: 'portero',
        inCall: false,
        callTarget: null,
        callStartTime: null,
        timerInterval: null,
        muted: false,
        currentRoom: null,
        isRegistered: false,
        incomingCall: null,
        deviceId: generateDeviceId()
    };

    // Initialize app
    async function init() {
        // Inicializar almacenamiento local
        await IntercomDB.initDB();
        console.log('Base de datos local inicializada');
        
        // Inicializar sincronización con panel de administración
        const syncConfig = await IntercomSync.init();
        console.log('Sistema de sincronización inicializado', syncConfig);
        
        // Añadir entrada de log para el inicio de la aplicación
        await IntercomDB.addLogEntry('info', 'Aplicación iniciada', {
            timestamp: new Date(),
            deviceInfo: navigator.userAgent
        });
        
        // Cargar configuración desde localStorage o valores predeterminados
        await loadConfig();
        
        // Inicializar Socket.IO
        initSocketConnection();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check if we're in a frame, for kiosk mode detection
        checkKioskMode();
        
        // Load saved role if exists
        await loadSavedRole();
        
        // Cargar historial de llamadas
        await loadCallHistory();
        
        // Registrar esta tablet con el servidor PWA para admin
        registerWithAdminServer();
        
        // Iniciar el envío periódico de métricas al servidor
        startMetricsCollection();
    }

    // Cargar configuración desde localStorage y DB
    async function loadConfig() {
        // Intentar cargar la configuración guardada de localStorage
        const savedConfig = localStorage.getItem('intercom-config');
        
        if (savedConfig) {
            try {
                const parsedConfig = JSON.parse(savedConfig);
                // Actualizar solo las propiedades permitidas
                if (parsedConfig.mirotalksfu) {
                    // Merge config manteniendo valores predeterminados para propiedades faltantes
                    if (parsedConfig.mirotalksfu.local) {
                        config.mirotalksfu.local = {
                            ...config.mirotalksfu.local,
                            ...parsedConfig.mirotalksfu.local
                        };
                    }
                    if (parsedConfig.mirotalksfu.fallback) {
                        config.mirotalksfu.fallback = {
                            ...config.mirotalksfu.fallback,
                            ...parsedConfig.mirotalksfu.fallback
                        };
                    }
                    
                    // Mantener el servidor actual (si es válido)
                    if (parsedConfig.mirotalksfu.currentServer === 'local' || 
                        parsedConfig.mirotalksfu.currentServer === 'fallback') {
                        config.mirotalksfu.currentServer = parsedConfig.mirotalksfu.currentServer;
                    }
                }
                
                if (parsedConfig.signalingServer) {
                    config.signalingServer = parsedConfig.signalingServer;
                }
                
                if (parsedConfig.adminServer) {
                    config.adminServer = parsedConfig.adminServer;
                    // Actualizar también en el módulo de sincronización
                    await IntercomSync.setAdminServer(parsedConfig.adminServer);
                }
                
                if (parsedConfig.pwaServer) {
                    config.pwaServer = parsedConfig.pwaServer;
                }
                
                console.log('Configuración cargada desde localStorage');
            } catch (error) {
                console.error('Error al cargar configuración:', error);
                await IntercomDB.addErrorEntry('config', 'Error al cargar configuración', { error: error.message });
                saveConfig(); // Guardar configuración predeterminada
            }
        } else {
            // Si no hay configuración guardada, guardar la predeterminada
            saveConfig();
            console.log('Configuración predeterminada guardada en localStorage');
        }
        
        // Cargar configuraciones de audio/video desde IndexedDB
        try {
            const audioSettings = await IntercomDB.getSetting('audio');
            if (audioSettings) {
                config.mirotalksfu.params.audio = audioSettings;
            }
            
            const videoSettings = await IntercomDB.getSetting('video');
            if (videoSettings) {
                config.mirotalksfu.params.video = videoSettings;
            }
        } catch (error) {
            console.error('Error al cargar configuraciones de audio/video:', error);
        }
    }
    
    // Guardar configuración en localStorage
    function saveConfig() {
        try {
            localStorage.setItem('intercom-config', JSON.stringify(config));
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            IntercomDB.addErrorEntry('config', 'Error al guardar configuración', { error: error.message });
        }
    }

    /**
     * INTEGRACIÓN CON PANEL DE ADMINISTRACIÓN
     * Las siguientes funciones permiten que la tablet sea monitorizada
     * desde el panel de administración separado.
     */
    
    // Generar ID único para este dispositivo
    function generateDeviceId() {
        // Verificar si ya existe un ID guardado
        const savedId = localStorage.getItem('intercom-device-id');
        if (savedId) return savedId;
        
        // Generar un nuevo ID basado en timestamp y aleatorio
        const newId = `tablet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('intercom-device-id', newId);
        return newId;
    }
    
    // Registrar este dispositivo con el servidor PWA para admin
    async function registerWithAdminServer() {
        try {
            const deviceInfo = await collectDeviceInfo();
            
            const response = await fetch(`${config.pwaServer}/api/tablet/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: appState.deviceId,
                    deviceName: appState.currentRole,
                    deviceType: appState.currentRole === 'portero' ? 'portero' : 'departamento',
                    role: appState.currentRole,
                    ip: deviceInfo.ip || 'unknown',
                    version: deviceInfo.appVersion || '1.0.0'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error al registrar dispositivo: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Dispositivo registrado con el servidor de administración:', result);
            
            return true;
        } catch (error) {
            console.error('Error al registrar con servidor admin:', error);
            IntercomDB.addErrorEntry('admin', 'Error al registrar con servidor admin', { error: error.message });
            return false;
        }
    }
    
    // Iniciar recolección periódica de métricas para enviar al servidor
    function startMetricsCollection() {
        // Enviar métricas iniciales
        sendMetricsToAdminServer();
        
        // Configurar envío periódico cada minuto
        setInterval(() => {
            sendMetricsToAdminServer();
        }, 60000); // 1 minuto
    }
    
    // Enviar métricas actualizadas al servidor
    async function sendMetricsToAdminServer() {
        try {
            // Recopilar información del dispositivo
            const deviceInfo = await collectDeviceInfo();
            
            // Obtener estadísticas de llamadas
            const callStats = await IntercomDB.getCallStats();
            
            // Enviar datos al servidor
            const response = await fetch(`${config.pwaServer}/api/tablet/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: appState.deviceId,
                    metrics: {
                        role: appState.currentRole,
                        battery: deviceInfo.battery?.level || 0,
                        version: deviceInfo.appVersion || '1.0.0',
                        performance: {
                            memory: deviceInfo.memory || {},
                            cpu: deviceInfo.cpu || 0,
                            network: deviceInfo.connection?.type || 'unknown',
                            battery: deviceInfo.battery?.level || 0,
                            charging: deviceInfo.battery?.charging || false
                        },
                        hardware: {
                            model: deviceInfo.model || 'unknown',
                            osVersion: deviceInfo.osVersion || 'unknown',
                            screenWidth: window.screen.width,
                            screenHeight: window.screen.height,
                            storage: deviceInfo.storage || {}
                        },
                        stats: {
                            callCount: callStats.total || 0,
                            errorCount: 0, // Obtener desde los registros de errores
                            connectedTime: Math.floor((Date.now() - performance.timing.navigationStart) / 1000),
                            lastCall: callStats.lastCall || null
                        }
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error al actualizar métricas: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Métricas enviadas al servidor admin:', result);
            
            return true;
        } catch (error) {
            console.error('Error al enviar métricas al servidor admin:', error);
            IntercomDB.addErrorEntry('admin', 'Error al enviar métricas', { error: error.message });
            return false;
        }
    }
    
    // Recopilar información sobre el dispositivo actual
    async function collectDeviceInfo() {
        const info = {
            appVersion: '1.0.0', // Versión de la aplicación
            osVersion: 'Unknown',
            model: 'Unknown',
            ip: 'Unknown',
            connection: null,
            memory: null,
            storage: null,
            battery: null,
            cpu: 0
        };
        
        try {
            // Información de conexión
            if (navigator.connection) {
                info.connection = {
                    type: navigator.connection.effectiveType || 'unknown',
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt
                };
            }
            
            // Información del sistema operativo y dispositivo
            const userAgent = navigator.userAgent;
            if (/android/i.test(userAgent)) {
                info.osVersion = 'Android';
                const match = userAgent.match(/Android\s([0-9.]+)/);
                if (match) info.osVersion = `Android ${match[1]}`;
            } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                info.osVersion = 'iOS';
                const match = userAgent.match(/OS\s([0-9_]+)/);
                if (match) info.osVersion = `iOS ${match[1].replace('_', '.')}`;
            } else if (/Windows/.test(userAgent)) {
                info.osVersion = 'Windows';
            } else if (/Mac/.test(userAgent)) {
                info.osVersion = 'MacOS';
            } else if (/Linux/.test(userAgent)) {
                info.osVersion = 'Linux';
            }
            
            // Modelo del dispositivo (limitado)
            if (/Mobile/.test(userAgent)) {
                info.model = 'Mobile Device';
            } else if (/Tablet/.test(userAgent)) {
                info.model = 'Tablet Device';
            } else {
                info.model = 'Desktop Device';
            }
            
            // Memoria
            if (navigator.deviceMemory) {
                info.memory = {
                    total: navigator.deviceMemory * 1024, // Convertir a MB
                    used: 0 // No disponible en navegador
                };
            }
            
            // Almacenamiento
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                info.storage = {
                    total: estimate.quota,
                    used: estimate.usage
                };
            }
            
            // Batería
            if (navigator.getBattery) {
                const battery = await navigator.getBattery();
                info.battery = {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging
                };
            }
            
            // IP (se obtendrá en el servidor)
            
            return info;
        } catch (error) {
            console.error('Error al recopilar información del dispositivo:', error);
            return info;
        }
    }

    // Initialize the app
    init();
    
    // Iniciar verificación de servidores
    startServerCheck();
    
    // Programar sincronización completa con servidor admin cada hora
    setInterval(() => {
        IntercomSync.syncData();
    }, 3600000); // 1 hora
});
