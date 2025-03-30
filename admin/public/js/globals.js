/**
 * Panel de Administración - Sistema Intercom
 * Definiciones globales
 */

// Variables y funciones que se utilizan en varios archivos
window.updateLogDisplay = function(logs, container, showTimestamps = true) {
  const logContainer = document.getElementById(container);
  if (!logContainer) return;
  
  logContainer.innerHTML = '';
  
  logs.forEach(log => {
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

window.updateServiceStatus = function(service, status) {
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

window.updateTabletStatus = function(deviceId, status) {
  const tabletElement = document.querySelector(`.tablet-item[data-device="${deviceId}"]`);
  if (!tabletElement) return;
  
  const statusBadge = tabletElement.querySelector('.tablet-status-badge');
  if (statusBadge) {
    statusBadge.className = `tablet-status-badge badge ${getStatusBadgeClass(status)}`;
    statusBadge.textContent = status;
  }
  
  // Actualizar estado en el objeto appState
  if (window.appState && window.appState.tablets) {
    const tablet = window.appState.tablets.list.find(t => t.deviceId === deviceId);
    if (tablet) {
      tablet.status = status;
    }
  }
};

window.handleDeviceResponse = function(data) {
  console.log('Respuesta del dispositivo:', data);
  
  if (data.success) {
    showToast('Acción Completada', `La acción se ha completado con éxito en ${data.deviceName}`, 'success');
  } else {
    showToast('Error', `Error al ejecutar la acción en ${data.deviceName}: ${data.message}`, 'danger');
  }
  
  // Actualizar información si es necesario
  if (data.type === 'status') {
    updateTabletStatus(data.deviceId, data.status);
  }
};

// Función para aplicar tema (oscuro/claro)
window.applyTheme = function(theme) {
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
window.saveGeneralSettings = function() {
  const settings = {
    adminServer: document.getElementById('admin-server-url').value,
    mqttBroker: document.getElementById('mqtt-broker-url').value,
    logsRetention: parseInt(document.getElementById('logs-retention').value, 10),
    refreshInterval: parseInt(document.getElementById('refresh-interval').value, 10)
  };
  
  // Guardar configuración mediante Socket.IO
  if (window.socket) {
    window.socket.emit('save-settings', { type: 'general', settings });
    showToast('Configuración Guardada', 'La configuración general se ha guardado correctamente', 'success');
  } else {
    showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

window.saveTabletsSettings = function() {
  const settings = {
    autoRegister: document.getElementById('auto-register-tablets').checked,
    heartbeatInterval: parseInt(document.getElementById('heartbeat-interval').value, 10),
    offlineTimeout: parseInt(document.getElementById('offline-timeout').value, 10)
  };
  
  // Guardar configuración mediante Socket.IO
  if (window.socket) {
    window.socket.emit('save-settings', { type: 'tablets', settings });
    showToast('Configuración Guardada', 'La configuración de tablets se ha guardado correctamente', 'success');
  } else {
    showToast('Error', 'No hay conexión con el servidor', 'danger');
  }
};

window.changeAdminPassword = function(event) {
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

window.clearLogsByTimePeriod = function(timePeriod) {
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
    showToast('Limpieza de Logs', `Se han eliminado los logs anteriores a ${cutoffTime.toLocaleString()}`, 'info');
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
window.addLog = function(type, message, data = {}) {
  if (window.socket) {
    window.socket.emit('log', { type, message, data });
  }
  
  // También mostrar en consola para debug
  console.log(`[${type}] ${message}`, data);
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
    addLog
  };
}
