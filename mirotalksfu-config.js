'use strict';

const dotenv = require('dotenv').config();
const packageJson = require('../../package.json');

const os = require('os');
const fs = require('fs');

const PLATFORM = os.platform();
const IS_DOCKER = fs.existsSync('/.dockerenv');

// ###################################################################################################
const ENVIRONMENT = process.env.NODE_ENV || 'production'; // Cambiado a production por defecto

// ============== CONFIGURACIÓN FALLBACK SFU ==============
// Configuración del servidor local (dentro del edificio)
const LOCAL_SFU_ENABLED = process.env.LOCAL_SFU_ENABLED === 'true' || true;
const LOCAL_SFU_IP = process.env.LOCAL_SFU_IP || ''; // IP del servidor local
const LOCAL_SFU_PORT = parseInt(process.env.LOCAL_SFU_PORT) || 8080;
const LOCAL_SFU_LISTEN_IP = process.env.LOCAL_SFU_LISTEN_IP || '0.0.0.0';
const LOCAL_SFU_MIN_PORT = parseInt(process.env.LOCAL_SFU_MIN_PORT) || 40000;
const LOCAL_SFU_MAX_PORT = parseInt(process.env.LOCAL_SFU_MAX_PORT) || 50000;

// Configuración del servidor de fallback (internet)
const FALLBACK_SFU_ENABLED = process.env.FALLBACK_SFU_ENABLED === 'true' || true;
const FALLBACK_SFU_IP = process.env.FALLBACK_SFU_IP || ''; // IP/dominio del servidor fallback
const FALLBACK_SFU_PORT = parseInt(process.env.FALLBACK_SFU_PORT) || 8080;
const FALLBACK_SFU_LISTEN_IP = process.env.FALLBACK_SFU_LISTEN_IP || '0.0.0.0';
const FALLBACK_SFU_MIN_PORT = parseInt(process.env.FALLBACK_SFU_MIN_PORT) || 40000;
const FALLBACK_SFU_MAX_PORT = parseInt(process.env.FALLBACK_SFU_MAX_PORT) || 50000;

// Configuración del mecanismo de fallback
const FALLBACK_TIMEOUT_MS = parseInt(process.env.FALLBACK_TIMEOUT_MS) || 5000;
const FALLBACK_MAX_RETRIES = parseInt(process.env.FALLBACK_MAX_RETRIES) || 3;

// Configuración activa para este servidor
// Nota: En producción, esta configuración inicial se utiliza,
// pero la PWA determinará dinámicamente cuál servidor usar
const PUBLIC_IP = process.env.SFU_PUBLIC_IP || LOCAL_SFU_IP || '';
const LISTEN_IP = process.env.SFU_LISTEN_IP || LOCAL_SFU_LISTEN_IP;
const RTC_MIN_PORT = parseInt(process.env.SFU_MIN_PORT) || LOCAL_SFU_MIN_PORT;
const RTC_MAX_PORT = parseInt(process.env.SFU_MAX_PORT) || LOCAL_SFU_MAX_PORT;
const IPv4 = getIPv4(); // Determina la dirección IPv4 apropiada según el entorno
// ============================================================

// Configuramos los workers para optimizar el rendimiento
const NUM_CPUS = os.cpus().length;
const NUM_WORKERS = Math.min(process.env.SFU_NUM_WORKERS || NUM_CPUS, NUM_CPUS);

// RTMP usando FFMPEG para streaming...
const FFMPEG_PATH = process.env.FFMPEG_PATH || getFFmpegPath(PLATFORM);

