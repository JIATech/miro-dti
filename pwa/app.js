/**
 * Intercom PWA - App Logic
 * 
 * This file contains the client-side logic for the intercom system
 * using MiroTalkSFU for WebRTC communication
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const roleSelector = document.getElementById('role');
    const porteroInterface = document.getElementById('portero-interface');
    const administracionInterface = document.getElementById('administracion-interface');
    const callInterface = document.getElementById('call-interface');
    const callButtons = document.querySelectorAll('.call-button');
    const callTargetEl = document.getElementById('call-target');
    const hangupBtn = document.getElementById('hangup-btn');
    const muteBtn = document.getElementById('mute-btn');
    
    // Socket.IO para comunicación con el servidor de señalización
    let socket;
    
    // Configuración del sistema
    const config = {
        signalingServer: 'http://localhost:3000',
        mirotalksfu: {
            url: 'http://localhost:8080',
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
        incomingCall: null
    };

    // Initialize app
    function init() {
        // Inicializar Socket.IO
        initSocketConnection();
        
        // Set up event listeners
        setupEventListeners();
        
        // Check if we're in a frame, for kiosk mode detection
        checkKioskMode();
        
        // Load saved role if exists
        loadSavedRole();
    }

    // Inicializar la conexión con el servidor de señalización
    function initSocketConnection() {
        console.log('Conectando al servidor de señalización...');
        
        // Iniciar conexión al servidor de señalización
        socket = io(config.signalingServer);
        
        // Eventos de Socket.IO
        socket.on('connect', () => {
            console.log('Conectado al servidor de señalización');
            
            // Registrar el dispositivo una vez conectado
            registerDevice();
        });
        
        socket.on('connect_error', (error) => {
            console.error('Error de conexión con el servidor de señalización:', error);
        });
        
        socket.on('disconnect', () => {
            console.log('Desconectado del servidor de señalización');
            appState.isRegistered = false;
        });
        
        // Eventos específicos de señalización
        socket.on('deviceList', (devices) => {
            console.log('Lista de dispositivos actualizada:', devices);
            // Aquí podrías actualizar una lista UI de dispositivos disponibles
        });
        
        socket.on('incomingCall', (data) => {
            console.log('Llamada entrante:', data);
            handleIncomingCall(data);
        });
        
        socket.on('callAccepted', (data) => {
            console.log('Llamada aceptada:', data);
            joinMiroTalkRoom(data.room);
        });
        
        socket.on('callRejected', (data) => {
            console.log('Llamada rechazada:', data);
            endCall(false);
        });
        
        socket.on('callEnded', (data) => {
            console.log('Llamada finalizada:', data);
            if (appState.inCall) {
                endCall(false);
            }
        });
        
        socket.on('callError', (error) => {
            console.error('Error en la llamada:', error);
            showNotification('Error', `Error: ${error.message}`, 'error');
        });
    }
    
    // Registrar el dispositivo en el servidor de señalización
    function registerDevice() {
        if (appState.isRegistered) return;
        
        const deviceName = appState.currentRole;
        const deviceType = appState.currentRole;
        
        socket.emit('register', { deviceName, deviceType });
        appState.isRegistered = true;
        
        console.log(`Dispositivo registrado como: ${deviceName} (${deviceType})`);
    }

    // Set up all event listeners
    function setupEventListeners() {
        // Role selection change
        roleSelector.addEventListener('change', handleRoleChange);
        
        // Call button clicks
        callButtons.forEach(button => {
            button.addEventListener('click', () => {
                const target = button.getAttribute('data-target');
                initiateCall(target);
            });
        });
        
        // Hangup button
        hangupBtn.addEventListener('click', () => endCall(true));
        
        // Mute button
        muteBtn.addEventListener('click', toggleMute);
        
        // Handle back button/escape in call interface
        window.addEventListener('popstate', (e) => {
            if (appState.inCall) {
                e.preventDefault();
                endCall(true);
            }
        });
    }

    // Check if in kiosk mode
    function checkKioskMode() {
        // This would integrate with JamiPortero's kiosk mode feature
        // For development, we'll just add a class if in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            document.body.classList.add('kiosk-mode');
        }
    }

    // Load saved role from storage
    function loadSavedRole() {
        const savedRole = localStorage.getItem('intercom-role');
        if (savedRole) {
            roleSelector.value = savedRole;
            appState.currentRole = savedRole;
            updateInterfaceForRole(savedRole);
        } else {
            updateInterfaceForRole('portero'); // Default
        }
    }

    // Handle role change from dropdown
    function handleRoleChange(e) {
        const newRole = e.target.value;
        appState.currentRole = newRole;
        
        // Save to localStorage
        localStorage.setItem('intercom-role', newRole);
        
        updateInterfaceForRole(newRole);
        
        // Re-registrar con el nuevo rol
        if (socket && socket.connected) {
            registerDevice();
        }
    }

    // Update UI based on selected role
    function updateInterfaceForRole(role) {
        if (role === 'portero') {
            porteroInterface.classList.remove('hidden');
            administracionInterface.classList.add('hidden');
        } else if (role === 'administracion') {
            porteroInterface.classList.add('hidden');
            administracionInterface.classList.remove('hidden');
        }
    }

    /**
     * CALL FUNCTIONALITY
     * The following functions will integrate with MiroTalkSFU
     */

    // Initiate a call to the target department
    function initiateCall(target) {
        console.log(`Iniciando llamada a: ${target}`);
        
        if (!socket || !socket.connected) {
            showNotification('Error', 'No hay conexión con el servidor', 'error');
            return;
        }
        
        // Update app state
        appState.inCall = true;
        appState.callTarget = target;
        
        // Crear un ID de sala único
        const room = `intercom_${appState.currentRole}_${target}_${Date.now()}`;
        appState.currentRoom = room;
        
        // Enviar solicitud de llamada al servidor de señalización
        socket.emit('callRequest', {
            from: appState.currentRole,
            to: target,
            roomId: room
        });
        
        // Update UI
        callTargetEl.textContent = target.charAt(0).toUpperCase() + target.slice(1);
        callInterface.classList.remove('hidden');
        
        // Add to history so back button works properly
        history.pushState({inCall: true}, '', '#call');
        
        // Start call timer
        startCallTimer();
        
        // Reproducir tono de llamada saliente (si existe)
        if (sounds.ringtone) {
            sounds.ringtone.loop = true;
            sounds.ringtone.play().catch(e => console.error('Error al reproducir ringtone:', e));
        }
        
        // Mostrar notificación
        showNotification('Llamando', `Llamando a ${target}...`, 'info');
    }

    // End the current call
    function endCall(notifyServer = true) {
        console.log('Terminando llamada');
        
        // Detener sonidos
        if (sounds.ringtone) sounds.ringtone.pause();
        if (sounds.callEnd) sounds.callEnd.play().catch(e => console.log('Error al reproducir sonido de fin:', e));
        
        // Si estamos en una llamada, notificar al servidor
        if (notifyServer && appState.currentRoom) {
            socket.emit('callHangup', { room: appState.currentRoom });
        }
        
        // Update app state
        appState.inCall = false;
        appState.currentRoom = null;
        appState.incomingCall = null;
        
        // Stop the timer
        stopCallTimer();
        
        // Hide call interface
        callInterface.classList.add('hidden');
        
        // Go back in history
        if (history.state && history.state.inCall) {
            history.back();
        }
    }

    // Toggle mute status
    function toggleMute() {
        appState.muted = !appState.muted;
        muteBtn.querySelector('.icon').textContent = appState.muted ? '🔊' : '🔇';
        muteBtn.querySelector('.label').textContent = appState.muted ? 'Activar' : 'Silenciar';
        
        // En una implementación real, esto controlaría el audio de la videollamada
    }

    // Start the call timer
    function startCallTimer() {
        const timerEl = document.querySelector('.call-timer');
        appState.callStartTime = new Date();
        
        appState.timerInterval = setInterval(() => {
            const now = new Date();
            const diff = now - appState.callStartTime;
            
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    // Stop the call timer
    function stopCallTimer() {
        if (appState.timerInterval) {
            clearInterval(appState.timerInterval);
            appState.timerInterval = null;
        }
    }

    /**
     * INCOMING CALL HANDLER
     * These functions will be triggered by the MiroTalkSFU signaling server
     */
    
    // Handle an incoming call
    function handleIncomingCall(data) {
        const { from, room, timestamp } = data;
        
        // Guardar datos de la llamada entrante
        appState.incomingCall = data;
        
        // Crear o mostrar la interfaz de llamada entrante
        showIncomingCallInterface(from, room);
        
        // Reproducir tono de llamada entrante
        if (sounds.ringtone) {
            sounds.ringtone.loop = true;
            sounds.ringtone.play().catch(e => console.error('Error al reproducir ringtone:', e));
        }
        
        // Mostrar notificación de sistema (si está permitido)
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification('Llamada entrante', {
                    body: `${from} está llamando`,
                    icon: '/icons/icon-192x192.png'
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
    }
    
    // Mostrar interfaz de llamada entrante
    function showIncomingCallInterface(from, room) {
        // Esta función debería crear y mostrar una interfaz para llamadas entrantes
        // Para simplicidad, usaremos un confirm, pero en producción debería ser un elemento UI bonito
        
        // Detener cualquier llamada actual
        if (appState.inCall) {
            endCall(true);
        }
        
        // Por ahora usamos confirm, pero idealmente sería una UI personalizada
        const accept = confirm(`Llamada entrante de ${from}. ¿Aceptar?`);
        
        if (accept) {
            acceptCall(room);
        } else {
            rejectCall(room);
        }
    }
    
    // Aceptar una llamada entrante
    function acceptCall(room) {
        console.log(`Aceptando llamada en sala: ${room}`);
        
        // Detener sonido de llamada
        if (sounds.ringtone) sounds.ringtone.pause();
        
        // Informar al servidor que aceptamos la llamada
        socket.emit('callAnswer', { room, answer: true });
        
        // Unirse a la sala de MiroTalkSFU
        joinMiroTalkRoom(room);
    }
    
    // Rechazar una llamada entrante
    function rejectCall(room) {
        console.log(`Rechazando llamada en sala: ${room}`);
        
        // Detener sonido de llamada
        if (sounds.ringtone) sounds.ringtone.pause();
        
        // Informar al servidor que rechazamos la llamada
        socket.emit('callAnswer', { room, answer: false });
        
        // Limpiar estado
        appState.incomingCall = null;
    }
    
    // Unirse a una sala de MiroTalkSFU
    function joinMiroTalkRoom(room) {
        // Construir URL para unirse a la sala de MiroTalkSFU
        const joinUrl = constructMiroTalkJoinUrl(room);
        
        console.log(`Uniendo a MiroTalkSFU: ${joinUrl}`);
        
        // Redirigir a la sala de videollamada
        window.location.href = joinUrl;
    }
    
    // Construir URL para unirse a MiroTalkSFU
    function constructMiroTalkJoinUrl(room) {
        const { url, params } = config.mirotalksfu;
        
        // Construir URL con parámetros para unirse directamente con audio/video ya habilitados
        const joinUrl = new URL(`join`, url);
        
        // Añadir parámetros
        joinUrl.searchParams.append('room', room);
        joinUrl.searchParams.append('name', appState.currentRole);
        joinUrl.searchParams.append('audio', params.audio ? '1' : '0');
        joinUrl.searchParams.append('video', params.video ? '1' : '0');
        joinUrl.searchParams.append('screen', params.screen ? '1' : '0');
        joinUrl.searchParams.append('notify', params.notify ? '1' : '0');
        
        // Añadir parámetro para URL de retorno después de colgar
        const returnUrl = new URL('return.html', window.location.origin);
        returnUrl.searchParams.append('room', room);
        returnUrl.searchParams.append('from', appState.currentRole);
        returnUrl.searchParams.append('to', appState.callTarget || '');
        returnUrl.searchParams.append('action', 'hangup');
        
        // Añadir la URL de retorno como parámetro
        joinUrl.searchParams.append('exitURL', returnUrl.toString());
        
        return joinUrl.toString();
    }
    
    // Mostrar una notificación en pantalla
    function showNotification(title, message, type = 'info') {
        // En una implementación real, esto mostraría un toast o alerta UI
        console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    }

    // Initialize the app
    init();
});
