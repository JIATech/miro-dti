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
            mirotalksfu: []
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
        second: '2-digit',
        hour12: false
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
    // Configurar elementos de UI y eventos
    document.getElementById('pause-logs').addEventListener('click', toggleLogsPause);
    document.getElementById('clear-logs').addEventListener('click', clearLogs);
    document.getElementById('auto-scroll').addEventListener('change', toggleAutoScroll);
    document.getElementById('show-timestamps').addEventListener('change', toggleTimestamps);
    document.getElementById('apply-filter').addEventListener('click', applyFilter);
    document.getElementById('log-filter').addEventListener('keyup', e => {
        if (e.key === 'Enter') applyFilter();
    });
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('btn-clean-logs').addEventListener('click', () => {
        showConfirmDialog(
            'Confirmar limpieza manual',
            '¿Está seguro de que desea eliminar los logs antiguos? Esta acción no se puede deshacer.',
            'clean-logs'
        );
    });
    
    // Configurar eventos de botones de servicio
    document.querySelectorAll('[data-service][data-action]').forEach(button => {
        button.addEventListener('click', handleServiceAction);
    });
    
    // Inicializar toast
    toastInstance = new bootstrap.Toast(document.getElementById('notification-toast'));
    
    // Inicializar modal de confirmación
    confirmModal = new bootstrap.Modal(document.getElementById('confirm-modal'));
    document.getElementById('confirm-btn').addEventListener('click', confirmAction);
    
    // Inicializar los gráficos
    initializeCharts();
    
    // Cargar datos iniciales
    loadInitialData();
}

