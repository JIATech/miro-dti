/**
 * Panel de Administración - Sistema Intercom
 * Script principal para monitorización en tiempo real
 */

// Crear namespace global para administrar todas las funciones
if (!window.IntercomAdmin) {
  window.IntercomAdmin = {};
}

// Importar referencias a objetos globales
const bootstrap = window.bootstrap || {};
const Chart = window.Chart || {};
const io = window.io || {};

// Referencias a funciones de globals.js y missing-functions.js
const {
  updateLogDisplay,
  updateServiceStatus,
  updateTabletStatus,
  handleDeviceResponse,
  applyTheme,
  saveGeneralSettings,
  saveTabletsSettings,
  changeAdminPassword,
  addLog
} = window;

// Referencias a funciones de missing-functions.js
const {
  loadDashboard,
  loadTablets,
  updateTabletsList,
  showTabletDetails,
  applyFilter,
  toggleFullscreen,
  fetchServiceStatus,
  handleServiceAction,
  performServiceAction,
  showConfirmDialog,
  confirmAction,
  updateTabletCounter,
  updateStatsUI,
  formatTimeAgo,
  toggleLogsPause,
  clearLogs,
  toggleAutoScroll,
  toggleTimestamps,
  updateServicesUI,
  setupTTSControls,
  showToast
} = window;

// Estado de la aplicación
const appState = {
  logs: {
    paused: false,
    autoScroll: true,
    showTimestamps: true,
    filter: '',
    data: {
      all: [],
      pwa: [],
      signaling: [],
      mirotalksfu: [],
      tablets: [],
    },
  },
  charts: {
    calls: null,
    errors: null,
  },
  stats: {
    callsByHour: Array(24).fill(0),
    errorsByType: {},
    lastErrorTimestamp: null,
  },
  services: {
    status: {},
    lastCheck: null,
  },
  connection: {
    status: 'connecting',
    reconnectAttempts: 0,
  },
  tablets: {
    list: [],
    lastUpdate: null,
    selected: null,
  },
};

// Exponer appState globalmente
window.appState = appState;

// Límite de logs en memoria
const MAX_LOGS = 2000;

// Inicializar Socket.IO
let socket;
let toastInstance;
let confirmModal;
let currentAction = {};

// Formato de fecha y hora
function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatFullDateTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES');
}

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

function formatMemory(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return Math.round(kb) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  const gb = mb / 1024;
  return gb.toFixed(2) + ' GB';
}

// Inicializar interfaz de usuario
function initializeUI() {
  try {
    // Inicializar elementos UI
    toastInstance = new bootstrap.Toast(document.getElementById('notification-toast'));
    confirmModal = new bootstrap.Modal(document.getElementById('confirm-modal'));

    // Configurar eventos para pestañas de logs
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab) => {
      tab.addEventListener('shown.bs.tab', function () {
        if (this.getAttribute('href') === '#dashboard-tab') {
          loadDashboard();
        } else if (this.getAttribute('href') === '#tablets-tab') {
          loadTablets();
        }
      });
    });

    // Configurar botones de logs
    document.getElementById('toggle-logs-pause').addEventListener('click', toggleLogsPause);
    document.getElementById('clear-logs').addEventListener('click', clearLogs);
    document.getElementById('auto-scroll').addEventListener('change', toggleAutoScroll);
    document.getElementById('show-timestamps').addEventListener('change', toggleTimestamps);
    document.getElementById('apply-filter').addEventListener('click', applyFilter);
    document.getElementById('logs-filter').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        applyFilter();
      }
    });

    // Botones de control
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);

    // Botones de refresh
    document.getElementById('refresh-dashboard').addEventListener('click', loadDashboard);
    document.getElementById('refresh-tablets').addEventListener('click', loadTablets);
    document.getElementById('refresh-services').addEventListener('click', fetchServiceStatus);

    // Botón de confirmación
    document.getElementById('confirm-action').addEventListener('click', confirmAction);

    // Formularios
    document.getElementById('general-settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveGeneralSettings(e);
    });

    document.getElementById('tablets-settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveTabletsSettings(e);
    });

    document.getElementById('security-settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      changeAdminPassword(e);
    });

    // Delegación de eventos para botones dinámicos
    document.addEventListener('click', function (e) {
      // Botones de acciones de servicios
      if (e.target.closest('[data-action]')) {
        const element = e.target.closest('[data-action]');
        handleServiceAction(element);
      }

      // Botones de detalle de tablet
      if (e.target.closest('.view-tablet-details')) {
        const deviceName = e.target.closest('.view-tablet-details').dataset.device;
        showTabletDetails(deviceName);
      }
    });
  } catch (error) {
    console.error('Error al inicializar UI:', error);
  }
}

