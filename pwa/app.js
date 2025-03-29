/**
 * Intercom PWA - App Logic
 * 
 * This file contains the client-side logic for the intercom system
 * using MiroTalkSFU for WebRTC communication
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const roleSelector = document.getElementById('role');
    const loginBtn = document.getElementById('login-btn');
    const loginForm = document.getElementById('login-form');
    const mainInterface = document.getElementById('main-interface');
    const buttonsContainer = document.querySelector('.buttons-container');
    const callInterface = document.getElementById('call-interface');
    const callTargetEl = document.getElementById('call-target');
    const hangupBtn = document.getElementById('hangup-btn');
    const muteBtn = document.getElementById('mute-btn');
    
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
                notify: true,
                // Parámetros avanzados de audio
                audioConfig: {
                    autoGainControl: true,        // Control automático de ganancia (evita audio demasiado bajo/alto)
                    echoCancellation: true,       // Cancelación de eco (evita feedback)
                    noiseSuppression: true,       // Supresión de ruido de fondo
                    sampleRate: 48000,            // Tasa de muestreo de alta calidad
                    channelCount: 1,              // Mono es suficiente y ahorra ancho de banda
                    volume: 1.0                   // Nivel de volumen inicial (0.0 - 1.0)
                },
                // Parámetros avanzados de video
                videoConfig: {
                    autoAdjustQuality: true,      // Ajuste automático de calidad según conexión
                    frameRate: { ideal: 24, max: 30 }, // Framerate balanceado (suficiente para video comunicación)
                    aspectRatio: 1.777778,        // Relación de aspecto 16:9
                    width: { ideal: 640, max: 1280 }, // Resolución inicial
                    height: { ideal: 360, max: 720 },
                    preferredCodec: 'VP9'         // Codec con mejor compresión
                },
                // Parámetros de red
                networkConfig: {
                    adaptiveStreaming: true,     // Ajusta bitrate según condiciones de red
                    simulcast: true,             // Permite múltiples calidades para adaptarse a las condiciones
                    bandwidth: {
                        audio: 32,               // kbps para audio
                        video: 512,              // kbps inicial para video (se ajustará según conexión)
                        screen: 1024             // kbps para compartir pantalla (no usado en este caso)
                    }
                }
            }
        }
    };
    
    // Sonidos del sistema
    const sounds = {
        ringtone: new Audio('sounds/ringtone.mp3'),
        callEnd: new Audio('sounds/end.mp3'),
        dialing: new Audio('sounds/dialing.mp3')
    };
    
    // Configurar bucles para los sonidos que lo requieren
    sounds.ringtone.loop = true;
    sounds.dialing.loop = true;
    
    // Función para detener todos los sonidos
    function stopAllSounds() {
        Object.values(sounds).forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }
    
    // Mapping de roles y departamentos
    const departmentConfig = {
        portero: {
            title: 'Portero DTI',
            targets: [
                { id: 'administracion', label: 'Administración', icon: '👥' },
                { id: 'sistemas', label: 'Sistemas', icon: '💻' },
                { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' },
                { id: 'soporte', label: 'Soporte', icon: '🛠️' }
            ]
        },
        administracion: {
            title: 'Administración DTI',
            targets: [
                { id: 'portero', label: 'Portero', icon: '🚪' },
                { id: 'sistemas', label: 'Sistemas', icon: '💻' },
                { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' },
                { id: 'soporte', label: 'Soporte', icon: '🛠️' }
            ]
        },
        sistemas: {
            title: 'Sistemas DTI',
            targets: [
                { id: 'portero', label: 'Portero', icon: '🚪' },
                { id: 'administracion', label: 'Administración', icon: '👥' },
                { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' },
                { id: 'soporte', label: 'Soporte', icon: '🛠️' }
            ]
        },
        infraestructura: {
            title: 'Infraestructura DTI',
            targets: [
                { id: 'portero', label: 'Portero', icon: '🚪' },
                { id: 'administracion', label: 'Administración', icon: '👥' },
                { id: 'sistemas', label: 'Sistemas', icon: '💻' },
                { id: 'soporte', label: 'Soporte', icon: '🛠️' }
            ]
        },
        soporte: {
            title: 'Soporte DTI',
            targets: [
                { id: 'portero', label: 'Portero', icon: '🚪' },
                { id: 'administracion', label: 'Administración', icon: '👥' },
                { id: 'sistemas', label: 'Sistemas', icon: '💻' },
                { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' }
            ]
        }
    };
    
    // App State
    const appState = {
        currentRole: '',
        inCall: false,
        callTarget: null,
        callStartTime: null,
        timerInterval: null,
        muted: false,
        currentRoom: null,
        isRegistered: false,
        incomingCall: null,
        deviceId: generateDeviceId(),
        connectionQuality: null
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
    
    // Inicializar conexión de Socket.IO con el servidor de señalización
    function initSocketConnection() {
        try {
            socket = io(config.signalingServer);
            
            // Eventos de Socket.IO
            socket.on('connect', () => {
                console.log('Conectado al servidor de señalización');
                appState.isRegistered = true;
                
                // Registrar este cliente con el servidor
                if (appState.currentRole) {
                    socket.emit('register', {
                        role: appState.currentRole,
                        deviceId: appState.deviceId
                    });
                }
            });
            
            socket.on('disconnect', () => {
                console.log('Desconectado del servidor de señalización');
                appState.isRegistered = false;
            });
            
            socket.on('call', async (data) => {
                console.log('Llamada entrante de:', data.from);
                showIncomingCall(data.from);
            });
            
            socket.on('hangup', () => {
                console.log('La otra parte colgó la llamada');
                endCall();
            });
            
            socket.on('error', (error) => {
                console.error('Error de Socket.IO:', error);
                IntercomDB.addErrorEntry('socket', 'Error en Socket.IO', { error });
            });
        } catch (error) {
            console.error('Error al conectar con el servidor de señalización:', error);
            IntercomDB.addErrorEntry('socket', 'Error al conectar con el servidor de señalización', { error: error.message });
        }
    }
    
    // Setup de event listeners para la interfaz
    function setupEventListeners() {
        // Event listener para el botón de login
        loginBtn.addEventListener('click', handleLogin);
        
        // Event listener para tecla Enter en el selector de rol
        roleSelector.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
        
        // Event listeners para botones de llamada (se añadirán dinámicamente)
        
        // Event listener para colgar llamada
        hangupBtn.addEventListener('click', () => {
            endCall();
        });
        
        // Event listener para silenciar/activar micrófono
        muteBtn.addEventListener('click', toggleMute);
        
        // Event listener para el control de volumen del micrófono
        const micVolumeSlider = document.getElementById('mic-volume');
        if (micVolumeSlider) {
            micVolumeSlider.addEventListener('input', (e) => {
                // Convertir valor de 0-100 a 0-1
                const volume = e.target.value / 100;
                adjustMicVolume(volume);
            });
        }
        
        // Event listeners para entrada y salida del modo de pantalla completa
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Prevenir que el usuario pueda hacer zoom en la aplicación
        document.addEventListener('wheel', preventZoom, { passive: false });
        document.addEventListener('touchmove', preventZoom, { passive: false });
    }
    
    // Manejar login con el rol seleccionado
    function handleLogin() {
        const selectedRole = roleSelector.value;
        
        if (!selectedRole) {
            alert('Por favor, selecciona un rol para continuar');
            return;
        }
        
        // Guardar el rol seleccionado
        appState.currentRole = selectedRole;
        localStorage.setItem('intercom-role', selectedRole);
        
        // Registrar con el servidor de señalización
        if (socket && socket.connected) {
            socket.emit('register', {
                role: selectedRole,
                deviceId: appState.deviceId
            });
        }
        
        // Configurar la interfaz según el rol
        setupRoleInterface(selectedRole);
        
        // Ocultar login, mostrar interfaz principal
        loginForm.parentElement.classList.add('hidden');
        mainInterface.classList.remove('hidden');
        
        // Registrar con el servidor de admin con el nuevo rol
        registerWithAdminServer();
        
        // Intentar entrar en modo pantalla completa para modo kiosco
        requestFullscreen();
    }
    
    // Cargar rol guardado, si existe
    async function loadSavedRole() {
        try {
            const savedRole = localStorage.getItem('intercom-role');
            
            if (savedRole && departmentConfig[savedRole]) {
                // Autoseleccionar el rol guardado
                roleSelector.value = savedRole;
                
                // Autologin si hay un rol guardado
                handleLogin();
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error al cargar rol guardado:', error);
            return false;
        }
    }
    
    // Configurar la interfaz según el rol seleccionado
    function setupRoleInterface(role) {
        appState.currentRole = role;
        const roleConfig = departmentConfig[role] || { targets: [] };
        
        // Actualizar localStorage con el rol seleccionado
        localStorage.setItem('selectedRole', role);
        
        // Actualizar título del departamento
        const departmentTitle = document.getElementById('department-title');
        if (departmentTitle) {
            departmentTitle.textContent = roleConfig.title || `${role.charAt(0).toUpperCase() + role.slice(1)} DTI`;
        }
        
        // Ocultar la pantalla de selección de rol
        document.getElementById('role-selector').classList.add('hidden');
        
        // Mostrar la interfaz principal
        document.getElementById('main-interface').classList.remove('hidden');
        
        const buttonsContainer = document.querySelector('.buttons-container');
        buttonsContainer.innerHTML = '';
        
        // Crear botones dinámicamente para cada objetivo
        roleConfig.targets.forEach(target => {
            const button = document.createElement('button');
            button.classList.add('role-button', 'call-button');
            button.dataset.target = target.id;
            
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('button-icon');
            iconSpan.textContent = target.icon || '📞';
            
            const labelSpan = document.createElement('span');
            labelSpan.classList.add('button-label');
            labelSpan.textContent = target.label;
            
            button.appendChild(iconSpan);
            button.appendChild(labelSpan);
            
            // Añadir el evento de clic para iniciar la llamada
            button.addEventListener('click', () => {
                initiateCall(target.id);
            });
            
            buttonsContainer.appendChild(button);
        });
        
        // Registrar con el servidor para recibir llamadas
        socket.emit('register', { role, deviceId: appState.deviceId });
        
        console.log(`Interfaz configurada para rol: ${role}`);
    }
    
    // Iniciar una llamada a otro departamento
    async function initiateCall(targetRole) {
        if (appState.inCall) {
            alert('Ya estás en una llamada. Finaliza la llamada actual antes de iniciar una nueva.');
            return;
        }
        
        try {
            // Comprobar si el destino está disponible
            if (!socket || !socket.connected) {
                alert('No hay conexión con el servidor. Intenta de nuevo más tarde.');
                return;
            }
            
            // Iniciar UI de llamada
            appState.callTarget = targetRole;
            callTargetEl.textContent = departmentConfig[targetRole]?.targets.find(t => t.id === targetRole)?.label || targetRole;
            
            // Mostrar interfaz de llamada
            mainInterface.classList.add('hidden');
            callInterface.classList.remove('hidden');
            
            // Iniciar temporizador
            startCallTimer();
            
            // Emitir evento de llamada al servidor de señalización
            socket.emit('call', {
                from: appState.currentRole,
                to: targetRole,
                deviceId: appState.deviceId
            });
            
            // Registrar inicio de llamada en logs
            await IntercomDB.addCallEntry({
                type: 'outgoing',
                target: targetRole,
                startTime: new Date(),
                status: 'initiated'
            });
            
            // Lógica para iniciar llamada WebRTC a través de MiroTalkSFU
            await startWebRTCCall(targetRole);
            
            appState.inCall = true;
            
            // Reproducir sonido de llamada saliente
            sounds.dialing.play();
            
        } catch (error) {
            console.error('Error al iniciar llamada:', error);
            await IntercomDB.addErrorEntry('call', 'Error al iniciar llamada', { error: error.message, target: targetRole });
            endCall();
        }
    }
    
    // Mostrar interfaz para llamada entrante
    async function showIncomingCall(fromRole) {
        if (appState.inCall) {
            // Rechazar automáticamente si ya estamos en una llamada
            socket.emit('reject', {
                from: appState.currentRole,
                to: fromRole,
                reason: 'busy'
            });
            return;
        }
        
        // Configurar datos de la llamada
        appState.incomingCall = fromRole;
        appState.callTarget = fromRole;
        
        // Reproducir ringtone
        stopAllSounds();
        sounds.ringtone.play();
        
        // Mostrar una alerta de confirmación en lugar de aceptar automáticamente
        const callerName = departmentConfig[fromRole]?.title || fromRole;
        if (confirm(`Llamada entrante de ${callerName}. ¿Deseas contestar?`)) {
            acceptIncomingCall();
        } else {
            // Si rechaza, detener sonido y enviar señal de rechazo
            stopAllSounds();
            socket.emit('reject', {
                from: appState.currentRole,
                to: fromRole,
                reason: 'rejected'
            });
            
            // Registrar llamada rechazada
            await IntercomDB.addCallEntry({
                type: 'incoming',
                target: fromRole,
                startTime: new Date(),
                endTime: new Date(),
                status: 'rejected',
                duration: 0
            });
        }
    }
    
    // Aceptar una llamada entrante
    async function acceptIncomingCall() {
        try {
            // Detener ringtone
            stopAllSounds();
            
            // Obtener nombre para mostrar
            const callerName = departmentConfig[appState.incomingCall]?.title || appState.incomingCall;
            callTargetEl.textContent = callerName;
            
            // Mostrar interfaz de llamada
            mainInterface.classList.add('hidden');
            callInterface.classList.remove('hidden');
            
            // Iniciar temporizador
            startCallTimer();
            
            // Notificar al servidor que se aceptó la llamada
            socket.emit('accept', {
                from: appState.currentRole,
                to: appState.incomingCall
            });
            
            // Registrar inicio de llamada en logs
            await IntercomDB.addCallEntry({
                type: 'incoming',
                target: appState.incomingCall,
                startTime: new Date(),
                status: 'accepted'
            });
            
            // Lógica para iniciar llamada WebRTC a través de MiroTalkSFU
            await startWebRTCCall(appState.incomingCall);
            
            // Actualizar estado
            appState.inCall = true;
            appState.incomingCall = null;
            
        } catch (error) {
            console.error('Error al aceptar llamada:', error);
            await IntercomDB.addErrorEntry('call', 'Error al aceptar llamada', { error: error.message });
            endCall();
        }
    }
    
    // Iniciar la llamada WebRTC a través de MiroTalkSFU
    async function startWebRTCCall(targetRole) {
        try {
            // Generar ID de sala único para esta llamada
            appState.currentRoom = `call-${appState.currentRole}-${targetRole}-${Date.now()}`;
            
            // Obtener el servidor SFU óptimo (local o fallback)
            const serverUrl = appState.mirotalksfu.currentServer === 'local' 
                ? appState.mirotalksfu.local.url 
                : appState.mirotalksfu.fallback.url;
            
            // Construir URL con parámetros avanzados
            const joinUrl = buildAdvancedJoinUrl(serverUrl, appState.currentRoom);
            
            // Crear iframe para la llamada
            const videoContainer = document.getElementById('video-container');
            videoContainer.innerHTML = '';
            
            const iframe = document.createElement('iframe');
            iframe.src = joinUrl;
            iframe.id = 'call-iframe';
            iframe.allow = 'camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            
            // Evento para cuando la llamada se conecta
            iframe.addEventListener('load', () => {
                console.log('MiroTalkSFU cargado en iframe');
                // Detener sonido de marcación cuando carga la interfaz
                stopAllSounds();
            });
            
            // Agregar iframe al contenedor
            videoContainer.appendChild(iframe);
            
            // Configurar manejo de mensajes desde el iframe
            setupIframeMessageHandling();
            
            return true;
        } catch (error) {
            console.error('Error al iniciar llamada WebRTC:', error);
            await IntercomDB.addErrorEntry('webrtc', 'Error al iniciar llamada WebRTC', { 
                error: error.message, 
                room: appState.currentRoom,
                target: targetRole 
            });
            return false;
        }
    }
    
    // Construir URL con parámetros avanzados para MiroTalkSFU
    function buildAdvancedJoinUrl(serverUrl, roomId) {
        const params = config.mirotalksfu.params;
        const audioConfig = params.audioConfig;
        const videoConfig = params.videoConfig;
        const networkConfig = params.networkConfig;
        
        // Base URL
        let url = `${serverUrl}/join/${roomId}?name=${appState.currentRole}`;
        
        // Parámetros básicos
        url += `&audio=${params.audio}&video=${params.video}&screen=${params.screen}&notify=false&hide=true`;
        
        // Parámetros de audio
        if (audioConfig) {
            url += `&autoGainControl=${audioConfig.autoGainControl}`;
            url += `&echoCancellation=${audioConfig.echoCancellation}`;
            url += `&noiseSuppression=${audioConfig.noiseSuppression}`;
            
            // Solo añadir si la conexión es buena, de lo contrario usar valores más conservadores
            if (appState.connectionQuality === 'high') {
                url += `&audioSampleRate=${audioConfig.sampleRate}`;
            }
        }
        
        // Parámetros de video según calidad de conexión
        if (videoConfig && params.video) {
            const quality = appState.connectionQuality || 'medium';
            
            switch (quality) {
                case 'low':
                    url += '&videoQuality=low';
                    url += '&maxVideoFps=15';
                    break;
                case 'medium':
                    url += '&videoQuality=medium';
                    url += '&maxVideoFps=24';
                    break;
                case 'high':
                    url += '&videoQuality=high';
                    url += '&maxVideoFps=30';
                    break;
                default:
                    url += '&videoQuality=auto';
            }
            
            // Codec preferido si está especificado
            if (videoConfig.preferredCodec) {
                url += `&codec=${videoConfig.preferredCodec}`;
            }
        }
        
        // Parámetros de red
        if (networkConfig) {
            url += `&simulcast=${networkConfig.simulcast}`;
            
            // Ajustar ancho de banda según la calidad de conexión
            if (appState.connectionQuality) {
                const videoBitrate = getOptimalBitrate(appState.connectionQuality, 
                                                    networkConfig.bandwidth.video);
                url += `&videoBitrate=${videoBitrate}`;
                
                const audioBitrate = Math.min(networkConfig.bandwidth.audio, 
                                          appState.connectionQuality === 'low' ? 24 : 32);
                url += `&audioBitrate=${audioBitrate}`;
            }
        }
        
        return url;
    }
    
    // Determinar la tasa de bits óptima según la calidad de conexión
    function getOptimalBitrate(quality, defaultBitrate) {
        switch (quality) {
            case 'low':
                return Math.min(defaultBitrate, 256); // 256 kbps máximo para conexiones bajas
            case 'medium':
                return Math.min(defaultBitrate, 512); // 512 kbps para conexiones medias
            case 'high':
                return defaultBitrate; // Usar el valor por defecto para conexiones buenas
            default:
                return 384; // Valor conservador para casos desconocidos
        }
    }
    
    // Optimizar la configuración según la calidad de conexión
    async function optimizeConnectionSettings() {
        try {
            // Obtener información de la conexión
            const connectionInfo = navigator.connection || {};
            
            // Clasificar la calidad de la conexión
            let connectionQuality = 'medium'; // Valor por defecto
            
            if (connectionInfo.effectiveType) {
                switch (connectionInfo.effectiveType) {
                    case 'slow-2g':
                    case '2g':
                        connectionQuality = 'low';
                        break;
                    case '3g':
                        connectionQuality = 'medium';
                        break;
                    case '4g':
                        connectionQuality = 'high';
                        break;
                }
            }
            
            // Considerar también el RTT (round-trip time) si está disponible
            if (connectionInfo.rtt) {
                if (connectionInfo.rtt > 500) {
                    connectionQuality = 'low';
                } else if (connectionInfo.rtt > 200 && connectionQuality === 'high') {
                    connectionQuality = 'medium';
                }
            }
            
            // Considerar el ancho de banda disponible
            if (connectionInfo.downlink) {
                if (connectionInfo.downlink < 1) {
                    connectionQuality = 'low';
                } else if (connectionInfo.downlink < 5 && connectionQuality === 'high') {
                    connectionQuality = 'medium';
                } else if (connectionInfo.downlink >= 10) {
                    connectionQuality = 'high';
                }
            }
            
            // Guardar calidad detectada para uso posterior
            appState.connectionQuality = connectionQuality;
            console.log(`Calidad de conexión detectada: ${connectionQuality}`);
            
            // Registrar en log
            await IntercomDB.addLogEntry('network', 'Calidad de conexión detectada', {
                quality: connectionQuality,
                effectiveType: connectionInfo.effectiveType,
                rtt: connectionInfo.rtt,
                downlink: connectionInfo.downlink
            });
            
            return connectionQuality;
        } catch (error) {
            console.error('Error al optimizar configuración de conexión:', error);
            appState.connectionQuality = 'medium'; // Valor conservador por defecto
            return 'medium';
        }
    }
    
    // Configurar el manejo de mensajes desde el iframe
    function setupIframeMessageHandling() {
        window.addEventListener('message', (event) => {
            // Verificar origen del mensaje (debe venir del iframe de MiroTalkSFU)
            const iframe = document.getElementById('mirotalksfu-frame');
            if (!iframe || !event.source === iframe.contentWindow) {
                return;
            }
            
            // Procesar mensajes
            const data = event.data;
            if (typeof data === 'object') {
                handleIframeMessage(data);
            }
        });
    }
    
    // Manejar mensajes recibidos desde el iframe
    function handleIframeMessage(data) {
        if (!data.type) return;
        
        switch (data.type) {
            case 'connection-quality':
                // Actualizar UI según la calidad de conexión
                updateConnectionQualityUI(data.quality);
                break;
                
            case 'audio-volume':
                // Se recibe información sobre nivel de audio
                updateAudioLevelUI(data.level);
                break;
                
            case 'participant-joined':
                // Notificación de que otro participante se unió
                console.log('Participante unido:', data.name);
                break;
                
            case 'participant-left':
                // Participante dejó la llamada
                console.log('Participante salió:', data.name);
                if (data.name !== appState.currentRole) {
                    // Si el otro participante se fue, terminar la llamada
                    endCall();
                }
                break;
                
            case 'error':
                // Error en la llamada
                console.error('Error en llamada WebRTC:', data.message);
                IntercomDB.addErrorEntry('webrtc', 'Error en llamada WebRTC', data);
                break;
        }
    }
    
    // Actualizar UI según calidad de conexión
    function updateConnectionQualityUI(quality) {
        const indicator = document.getElementById('connection-quality-indicator');
        const text = document.getElementById('connection-quality-text');
        
        if (!indicator || !text) return;
        
        // Eliminar clases anteriores
        indicator.classList.remove('low', 'medium', 'high');
        
        // Mostrar calidad actual
        let qualityText = 'Auto';
        switch (quality) {
            case 'low':
                indicator.classList.add('low');
                qualityText = 'Baja';
                break;
                
            case 'medium':
                indicator.classList.add('medium');
                qualityText = 'Media';
                break;
                
            case 'high':
                indicator.classList.add('high');
                qualityText = 'Alta';
                break;
        }
        
        text.textContent = `Calidad: ${qualityText}`;
        
        // Actualizar estado global
        appState.connectionQuality = quality;
        
        // Registrar en log
        IntercomDB.addLogEntry('network', 'Cambio de calidad de conexión', { quality });
        
        console.log('Calidad de conexión durante la llamada:', quality);
    }
    
    // Actualizar UI con nivel de audio
    function updateAudioLevelUI(level) {
        // Opcional: mostrar indicador visual del nivel de audio
    }
    
    // Finalizar una llamada en curso
    async function endCall() {
        try {
            // Detener cualquier sonido actual y reproducir sonido de fin
            stopAllSounds();
            sounds.callEnd.play();
            
            // Actualizar estado
            const wasInCall = appState.inCall;
            appState.inCall = false;
            appState.incomingCall = null;
            
            // Notificar al servidor que se terminó la llamada
            if (socket && socket.connected) {
                socket.emit('hangup', {
                    from: appState.currentRole,
                    to: appState.callTarget
                });
            }
            
            // Detener temporizador
            stopCallTimer();
            
            // Finalizar llamada en base de datos
            const endTime = new Date();
            await IntercomDB.updateLastCallEntry({
                endTime: endTime,
                duration: appState.callStartTime ? Math.floor((endTime - appState.callStartTime) / 1000) : 0,
                status: 'completed'
            });
            
            // Limpiar contenedor de video
            const videoContainer = document.getElementById('video-container');
            videoContainer.innerHTML = '';
            
            // Restaurar estado
            appState.callTarget = null;
            appState.currentRoom = null;
            appState.muted = false;
            
            // Restaurar interfaces
            callInterface.classList.add('hidden');
            mainInterface.classList.remove('hidden');
            
            // Restaurar UI de botones
            muteBtn.innerHTML = `
                <span class="icon">🔇</span>
                <span class="label">Silenciar</span>
            `;
            
        } catch (error) {
            console.error('Error al finalizar llamada:', error);
            await IntercomDB.addErrorEntry('call', 'Error al finalizar llamada', { error: error.message });
            
            // Forzar restauración de interfaz
            callInterface.classList.add('hidden');
            mainInterface.classList.remove('hidden');
        }
    }
    
    // Alternar silencio del micrófono
    function toggleMute() {
        try {
            if (!appState.inCall) return;
            
            appState.muted = !appState.muted;
            
            // Actualizar UI del botón de mute
            if (appState.muted) {
                muteBtn.innerHTML = `
                    <span class="icon">🔊</span>
                    <span class="label">Activar</span>
                `;
            } else {
                muteBtn.innerHTML = `
                    <span class="icon">🔇</span>
                    <span class="label">Silenciar</span>
                `;
            }
            
            // Enviar mensaje al iframe de MiroTalkSFU
            const iframe = document.getElementById('mirotalksfu-frame');
            if (iframe) {
                iframe.contentWindow.postMessage({
                    type: 'toggle-audio',
                    muted: appState.muted
                }, '*');
            }
            
        } catch (error) {
            console.error('Error al cambiar estado de micrófono:', error);
        }
    }
    
    // Ajustar volumen del micrófono
    function adjustMicVolume(volume) {
        try {
            if (!appState.inCall) return;
            
            // Valor entre 0 y 1
            const normalizedVolume = Math.max(0, Math.min(1, volume));
            
            // Enviar mensaje al iframe de MiroTalkSFU
            const iframe = document.getElementById('mirotalksfu-frame');
            if (iframe) {
                iframe.contentWindow.postMessage({
                    type: 'mic-volume',
                    volume: normalizedVolume
                }, '*');
            }
            
        } catch (error) {
            console.error('Error al ajustar volumen del micrófono:', error);
        }
    }
    
    // Iniciar temporizador de llamada
    function startCallTimer() {
        appState.callStartTime = new Date();
        const timerEl = document.querySelector('.call-timer');
        
        // Actualizar el timer cada segundo
        appState.timerInterval = setInterval(() => {
            const duration = Math.floor((new Date() - appState.callStartTime) / 1000);
            const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
            const seconds = (duration % 60).toString().padStart(2, '0');
            timerEl.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }
    
    // Detener temporizador de llamada
    function stopCallTimer() {
        if (appState.timerInterval) {
            clearInterval(appState.timerInterval);
            appState.timerInterval = null;
        }
        
        // Resetear UI del timer
        const timerEl = document.querySelector('.call-timer');
        timerEl.textContent = '00:00';
    }
    
    // Comprobar si estamos en un iframe para modo kiosco
    function checkKioskMode() {
        const isInFrame = window !== window.parent;
        if (isInFrame) {
            document.body.classList.add('kiosk-mode');
            // En modo kiosco, vamos a fullscreen automáticamente
            requestFullscreen();
        }
    }
    
    // Solicitar modo pantalla completa
    function requestFullscreen() {
        try {
            const elem = document.documentElement;
            
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { // Safari
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { // IE11
                elem.msRequestFullscreen();
            }
        } catch (error) {
            console.error('Error al solicitar pantalla completa:', error);
        }
    }
    
    // Manejar cambios en el estado de pantalla completa
    function handleFullscreenChange() {
        const isFullscreen = document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullscreenElement || 
                             document.msFullscreenElement;
                             
        // Si salimos del modo pantalla completa y estamos en modo kiosco, intentar volver
        if (!isFullscreen && document.body.classList.contains('kiosk-mode')) {
            // Esperar un poco antes de intentar de nuevo
            setTimeout(requestFullscreen, 1000);
        }
    }
    
    // Prevenir zoom en dispositivos táctiles
    function preventZoom(e) {
        // Prevenir zoom con teclas ctrl/cmd + rueda
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            return false;
        }
        
        // Prevenir zoom con gestos de pinch en táctiles
        if (e.touches && e.touches.length > 1) {
            e.preventDefault();
            return false;
        }
    }
    
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
    
    // Cargar historial de llamadas (para estadísticas)
    async function loadCallHistory() {
        try {
            const history = await IntercomDB.getCallHistory(10);
            return history;
        } catch (error) {
            console.error('Error al cargar historial de llamadas:', error);
            return [];
        }
    }
    
    // Verificar disponibilidad de servidores MiroTalkSFU
    async function startServerCheck() {
        try {
            // Verificar servidor local
            if (config.mirotalksfu.local.enabled) {
                let isLocalAvailable = false;
                let retries = config.mirotalksfu.local.retries || 3;
                
                while (retries > 0 && !isLocalAvailable) {
                    try {
                        const response = await fetch(`${config.mirotalksfu.local.url}/health`, {
                            method: 'GET',
                            headers: { 'Content-Type': 'application/json' },
                            timeout: config.mirotalksfu.local.timeout || 5000
                        });
                        
                        if (response.ok) {
                            isLocalAvailable = true;
                            console.log('Servidor MiroTalkSFU local disponible');
                        }
                    } catch (error) {
                        console.warn(`Intento fallido de conectar al servidor local: ${retries} intentos restantes`);
                    }
                    
                    retries--;
                    if (!isLocalAvailable && retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos entre intentos
                    }
                }
                
                if (isLocalAvailable) {
                    config.mirotalksfu.currentServer = 'local';
                    saveConfig();
                    return;
                }
            }
            
            // Si el servidor local no está disponible, verificar fallback
            if (config.mirotalksfu.fallback.enabled) {
                try {
                    const response = await fetch(`${config.mirotalksfu.fallback.url}/health`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        timeout: config.mirotalksfu.fallback.timeout || 5000
                    });
                    
                    if (response.ok) {
                        console.log('Servidor MiroTalkSFU fallback disponible');
                        config.mirotalksfu.currentServer = 'fallback';
                        saveConfig();
                        return;
                    }
                } catch (error) {
                    console.error('Error al verificar servidor fallback:', error);
                }
            }
            
            // Si llegamos aquí, ningún servidor está disponible
            console.error('Ningún servidor MiroTalkSFU disponible');
            IntercomDB.addErrorEntry('server', 'Ningún servidor MiroTalkSFU disponible', {
                local: config.mirotalksfu.local.url,
                fallback: config.mirotalksfu.fallback.url
            });
            
        } catch (error) {
            console.error('Error al verificar servidores:', error);
        }
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

    // Initialize the app
    init();
    
    // Iniciar verificación de servidores
    startServerCheck();
    
    // Programar sincronización completa con servidor admin cada hora
    setInterval(() => {
        IntercomSync.syncData();
    }, 3600000); // 1 hora
});
