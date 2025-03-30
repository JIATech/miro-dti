/**
 * Panel de Administración - Sistema Intercom
 * Definiciones globales
 */

// Variables y funciones que se utilizan en varios archivos
window.updateLogDisplay = function (logs, container, showTimestamps = true) {
  const logContainer = document.getElementById(container);
  if (!logContainer) return;

  logContainer.innerHTML = '';

  logs.forEach((log) => {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${log.level || 'info'}`;

    let logText = '';
    if (showTimestamps) {
      const timestamp = new Date(log.timestamp);
      logText += `<span class="log-time">${timestamp.toLocaleTimeString()}</span> `;
    }

    logText += `<span class="log-component">[${log.component || 'system'}]</span> `;
    logText += `<span class="log-message">${log.message}</span>`;

    logEntry.innerHTML = logText;
    logContainer.appendChild(logEntry);
  });

  // Auto-scroll
  if (window.appState && window.appState.logs && window.appState.logs.autoScroll) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
};

window.updateServiceStatus = function (service, status) {
  const serviceElement = document.querySelector(`.service-item[data-service="${service}"]`);
  if (!serviceElement) return;

  const statusBadge = serviceElement.querySelector('.service-status-badge');
  if (statusBadge) {
    statusBadge.className = `service-status-badge badge ${getStatusBadgeClass(status)}`;
    statusBadge.textContent = status;
  }

  // Actualizar estado en el objeto appState
  if (window.appState && window.appState.services) {
    window.appState.services.status[service] = status;
  }
};

window.updateTabletStatus = function (deviceId, status) {
  const tabletElement = document.querySelector(`.tablet-item[data-device="${deviceId}"]`);
  if (!tabletElement) return;

  const statusBadge = tabletElement.querySelector('.tablet-status-badge');
  if (statusBadge) {
    statusBadge.className = `tablet-status-badge badge ${getStatusBadgeClass(status)}`;
    statusBadge.textContent = status;
  }

  // Actualizar estado en el objeto appState
  if (window.appState && window.appState.tablets) {
    const tablet = window.appState.tablets.list.find((t) => t.deviceId === deviceId);
    if (tablet) {
      tablet.status = status;
    }
  }
};

window.handleDeviceResponse = function (data) {
  console.log('Respuesta del dispositivo:', data);

  if (data.success) {
    showToast(
      'Acción Completada',
      `La acción se ha completado con éxito en ${data.deviceName}`,
      'success'
    );
  } else {
    showToast(
      'Error',
      `Error al ejecutar la acción en ${data.deviceName}: ${data.message}`,
      'danger'
    );
  }

  // Actualizar información si es necesario
  if (data.type === 'status') {
    updateTabletStatus(data.deviceId, data.status);
  }
};

// Función para aplicar tema (oscuro/claro)
window.applyTheme = function (theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem('theme', theme);

  // Actualizar switch en la interfaz si existe
  const themeSwitch = document.getElementById('theme-switch');
  if (themeSwitch) {
    themeSwitch.checked = theme === 'dark';
  }
};

// Funciones para configuraciones
window.saveGeneralSettings = function () {
  const settings = {
    adminServer: document.getElementById('admin-server-url').value,
    mqttBroker: document.getElementById('mqtt-broker-url').value,
    logsRetention: parseInt(document.getElementById('logs-retention').value, 10),
    refreshInterval: parseInt(document.getElementById('refresh-interval').value, 10),
  };

  // Guardar configuración mediante Socket.IO
  if (window.socket) {
    window.socket.emit('save-settings', { type: 'general', settings });
    showToast(
      'Configuración Guardada',
      'La configuración general se ha guardado correctamente',
      'success'
    );
  } else {
    showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

window.saveTabletsSettings = function () {
  const settings = {
    autoRegister: document.getElementById('auto-register-tablets').checked,
    heartbeatInterval: parseInt(document.getElementById('heartbeat-interval').value, 10),
    offlineTimeout: parseInt(document.getElementById('offline-timeout').value, 10),
  };

  // Guardar configuración mediante Socket.IO
  if (window.socket) {
    window.socket.emit('save-settings', { type: 'tablets', settings });
    showToast(
      'Configuración Guardada',
      'La configuración de tablets se ha guardado correctamente',
      'success'
    );
  } else {
    showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

window.changeAdminPassword = function (event) {
  event.preventDefault();

  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  // Validación básica
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Error', 'Todos los campos son obligatorios', 'danger');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Error', 'Las contraseñas no coinciden', 'danger');
    return;
  }

  // Cambiar contraseña mediante Socket.IO
  if (window.socket) {
    window.socket.emit('change-password', { currentPassword, newPassword });
  } else {
    showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

window.clearLogsByTimePeriod = function (timePeriod) {
  let cutoffTime;
  const now = new Date();

  switch (timePeriod) {
    case '1h':
      cutoffTime = new Date(now.getTime() - 3600000); // 1 hora
      break;
    case '6h':
      cutoffTime = new Date(now.getTime() - 21600000); // 6 horas
      break;
    case '24h':
      cutoffTime = new Date(now.getTime() - 86400000); // 24 horas
      break;
    case '7d':
      cutoffTime = new Date(now.getTime() - 604800000); // 7 días
      break;
    case '30d':
      cutoffTime = new Date(now.getTime() - 2592000000); // 30 días
      break;
    default:
      return; // No hacer nada si no es un período válido
  }

  // Solicitar limpieza de logs al servidor
  if (window.socket) {
    window.socket.emit('clear-logs', { before: cutoffTime.toISOString() });
    showToast(
      'Limpieza de Logs',
      `Se han eliminado los logs anteriores a ${cutoffTime.toLocaleString()}`,
      'info'
    );
  }
};

// Utilidades para status badges
function getStatusBadgeClass(status) {
  switch (status.toLowerCase()) {
    case 'online':
    case 'running':
    case 'active':
      return 'bg-success';
    case 'offline':
    case 'stopped':
    case 'inactive':
      return 'bg-danger';
    case 'warning':
    case 'restarting':
      return 'bg-warning';
    case 'pending':
    case 'unknown':
    default:
      return 'bg-secondary';
  }
}

// Variables para el log
window.addLog = function (type, message, data = {}) {
  if (window.socket) {
    window.socket.emit('log', { type, message, data });
  }

  // También mostrar en consola para debug
  console.log(`[${type}] ${message}`, data);
};

// Mostrar notificación tipo toast
window.showToast = function (title, message, type = 'info') {
  const toastEl = document.getElementById('notification-toast');
  const toastTitle = document.getElementById('notification-title');
  const toastBody = document.getElementById('notification-body');

  if (!toastEl || !toastTitle || !toastBody) {
    console.error('Elementos toast no encontrados');
    return;
  }

  // Actualizar contenido
  toastTitle.textContent = title;
  toastBody.textContent = message;

  // Actualizar tipo/estilo
  toastEl.className = toastEl.className.replace(/bg-\w+/, '');
  toastEl.classList.add(`bg-${type}`);

  // Mostrar notificación
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
};

// Actualizar visualización de logs
window.updateLogDisplay = function (logs, containerId, showTimestamps = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Vaciar contenedor
  container.innerHTML = '';

  // Verificar si hay logs
  if (!logs || logs.length === 0) {
    container.innerHTML =
      '<div class="text-center py-3 text-muted"><em>No hay logs disponibles</em></div>';
    return;
  }

  // Crear elemento para cada log
  logs.forEach((log) => {
    // Determinar clase según nivel
    const levelClass =
      log.level === 'error'
        ? 'text-danger'
        : log.level === 'warning'
          ? 'text-warning'
          : log.level === 'success'
            ? 'text-success'
            : 'text-info';

    // Crear elemento de log
    const logEl = document.createElement('div');
    logEl.className = `log-item ${levelClass} py-1`;

    // Formatear tiempo si es necesario
    let timeString = '';
    if (showTimestamps && log.timestamp) {
      const date = new Date(log.timestamp);
      timeString = `<span class="log-time text-muted me-2">[${date.toLocaleTimeString()}]</span>`;
    }

    // Establecer contenido
    logEl.innerHTML = `
      ${timeString}
      <span class="log-message">${log.message || ''}</span>
    `;

    // Agregar al contenedor
    container.appendChild(logEl);
  });

  // Auto-scroll si está habilitado
  if (window.appState && window.appState.logs && window.appState.logs.autoScroll) {
    container.scrollTop = container.scrollHeight;
  }
};

// Actualizar estado de servicio en la UI
window.updateServiceStatus = function (serviceName, status) {
  // Buscar elementos relacionados con este servicio
  const statusBadges = document.querySelectorAll(
    `.service-status-badge[data-service="${serviceName}"]`
  );

  // Determinar clase según estado
  const statusClass =
    status === 'running'
      ? 'bg-success'
      : status === 'stopped'
        ? 'bg-danger'
        : status === 'restarting'
          ? 'bg-warning'
          : 'bg-secondary';

  // Actualizar cada badge
  statusBadges.forEach((badge) => {
    // Eliminar clases actuales
    badge.className = badge.className.replace(/bg-\w+/, '');
    badge.classList.add('service-status-badge', 'badge', statusClass);
    badge.textContent = status;
  });

  // Actualizar botones de acción
  const actionBtns = document.querySelectorAll(`button[data-service="${serviceName}"]`);
  actionBtns.forEach((btn) => {
    // Ocultar todos los botones primero
    btn.style.display = 'none';

    // Mostrar botones según el estado
    if (status === 'running') {
      if (btn.dataset.action === 'restart' || btn.dataset.action === 'stop') {
        btn.style.display = 'inline-block';
      }
    } else {
      if (btn.dataset.action === 'start') {
        btn.style.display = 'inline-block';
      }
    }
  });
};

// Actualizar estado de tablet en la UI
window.updateTabletStatus = function (deviceId, status) {
  // Buscar elementos relacionados con esta tablet
  const tabletItems = document.querySelectorAll(`.tablet-item[data-device="${deviceId}"]`);

  // Determinar clase según estado
  const statusClass =
    status === 'online' ? 'bg-success' : status === 'offline' ? 'bg-danger' : 'bg-secondary';

  // Actualizar cada elemento
  tabletItems.forEach((item) => {
    // Actualizar badge de estado
    const badge = item.querySelector('.tablet-status-badge');
    if (badge) {
      badge.className = badge.className.replace(/bg-\w+/, '');
      badge.classList.add('tablet-status-badge', 'badge', statusClass);
      badge.textContent = status;
    }

    // También podríamos actualizar otros indicadores visuales si los hay
  });
};

// Manejar respuesta de dispositivo
window.handleDeviceResponse = function (response) {
  if (!response) return;

  // Verificar si hay un error
  if (response.error) {
    window.showToast('Error', response.error, 'danger');
    return;
  }

  // Mostrar mensaje de éxito si hay uno
  if (response.message) {
    window.showToast('Éxito', response.message, 'success');
  }

  // Manejar diferentes tipos de comandos
  if (response.command) {
    switch (response.command) {
      case 'speak':
        console.log('TTS enviado correctamente');
        break;
      case 'restart':
        console.log('Comando de reinicio enviado');
        break;
      case 'ping':
        // Actualizar UI con información del ping
        window.showToast('Ping', `Respuesta recibida: ${response.latency}ms`, 'info');
        break;
      // Otros comandos posibles
      default:
        console.log(`Respuesta para comando ${response.command}:`, response);
    }
  }
};

// Aplicar tema
window.applyTheme = function (theme) {
  // Verificar tema válido
  if (theme !== 'light' && theme !== 'dark') {
    console.error('Tema no válido:', theme);
    return;
  }

  // Aplicar tema al elemento HTML
  document.documentElement.setAttribute('data-bs-theme', theme);

  // Guardar preferencia
  localStorage.setItem('theme', theme);

  // Actualizar botón de tema
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
  }

  console.log(`Tema aplicado: ${theme}`);
};

// Guardar configuración general
window.saveGeneralSettings = function (event) {
  // Prevenir envío del formulario
  if (event) event.preventDefault();

  // Obtener valores del formulario
  const form = document.getElementById('general-settings-form');
  if (!form) return;

  const formData = new FormData(form);
  const settings = {
    adminPort: formData.get('admin-port'),
    mqttBroker: formData.get('mqtt-broker'),
    mongoUri: formData.get('mongo-uri'),
    logsLevel: formData.get('logs-level'),
  };

  // Enviar configuración al servidor
  if (window.socket) {
    window.socket.emit('update_settings', { general: settings });
    window.showToast('Configuración', 'Guardando configuración...', 'info');
  } else {
    window.showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

// Guardar configuración de tablets
window.saveTabletsSettings = function (event) {
  // Prevenir envío del formulario
  if (event) event.preventDefault();

  // Obtener valores del formulario
  const form = document.getElementById('tablets-settings-form');
  if (!form) return;

  const formData = new FormData(form);
  const settings = {
    checkInterval: formData.get('check-interval'),
    offlineTimeout: formData.get('offline-timeout'),
    autoRestart: formData.get('auto-restart') === 'on',
  };

  // Enviar configuración al servidor
  if (window.socket) {
    window.socket.emit('update_settings', { tablets: settings });
    window.showToast('Configuración', 'Guardando configuración de tablets...', 'info');
  } else {
    window.showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

// Cambiar contraseña de administrador
window.changeAdminPassword = function (event) {
  // Prevenir envío del formulario
  if (event) event.preventDefault();

  // Obtener valores del formulario
  const form = document.getElementById('security-settings-form');
  if (!form) return;

  const formData = new FormData(form);
  const currentPassword = formData.get('current-password');
  const newPassword = formData.get('new-password');
  const confirmPassword = formData.get('confirm-password');

  // Validar entradas
  if (!currentPassword || !newPassword || !confirmPassword) {
    window.showToast('Error', 'Todos los campos son obligatorios', 'danger');
    return;
  }

  if (newPassword !== confirmPassword) {
    window.showToast('Error', 'Las contraseñas no coinciden', 'danger');
    return;
  }

  // Enviar al servidor
  if (window.socket) {
    window.socket.emit('change_password', {
      current: currentPassword,
      new: newPassword,
    });
    window.showToast('Seguridad', 'Cambiando contraseña...', 'info');
  } else {
    window.showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

// Limpiar logs por período de tiempo
window.clearLogsByTimePeriod = function (period) {
  // Verificar período válido
  const validPeriods = ['today', 'week', 'month', 'all'];
  if (!validPeriods.includes(period)) {
    console.error('Período no válido:', period);
    return;
  }

  // Solicitar limpieza al servidor
  if (window.socket) {
    window.socket.emit('clear_logs', { period });
    window.showToast('Logs', `Limpiando logs (${period})...`, 'info');
  } else {
    window.showToast('Error', 'No hay conexión con el servidor', 'danger');
  }

  // También limpiar logs locales si period es 'all'
  if (period === 'all' && window.appState && window.appState.logs) {
    Object.keys(window.appState.logs.data).forEach((category) => {
      window.appState.logs.data[category] = [];
    });

    // Actualizar vistas
    document.querySelectorAll('.logs-container').forEach((container) => {
      container.innerHTML =
        '<div class="text-center py-3 text-muted"><em>No hay logs disponibles</em></div>';
    });
  }
};

// Agregar un log
window.addLog = function (type, message, data = {}) {
  // Crear entrada de log
  const logEntry = {
    timestamp: new Date(),
    type,
    message,
    data,
    service: 'admin',
  };

  // Emitir a través de socket si está disponible
  if (window.socket) {
    window.socket.emit('log', logEntry);
  }

  // También mostrar en consola
  const logMethod = type === 'error' ? console.error : console.log;
  logMethod(`[${type}] ${message}`, data);

  return logEntry;
};

// Exportar funciones globales para testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateLogDisplay,
    updateServiceStatus,
    updateTabletStatus,
    handleDeviceResponse,
    applyTheme,
    saveGeneralSettings,
    saveTabletsSettings,
    changeAdminPassword,
    clearLogsByTimePeriod,
    addLog,
  };
}