// Inicializar los gráficos
function initializeCharts() {
  try {
    // Configuración para Chart.js
    Chart.defaults.color = '#666';
    Chart.defaults.font.family = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

    // Gráfico de llamadas por hora
    const callsCtx = document.getElementById('calls-chart').getContext('2d');
    appState.charts.calls = new Chart(callsCtx, {
      type: 'bar',
      data: {
        labels: [...Array(24).keys()].map((h) => `${h}:00`),
        datasets: [
          {
            label: 'Llamadas',
            data: appState.stats.callsByHour,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Llamadas por hora',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });

    // Gráfico de errores por tipo
    const errorsCtx = document.getElementById('errors-chart').getContext('2d');
    appState.charts.errors = new Chart(errorsCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [
              'rgba(255, 99, 132, 0.8)',
              'rgba(54, 162, 235, 0.8)',
              'rgba(255, 206, 86, 0.8)',
              'rgba(75, 192, 192, 0.8)',
              'rgba(153, 102, 255, 0.8)',
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Errores por tipo',
          },
        },
      },
    });
  } catch (error) {
    console.error('Error al inicializar gráficos:', error);
  }
}

// Cargar datos iniciales
function loadInitialData() {
  loadDashboard();
  setupTTSControls();
}

// Conectar con Socket.IO
function connectSocket() {
  try {
    // Obtener URL del socket desde la URL actual
    const socketUrl = window.location.origin;
    
    socket = io(socketUrl, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
    });

    socket.on('connect', () => {
      updateConnectionStatus('connected');
      document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString();
      
      // Solicitar datos iniciales
      loadDashboard();
      fetchServiceStatus();
    });

    socket.on('disconnect', () => {
      updateConnectionStatus('disconnected');
    });

    socket.on('connecting', () => {
      updateConnectionStatus('connecting');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      appState.connection.reconnectAttempts = attemptNumber;
      updateConnectionStatus('reconnecting');
    });

    socket.on('reconnect_failed', () => {
      updateConnectionStatus('failed');
    });

    // Eventos específicos del servidor
    socket.on('log', handleLogMessage);
    
    socket.on('stats_update', handleStatsUpdate);
    
    socket.on('system_event', handleSystemEvent);
    
    socket.on('tablet_update', handleTabletUpdate);
    
    socket.on('service_status', (services) => {
      appState.services.status = services;
      appState.services.lastCheck = new Date();
      updateServicesUI(services);
    });
    
    socket.on('error', (error) => {
      showToast('Error', `Error en la conexión: ${error}`, 'danger');
    });
    
    socket.on('password_changed', (data) => {
      if (data.success) {
        showToast('Éxito', 'Contraseña actualizada correctamente', 'success');
        document.getElementById('security-settings-form').reset();
      } else {
        showToast('Error', `Error al cambiar contraseña: ${data.message}`, 'danger');
      }
    });
  } catch (error) {
    console.error('Error al conectar socket:', error);
  }
}

// Actualizar indicador de estado de conexión
function updateConnectionStatus(status) {
  const statusElement = document.getElementById('connection-status');
  appState.connection.status = status;
  
  // Eliminar clases existentes
  statusElement.className = 'badge';
  
  // Aplicar clase según estado
  switch (status) {
  case 'connected':
    statusElement.classList.add('bg-success');
    statusElement.textContent = 'Conectado';
    break;
  case 'disconnected':
    statusElement.classList.add('bg-danger');
    statusElement.textContent = 'Desconectado';
    break;
  case 'connecting':
    statusElement.classList.add('bg-warning');
    statusElement.textContent = 'Conectando...';
    break;
  case 'reconnecting':
    statusElement.classList.add('bg-warning');
    statusElement.textContent = `Reconectando (${appState.connection.reconnectAttempts})`;
    break;
  case 'failed':
    statusElement.classList.add('bg-danger');
    statusElement.textContent = 'Conexión fallida';
    break;
  }
}

// Manejar mensaje de log recibido
function handleLogMessage(log) {
  // Añadir timestamp si no lo tiene
  if (!log.timestamp) {
    log.timestamp = new Date();
  } else if (typeof log.timestamp === 'string') {
    log.timestamp = new Date(log.timestamp);
  }
  
  // Convertir nivel string a un valor estandarizado
  let level = log.level || (log.type === 'error' ? 'error' : 'info');
  
  // Determinar componente
  const component = log.service || log.component || 'system';
  
  // Crear objeto de log estandarizado
  const standardLog = {
    timestamp: log.timestamp,
    level,
    message: log.message,
    component,
    details: log.data || {},
  };
  
  // Agregar a la colección correcta según componente
  addLogToCollection(component, standardLog);
  
  // Siempre añadir a "all"
  addLogToCollection('all', standardLog);
  
  // Actualizar pantalla si no está pausado
  if (!appState.logs.paused) {
    updateLogDisplay(appState.logs.data.all, 'all-logs-container', appState.logs.showTimestamps);
  }
}

// Añadir log a una colección específica
function addLogToCollection(collection, log) {
  // Mapear nombres de componentes a colecciones
  const collectionMap = {
    'pwa': 'pwa',
    'signaling': 'signaling',
    'admin': 'all',
    'mirotalksfu': 'mirotalksfu',
    'tablet': 'tablets',
  };
  
  const targetCollection = collectionMap[collection] || 'all';
  
  // Añadir al principio del arreglo
  appState.logs.data[targetCollection].unshift(log);
  
  // Limitar tamaño de la colección
  if (appState.logs.data[targetCollection].length > MAX_LOGS) {
    appState.logs.data[targetCollection].pop();
  }
}

// Manejar actualización de estadísticas
function handleStatsUpdate(data) {
  // Actualizar estadísticas de llamadas por hora
  if (data.callsByHour) {
    appState.stats.callsByHour = data.callsByHour;
    
    // Actualizar gráfico
    if (appState.charts.calls) {
      appState.charts.calls.data.datasets[0].data = data.callsByHour;
      appState.charts.calls.update();
    }
  }
  
  // Actualizar estadísticas de errores por tipo
  if (data.errorsByType) {
    appState.stats.errorsByType = data.errorsByType;
    
    // Actualizar gráfico
    if (appState.charts.errors) {
      const labels = Object.keys(data.errorsByType);
      const dataValues = Object.values(data.errorsByType);
      
      appState.charts.errors.data.labels = labels;
      appState.charts.errors.data.datasets[0].data = dataValues;
      appState.charts.errors.update();
    }
  }
  
  // Actualizar última ocurrencia de error
  if (data.lastErrorTimestamp) {
    appState.stats.lastErrorTimestamp = new Date(data.lastErrorTimestamp);
  }
  
  // Actualizar contadores
  if (data.counts) {
    for (const [key, value] of Object.entries(data.counts)) {
      const element = document.getElementById(`${key}-count`);
      if (element) {
        element.textContent = value;
      }
    }
  }
  
  // Actualizar UI
  updateStatsUI();
}

// Manejar evento del sistema
function handleSystemEvent(event) {
  // Registrar en consola
  console.log('Evento del sistema:', event);
  
  switch (event.type) {
  case 'service_change': {
    // Actualizar el estado del servicio en la UI
    updateServiceStatus(event.service, event.status);
      
    // Mostrar notificación
    const statusMessage = event.status === 'running' ? 'Activo' : 
      event.status === 'stopped' ? 'Detenido' : 
        event.status === 'restarting' ? 'Reiniciando' : event.status;
      
    showToast('Estado de Servicio', `Servicio ${event.service}: ${statusMessage}`, 
      event.status === 'running' ? 'success' : 
        event.status === 'stopped' ? 'danger' : 'warning');
    break;
  }
      
  case 'tablet_change': {
    // Actualizar el estado de la tablet en la UI
    updateTabletStatus(event.deviceId, event.status);
      
    // Mostrar notificación
    showToast('Estado de Tablet', `Tablet ${event.deviceName || event.deviceId}: ${event.status}`, 
      event.status === 'online' ? 'success' : 'warning');
    break;
  }
      
  case 'update_available': {
    // Mostrar notificación de actualización disponible
    showToast('Actualización', `Nueva actualización disponible: v${event.version}`, 'info');
    break;
  }
  }
}

// Manejar actualización de tablet
function handleTabletUpdate(data) {
  // Buscar si la tablet ya existe
  const existingIndex = appState.tablets.list.findIndex(tablet => tablet.deviceId === data.deviceId);
  
  if (existingIndex >= 0) {
    // Actualizar la tablet existente
    appState.tablets.list[existingIndex] = {
      ...appState.tablets.list[existingIndex],
      ...data,
      lastContact: new Date()
    };
  } else {
    // Agregar una nueva tablet
    appState.tablets.list.push({
      ...data,
      lastContact: new Date()
    });
  }
  
  // Actualizar timestamp de última actualización
  appState.tablets.lastUpdate = new Date();
  
  // Actualizar la UI
  updateTabletsList();
  
  // Si está seleccionada, actualizar los detalles
  if (appState.tablets.selected === data.deviceId) {
    showTabletDetails(data.deviceId);
  }
  
  // Si hay un cambio significativo, mostrar una notificación
  if (data.status === 'online' && (existingIndex < 0 || appState.tablets.list[existingIndex].status !== 'online')) {
    showToast('Tablet Conectada', `${data.deviceName || data.deviceId} está en línea`, 'success');
  } else if (data.status === 'offline' && (existingIndex >= 0 && appState.tablets.list[existingIndex].status !== 'offline')) {
    showToast('Tablet Desconectada', `${data.deviceName || data.deviceId} está fuera de línea`, 'warning');
  }
}

// Exponer funciones al contexto global para que sean accesibles desde otros scripts
window.IntercomAdmin = {
  initializeUI,
  initializeCharts,
  loadInitialData,
  connectSocket,
  handleLogMessage,
  addLogToCollection,
  handleStatsUpdate,
  handleSystemEvent,
  handleTabletUpdate,
  updateConnectionStatus,
  formatDateTime,
  formatFullDateTime,
  formatUptime,
  formatMemory
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar interfaz
  initializeUI();
  
  // Inicializar gráficos
  initializeCharts();
  
  // Cargar datos iniciales
  loadInitialData();
  
  // Conectar con Socket.IO
  connectSocket();
  
  // Aplicar tema según preferencia guardada
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
});
