/**
 * Intercom PWA - App Logic
 *
 * This file contains the client-side logic for the intercom system
 * using MiroTalkSFU for WebRTC communication
 */

/* global IntercomDB, IntercomSync, io */

// Declarar funciones que parecen estar definidas en otro archivo
let showChangePasswordModal, hideChangePasswordModal, handlePasswordChange;

// Variables globales para estado de la aplicación
// eslint-disable-next-line no-unused-vars
let currentCallData = null;

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
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
        retries: 3,
      },
      fallback: {
        enabled: true,
        url: 'https://fallback-server.example.com:8080', // Cambiar en producción
        timeout: 5000,
      },
      currentServer: 'local', // 'local' o 'fallback'
      params: {
        audio: true,
        video: true,
        screen: false,
        notify: true,
        // Parámetros avanzados de audio
        audioConfig: {
          autoGainControl: true, // Control automático de ganancia (evita audio demasiado bajo/alto)
          echoCancellation: true, // Cancelación de eco (evita feedback)
          noiseSuppression: true, // Supresión de ruido de fondo
          sampleRate: 48000, // Tasa de muestreo de alta calidad
          channelCount: 1, // Mono es suficiente y ahorra ancho de banda
          volume: 1.0, // Nivel de volumen inicial (0.0 - 1.0)
        },
        // Parámetros avanzados de video
        videoConfig: {
          autoAdjustQuality: true, // Ajuste automático de calidad según conexión
          frameRate: { ideal: 24, max: 30 }, // Framerate balanceado (suficiente para video comunicación)
          aspectRatio: 1.777778, // Relación de aspecto 16:9
          width: { ideal: 640, max: 1280 }, // Resolución inicial
          height: { ideal: 360, max: 720 },
          preferredCodec: 'VP9', // Codec con mejor compresión
        },
        // Parámetros de red
        networkConfig: {
          adaptiveStreaming: true, // Ajusta bitrate según condiciones de red
          simulcast: true, // Permite múltiples calidades para adaptarse a las condiciones
          bandwidth: {
            audio: 32, // kbps para audio
            video: 512, // kbps inicial para video (se ajustará según conexión)
            screen: 1024, // kbps para compartir pantalla (no usado en este caso)
          },
        },
      },
    },
  };

  // Sonidos del sistema
  const sounds = {
    ringtone: new Audio('sounds/ringtone.mp3'),
    callEnd: new Audio('sounds/end.mp3'),
    dialing: new Audio('sounds/dialing.mp3'),
  };

  // Configurar bucles para los sonidos que lo requieren
  sounds.ringtone.loop = true;
  sounds.dialing.loop = true;

  // Función para detener todos los sonidos
  function stopAllSounds() {
    Object.values(sounds).forEach((sound) => {
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
        { id: 'soporte', label: 'Soporte', icon: '🛠️' },
      ],
    },
    administracion: {
      title: 'Administración DTI',
      targets: [
        { id: 'portero', label: 'Portero', icon: '🚪' },
        { id: 'sistemas', label: 'Sistemas', icon: '💻' },
        { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' },
        { id: 'soporte', label: 'Soporte', icon: '🛠️' },
      ],
    },
    sistemas: {
      title: 'Sistemas DTI',
      targets: [
        { id: 'portero', label: 'Portero', icon: '🚪' },
        { id: 'administracion', label: 'Administración', icon: '👥' },
        { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' },
        { id: 'soporte', label: 'Soporte', icon: '🛠️' },
      ],
    },
    infraestructura: {
      title: 'Infraestructura DTI',
      targets: [
        { id: 'portero', label: 'Portero', icon: '🚪' },
        { id: 'administracion', label: 'Administración', icon: '👥' },
        { id: 'sistemas', label: 'Sistemas', icon: '💻' },
        { id: 'soporte', label: 'Soporte', icon: '🛠️' },
      ],
    },
    soporte: {
      title: 'Soporte DTI',
      targets: [
        { id: 'portero', label: 'Portero', icon: '🚪' },
        { id: 'administracion', label: 'Administración', icon: '👥' },
        { id: 'sistemas', label: 'Sistemas', icon: '💻' },
        { id: 'infraestructura', label: 'Infraestructura', icon: '🏢' },
      ],
    },
  };

  // App State
  const appState = {
    currentRole: '',
    displayName: '',
    token: '',
    userId: '',
    inCall: false,
    callTarget: null,
    callStartTime: null,
    timerInterval: null,
    muted: false,
    currentRoom: null,
    isRegistered: false,
    incomingCall: null,
    deviceId: generateDeviceId(),
    connectionQuality: null,
    isLoggedIn: false,
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
      deviceInfo: navigator.userAgent,
    });

    // Cargar configuración desde localStorage o valores predeterminados
    await loadConfig();

    // Inicializar Socket.IO
    initSocketConnection();

    // Set up event listeners
    setupEventListeners();

    // Check if we're in a frame, for kiosk mode detection
    checkKioskMode();

    // Check if we have a saved session
    await checkSavedSession();

    // Cargar historial de llamadas
    await loadCallHistory();

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
        if (appState.token) {
          socket.emit('register', {
            token: appState.token,
            deviceId: appState.deviceId,
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
      IntercomDB.addErrorEntry('socket', 'Error al conectar con el servidor de señalización', {
        error: error.message,
      });
    }
  }

  // Setup de event listeners para la interfaz
  function setupEventListeners() {
    // Login
    loginBtn.addEventListener('click', handleLogin);

    // Forgot Password
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showResetPasswordModal();
      });
    }

    // Reset Password Modal
    const closeResetModalBtn = document.getElementById('close-reset-modal-btn');
    if (closeResetModalBtn) {
      closeResetModalBtn.addEventListener('click', hideResetPasswordModal);
    }

    const cancelResetBtn = document.getElementById('cancel-reset-btn');
    if (cancelResetBtn) {
      cancelResetBtn.addEventListener('click', hideResetPasswordModal);
    }

    const saveResetBtn = document.getElementById('save-reset-btn');
    if (saveResetBtn) {
      saveResetBtn.addEventListener('click', handlePasswordReset);
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Cambio de contraseña
    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', showChangePasswordModal);
    }

    // Modal de cambio de contraseña
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', hideChangePasswordModal);
    }

    const cancelPasswordBtn = document.getElementById('cancel-password-btn');
    if (cancelPasswordBtn) {
      cancelPasswordBtn.addEventListener('click', hideChangePasswordModal);
    }

    const savePasswordBtn = document.getElementById('save-password-btn');
    if (savePasswordBtn) {
      savePasswordBtn.addEventListener('click', handlePasswordChange);
    }

    // Event listener para tecla Enter en el campo de usuario
    usernameInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        passwordInput.focus();
      }
    });

    // Event listener para tecla Enter en el campo de contraseña
    passwordInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        handleLogin();
      }
    });

    // Event listener para tecla Escape en modales
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const changePasswordModal = document.getElementById('change-password-modal');
        if (changePasswordModal && !changePasswordModal.classList.contains('hidden')) {
          hideChangePasswordModal();
        }

        const resetPasswordModal = document.getElementById('reset-password-modal');
        if (resetPasswordModal && !resetPasswordModal.classList.contains('hidden')) {
          hideResetPasswordModal();
        }
      }
    });

    // Call functionality
    // Los botones de llamada se generan dinámicamente, usamos event delegation
    buttonsContainer.addEventListener('click', (event) => {
      const callButton = event.target.closest('.call-button');
      if (callButton) {
        const targetRole = callButton.dataset.target;
        if (targetRole) {
          initiateCall(targetRole);
        }
      }
    });

    // Call controls
    hangupBtn.addEventListener('click', endCall);
    muteBtn.addEventListener('click', toggleMute);

    // Control de volumen
    const micVolumeControl = document.getElementById('mic-volume');
    if (micVolumeControl) {
      micVolumeControl.addEventListener('input', (e) => {
        adjustMicVolume(e.target.value / 100);
      });
    }

    // Prevenir zoom en dispositivos táctiles
    document.addEventListener('touchmove', preventZoom, { passive: false });

    // Manejo de cambios en pantalla completa
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  }

  // Mostrar modal de recuperación de contraseña
  function showResetPasswordModal() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) {
      // Limpiar campos y mensajes anteriores
      document.getElementById('reset-username').value = '';
      document.getElementById('reset-new-password').value = '';
      document.getElementById('reset-confirm-password').value = '';
      document.getElementById('reset-error').classList.add('hidden');
      document.getElementById('reset-success').classList.add('hidden');

      // Ocultar el formulario de reset y mostrar paso de verificación
      document.getElementById('reset-password-form').classList.add('hidden');
      document.getElementById('device-verification-step').classList.remove('hidden');

      // Deshabilitar botón de reset
      document.getElementById('save-reset-btn').disabled = true;

      // Mostrar modal
      modal.classList.remove('hidden');

      // Iniciar verificación del dispositivo
      verifyDeviceForPasswordReset();
    }
  }

  // Ocultar modal de recuperación de contraseña
  function hideResetPasswordModal() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  // Verificar el dispositivo para reset de contraseña
  async function verifyDeviceForPasswordReset() {
    const statusElement = document.getElementById('device-verification-status');
    const saveButton = document.getElementById('save-reset-btn');
    const resetForm = document.getElementById('reset-password-form');

    try {
      // Obtener nombre de usuario si está disponible en el campo de login
      const username = document.getElementById('username').value || '';

      // Intentar obtener identificador del dispositivo
      const deviceInfo = await getDeviceIdentifier();

      // Añadir username a la info del dispositivo para verificación
      deviceInfo.username = username;

      // Verificar el dispositivo con el servidor
      const response = await fetch(`${config.signalingServer}/api/auth/verify-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceInfo: deviceInfo,
        }),
      });

      const result = await response.json();

      if (result.verified) {
        // Dispositivo verificado correctamente
        statusElement.textContent = '✅ Dispositivo reconocido. Puedes restablecer tu contraseña.';
        statusElement.classList.add('success');
        statusElement.classList.remove('error');

        // Mostrar formulario de reset
        resetForm.classList.remove('hidden');

        // Habilitar botón de reset
        saveButton.disabled = false;

        // Si ya hay un username en el campo de login, añadirlo al campo de reset
        if (username) {
          document.getElementById('reset-username').value = username;
        }

        // Registrar en logs
        await IntercomDB.addLogEntry(
          'security',
          'Dispositivo autorizado para recuperación de contraseña',
          {
            timestamp: new Date(),
            deviceInfo: deviceInfo,
          }
        );
      } else {
        // Dispositivo no reconocido
        statusElement.textContent =
          '❌ Dispositivo no reconocido. Por motivos de seguridad, no puedes restablecer la contraseña desde este dispositivo.';
        statusElement.classList.add('error');
        statusElement.classList.remove('success');

        // Mantener oculto el formulario
        resetForm.classList.add('hidden');

        // Mantener deshabilitado el botón
        saveButton.disabled = true;

        // Registrar en logs
        await IntercomDB.addLogEntry(
          'security',
          'Intento de recuperación desde dispositivo no autorizado',
          {
            timestamp: new Date(),
            deviceInfo: deviceInfo,
          }
        );
      }
    } catch (error) {
      console.error('Error verificando dispositivo:', error);

      // Mostrar error
      statusElement.textContent =
        '❌ Error al verificar el dispositivo. Por favor, inténtalo de nuevo más tarde.';
      statusElement.classList.add('error');
      statusElement.classList.remove('success');

      // Mantener oculto el formulario
      resetForm.classList.add('hidden');

      // Mantener deshabilitado el botón
      saveButton.disabled = true;

      // Registrar en logs
      await IntercomDB.addLogEntry('error', 'Error al verificar dispositivo para recuperación', {
        timestamp: new Date(),
        error: error.message || 'Error desconocido',
      });
    }
  }

  // Manejar reset de contraseña
  async function handlePasswordReset() {
    const usernameInput = document.getElementById('reset-username');
    const newPasswordInput = document.getElementById('reset-new-password');
    const confirmPasswordInput = document.getElementById('reset-confirm-password');
    const errorElement = document.getElementById('reset-error');
    const successElement = document.getElementById('reset-success');
    const saveButton = document.getElementById('save-reset-btn');

    // Obtener valores
    const username = usernameInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Limpiar mensajes anteriores
    errorElement.classList.add('hidden');
    successElement.classList.add('hidden');

    // Validar entradas
    if (!username || !newPassword || !confirmPassword) {
      errorElement.textContent = 'Todos los campos son obligatorios';
      errorElement.classList.remove('hidden');
      return;
    }

    // Verificar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      errorElement.textContent = 'Las contraseñas nuevas no coinciden';
      errorElement.classList.remove('hidden');
      return;
    }

    // Verificar longitud mínima
    if (newPassword.length < 6) {
      errorElement.textContent = 'La contraseña debe tener al menos 6 caracteres';
      errorElement.classList.remove('hidden');
      return;
    }

    try {
      // Obtener identificador del dispositivo para incluirlo en la solicitud
      const deviceInfo = await getDeviceIdentifier();

      // Deshabilitar botón durante la petición
      saveButton.disabled = true;
      saveButton.textContent = 'Procesando...';

      // Enviar solicitud al servidor
      const response = await fetch(`${config.signalingServer}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          newPassword,
          deviceInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al restablecer la contraseña');
      }

      // Mostrar mensaje de éxito
      successElement.textContent =
        'Contraseña restablecida correctamente. Ya puedes iniciar sesión.';
      successElement.classList.remove('hidden');

      // Registrar en log
      await IntercomDB.addLogEntry('security', 'Contraseña restablecida exitosamente', {
        timestamp: new Date(),
        username: username,
        deviceInfo: deviceInfo,
      });

      // Cerrar modal después de 3 segundos
      setTimeout(() => {
        hideResetPasswordModal();
        // Enfocar campo de usuario para facilitar nuevo inicio de sesión
        document.getElementById('username').value = username;
        document.getElementById('username').focus();
      }, 3000);
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      errorElement.textContent =
        error.message || 'Error al restablecer la contraseña. Inténtalo de nuevo.';
      errorElement.classList.remove('hidden');

      // Registrar error en logs
      await IntercomDB.addLogEntry('error', 'Error en recuperación de contraseña', {
        timestamp: new Date(),
        username: username,
        errorMessage: error.message,
      });
    } finally {
      // Restablecer el botón
      saveButton.disabled = false;
      saveButton.textContent = 'Restablecer Contraseña';
    }
  }

  // Obtener identificador único del dispositivo (con soporte para WallPanel)
  async function getDeviceIdentifier() {
    // Objeto para almacenar toda la información del dispositivo
    let deviceInfo = {};

    // 1. Intentar obtener información a través de WallPanel
    if (typeof window.WallPanel !== 'undefined') {
      try {
        deviceInfo = {
          source: 'wallpanel',
          deviceId: window.WallPanel.getDeviceId(),
          androidId: window.WallPanel.getAndroidId(),
          appVersion: window.WallPanel.getAppVersion(),
          serialNumber: window.WallPanel.getSerialNumber(),
          manufacturer: window.WallPanel.getDeviceManufacturer(),
          model: window.WallPanel.getDeviceModel(),
        };
        console.log('Dispositivo identificado via WallPanel JS Bridge');
      } catch (e) {
        console.error('Error accediendo a WallPanel JS Bridge:', e);
      }
    }

    // 2. Si no funcionó WallPanel JS Bridge, intentar API REST de WallPanel
    if (!deviceInfo.deviceId) {
      try {
        const response = await fetch('http://localhost:2971/api/info');
        if (response.ok) {
          const wallPanelInfo = await response.json();
          deviceInfo = {
            source: 'wallpanel_rest',
            deviceId: wallPanelInfo.deviceId,
            androidId: wallPanelInfo.androidId,
            appVersion: wallPanelInfo.appVersion,
            ipAddress: wallPanelInfo.ipAddress,
          };
          console.log('Dispositivo identificado via WallPanel REST API');
        }
      } catch (e) {
        console.log('WallPanel REST API no disponible:', e);
      }
    }

    // 3. Si ninguna API de WallPanel funcionó, obtener toda la información posible del navegador
    if (!deviceInfo.deviceId) {
      // UUID almacenado localmente (ya implementado)
      const storedUuid = localStorage.getItem('intercom-device-id') || appState.deviceId;

      // Fingerprinting básico del navegador
      const browserFingerprint = await generateBrowserFingerprint();

      deviceInfo = {
        source: 'browser',
        uuid: storedUuid,
        fingerprint: browserFingerprint,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        colorDepth: window.screen.colorDepth,
      };
      console.log('Dispositivo identificado via navegador estándar');
    }

    // Agregar timestamp a la información
    deviceInfo.timestamp = new Date().toISOString();

    // Guardar en base de datos local
    await saveDeviceInfoToLocalStorage(deviceInfo);

    return deviceInfo;
  }

  // Generar fingerprint del navegador
  async function generateBrowserFingerprint() {
    // Combinar varios puntos de datos para crear una huella única
    const fingerPrintData = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      navigator.deviceMemory,
      navigator.platform,
      navigator.vendor,
      window.screen.width,
      window.screen.height,
      window.screen.colorDepth,
    ].join('|');

    try {
      // Usar SubtleCrypto para generar un hash más seguro
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerPrintData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback a hash simple si crypto API no está disponible
      console.error('Error generando fingerprint con SubtleCrypto:', e);
      return simpleHash(fingerPrintData);
    }
  }

  // Función de hash simple para fallback
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convertir a entero de 32 bits
    }
    return hash.toString(16);
  }

  // Guardar información del dispositivo en localStorage
  async function saveDeviceInfoToLocalStorage(deviceInfo) {
    try {
      // Guardar UUID principal si viene de WallPanel
      if (deviceInfo.source.includes('wallpanel') && deviceInfo.deviceId) {
        localStorage.setItem('intercom-device-id', deviceInfo.deviceId);
      }

      // Guardar la información completa
      localStorage.setItem('intercom-device-info', JSON.stringify(deviceInfo));

      // También guardar en IndexedDB para persistencia adicional
      if (IntercomDB && typeof IntercomDB.saveDeviceInfo === 'function') {
        await IntercomDB.saveDeviceInfo(deviceInfo);
      }

      return true;
    } catch (error) {
      console.error('Error guardando info del dispositivo:', error);
      return false;
    }
  }

  // Manejar login con el rol seleccionado
  async function handleLogin() {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
      alert('Por favor, ingresa un nombre de usuario y contraseña para continuar');
      return;
    }

    try {
      // Obtener información del dispositivo para enviar al servidor
      const deviceInfo = await getDeviceIdentifier();

      // Autenticar con el servidor
      authenticateUser(username, password, deviceInfo);
    } catch (error) {
      console.error('Error al preparar login:', error);
      authenticateUser(username, password);
    }
  }

  // Autenticar usuario con el servidor
  async function authenticateUser(username, password, deviceInfo) {
    try {
      // Mostrar indicador de carga
      loginBtn.disabled = true;
      loginBtn.textContent = 'Autenticando...';
      loginError.classList.add('hidden');

      const response = await fetch(`${config.signalingServer}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          deviceInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error de autenticación');
      }

      // Guardar información del usuario en el estado de la app
      appState.token = data.token;
      appState.currentRole = data.user.role;
      appState.displayName = data.user.displayName;
      appState.userId = data.user.id;

      // Guardar token en localStorage para persistencia de sesión
      localStorage.setItem('intercom-token', appState.token);

      console.log('Usuario autenticado:', appState.displayName);

      // Registrar con el servidor de señalización
      if (socket && socket.connected) {
        socket.emit('register', {
          token: appState.token,
          deviceId: appState.deviceId,
        });
      }

      // Configurar la interfaz según el rol
      setupRoleInterface();

      // Ocultar login, mostrar interfaz principal
      loginForm.parentElement.classList.add('hidden');
      mainInterface.classList.remove('hidden');

      // Registrar con el servidor de admin
      registerWithAdminServer();

      // Intentar entrar en modo pantalla completa para modo kiosco
      requestFullscreen();

      // Añadir entrada de log para el inicio de sesión
      await IntercomDB.addLogEntry('auth', 'Inicio de sesión exitoso', {
        timestamp: new Date(),
        role: appState.currentRole,
        displayName: appState.displayName,
      });
    } catch (error) {
      console.error('Error al autenticar:', error);
      loginError.textContent =
        error.message || 'Error al autenticar. Por favor, inténtalo de nuevo.';
      loginError.classList.remove('hidden');

      // Añadir entrada de log para el error de inicio de sesión
      await IntercomDB.addLogEntry('error', 'Error de inicio de sesión', {
        timestamp: new Date(),
        username: username,
        errorMessage: error.message || 'Error desconocido',
      });
    } finally {
      // Restablecer el botón de inicio de sesión
      loginBtn.disabled = false;
      loginBtn.textContent = 'Iniciar Sesión';
    }
  }

  // Configurar la interfaz según el rol seleccionado
  function setupRoleInterface() {
    // Actualizar título del departamento
    const departmentTitle = document.getElementById('department-title');
    if (departmentTitle) {
      departmentTitle.textContent = `Bienvenido, ${appState.displayName}`;
    }

    // Ocultar la pantalla de selección de rol
    document.getElementById('role-selector').classList.add('hidden');

    // Mostrar la interfaz principal
    document.getElementById('main-interface').classList.remove('hidden');

    const buttonsContainer = document.querySelector('.buttons-container');
    buttonsContainer.innerHTML = '';

    // Crear botones dinámicamente para cada objetivo
    departmentConfig.portero.targets.forEach((target) => {
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

    console.log('Interfaz configurada');
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
      callTargetEl.textContent =
        departmentConfig.portero.targets.find((t) => t.id === targetRole)?.label || targetRole;

      // Mostrar interfaz de llamada
      mainInterface.classList.add('hidden');
      callInterface.classList.remove('hidden');

      // Iniciar temporizador
      startCallTimer();

      // Emitir evento de llamada al servidor de señalización
      socket.emit('call', {
        from: appState.userId,
        to: targetRole,
        deviceId: appState.deviceId,
      });

      // Registrar inicio de llamada en logs
      await IntercomDB.addCallEntry({
        type: 'outgoing',
        target: targetRole,
        startTime: new Date(),
        status: 'initiated',
      });

      // Lógica para iniciar llamada WebRTC a través de MiroTalkSFU
      await startWebRTCCall(targetRole);

      appState.inCall = true;

      // Reproducir sonido de llamada saliente
      sounds.dialing.play();
    } catch (error) {
      console.error('Error al iniciar llamada:', error);
      await IntercomDB.addErrorEntry('call', 'Error al iniciar llamada', {
        error: error.message,
        target: targetRole,
      });
      endCall();
    }
  }

  // Mostrar interfaz para llamada entrante
  async function showIncomingCall(fromRole) {
    if (appState.inCall) {
      // Rechazar automáticamente si ya estamos en una llamada
      socket.emit('reject', {
        from: appState.userId,
        to: fromRole,
        reason: 'busy',
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
    const callerName =
      departmentConfig.portero.targets.find((t) => t.id === fromRole)?.label || fromRole;
    if (confirm(`Llamada entrante de ${callerName}. ¿Deseas contestar?`)) {
      acceptIncomingCall();
    } else {
      // Si rechaza, detener sonido y enviar señal de rechazo
      stopAllSounds();
      socket.emit('reject', {
        from: appState.userId,
        to: fromRole,
        reason: 'rejected',
      });

      // Registrar llamada rechazada
      await IntercomDB.addCallEntry({
        type: 'incoming',
        target: fromRole,
        startTime: new Date(),
        endTime: new Date(),
        status: 'rejected',
        duration: 0,
      });
    }
  }

  // Aceptar una llamada entrante
  async function acceptIncomingCall() {
    try {
      // Detener ringtone
      stopAllSounds();

      // Obtener nombre para mostrar
      const callerName =
        departmentConfig.portero.targets.find((t) => t.id === appState.incomingCall)?.label ||
        appState.incomingCall;
      callTargetEl.textContent = callerName;

      // Mostrar interfaz de llamada
      mainInterface.classList.add('hidden');
      callInterface.classList.remove('hidden');

      // Iniciar temporizador
      startCallTimer();

      // Notificar al servidor que se aceptó la llamada
      socket.emit('accept', {
        from: appState.userId,
        to: appState.incomingCall,
      });

      // Registrar inicio de llamada en logs
      await IntercomDB.addCallEntry({
        type: 'incoming',
        target: appState.incomingCall,
        startTime: new Date(),
        status: 'accepted',
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
      appState.currentRoom = `call-${appState.userId}-${targetRole}-${Date.now()}`;

      // Obtener el servidor SFU óptimo (local o fallback)
      const serverUrl =
        appState.mirotalksfu.currentServer === 'local'
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
      iframe.allow =
        'camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write';
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
        target: targetRole,
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
    let url = `${serverUrl}/join/${roomId}?name=${appState.displayName}`;

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
        const videoBitrate = getOptimalBitrate(
          appState.connectionQuality,
          networkConfig.bandwidth.video
        );
        url += `&videoBitrate=${videoBitrate}`;

        const audioBitrate = Math.min(
          networkConfig.bandwidth.audio,
          appState.connectionQuality === 'low' ? 24 : 32
        );
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
  // eslint-disable-next-line no-unused-vars
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
        downlink: connectionInfo.downlink,
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
      if (data.name !== appState.displayName) {
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
  // eslint-disable-next-line no-unused-vars
  function updateAudioLevelUI(level) {
    // Esta función podría implementarse en el futuro para mostrar una animación
    // de nivel de audio durante las llamadas
  }

  // Finalizar una llamada en curso
  function endCall() {
    // eslint-disable-next-line no-unused-vars
    const wasInCall = appState.inCall;
    
    stopCallTimer();
    currentCallData = null;
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
        iframe.contentWindow.postMessage(
          {
            type: 'toggle-audio',
            muted: appState.muted,
          },
          '*'
        );
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
        iframe.contentWindow.postMessage(
          {
            type: 'mic-volume',
            volume: normalizedVolume,
          },
          '*'
        );
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
      const minutes = Math.floor(duration / 60)
        .toString()
        .padStart(2, '0');
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
      } else if (elem.webkitRequestFullscreen) {
        // Safari
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        // IE11
        elem.msRequestFullscreen();
      }
    } catch (error) {
      console.error('Error al solicitar pantalla completa:', error);
    }
  }

  // Manejar cambios en el estado de pantalla completa
  function handleFullscreenChange() {
    const isFullscreen =
      document.fullscreenElement ||
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: appState.deviceId,
          deviceName: appState.displayName,
          deviceType: 'tablet',
          role: 'user',
          ip: deviceInfo.ip || 'unknown',
          version: deviceInfo.appVersion || '1.0.0',
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Error al registrar dispositivo: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log('Dispositivo registrado con el servidor de administración:', result);

      return true;
    } catch (error) {
      console.error('Error al registrar con servidor admin:', error);
      IntercomDB.addErrorEntry('admin', 'Error al registrar con servidor admin', {
        error: error.message,
      });
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: appState.deviceId,
          metrics: {
            role: 'user',
            battery: deviceInfo.battery?.level || 0,
            version: deviceInfo.appVersion || '1.0.0',
            performance: {
              memory: deviceInfo.memory || {},
              cpu: deviceInfo.cpu || 0,
              network: deviceInfo.connection?.type || 'unknown',
              battery: deviceInfo.battery?.level || 0,
              charging: deviceInfo.battery?.charging || false,
            },
            hardware: {
              model: deviceInfo.model || 'unknown',
              osVersion: deviceInfo.osVersion || 'unknown',
              screenWidth: window.screen.width,
              screenHeight: window.screen.height,
              storage: deviceInfo.storage || {},
            },
            stats: {
              callCount: callStats.total || 0,
              errorCount: 0, // Obtener desde los registros de errores
              connectedTime: Math.floor((Date.now() - performance.timing.navigationStart) / 1000),
              lastCall: callStats.lastCall || null,
            },
          },
        }),
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
      cpu: 0,
    };

    try {
      // Información de conexión
      if (navigator.connection) {
        info.connection = {
          type: navigator.connection.effectiveType || 'unknown',
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
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
          used: 0, // No disponible en navegador
        };
      }

      // Almacenamiento
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        info.storage = {
          total: estimate.quota,
          used: estimate.usage,
        };
      }

      // Batería
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        info.battery = {
          level: Math.round(battery.level * 100),
          charging: battery.charging,
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
              timeout: config.mirotalksfu.local.timeout || 5000,
            });

            if (response.ok) {
              isLocalAvailable = true;
              console.log('Servidor MiroTalkSFU local disponible');
            }
          } catch (error) {
            console.warn(
              `Intento fallido de conectar al servidor local: ${retries} intentos restantes`
            );
          }

          retries--;
          if (!isLocalAvailable && retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 segundos entre intentos
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
            timeout: config.mirotalksfu.fallback.timeout || 5000,
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
        fallback: config.mirotalksfu.fallback.url,
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
              ...parsedConfig.mirotalksfu.local,
            };
          }
          if (parsedConfig.mirotalksfu.fallback) {
            config.mirotalksfu.fallback = {
              ...config.mirotalksfu.fallback,
              ...parsedConfig.mirotalksfu.fallback,
            };
          }

          // Mantener el servidor actual (si es válido)
          if (
            parsedConfig.mirotalksfu.currentServer === 'local' ||
            parsedConfig.mirotalksfu.currentServer === 'fallback'
          ) {
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
        await IntercomDB.addErrorEntry('config', 'Error al cargar configuración', {
          error: error.message,
        });
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
      IntercomDB.addErrorEntry('config', 'Error al guardar configuración', {
        error: error.message,
      });
    }
  }

  // Verificar si hay una sesión guardada
  async function checkSavedSession() {
    try {
      const savedToken = localStorage.getItem('intercom-token');

      // Primero intentar verificar con el token guardado
      if (savedToken) {
        console.log('Verificando token guardado...');

        // Verificar la validez del token con el servidor
        const response = await fetch(`${config.signalingServer}/api/auth/verify`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (response.ok) {
          // Token válido, obtener información del usuario
          const userData = await response.json();

          // Actualizar estado de la aplicación
          appState.token = savedToken;
          appState.userId = userData.user.id;
          appState.displayName = userData.user.displayName;
          appState.currentRole = userData.user.role;
          appState.isLoggedIn = true;

          console.log('Sesión válida recuperada:', userData.user.displayName);

          // Registrar con el servidor de señalización
          if (socket && socket.connected) {
            socket.emit('register', {
              token: appState.token,
              deviceId: appState.deviceId,
            });
          }

          // Iniciar interfaz según el rol
          setupRoleInterface();
          loginForm.parentElement.classList.add('hidden');
          mainInterface.classList.remove('hidden');

          return true;
        } else {
          console.log('Token inválido o expirado, eliminando...');
          localStorage.removeItem('intercom-token');
        }
      }

      // Si no hay token o el token es inválido, intentar login automático por dispositivo
      return await tryDeviceAutoLogin();
    } catch (error) {
      console.error('Error al verificar sesión guardada:', error);
      return false;
    }
  }

  // Intentar inicio de sesión automático por dispositivo
  async function tryDeviceAutoLogin() {
    try {
      // Obtener información del dispositivo
      const deviceInfo = await getDeviceIdentifier();

      console.log('Intentando inicio de sesión automático por dispositivo...');

      // Solicitar inicio de sesión automático al servidor
      const response = await fetch(`${config.signalingServer}/api/auth/device-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceInfo,
        }),
      });

      const data = await response.json();

      // Si el dispositivo está reconocido, iniciar sesión automáticamente
      if (response.ok && data.success) {
        console.log('Inicio de sesión automático exitoso:', data.user.displayName);

        // Guardar token y datos de usuario
        appState.token = data.token;
        appState.userId = data.user.id;
        appState.username = data.user.username;
        appState.displayName = data.user.displayName;
        appState.currentRole = data.user.role;
        appState.isLoggedIn = true;

        // Guardar en localStorage para persistencia
        localStorage.setItem('intercom-token', data.token);
        localStorage.setItem(
          'intercom-user',
          JSON.stringify({
            id: data.user.id,
            username: data.user.username,
            displayName: data.user.displayName,
            role: data.user.role,
          })
        );

        // Registrar en logs
        await IntercomDB.addLogEntry('auth', 'Inicio de sesión automático exitoso', {
          timestamp: new Date(),
          username: data.user.username,
        });

        // Registrar con el servidor de señalización
        if (socket && socket.connected) {
          socket.emit('register', {
            token: appState.token,
            deviceId: appState.deviceId,
          });
        }

        // Actualizar interfaz según el rol
        await setupRoleInterface();
        loginForm.parentElement.classList.add('hidden');
        mainInterface.classList.remove('hidden');

        // Intentar entrar en modo pantalla completa para modo kiosco
        requestFullscreen();

        return true;
      } else if (data.requiresLogin) {
        console.log('El dispositivo requiere inicio de sesión manual');
        // No hacer nada, se mostrará la pantalla de login
      } else {
        console.error('Error en inicio de sesión automático:', data.message);
      }

      return false;
    } catch (error) {
      console.error('Error al intentar inicio de sesión automático:', error);
      return false;
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

  // Función para manejar el cierre de sesión
  function handleLogout() {
    // Mostrar confirmación antes de cerrar sesión
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      // Registrar acción en logs
      IntercomDB.addLogEntry('auth', 'Cierre de sesión', {
        timestamp: new Date(),
        role: appState.currentRole,
        displayName: appState.displayName,
      }).catch((error) => console.error('Error al registrar cierre de sesión:', error));

      // Si hay una llamada activa, terminarla
      if (appState.inCall) {
        endCall();
      }

      // Notificar al servidor que el dispositivo se desconecta
      if (socket && socket.connected) {
        socket.emit('unregister', {
          token: appState.token,
          deviceId: appState.deviceId,
        });
      }

      // Limpiar el estado de la aplicación
      appState.token = '';
      appState.userId = '';
      appState.displayName = '';
      appState.currentRole = '';

      // Eliminar token del almacenamiento local
      localStorage.removeItem('intercom-token');

      // Limpiar campos de login
      usernameInput.value = '';
      passwordInput.value = '';
      loginError.classList.add('hidden');

      // Mostrar formulario de login y ocultar interfaz principal
      loginForm.parentElement.classList.remove('hidden');
      mainInterface.classList.add('hidden');
      callInterface.classList.add('hidden');

      console.log('Sesión cerrada exitosamente');
    }
  }
});
