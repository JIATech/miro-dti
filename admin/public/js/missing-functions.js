/**
 * Panel de Administración - Sistema Intercom
 * Funciones que faltaban en el código principal
 */

// Asegurarnos que la referencia a bootstrap esté disponible
const bootstrap = window.bootstrap || {};

// --- Funciones para el manejo de la interfaz ---

// Cargar el dashboard
window.loadDashboard = function () {
  console.log('Cargando dashboard...');
  // Actualizar fecha de última actualización
  document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString();

  // Solicitar estadísticas actualizadas
  if (window.socket) {
    window.socket.emit('get_stats');
  }

  // Actualizar estado de servicios
  window.fetchServiceStatus();

  // Actualizar estado de tablets
  window.loadTablets();
};

// Cargar datos de tablets
window.loadTablets = function () {
  console.log('Cargando datos de tablets...');
  if (window.socket) {
    window.socket.emit('get_tablets');
  }
};

// Actualizar lista de tablets en la interfaz
window.updateTabletsList = function () {
  const tabletsList = document.getElementById('tablets-list-container');
  const tabletsGrid = document.getElementById('tablets-grid-container');

  if (!tabletsList || !tabletsGrid) return;

  // Limpiar contenedores
  tabletsList.innerHTML = '';
  tabletsGrid.innerHTML = '';

  // Verificar si hay tablets
  if (window.appState.tablets.list.length === 0) {
    tabletsList.innerHTML = '<div class="text-center py-5"><p>No hay tablets registradas</p></div>';
    tabletsGrid.innerHTML = '<div class="text-center py-5"><p>No hay tablets registradas</p></div>';
    return;
  }

  // Ordenar tablets por nombre
  const sortedTablets = [...window.appState.tablets.list].sort((a, b) => {
    return (a.deviceName || a.deviceId).localeCompare(b.deviceName || b.deviceId);
  });

  // Crear elementos para cada tablet
  sortedTablets.forEach((tablet) => {
    // Crear elemento para vista de lista
    const listItem = document.createElement('div');
    listItem.className = 'tablet-item card mb-2';
    listItem.dataset.device = tablet.deviceId;

    const statusClass =
      tablet.status === 'online'
        ? 'bg-success'
        : tablet.status === 'offline'
          ? 'bg-danger'
          : 'bg-secondary';

    listItem.innerHTML = `
      <div class="card-body d-flex justify-content-between align-items-center">
        <div>
          <h5 class="card-title">${tablet.deviceName || tablet.deviceId}</h5>
          <p class="card-text text-muted mb-0">
            <small>
              <i class="bi bi-geo-alt me-1"></i>${tablet.location || 'Sin ubicación'}
            </small>
          </p>
        </div>
        <div class="d-flex align-items-center">
          <span class="tablet-status-badge badge ${statusClass} me-2">${tablet.status}</span>
          <button class="btn btn-sm btn-primary view-tablet-details" data-device="${tablet.deviceId}">
            <i class="bi bi-info-circle"></i>
          </button>
        </div>
      </div>
    `;

    tabletsList.appendChild(listItem);

    // Crear elemento para vista de cuadrícula
    const gridItem = document.createElement('div');
    gridItem.className = 'col-md-4 col-lg-3 mb-3';
    gridItem.innerHTML = `
      <div class="tablet-item card h-100" data-device="${tablet.deviceId}">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="tablet-status-badge badge ${statusClass}">${tablet.status}</span>
          <small>${window.formatTimeAgo(tablet.lastContact)}</small>
        </div>
        <div class="card-body">
          <h5 class="card-title">${tablet.deviceName || tablet.deviceId}</h5>
          <p class="card-text text-muted">
            <i class="bi bi-geo-alt me-1"></i>${tablet.location || 'Sin ubicación'}
          </p>
          <p class="card-text">
            <small class="text-muted">
              IP: ${tablet.ip || 'Desconocida'}<br>
              Batería: ${tablet.batteryLevel || 'N/A'}%
            </small>
          </p>
        </div>
        <div class="card-footer">
          <button class="btn btn-sm btn-primary view-tablet-details" data-device="${tablet.deviceId}">
            Detalles
          </button>
        </div>
      </div>
    `;

    tabletsGrid.appendChild(gridItem);
  });

  // Actualizar contador de tablets
  window.updateTabletCounter();
};