module.exports = {
  // Configuración del sistema de fallback para que la PWA pueda elegir entre servidores
  fallback: {
    local: {
      enabled: LOCAL_SFU_ENABLED,
      ip: LOCAL_SFU_IP,
      port: LOCAL_SFU_PORT,
      listenIp: LOCAL_SFU_LISTEN_IP,
      minPort: LOCAL_SFU_MIN_PORT,
      maxPort: LOCAL_SFU_MAX_PORT,
    },
    internet: {
      enabled: FALLBACK_SFU_ENABLED,
      ip: FALLBACK_SFU_IP,
      port: FALLBACK_SFU_PORT,
      listenIp: FALLBACK_SFU_LISTEN_IP,
      minPort: FALLBACK_SFU_MIN_PORT,
      maxPort: FALLBACK_SFU_MAX_PORT,
    },
    settings: {
      timeoutMs: FALLBACK_TIMEOUT_MS,
      maxRetries: FALLBACK_MAX_RETRIES,
      currentMode: 'local', // Modo inicial (local o internet)
    },
  },
  services: {
    ip: ['http://api.ipify.org', 'http://ipinfo.io/ip', 'http://ifconfig.me/ip'],
  },
  systemInfo: {
    os: {
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0].model,
    },
    memory: {
      total: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    },
    isDocker: IS_DOCKER,
  },
  console: {
    timeZone: 'America/Argentina/Buenos_Aires', // Configuración para Argentina
    debug: false, // Deshabilitado en producción
    colors: true,
  },
  server: {
    hostUrl: '', // Se configurará automáticamente
    listen: {
      ip: '0.0.0.0',
      port: process.env.SFU_PORT || 8080, // Puerto para MiroTalkSFU
    },
    trustProxy: true, // Habilitado para trabajar detrás de un proxy
    ssl: {
      cert: process.env.SSL_CERT || '../ssl/cert.pem',
      key: process.env.SSL_KEY || '../ssl/key.pem',
    },
    cors: {
      origin: '*', // Permitir todas las conexiones
      methods: ['GET', 'POST'],
    },
    recording: {
      enabled: false, // Sin grabación por defecto
      endpoint: '',
      dir: 'rec',
      maxFileSize: 1 * 1024 * 1024 * 1024, // 1 GB
    },
    rtmp: {
      enabled: false, // Deshabilitado por defecto
      fromFile: false,
      fromUrl: false,
      fromStream: false,
      maxStreams: 1,
      server: 'rtmp://localhost:1935',
      appName: 'mirotalk',
      streamKey: '',
      secret: 'mirotalkRtmpSecret',
      apiSecret: 'mirotalkRtmpApiSecret',
      expirationHours: 4,
      dir: 'rtmp',
      ffmpegPath: FFMPEG_PATH,
      platform: PLATFORM,
    },
  },
  middleware: {
    IpWhitelist: {
      enabled: false, // Sin restricción de IP
      allowed: ['127.0.0.1', '::1'],
    },
  },
  api: {
    keySecret: process.env.API_KEY_SECRET || 'mirotalksfu_default_secret',
    allowed: {
      stats: true,
      meetings: true,
      meeting: true,
      join: true,
      token: true, // Habilitado para usar autenticación
      slack: false, // Deshabilitamos servicios no necesarios
      mattermost: false,
    },
  },
  jwt: {
    key: process.env.JWT_KEY || 'intercom_jwt_secret',
    exp: process.env.JWT_EXPIRATION || '365d', // 1 año para evitar relogueos frecuentes
  },
  oidc: {
    enabled: false, // Sin OpenID Connect
    baseURLDynamic: false,
    peer_name: {
      force: true,
      email: true,
      name: false,
    },
    config: {
      issuerBaseURL: 'https://server.example.com',
      baseURL: `http://localhost:${process.env.SFU_PORT ? process.env.SFU_PORT : 8080}`,
      clientID: 'clientID',
      clientSecret: 'clientSecret',
      secret: 'mirotalksfu-oidc-secret',
      authorizationParams: {
        response_type: 'code',
        scope: 'openid profile email',
      },
      routes: {
        login: false,
        logout: false,
        callback: false,
      },
    },
  },
  host: {
    protected: true, // Habilitamos protección para salas
    user_auth: true, // Requiere autenticación de usuario
    users: [
      {
        username: 'administracion',
        password: 'admin1234',
        displayname: 'Administración',
        allowed_rooms: ['*'],
      },
      {
        username: 'portero',
        password: 'portero1234',
        displayname: 'Portero',
        allowed_rooms: ['*'],
      },
      {
        username: 'sistemas',
        password: 'sistemas1234',
        displayname: 'Sistemas',
        allowed_rooms: ['*'],
      },
      {
        username: 'soporte',
        password: 'soporte1234',
        displayname: 'Soporte',
        allowed_rooms: ['*'],
      },
      {
        username: 'infraestructura',
        password: 'infra1234',
        displayname: 'Infraestructura',
        allowed_rooms: ['*'],
      },
    ],
  },
  presenters: {
    list: [],
  },
  room: {
    defaultLobby: true, // Sala de espera por defecto
    defaultName: 'intercom', // Nombre por defecto
    defaultPassword: false, // Sin contraseña por defecto
    maxPeers: 10, // Reducimos el número de participantes
    maxVideoQuality: 2160, // Calidad máxima soportada (4K)
  },
  survey: {
    enabled: false, // Sin encuestas
    url: '',
  },
  slack: {
    enabled: false,
    channelId: '',
    botToken: '',
  },
  chatGPT: {
    enabled: false, // Sin ChatGPT
    basePath: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    max_tokens: 1000,
    temperature: 0.2,
    delay_ms: 3000,
  },
  videoAI: {
    enabled: false, // Sin VideoAI
    apiKey: '',
    endpoint: 'https://api.d-id.com',
    sessionHistory: 10,
    max_tokens: 8192,
    temperature: 0.7,
    topP: 0.8,
    delay_ms: 3000,
  },
  discord: {
    enabled: false, // Sin Discord
    webhookURL: '',
  },
  stats: {
    enabled: false, // Sin estadísticas de uso
    src: '',
    id: '',
  },
  mediasoup: {
    // Configuración de WorkerSettings para WebRTC
    worker: {
      rtcMinPort: RTC_MIN_PORT,
      rtcMaxPort: RTC_MAX_PORT,
      logLevel: 'error',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    },
    // Configuración de WebRtcServerOptions
    webRtcServerActive: true, // Para mejor rendimiento
    webRtcTransport: {
      listenIps: [
        {
          ip: LISTEN_IP, // Default '0.0.0.0'
          announcedIp: PUBLIC_IP, // Determinar IP pública
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
    },
  },
  // Configuración avanzada de la interfaz
  ui: {
    loader: {
      welcome: 'Sistema Intercom',
      message: 'Bienvenido al sistema de comunicación interna',
    },
    lobby: {
      title: 'Sala de Espera',
      message: 'Su llamada está siendo procesada, por favor espere a que le atiendan.',
      watermark: true,
      avatar: true,
    },
    survey: {
      enabled: false,
    },
    main: {
      title: 'Sistema Intercom',
      logo: null,
      background: null,
      waveEffect: true,
      buttons: {
        main: {
          shareButton: false, // Deshabilitamos compartir
          hideMeButton: true,
          startAudioButton: true,
          startVideoButton: true,
          startScreenButton: false, // Deshabilitamos compartir pantalla
          startRecButton: false, // Deshabilitamos grabación
          closeTabButton: true,
          raiseHandButton: true,
          chatButton: true,
          chatEmojiButton: true,
          chatMarkdownButton: false, // Simplified chat
          chatFileButton: false, // Deshabilitamos archivos
          mySettingsButton: true,
          participantsButton: true,
          moreButton: true,
          aboutButton: false, // Deshabilitamos información
          toggleLobby: true,
        },
        settings: {
          lockRoomButton: true,
          unlockRoomButton: true,
          lobbyEnabledButton: true,
          lobbyDisabledButton: true,
        },
        producerVideo: {
          videoPictureInPicture: false, // Deshabilitamos PiP
          fullScreenButton: true,
          snapShotButton: false, // Deshabilitamos snapshots
          muteAudioButton: true,
          hideVideoButton: true,
          sendFileButton: false, // Deshabilitamos envío archivos
          sendMessageButton: true,
          sendVideoButton: false, // Deshabilitamos envío videos
          kickOutButton: true,
          ejectButton: true,
        },
        consumerVideo: {
          videoPictureInPicture: false, // Deshabilitamos PiP
          fullScreenButton: true,
          snapShotButton: false, // Deshabilitamos snapshots
          sendFileButton: false, // Deshabilitamos envío archivos
          sendMessageButton: true,
          sendVideoButton: false, // Deshabilitamos envío videos
          muteVideoAudioButton: true,
          muteVideoButton: true,
          raiseHandButton: true,
          ejectButton: true,
        },
      },
    },
    chat: {
      public: true,
      private: true,
    },
    thereCanBeOnlyOneProducer: true, // De un tipo a la vez
    speechRecognition: {
      enabled: false, // Sin reconocimiento de voz
      lang: 'es-ES', // Español de España
    },
    html: {
      image: null,
      message: null,
    },
  },
};

// Determines the appropriate IPv4 address based on environment and configuration
// Priority order:
// 1. Explicitly configured PUBLIC_IP (if set)
// 2. Environment-specific detection
//
// @returns {string} The selected IPv4 address
function getIPv4() {
  if (PUBLIC_IP) {
    return PUBLIC_IP;
  }

  if (ENVIRONMENT === 'production') {
    // In production we don't want to try internal IPs
    return PUBLIC_IP || '0.0.0.0';
  }

  // Otherwise return the first local non-internal IP address
  const ip = getLocalIPv4();
  return ip || PUBLIC_IP || '0.0.0.0';
}

// Retrieves the most suitable local IPv4 address by:
// 1. Checking platform-specific priority interfaces first (Ethernet/Wi-Fi)
// 2. Falling back to scanning all non-virtual interfaces
// 3. Excluding APIPA (169.254.x.x) and internal/virtual addresses
//
// @returns {string} Valid IPv4 address or '0.0.0.0' if none found
function getLocalIPv4() {
  const ifaces = os.networkInterfaces();
  const excludes = [
    'VMware',
    'VirtualBox',
    'Hyper-V',
    'Docker',
    'WSL',
    'Loopback',
    'Pseudo-Interface',
    'vEthernet',
    'VPN',
    'WSL',
    'npcap',
    'wsl',
  ];

  // Platform-specific interfaces with priority
  switch (PLATFORM) {
    case 'win32': {
      // On Windows, Ethernet and Wi-Fi interfaces are prioritized
      const ethOrWifi = Object.keys(ifaces).find(
        (iface) =>
          !excludes.some((exclude) => iface.includes(exclude)) &&
          (iface.toLowerCase().includes('ethernet') || iface.toLowerCase().includes('wi-fi')) &&
          ifaces[iface].some(
            (addr) =>
              addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')
          )
      );

      if (ethOrWifi) {
        const addr = findValidAddress(ifaces[ethOrWifi]);
        if (addr) return addr;
      }
      break;
    }

    case 'darwin': {
      // On macOS, en0 is typically the built-in Ethernet/Wi-Fi
      if (ifaces.en0) {
        const addr = findValidAddress(ifaces.en0);
        if (addr) return addr;
      }
      break;
    }

    case 'linux': {
      // On Linux, eth0 or ens160 are common for primary Ethernet, wlan0 for Wi-Fi
      const commonInterfaces = ['eth0', 'ens160', 'ens192', 'wlan0', 'enp0s'];
      for (const ifname of commonInterfaces) {
        const iface = Object.keys(ifaces).find((name) => name.startsWith(ifname));
        if (iface && ifaces[iface]) {
          const addr = findValidAddress(ifaces[iface]);
          if (addr) return addr;
        }
      }
      break;
    }
  }

  // Fallback to scanning all interfaces
  return scanAllInterfaces(ifaces, excludes);
}

// Scans all non-virtual interfaces for valid IPv4 addresses
// @param {Object} ifaces - Network interfaces from os.networkInterfaces()
// @param {string[]} excludes - Virtual interface prefixes to ignore
// @returns {string|null} First valid IPv4 address found
function scanAllInterfaces(ifaces, excludes) {
  for (const [name, addrs] of Object.entries(ifaces)) {
    // Skip virtual interfaces
    if (excludes.some((exclude) => name.includes(exclude))) {
      continue;
    }

    // Find first valid address
    const addr = findValidAddress(addrs);
    if (addr) return addr;
  }

  // Nothing found
  return null;
}

// Validates a network address as:
// - IPv4 family
// - Non-internal (not loopback)
// - Non-APIPA (not 169.254.x.x)
// @param {Object[]} addresses - Network interface addresses
// @returns {string|undefined} Valid address or undefined
function findValidAddress(addresses) {
  return addresses.find(
    (addr) => addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')
  )?.address;
}

// Finds the appropriate FFmpeg executable path for the current platform
//
// @param {string} platform - The Node.js process.platform value (darwin, linux, win32)
// @returns {string} The first valid FFmpeg path found, or the default path for the platform
//
// @description
// This function handles FFmpeg path detection across different operating systems.
// It checks common installation locations and returns the first accessible path.
// If no valid path is found, it returns the first default path for the platform.
function getFFmpegPath(platform) {
  const ffmpegPaths = [];

  switch (platform) {
    case 'darwin': // macOS
      ffmpegPaths.push('/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg');
      break;
    case 'linux': // Linux
      ffmpegPaths.push('/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/ffmpeg/bin/ffmpeg');
      break;
    case 'win32': // Windows
      ffmpegPaths.push(
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
        'ffmpeg'
      );
      break;
    default:
      ffmpegPaths.push('ffmpeg');
  }

  // Check each path to see if it exists
  for (const path of ffmpegPaths) {
    try {
      // Basic check with fs.accessSync for file existence
      fs.accessSync(path, fs.constants.F_OK);
      return path;
    } catch (error) {
      // Path not found, continue to next path
      continue;
    }
  }

  // If no valid path found, return the default for this platform
  return ffmpegPaths[0];
}