// Inicializar los gráficos
function initializeCharts() {
    // Gráfico de llamadas por hora
    const callsCtx = document.getElementById('calls-chart').getContext('2d');
    appState.charts.calls = new Chart(callsCtx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Llamadas',
                data: appState.stats.callsByHour,
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
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
            labels: ['No hay datos'],
            datasets: [{
                data: [1],
                backgroundColor: ['#e0e0e0'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Cargar datos iniciales
function loadInitialData() {
    // Cargar estado de servicios
    fetchServiceStatus();
    
    // Cargar estadísticas del sistema
    fetchSystemStats();
}

// Conectar con Socket.IO
function connectSocket() {
    try {
        updateConnectionStatus('connecting');
        
        socket = io();
        
        socket.on('connect', () => {
            console.log('Conectado al servidor de administración');
            updateConnectionStatus('connected');
            showToast('Conexión establecida', 'Conectado al servidor de administración', 'success');
            
            // Recargar datos al reconectar
            loadInitialData();
        });
        
        socket.on('disconnect', () => {
            console.log('Desconectado del servidor de administración');
            updateConnectionStatus('disconnected');
            showToast('Conexión perdida', 'Se perdió la conexión con el servidor', 'error');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Error de conexión:', error);
            updateConnectionStatus('disconnected');
            appState.connection.reconnectAttempts++;
            
            if (appState.connection.reconnectAttempts % 5 === 0) {
                showToast('Error de conexión', 'No se puede conectar al servidor de administración', 'error');
            }
        });
        
        // Escuchar eventos de logs
        socket.on('log', handleLogMessage);
        
        // Escuchar actualizaciones de estadísticas
        socket.on('stats-update', handleStatsUpdate);
        
        // Escuchar eventos del sistema
        socket.on('system-event', handleSystemEvent);
        
    } catch (error) {
        console.error('Error al inicializar Socket.IO:', error);
    }
}

// Actualizar indicador de estado de conexión
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    appState.connection.status = status;
    
    statusElement.className = 'badge';
    statusElement.classList.add(status === 'connected' ? 'bg-success' : 
                               status === 'connecting' ? 'bg-warning' : 'bg-danger');
    
    statusElement.textContent = status === 'connected' ? 'Conectado' :
                              status === 'connecting' ? 'Conectando...' : 'Desconectado';
}

// Manejar mensaje de log recibido
function handleLogMessage(log) {
    // Si los logs están pausados, no actualizar
    if (appState.logs.paused) return;
    
    // Aplicar filtro si existe
    if (appState.logs.filter && !log.message.toLowerCase().includes(appState.logs.filter.toLowerCase())) {
        return;
    }
    
    // Añadir a la colección global
    addLogToCollection('all', log);
    
    // Añadir a la colección específica del servicio
    addLogToCollection(log.service, log);
    
    // Actualizar UI
    updateLogDisplay();
}

// Añadir log a una colección específica
function addLogToCollection(collection, log) {
    // Asegurarse de que la colección existe
    if (!appState.logs.data[collection]) {
        appState.logs.data[collection] = [];
    }
    
    // Añadir log y limitar tamaño
    appState.logs.data[collection].push(log);
    
    // Limitar la cantidad de logs en memoria
    if (appState.logs.data[collection].length > MAX_LOGS) {
        appState.logs.data[collection].shift();
    }
}

// Actualizar visualización de logs
function updateLogDisplay() {
    const collections = ['all', 'pwa', 'signaling', 'mirotalksfu'];
    
    collections.forEach(collection => {
        const container = document.getElementById(`${collection}-logs-container`);
        if (!container) return;
        
        // Limpiar contenedor si está vacío o tiene placeholder
        if (container.children.length <= 1 && container.querySelector('.text-muted')) {
            container.innerHTML = '';
        }
        
        // Obtener logs para esta colección
        const logs = appState.logs.data[collection] || [];
        
        // Si no hay logs, mostrar mensaje
        if (logs.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No hay logs disponibles</div>';
            return;
        }
        
        // Obtener último log
        const lastLog = logs[logs.length - 1];
        
        // Crear elemento para el log
        const logElement = document.createElement('div');
        logElement.className = `log-line log-line-${lastLog.service}`;
        
        // Detectar si es un error o advertencia
        if (lastLog.message.toLowerCase().includes('error')) {
            logElement.classList.add('log-line-error');
        } else if (lastLog.message.toLowerCase().includes('warn')) {
            logElement.classList.add('log-line-warning');
        } else if (lastLog.message.toLowerCase().includes('success') || 
                  lastLog.message.toLowerCase().includes(' ok ')) {
            logElement.classList.add('log-line-success');
        }
        
        // Construir contenido del log
        let logContent = '';
        
        // Añadir timestamp si está habilitado
        if (appState.logs.showTimestamps) {
            logContent += `<span class="log-timestamp">${formatDateTime(lastLog.timestamp)}</span>`;
        }
        
        // Añadir etiqueta de servicio si estamos en la vista "all"
        if (collection === 'all') {
            logContent += `<span class="badge bg-secondary me-1">${lastLog.service}</span>`;
        }
        
        // Añadir mensaje
        logContent += lastLog.message;
        
        // Establecer contenido
        logElement.innerHTML = logContent;
        
        // Añadir al contenedor
        container.appendChild(logElement);
        
        // Auto-scroll si está habilitado
        if (appState.logs.autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
    });
}

// Manejar actualización de estadísticas
function handleStatsUpdate(data) {
    // Actualizar contadores
    document.getElementById('total-calls').textContent = data.eventStats.calls.total;
    document.getElementById('success-calls').textContent = data.eventStats.calls.success;
    document.getElementById('failed-calls').textContent = data.eventStats.calls.failed;
    document.getElementById('total-errors').textContent = data.eventStats.errors.total;
    
    // Actualizar estadísticas de errores
    updateErrorStats(data.eventStats.errors);
    
    // Actualizar memoria y tiempo activo
    if (data.system) {
        document.getElementById('server-uptime').value = formatUptime(data.system.uptime);
        
        if (data.system.memory) {
            const heapUsed = formatMemory(data.system.memory.heapUsed);
            const heapTotal = formatMemory(data.system.memory.heapTotal);
            document.getElementById('memory-usage').value = `${heapUsed} / ${heapTotal}`;
        }
        
        if (data.system.logRotation) {
            document.getElementById('log-retention').value = data.system.logRotation.maxDays;
            document.getElementById('next-cleanup').value = formatFullDateTime(data.system.logRotation.nextCleanup);
        }
    }
}

// Actualizar estadísticas de errores
function updateErrorStats(errors) {
    if (!errors || !errors.byType) return;
    
    // Actualizar el gráfico de errores
    const labels = Object.keys(errors.byType);
    const values = Object.values(errors.byType);
    
    // Si no hay datos, mostrar placeholder
    if (labels.length === 0) {
        appState.charts.errors.data.labels = ['No hay errores'];
        appState.charts.errors.data.datasets[0].data = [1];
        appState.charts.errors.data.datasets[0].backgroundColor = ['#e0e0e0'];
    } else {
        // Colores para cada tipo de error
        const colors = [
            '#f44336', '#ff9800', '#2196f3', '#4caf50', '#9c27b0', 
            '#e91e63', '#03a9f4', '#8bc34a', '#673ab7', '#009688'
        ];
        
        // Actualizar datos del gráfico
        appState.charts.errors.data.labels = labels.map(label => 
            label.charAt(0).toUpperCase() + label.slice(1)
        );
        appState.charts.errors.data.datasets[0].data = values;
        appState.charts.errors.data.datasets[0].backgroundColor = labels.map((_, i) => 
            colors[i % colors.length]
        );
    }
    
    // Actualizar el gráfico
    appState.charts.errors.update();
}

// Manejar evento del sistema
function handleSystemEvent(event) {
    // Añadir evento al registro de eventos
    const eventsContainer = document.getElementById('system-events');
    const eventElement = document.createElement('div');
    eventElement.className = 'log-line';
    
    // Estilo según el tipo de evento
    if (event.type === 'error') {
        eventElement.classList.add('log-line-error');
    } else if (event.type === 'warning') {
        eventElement.classList.add('log-line-warning');
    } else if (event.type === 'success') {
        eventElement.classList.add('log-line-success');
    }
    
    // Contenido del evento
    eventElement.innerHTML = `
        <span class="log-timestamp">${formatDateTime(new Date())}</span>
        <span class="badge bg-secondary me-1">${event.type}</span>
        ${event.message}
    `;
    
    // Añadir al contenedor
    eventsContainer.appendChild(eventElement);
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
    
    // Mostrar notificación para eventos importantes
    if (event.type === 'error' || event.type === 'warning') {
        showToast('Evento del sistema', event.message, event.type);
    }
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

function clearLogs() {
    const collections = ['all', 'pwa', 'signaling', 'mirotalksfu'];
    
    collections.forEach(collection => {
        const container = document.getElementById(`${collection}-logs-container`);
        if (container) {
            container.innerHTML = '<div class="text-center text-muted">Logs limpiados</div>';
        }
    });
}

function toggleAutoScroll() {
    appState.logs.autoScroll = document.getElementById('auto-scroll').checked;
}

function toggleTimestamps() {
    appState.logs.showTimestamps = document.getElementById('show-timestamps').checked;
    
    // Re-renderizar los logs
    clearLogs();
    Object.keys(appState.logs.data).forEach(collection => {
        const logs = appState.logs.data[collection];
        logs.forEach(log => {
            handleLogMessage(log);
        });
    });
}

function applyFilter() {
    const filterInput = document.getElementById('log-filter');
    appState.logs.filter = filterInput.value.trim();
    
    // Re-renderizar logs
    clearLogs();
    
    // Si el filtro está vacío, mostrar todos los logs
    if (!appState.logs.filter) {
        Object.keys(appState.logs.data).forEach(collection => {
            const logs = appState.logs.data[collection];
            logs.forEach(log => {
                handleLogMessage(log);
            });
        });
        return;
    }
    
    // Aplicar filtro
    Object.keys(appState.logs.data).forEach(collection => {
        const logs = appState.logs.data[collection];
        const filteredLogs = logs.filter(log => 
            log.message.toLowerCase().includes(appState.logs.filter.toLowerCase())
        );
        
        // Mostrar logs filtrados
        filteredLogs.forEach(log => {
            handleLogMessage(log);
        });
    });
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
    
    // Conectar con Socket.IO
    connectSocket();
    
    // Actualizar estado de servicios periódicamente
    setInterval(fetchServiceStatus, 30000); // Cada 30 segundos
});
