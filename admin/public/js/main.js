/**
 * Panel de Administración - Sistema Intercom
 * Script principal para monitorización en tiempo real
 */

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
            tablets: []
        }
    },
    charts: {
        calls: null,
        errors: null
    },
    stats: {
        callsByHour: Array(24).fill(0),
        errorsByType: {},
        lastErrorTimestamp: null
    },
    services: {
        status: {},
        lastCheck: null
    },
    connection: {
        status: 'connecting',
        reconnectAttempts: 0
    },
    tablets: {
        list: [],
        lastUpdate: null,
        selected: null
    }
};

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
        second: '2-digit'
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
    // Inicializar elementos UI
    toastInstance = new bootstrap.Toast(document.getElementById('notification-toast'));
    confirmModal = new bootstrap.Modal(document.getElementById('confirm-modal'));
    
    // Configurar eventos para pestañas de logs
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function() {
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
    document.getElementById('logs-filter').addEventListener('keypress', function(e) {
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
    document.getElementById('general-settings-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveGeneralSettings();
    });
    
    document.getElementById('tablets-settings-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveTabletsSettings();
    });
    
    document.getElementById('security-settings-form').addEventListener('submit', function(e) {
        e.preventDefault();
        changeAdminPassword(e);
    });
    
    // Delegación de eventos para botones dinámicos
    document.addEventListener('click', function(e) {
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
}

// Inicializar los gráficos
function initializeCharts() {
    // Configuración para Chart.js
    Chart.defaults.color = '#666';
    Chart.defaults.font.family = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    
    // Gráfico de llamadas por hora
    const callsCtx = document.getElementById('calls-chart').getContext('2d');
    appState.charts.calls = new Chart(callsCtx, {
        type: 'bar',
        data: {
            labels: [...Array(24).keys()].map(h => `${h}:00`),
            datasets: [{
                label: 'Llamadas',
                data: appState.stats.callsByHour,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Llamadas por hora'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // Gráfico de errores por tipo
    const errorsCtx = document.getElementById('errors-chart').getContext('2d');
    appState.charts.errors = new Chart(errorsCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Errores por Tipo'
                }
            }
        }
    });
}

// Cargar datos iniciales
function loadInitialData() {
    fetchServiceStatus();
    fetchSystemStats();
    loadDashboard();
}

// Conectar con Socket.IO
function connectSocket() {
    // Configurar reconexión 
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000; // 3 segundos
    
    // Función para intentar reconexión
    function attemptReconnect() {
        if (appState.connection.reconnectAttempts < maxReconnectAttempts) {
            appState.connection.reconnectAttempts++;
            updateConnectionStatus('reconnecting');
            
            setTimeout(() => {
                console.log(`Intento de reconexión ${appState.connection.reconnectAttempts}`);
                socket.connect();
            }, reconnectInterval);
        } else {
            updateConnectionStatus('disconnected');
            showToast('Error de Conexión', 'No se pudo conectar al servidor. Por favor, recarga la página.', 'error');
        }
    }
    
    // Inicializar Socket.IO
    socket = io();
    
    // Eventos de conexión
    socket.on('connect', () => {
        updateConnectionStatus('connected');
        appState.connection.reconnectAttempts = 0;
        console.log('Conectado al servidor:', socket.id);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Desconectado:', reason);
        updateConnectionStatus('disconnected');
        
        if (reason === 'io server disconnect') {
            // Reconectar si el servidor cerró la conexión
            socket.connect();
        } else {
            // Otros errores de conexión
            attemptReconnect();
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('Error de conexión:', error);
        attemptReconnect();
    });
    
    // Eventos de logs y actualizaciones
    socket.on('log', handleLogMessage);
    socket.on('stats', handleStatsUpdate);
    socket.on('system', handleSystemEvent);
    socket.on('tablet:update', handleTabletUpdate);
}

// Actualizar indicador de estado de conexión
function updateConnectionStatus(status) {
    appState.connection.status = status;
    
    const statusEl = document.getElementById('connection-status');
    statusEl.className = 'badge';
    
    switch (status) {
        case 'connected':
            statusEl.classList.add('bg-success');
            statusEl.textContent = 'Conectado';
            break;
        case 'disconnected':
            statusEl.classList.add('bg-danger');
            statusEl.textContent = 'Desconectado';
            break;
        case 'reconnecting':
            statusEl.classList.add('bg-warning');
            statusEl.textContent = 'Reconectando...';
            break;
        default:
            statusEl.classList.add('bg-secondary');
            statusEl.textContent = 'Desconocido';
    }
}

// Manejar mensaje de log recibido
function handleLogMessage(log) {
    if (appState.logs.paused) return;
    
    // Asegurarse de que el log tiene un timestamp
    if (!log.timestamp) {
        log.timestamp = new Date();
    } else if (typeof log.timestamp === 'string') {
        log.timestamp = new Date(log.timestamp);
    }
    
    // Verificar el servicio y añadir a la colección correspondiente
    if (log.service === 'pwa') {
        addLogToCollection('pwa', log);
    } else if (log.service === 'signaling') {
        addLogToCollection('signaling', log);
    } else if (log.service === 'mirotalksfu') {
        addLogToCollection('mirotalksfu', log);
    } else if (log.service === 'tablet') {
        addLogToCollection('tablets', log);
    }
    
    // Añadir a la colección general
    addLogToCollection('all', log);
    
    // Actualizar la visualización
    updateLogDisplay();
}

// Añadir log a una colección específica
function addLogToCollection(collection, log) {
    // Clonar para evitar referencias cruzadas
    const logCopy = { ...log };
    
    // Añadir al principio y limitar el tamaño máximo
    appState.logs.data[collection].unshift(logCopy);
    
    // Limitar el número de logs en memoria
    if (appState.logs.data[collection].length > MAX_LOGS) {
        appState.logs.data[collection] = appState.logs.data[collection].slice(0, MAX_LOGS);
    }
}

// Manejar actualización de estadísticas
function handleStatsUpdate(data) {
    console.log('Actualización de estadísticas recibida:', data);
    
    // Actualizar estadísticas de llamadas
    if (data.calls && Array.isArray(data.calls)) {
        appState.stats.callsByHour = data.calls;
        
        // Actualizar gráfico si existe
        if (appState.charts.calls) {
            appState.charts.calls.data.datasets[0].data = data.calls;
            appState.charts.calls.update();
        }
    }
    
    // Actualizar estadísticas de errores
    if (data.errors) {
        appState.stats.errorsByType = data.errors;
        appState.stats.lastErrorTimestamp = data.lastErrorTimestamp;
        
        // Actualizar gráfico si existe
        if (appState.charts.errors) {
            const labels = Object.keys(data.errors);
            const values = Object.values(data.errors);
            
            appState.charts.errors.data.labels = labels;
            appState.charts.errors.data.datasets[0].data = values;
            appState.charts.errors.update();
        }
        
        // Actualizar contador de errores en la interfaz
        const errorCountElement = document.getElementById('error-count');
        if (errorCountElement) {
            const totalErrors = values ? values.reduce((sum, val) => sum + val, 0) : 0;
            errorCountElement.textContent = totalErrors;
        }
    }
    
    // Actualizar elementos de la interfaz que muestran estadísticas
    updateStatsUI();
}

// Manejar evento del sistema
function handleSystemEvent(event) {
    console.log('Evento del sistema recibido:', event);
    
    // Registrar como log
    handleLogMessage({
        service: 'system',
        level: event.level || 'info',
        message: event.message,
        timestamp: event.timestamp || new Date()
    });
    
    // Actualizar UI según el tipo de evento
    switch (event.type) {
        case 'service_status':
            updateServiceStatus(event.data);
            break;
        case 'alert':
            showToast(event.title || 'Alerta del Sistema', event.message, event.level || 'warning');
            break;
        case 'tablet_connected':
        case 'tablet_disconnected':
            updateTabletStatus(event.data);
            break;
        case 'settings_updated':
            showToast('Configuración Actualizada', 'La configuración del sistema ha sido actualizada', 'info');
            break;
        default:
            // No hacer nada para otros tipos de eventos
            break;
    }
}

// Manejar actualización de tablet
function handleTabletUpdate(data) {
    console.log('Actualización de tablet recibida:', data);
    
    // Verificar si la tablet ya existe en la lista
    const tabletIndex = appState.tablets.list.findIndex(t => t.deviceId === data.deviceId);
    
    // Si existe, actualizar sus datos
    if (tabletIndex !== -1) {
        appState.tablets.list[tabletIndex] = {
            ...appState.tablets.list[tabletIndex],
            ...data,
            lastUpdate: new Date()
        };
    } else {
        // Si no existe, añadirla a la lista
        appState.tablets.list.push({
            ...data,
            lastUpdate: new Date()
        });
    }
    
    // Actualizar timestamp de última actualización
    appState.tablets.lastUpdate = new Date();
    
    // Si estamos en la página de tablets, actualizar la vista
    if (document.querySelector('a[href="#tablets-tab"]').classList.contains('active')) {
        loadTablets();
    }
    
    // Si esta tablet está seleccionada actualmente, actualizar detalles
    if (appState.tablets.selected === data.deviceId) {
        showTabletDetails(data.deviceId);
    }
    
    // Actualizar contador de tablets en la interfaz
    updateTabletCounter();
}

// Cargar los datos del dashboard
function loadDashboard() {
    // Actualizar fecha y hora de última actualización
    document.getElementById('last-update-time').textContent = formatFullDateTime(new Date());
    
    // Actualizar contadores
    updateTabletCounter();
    updateStatsUI();
    
    // Petición al servidor para actualizar estadísticas
    fetch('/api/dashboard/stats')
        .then(response => response.json())
        .then(data => {
            console.log('Estadísticas del dashboard cargadas:', data);
            handleStatsUpdate(data);
        })
        .catch(error => {
            console.error('Error al cargar estadísticas del dashboard:', error);
            showToast('Error', 'No se pudieron cargar las estadísticas', 'error');
        });
}

// Cargar los datos de tablets
function loadTablets() {
    const tabletsList = document.getElementById('tablets-list');
    const loadingIndicator = document.getElementById('tablets-loading');
    const emptyState = document.getElementById('tablets-empty-state');
    
    // Mostrar indicador de carga
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (tabletsList) tabletsList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    
    // Petición al servidor para actualizar lista de tablets
    fetch('/api/tablets')
        .then(response => response.json())
        .then(data => {
            console.log('Datos de tablets cargados:', data);
            
            // Actualizar lista en el estado
            appState.tablets.list = data.map(tablet => ({
                ...tablet,
                lastUpdate: new Date(tablet.lastUpdate || Date.now())
            }));
            
            // Actualizar UI
            updateTabletsList();
            
            // Esconder indicador de carga
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            // Mostrar lista o estado vacío según corresponda
            if (appState.tablets.list.length > 0) {
                if (tabletsList) tabletsList.style.display = 'block';
                if (emptyState) emptyState.style.display = 'none';
            } else {
                if (tabletsList) tabletsList.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error al cargar lista de tablets:', error);
            showToast('Error', 'No se pudo cargar la lista de tablets', 'error');
            
            // Esconder indicador de carga y mostrar estado vacío
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (tabletsList) tabletsList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        });
}

// Actualizar la lista de tablets en la interfaz
function updateTabletsList() {
    const tabletsList = document.getElementById('tablets-list');
    if (!tabletsList) return;
    
    // Limpiar lista actual
    tabletsList.innerHTML = '';
    
    // Ordenar tablets por estado (conectados primero) y luego por nombre
    const sortedTablets = [...appState.tablets.list].sort((a, b) => {
        if (a.online !== b.online) {
            return a.online ? -1 : 1; // Conectados primero
        }
        return a.deviceName.localeCompare(b.deviceName); // Luego por nombre
    });
    
    // Iterar sobre la lista ordenada y crear elementos para cada tablet
    sortedTablets.forEach(tablet => {
        const tabletCard = document.createElement('div');
        tabletCard.className = 'card mb-3 shadow-sm';
        
        // Añadir clase de estado
        if (tablet.online) {
            tabletCard.classList.add('border-success');
        } else {
            tabletCard.classList.add('border-secondary');
        }
        
        // Determinar el ícono de rol
        let roleIcon = 'bi-tablet';
        if (tablet.role === 'portero') {
            roleIcon = 'bi-door-open';
        } else if (tablet.role === 'admin') {
            roleIcon = 'bi-person-badge';
        }
        
        // Calcular tiempo desde la última conexión
        const lastSeen = tablet.lastSeen ? new Date(tablet.lastSeen) : null;
        const timeAgo = lastSeen ? formatTimeAgo(lastSeen) : 'Nunca';
        
        // Construir contenido de la tarjeta
        const cardContent = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                    <i class="bi ${roleIcon} me-2"></i>
                    <strong>${tablet.deviceName}</strong>
                </div>
                <span class="badge ${tablet.online ? 'bg-success' : 'bg-secondary'}">
                    ${tablet.online ? 'Online' : 'Offline'}
                </span>
            </div>
            <div class="card-body">
                <div class="d-flex justify-content-between">
                    <div>
                        <p class="mb-1"><small>Rol: <span class="badge bg-info">${tablet.role || 'No definido'}</span></small></p>
                        <p class="mb-1"><small>IP: ${tablet.ip || 'Desconocida'}</small></p>
                        <p class="mb-0"><small>Última actividad: ${timeAgo}</small></p>
                    </div>
                    <div class="text-end">
                        <p class="mb-1"><small>Batería: ${tablet.battery ? tablet.battery + '%' : 'N/A'}</small></p>
                        <p class="mb-1"><small>Versión: ${tablet.version || 'Desconocida'}</small></p>
                        <p class="mb-0"><small>Llamadas: ${tablet.callCount || 0}</small></p>
                    </div>
                </div>
            </div>
            <div class="card-footer d-flex justify-content-between align-items-center bg-light">
                <small class="text-muted">ID: ${tablet.deviceId}</small>
                <div>
                    <button class="btn btn-sm btn-primary view-tablet-details" data-device="${tablet.deviceId}">
                        <i class="bi bi-info-circle me-1"></i> Detalles
                    </button>
                    <button class="btn btn-sm btn-outline-secondary ms-1" data-action="ping-tablet" data-device="${tablet.deviceId}">
                        <i class="bi bi-arrow-repeat me-1"></i> Ping
                    </button>
                </div>
            </div>
        `;
        
        // Establecer contenido de la tarjeta
        tabletCard.innerHTML = cardContent;
        
        // Añadir a la lista
        tabletsList.appendChild(tabletCard);
    });
}

// Mostrar detalles de una tablet específica
function showTabletDetails(deviceId) {
    // Buscar la tablet en la lista
    const tablet = appState.tablets.list.find(t => t.deviceId === deviceId);
    if (!tablet) {
        showToast('Error', 'No se encontró la tablet especificada', 'error');
        return;
    }
    
    // Actualizar tablet seleccionada
    appState.tablets.selected = deviceId;
    
    // Obtener el modal
    const modal = new bootstrap.Modal(document.getElementById('tablet-details-modal'));
    
    // Actualizar contenido del modal
    document.getElementById('tablet-details-title').textContent = tablet.deviceName;
    
    // Completar información básica
    document.getElementById('tablet-details-id').textContent = tablet.deviceId;
    document.getElementById('tablet-details-role').textContent = tablet.role || 'No definido';
    document.getElementById('tablet-details-status').textContent = tablet.online ? 'Online' : 'Offline';
    document.getElementById('tablet-details-status').className = `badge ${tablet.online ? 'bg-success' : 'bg-secondary'}`;
    document.getElementById('tablet-details-ip').textContent = tablet.ip || 'Desconocida';
    document.getElementById('tablet-details-version').textContent = tablet.version || 'Desconocida';
    
    // Información de hardware si está disponible
    if (tablet.hardware) {
        document.getElementById('tablet-details-hw-info').style.display = 'block';
        document.getElementById('tablet-details-device-model').textContent = tablet.hardware.model || 'Desconocido';
        document.getElementById('tablet-details-os-version').textContent = tablet.hardware.osVersion || 'Desconocido';
        document.getElementById('tablet-details-screen').textContent = `${tablet.hardware.screenWidth || '?'} × ${tablet.hardware.screenHeight || '?'}`;
        document.getElementById('tablet-details-storage').textContent = tablet.hardware.storage ? 
            `${Math.round(tablet.hardware.storage.used / (1024*1024))}/${Math.round(tablet.hardware.storage.total / (1024*1024))} MB` : 
            'Desconocido';
    } else {
        document.getElementById('tablet-details-hw-info').style.display = 'none';
    }
    
    // Información de rendimiento si está disponible
    if (tablet.performance) {
        document.getElementById('tablet-details-perf-info').style.display = 'block';
        document.getElementById('tablet-details-cpu').textContent = `${tablet.performance.cpu || 0}%`;
        document.getElementById('tablet-details-memory').textContent = tablet.performance.memory ? 
            `${Math.round(tablet.performance.memory.used / (1024*1024))}/${Math.round(tablet.performance.memory.total / (1024*1024))} MB` : 
            'Desconocido';
        document.getElementById('tablet-details-battery').textContent = tablet.performance.battery ? 
            `${tablet.performance.battery}% ${tablet.performance.charging ? '(Cargando)' : ''}` : 
            'Desconocido';
        document.getElementById('tablet-details-network').textContent = tablet.performance.network || 'Desconocido';
    } else {
        document.getElementById('tablet-details-perf-info').style.display = 'none';
    }
    
    // Estadísticas de uso
    document.getElementById('tablet-details-calls').textContent = tablet.stats?.callCount || 0;
    document.getElementById('tablet-details-connected').textContent = tablet.stats?.connectedTime ? 
        formatUptime(tablet.stats.connectedTime) : 
        'Desconocido';
    document.getElementById('tablet-details-last-call').textContent = tablet.stats?.lastCall ? 
        formatFullDateTime(new Date(tablet.stats.lastCall)) : 
        'Nunca';
    document.getElementById('tablet-details-errors').textContent = tablet.stats?.errorCount || 0;
    
    // Mostrar el modal
    modal.show();
}

// Actualizar el contador de tablets
function updateTabletCounter() {
    const onlineCount = appState.tablets.list.filter(t => t.online).length;
    const totalCount = appState.tablets.list.length;
    
    // Actualizar en la interfaz
    const tabletCountElement = document.getElementById('tablet-count');
    if (tabletCountElement) {
        tabletCountElement.textContent = `${onlineCount}/${totalCount}`;
    }
    
    // Actualizar badge de estado global
    const tabletStatusBadge = document.getElementById('tablet-status-badge');
    if (tabletStatusBadge) {
        tabletStatusBadge.className = 'badge ms-2';
        
        if (onlineCount === 0) {
            tabletStatusBadge.classList.add('bg-danger');
            tabletStatusBadge.textContent = 'Todas Offline';
        } else if (onlineCount < totalCount) {
            tabletStatusBadge.classList.add('bg-warning');
            tabletStatusBadge.textContent = 'Parcial';
        } else {
            tabletStatusBadge.classList.add('bg-success');
            tabletStatusBadge.textContent = 'Todas Online';
        }
    }
}

// Actualizar elementos de estadísticas en la interfaz
function updateStatsUI() {
    // Actualizar indicador de última actualización
    document.getElementById('last-update-time').textContent = formatFullDateTime(new Date());
    
    // Actualizar contadores en cards del dashboard
    updateTabletCounter();
    
    // Actualizar contador de errores del último día
    const errorCountElement = document.getElementById('error-count');
    if (errorCountElement && appState.stats.errorsByType) {
        const totalErrors = Object.values(appState.stats.errorsByType).reduce((sum, val) => sum + val, 0);
        errorCountElement.textContent = totalErrors;
    }
    
    // Actualizar contador de llamadas del último día
    const callCountElement = document.getElementById('call-count');
    if (callCountElement && appState.stats.callsByHour) {
        const totalCalls = appState.stats.callsByHour.reduce((sum, val) => sum + val, 0);
        callCountElement.textContent = totalCalls;
    }
}

// Formatear tiempo relativo
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    // Menos de un minuto
    if (seconds < 60) {
        return "Ahora mismo";
    }
    
    // Menos de una hora
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    }
    
    // Menos de un día
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    
    // Menos de una semana
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }
    
    // Una semana o más
    return formatFullDateTime(date);
}

// Operaciones para los logs
function toggleLogsPause() {
    const button = document.getElementById('pause-logs');
    appState.logs.paused = !appState.logs.paused;
    
    if (appState.logs.paused) {
        button.innerHTML = '<i class="bi bi-play-fill"></i> Reanudar';
        button.classList.replace('btn-secondary', 'btn-success');
    } else {
        button.innerHTML = '<i class="bi bi-pause-fill"></i> Pausar';
        button.classList.replace('btn-success', 'btn-secondary');
    }
}

function clearLogs(timePeriod) {
    const collections = ['all', 'pwa', 'signaling', 'mirotalksfu', 'tablets'];
    
    collections.forEach(collection => {
        const container = document.getElementById(`${collection}-logs-container`);
        if (container) {
            container.innerHTML = '<div class="text-center text-muted">Logs limpiados</div>';
        }
        
        // Limpiar datos en la aplicación
        appState.logs.data[collection] = appState.logs.data[collection].filter(log => {
            if (!timePeriod) return false;
            const logDate = new Date(log.timestamp);
            const now = new Date();
            const diff = now - logDate;
            const period = timePeriod === 'hour' ? 3600000 : timePeriod === 'day' ? 86400000 : 604800000;
            return diff < period;
        });
    });
    
    // Mostrar mensaje de confirmación
    showToast('Logs Limpiados', 'Los logs han sido limpiados correctamente', 'success');
}

function toggleAutoScroll() {
    appState.logs.autoScroll = document.getElementById('auto-scroll').checked;
}

function toggleTimestamps() {
    appState.logs.showTimestamps = document.getElementById('show-timestamps').checked;
    
    // Actualizar visualización
    updateLogDisplay();
}

function applyFilter() {
    const filterText = document.getElementById('logs-filter').value.trim().toLowerCase();
    appState.logs.filter = filterText;
    
    // Actualizar visualización
    updateLogDisplay();
}

// Funciones para servicios
async function fetchServiceStatus() {
    try {
        const response = await fetch('/api/services');
        if (!response.ok) throw new Error('Error al obtener estado de servicios');
        
        const services = await response.json();
        appState.services.status = services;
        appState.services.lastCheck = new Date();
        
        updateServicesUI(services);
    } catch (error) {
        console.error('Error al cargar estado de servicios:', error);
        showToast('Error', 'No se pudo cargar el estado de los servicios', 'error');
    }
}

function updateServicesUI(services) {
    // Actualizar lista en dashboard
    const tableBody = document.querySelector('#services-status tbody');
    tableBody.innerHTML = '';
    
    services.forEach(service => {
        const row = document.createElement('tr');
        
        const statusClass = service.running ? 'bg-success' : 'bg-danger';
        const statusText = service.running ? 'Activo' : 'Detenido';
        
        row.innerHTML = `
            <td>${service.name}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${service.uptime}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-service="${service.name}" data-action="restart">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Actualizar tarjetas de servicio
        const statusBadge = document.getElementById(`${service.name}-status`);
        if (statusBadge) {
            statusBadge.className = `badge ${service.running ? 'bg-success' : 'bg-danger'}`;
            statusBadge.textContent = statusText;
        }
        
        const uptimeElement = document.getElementById(`${service.name}-uptime`);
        if (uptimeElement) {
            uptimeElement.textContent = `Tiempo activo: ${service.uptime}`;
        }
    });
    
    // Actualizar también la lista de salud
    const healthList = document.getElementById('services-health-list');
    healthList.innerHTML = '';
    
    services.forEach(service => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        const statusClass = service.running ? 'text-success' : 'text-danger';
        const statusIcon = service.running ? 'check-circle-fill' : 'x-circle-fill';
        
        item.innerHTML = `
            ${service.name}
            <span class="${statusClass}"><i class="bi bi-${statusIcon}"></i> ${service.running ? 'En línea' : 'Fuera de línea'}</span>
        `;
        
        healthList.appendChild(item);
    });
    
    // Activar eventos en botones de acción
    document.querySelectorAll('[data-service][data-action]').forEach(button => {
        button.addEventListener('click', handleServiceAction);
    });
}

// Funciones para estadísticas del sistema
async function fetchSystemStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Error al obtener estadísticas del sistema');
        
        const stats = await response.json();
        handleStatsUpdate(stats);
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Funciones de acción para servicios
function handleServiceAction(event) {
    const service = event.currentTarget.dataset.service;
    const action = event.currentTarget.dataset.action;
    
    if (action === 'restart') {
        showConfirmDialog(
            'Confirmar reinicio',
            `¿Está seguro de que desea reiniciar el servicio ${service}? Los usuarios activos podrían perder la conexión.`,
            'restart',
            service
        );
    }
}

async function performServiceAction(action, service) {
    try {
        if (action === 'restart') {
            const response = await fetch(`/api/actions/restart/${service}`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error(`Error al reiniciar ${service}`);
            
            const result = await response.json();
            showToast('Acción completada', result.message, 'success');
            
            // Recargar estado de servicios después de un momento
            setTimeout(fetchServiceStatus, 2000);
        } else if (action === 'clean-logs') {
            const response = await fetch('/api/actions/clean-logs', {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Error al limpiar logs');
            
            const result = await response.json();
            showToast('Limpieza iniciada', result.message, 'success');
        }
    } catch (error) {
        console.error(`Error en acción ${action}:`, error);
        showToast('Error', `No se pudo completar la acción: ${error.message}`, 'error');
    }
}

// Diálogo de confirmación
function showConfirmDialog(title, message, action, target = null) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    currentAction = { action, target };
    
    confirmModal.show();
}

function confirmAction() {
    confirmModal.hide();
    
    if (!currentAction.action) return;
    
    performServiceAction(currentAction.action, currentAction.target);
    currentAction = {};
}

// Notificaciones
function showToast(title, message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');
    const toastTime = document.getElementById('toast-time');
    
    // Establecer clase según tipo
    toast.className = 'toast';
    toast.classList.add(`border-${type === 'error' ? 'danger' : type}`);
    
    // Establecer contenido
    toastTitle.textContent = title;
    toastBody.textContent = message;
    toastTime.textContent = formatDateTime(new Date());
    
    // Mostrar notificación
    if (toastInstance) {
        toastInstance.show();
    }
}

// Alternar pantalla completa
function toggleFullscreen() {
    document.body.classList.toggle('fullscreen');
    
    const button = document.getElementById('btn-fullscreen');
    const icon = button.querySelector('i');
    
    if (document.body.classList.contains('fullscreen')) {
        icon.classList.replace('bi-arrows-fullscreen', 'bi-fullscreen-exit');
    } else {
        icon.classList.replace('bi-fullscreen-exit', 'bi-arrows-fullscreen');
    }
}

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
    
    // Configurar event listeners para el menú de borrado de logs por período
    document.querySelectorAll('#clear-logs-dropdown + .dropdown-menu .dropdown-item').forEach(button => {
        button.addEventListener('click', function() {
            const timePeriod = this.getAttribute('data-time-period');
            clearLogs(timePeriod);
        });
    });
    
    // Cargar tema guardado
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    document.querySelector(`input[name="theme-option"][value="${savedTheme}"]`).checked = true;
});

// Exportar funciones para uso global o debug
window.adminPanel = {
    loadDashboard,
    loadTablets,
    fetchServiceStatus,
    fetchSystemStats,
    clearLogs,
    toggleLogsPause,
    handleTabletUpdate
};

// Borrar logs según el período de tiempo seleccionado
function clearLogsByTimePeriod(timePeriod) {
    const collections = ['all', 'system', 'call', 'error', 'performance'];
    const now = new Date();
    let cutoffDate = new Date();
    let confirmMessage = '';
    
    // Determinar la fecha de corte según el período seleccionado
    switch(timePeriod) {
        case '1h':
            cutoffDate.setHours(now.getHours() - 1);
            confirmMessage = 'Logs de la última hora';
            break;
        case '24h':
            cutoffDate.setDate(now.getDate() - 1);
            confirmMessage = 'Logs de las últimas 24 horas';
            break;
        case '7d':
            cutoffDate.setDate(now.getDate() - 7);
            confirmMessage = 'Logs de los últimos 7 días';
            break;
        case '4w':
            cutoffDate.setDate(now.getDate() - 28);
            confirmMessage = 'Logs de las últimas 4 semanas';
            break;
        case 'all':
            cutoffDate = new Date(0); // 1 de enero de 1970
            confirmMessage = 'TODOS los logs históricos';
            break;
        default:
            showToast('Error', 'Período de tiempo no válido', 'error');
            return;
    }
    
    // Confirmar con el usuario antes de proceder
    if (!confirm(`¿Está seguro que desea borrar ${confirmMessage}? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    // Llamar a la API para borrar los logs
    fetch('/api/logs/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cutoffDate: cutoffDate.toISOString(),
            timePeriod
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        // Actualizar los logs en memoria
        collections.forEach(collection => {
            // Filtrar logs para mantener solo los anteriores a la fecha de corte
            if (timePeriod === 'all') {
                // Si es "desde siempre", borrar todos
                appState.logs.data[collection] = [];
            } else {
                // Filtrar por fecha
                appState.logs.data[collection] = appState.logs.data[collection].filter(log => {
                    const logDate = new Date(log.timestamp);
                    return logDate < cutoffDate;
                });
            }
            
            // Actualizar la visualización
            const wrapper = document.getElementById(`${collection}-logs-content-wrapper`);
            if (wrapper) {
                if (appState.logs.data[collection].length === 0) {
                    wrapper.innerHTML = '<div class="text-center text-muted p-3">No hay logs disponibles</div>';
                } else {
                    updateLogDisplay();
                }
            }
        });
        
        // Mostrar mensaje de confirmación
        showToast(
            'Logs Borrados', 
            `Se han borrado ${data.count || 'los'} logs según el criterio seleccionado`, 
            'success'
        );
    })
    .catch(error => {
        console.error('Error al borrar logs:', error);
        showToast('Error', `No se pudieron borrar los logs: ${error.message}`, 'error');
    });
}