// Mostrar detalles de una tablet específica
window.showTabletDetails = function (deviceId) {
  // Buscar la tablet
  const tablet = window.appState.tablets.list.find((t) => t.deviceId === deviceId);
  if (!tablet) {
    window.showToast('Error', `No se encontró la tablet con ID ${deviceId}`, 'danger');
    return;
  }

  // Actualizar tablet seleccionada
  window.appState.tablets.selected = deviceId;

  // Actualizar título del modal
  document.getElementById('tablet-details-title').textContent =
    tablet.deviceName || tablet.deviceId;

  // Actualizar detalles
  document.getElementById('tablet-id').textContent = tablet.deviceId;
  document.getElementById('tablet-name').textContent = tablet.deviceName || 'Sin nombre';
  document.getElementById('tablet-status').textContent = tablet.status;
  document.getElementById('tablet-ip').textContent = tablet.ip || 'Desconocida';
  document.getElementById('tablet-location').textContent = tablet.location || 'Sin ubicación';
  document.getElementById('tablet-battery').textContent = `${tablet.batteryLevel || 'N/A'}%`;
  document.getElementById('tablet-last-contact').textContent = tablet.lastContact
    ? window.formatFullDateTime(tablet.lastContact)
    : 'Nunca';
  document.getElementById('tablet-firmware').textContent = tablet.firmware || 'Desconocido';

  // Configurar botones de acciones
  document.getElementById('tablet-action-speak').dataset.device = deviceId;
  document.getElementById('tablet-action-restart').dataset.device = deviceId;
  document.getElementById('tablet-action-ping').dataset.device = deviceId;

  // Mostrar el modal
  const tabletModal = new bootstrap.Modal(document.getElementById('tablet-details-modal'));
  tabletModal.show();

  // Solicitar logs específicos de esta tablet
  if (window.socket) {
    window.socket.emit('get_tablet_logs', { deviceId, limit: 50 });
  }
};

// Aplicar filtro de logs
window.applyFilter = function () {
  const filterText = document.getElementById('logs-filter').value.toLowerCase();
  window.appState.logs.filter = filterText;

  // Aplicar filtro a las colecciones de logs
  for (const [category, logs] of Object.entries(window.appState.logs.data)) {
    // Obtener el contenedor correspondiente
    const containerId = `${category}-logs-container`;

    // Filtrar logs según el texto
    const filteredLogs = filterText
      ? logs.filter(
        (log) =>
          log.message?.toLowerCase().includes(filterText) ||
            log.component?.toLowerCase().includes(filterText)
      )
      : logs;

    // Actualizar vista
    window.updateLogDisplay(filteredLogs, containerId, window.appState.logs.showTimestamps);
  }
};

// Alternar pantalla completa
window.toggleFullscreen = function () {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error(`Error al intentar entrar en modo pantalla completa: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

// Obtener estado de servicios
window.fetchServiceStatus = function () {
  if (window.socket) {
    window.socket.emit('get_services_status');
  }
};

// Manejar acción de servicio
window.handleServiceAction = function (element) {
  const action = element.dataset.action;
  const service = element.dataset.service;

  if (action && service) {
    window.performServiceAction(action, service);
  }
};

// Realizar acción en un servicio
window.performServiceAction = function (action, service) {
  console.log(`Acción: ${action}, Servicio: ${service}`);

  // Mostrar diálogo de confirmación según la acción
  switch (action) {
  case 'restart':
    window.showConfirmDialog(
      'Reiniciar Servicio',
      `¿Está seguro que desea reiniciar el servicio ${service}?`,
      'restart-service',
      service
    );
    break;

  case 'stop':
    window.showConfirmDialog(
      'Detener Servicio',
      `¿Está seguro que desea detener el servicio ${service}?`,
      'stop-service',
      service
    );
    break;

  case 'start':
    window.showConfirmDialog(
      'Iniciar Servicio',
      `¿Está seguro que desea iniciar el servicio ${service}?`,
      'start-service',
      service
    );
    break;

  default:
    window.showToast('Error', `Acción desconocida: ${action}`, 'danger');
  }
};

// Mostrar diálogo de confirmación
window.showConfirmDialog = function (title, message, action, target = null) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;

  // Guardar acción actual
  window.currentAction = { action, target };

  // Mostrar modal
  window.confirmModal.show();
};

// Confirmar acción
window.confirmAction = function () {
  if (window.socket && window.currentAction.action) {
    window.socket.emit('service_action', window.currentAction);
    window.showToast('Acción Enviada', 'La solicitud ha sido enviada al servidor', 'info');
  }

  // Ocultar modal
  window.confirmModal.hide();
};

// Actualizar contadores de tablets
window.updateTabletCounter = function () {
  const tablets = window.appState.tablets.list;
  const totalElement = document.getElementById('total-tablets-count');
  const onlineElement = document.getElementById('tablets-online-count');
  const offlineElement = document.getElementById('tablets-offline-count');

  if (totalElement) totalElement.textContent = tablets.length;

  // Contar tablets online y offline
  const online = tablets.filter((t) => t.status === 'online').length;
  const offline = tablets.length - online;

  if (onlineElement) onlineElement.textContent = online;
  if (offlineElement) offlineElement.textContent = offline;
};

// Actualizar estadísticas en la interfaz
window.updateStatsUI = function () {
  // Actualizar contadores
  const todayCalls = document.getElementById('today-calls-count');
  if (todayCalls) {
    todayCalls.textContent = window.appState.stats.callsByHour.reduce((sum, val) => sum + val, 0);
  }

  // Actualizar último error
  const lastError = document.getElementById('last-error-time');
  if (lastError && window.appState.stats.lastErrorTimestamp) {
    lastError.textContent = window.formatTimeAgo(window.appState.stats.lastErrorTimestamp);
  }
};

// Formatear tiempo relativo
window.formatTimeAgo = function (date) {
  if (!date) return 'Nunca';

  const now = new Date();
  const timestamp = new Date(date);
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return 'hace unos segundos';
  } else if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  } else if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else if (diffSec < 604800) {
    const days = Math.floor(diffSec / 86400);
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  } else {
    return window.formatDateTime(timestamp);
  }
};

// Toogle pausa de logs
window.toggleLogsPause = function () {
  const btn = document.getElementById('toggle-logs-pause');
  window.appState.logs.paused = !window.appState.logs.paused;

  if (window.appState.logs.paused) {
    btn.innerHTML = '<i class="bi bi-play-fill"></i> Reanudar';
    btn.classList.replace('btn-warning', 'btn-success');
  } else {
    btn.innerHTML = '<i class="bi bi-pause-fill"></i> Pausar';
    btn.classList.replace('btn-success', 'btn-warning');

    // Actualizar logs
    for (const [category, logs] of Object.entries(window.appState.logs.data)) {
      const containerId = `${category}-logs-container`;
      window.updateLogDisplay(logs, containerId, window.appState.logs.showTimestamps);
    }
  }
};

// Limpiar logs
window.clearLogs = function () {
  // Mostrar opciones de limpieza
  const btn = document.getElementById('clear-logs');
  const dropdown = new bootstrap.Dropdown(btn);
  dropdown.show();
};

// Alternar auto-scroll
window.toggleAutoScroll = function () {
  const checkbox = document.getElementById('auto-scroll');
  window.appState.logs.autoScroll = checkbox.checked;
};

// Alternar timestamps
window.toggleTimestamps = function () {
  const checkbox = document.getElementById('show-timestamps');
  window.appState.logs.showTimestamps = checkbox.checked;

  // Actualizar vista
  for (const [category, logs] of Object.entries(window.appState.logs.data)) {
    const containerId = `${category}-logs-container`;
    window.updateLogDisplay(logs, containerId, window.appState.logs.showTimestamps);
  }
};

// Actualizar UI de servicios
window.updateServicesUI = function (services) {
  const servicesTable = document.getElementById('services-table-body');
  if (!servicesTable) return;

  servicesTable.innerHTML = '';

  for (const [name, info] of Object.entries(services)) {
    const statusClass =
      info.status === 'running'
        ? 'bg-success'
        : info.status === 'stopped'
          ? 'bg-danger'
          : 'bg-warning';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${name}</td>
      <td><span class="service-status-badge badge ${statusClass}">${info.status}</span></td>
      <td>${info.uptime ? window.formatUptime(info.uptime) : 'N/A'}</td>
      <td>
        <div class="btn-group btn-group-sm">
          ${
  info.status === 'running'
    ? `
            <button class="btn btn-warning" data-action="restart" data-service="${name}">
              <i class="bi bi-arrow-repeat"></i> Reiniciar
            </button>
            <button class="btn btn-danger" data-action="stop" data-service="${name}">
              <i class="bi bi-stop-fill"></i> Detener
            </button>
          `
    : `
            <button class="btn btn-success" data-action="start" data-service="${name}">
              <i class="bi bi-play-fill"></i> Iniciar
            </button>
          `
}
        </div>
      </td>
    `;

    servicesTable.appendChild(row);
  }

  // Actualizar última verificación
  const lastCheck = document.getElementById('services-last-check');
  if (lastCheck && window.appState.services.lastCheck) {
    lastCheck.textContent = window.formatFullDateTime(window.appState.services.lastCheck);
  }
};

// Configurar controles TTS
window.setupTTSControls = function () {
  const speakForm = document.getElementById('speak-form');
  if (!speakForm) return;

  speakForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const message = document.getElementById('speak-message').value.trim();
    const device = window.currentSpeakDeviceName || document.getElementById('speak-device').value;

    if (!message) {
      window.showToast('Error', 'El mensaje no puede estar vacío', 'danger');
      return;
    }

    // Enviar mensaje TTS
    if (window.socket) {
      window.socket.emit('tablet_command', {
        command: 'speak',
        deviceId: device,
        value: message,
      });

      window.showToast('Mensaje Enviado', `Mensaje enviado a ${device}`, 'success');

      // Limpiar formulario
      document.getElementById('speak-message').value = '';
    }
  });

  // Manejar selección de dispositivo
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('device-speak')) {
      const deviceName = e.target.dataset.device;
      if (deviceName) {
        window.currentSpeakDeviceName = deviceName;

        // Abrir modal
        const speakModal = new bootstrap.Modal(document.getElementById('speak-modal'));
        speakModal.show();

        // Actualizar título
        document.getElementById('speak-modal-title').textContent = `Enviar mensaje a ${deviceName}`;

        // Enfocar campo de mensaje
        document.getElementById('speak-message').focus();
      }
    }
  });

  // Limpiar dispositivo al cerrar modal
  document.getElementById('speak-modal').addEventListener('hidden.bs.modal', function () {
    window.currentSpeakDeviceName = null;
  });
};
