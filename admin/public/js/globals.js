/**
 * Panel de Administración - Sistema Intercom
 * Definiciones globales
 */

// Helper function for status badges
function getStatusBadgeClass(status) {
  switch (status ? status.toLowerCase() : 'unknown') {
    case 'online':
    case 'connected':
    case 'active':
    case 'running':
      return 'bg-success';
    case 'offline':
    case 'disconnected':
    case 'inactive':
    case 'stopped':
      return 'bg-danger';
    case 'connecting':
    case 'reconnecting':
    case 'pending':
      return 'bg-warning';
    case 'error':
      return 'bg-danger';
    case 'idle':
      return 'bg-secondary';
    case 'ringing':
    case 'busy':
      return 'bg-info';
    default:
      return 'bg-secondary';
  }
}

// Function to show toast notifications
function showToast(title, message, type = 'info') {
  // Assuming Bootstrap 5 Toast component is available
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer || typeof bootstrap === 'undefined') {
    console.error('Toast container or Bootstrap not found. Cannot show toast:', title, message);
    // Fallback to alert if Bootstrap or container is missing
    alert(`${title}: ${message}`);
    return;
  }

  const toastId = `toast-${Date.now()}`;
  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <strong>${title}</strong><br>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 5000 }); // Auto-hide after 5 seconds
  toast.show();

  // Remove the toast element from DOM after it's hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Function to add a log entry (client-side placeholder if needed)
function addLog(level, component, message) {
  // This function might primarily be used server-side.
  // Client-side, it could potentially send log data to the server via socket.
  console.log(`[${level.toUpperCase()}] [${component}] ${message}`);
  // Example: if (window.socket) { window.socket.emit('log', { level, component, message }); }
}

// Function to update the log display area
function updateLogDisplay(logs, containerId, showTimestamps = true) {
  const logContainer = document.getElementById(containerId);
  if (!logContainer) {
    console.error(`Log container #${containerId} not found.`);
    return;
  }

  // Clear existing logs efficiently
  while (logContainer.firstChild) {
    logContainer.removeChild(logContainer.firstChild);
  }

  if (!Array.isArray(logs)) {
    console.error('updateLogDisplay received non-array data:', logs);
    return;
  }

  const fragment = document.createDocumentFragment();
  logs.forEach((log) => {
    if (!log || typeof log !== 'object') return; // Skip invalid log entries

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${log.level || 'info'}`;

    let logText = '';
    if (showTimestamps && log.timestamp) {
      try {
        const timestamp = new Date(log.timestamp);
        // Check if timestamp is valid before formatting
        if (!isNaN(timestamp)) {
           logText += `<span class="log-time">${timestamp.toLocaleTimeString()}</span> `;
        } else {
           logText += `<span class="log-time">[Invalid Date]</span> `;
        }
      } catch (e) {
         logText += `<span class="log-time">[Date Error]</span> `;
      }
    }

    logText += `<span class="log-component">[${log.component || 'system'}]</span> `;
    logText += `<span class="log-message">${log.message || '(empty message)'}</span>`;

    logEntry.innerHTML = logText;
    fragment.appendChild(logEntry);
  });

  logContainer.appendChild(fragment);

  // Auto-scroll if enabled (check if appState exists and has the expected structure)
  if (window.appState && window.appState.logs && window.appState.logs.autoScroll) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

// Function to update service status indicators
function updateServiceStatus(service, status) {
  const serviceElement = document.querySelector(`.service-item[data-service="${service}"]`);
  if (!serviceElement) return;

  const statusBadge = serviceElement.querySelector('.service-status-badge');
  if (statusBadge) {
    statusBadge.className = `service-status-badge badge ${getStatusBadgeClass(status)}`;
    statusBadge.textContent = status || 'Unknown'; // Provide default text
  }

  // Update status in the global state object if it exists
  if (window.appState && window.appState.services && window.appState.services.status) {
     // Ensure the service exists in the status object before updating
     if (typeof window.appState.services.status[service] !== 'undefined') {
       window.appState.services.status[service] = status;
     }
  }
}

// Function to update tablet status indicators
function updateTabletStatus(deviceId, status) {
  const tabletElement = document.querySelector(`.tablet-item[data-device-id="${deviceId}"]`); // Use data-device-id
  if (!tabletElement) {
    // console.warn(`Tablet element not found for deviceId: ${deviceId}`);
    return;
  }

  const statusBadge = tabletElement.querySelector('.tablet-status-badge');
  if (statusBadge) {
    statusBadge.className = `tablet-status-badge badge ${getStatusBadgeClass(status)}`;
    statusBadge.textContent = status || 'Unknown'; // Provide default text
  }

  // Update status in the global state object if it exists
  if (window.appState && window.appState.tablets && Array.isArray(window.appState.tablets.list)) {
    const tablet = window.appState.tablets.list.find((t) => t.deviceId === deviceId);
    if (tablet) {
      tablet.status = status;
    }
  }
}

// Function to handle responses from device actions
function handleDeviceResponse(data) {
  console.log('Handling device response:', data);

  if (!data || typeof data !== 'object') {
     showToast('Error', 'Invalid response received from device action.', 'danger');
     return;
  }

  const deviceName = data.deviceName || data.deviceId || 'Unknown Device';

  if (data.success) {
    showToast(
      'Action Completed',
      `Action succeeded on ${deviceName}. ${data.message || ''}`,
      'success'
    );
    // Optionally trigger a state refresh here if needed
    // Example: if (window.requestStateUpdate) { window.requestStateUpdate(); }
  } else {
    showToast(
      'Action Failed',
      `Action failed on ${deviceName}: ${data.message || 'No details provided.'}`,
      'danger'
    );
  }

  // Update status if the response includes it
  if (data.deviceId && data.status) {
    updateTabletStatus(data.deviceId, data.status);
  }
}


// Function to apply the selected theme (dark/light)
function applyTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') {
    console.warn(`Invalid theme specified: ${theme}. Defaulting to light.`);
    theme = 'light'; // Default to light theme if invalid
  }

  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(`theme-${theme}`);

  try {
    localStorage.setItem('theme', theme);
  } catch (e) {
    console.error('Failed to save theme preference to localStorage:', e);
  }


  // Update the theme switch UI element if it exists
  const themeSwitch = document.getElementById('theme-switch');
  if (themeSwitch) {
    themeSwitch.checked = theme === 'dark';
  }
}

// --- Configuration Saving Functions ---
// These functions rely on specific DOM element IDs and a global 'socket' object.

function saveGeneralSettings() {
  // Check for socket connection first
  if (!window.socket || !window.socket.connected) {
     showToast('Error', 'Cannot save settings. No connection to the server.', 'danger');
     return;
  }

  try {
    const settings = {
      adminServerUrl: document.getElementById('admin-server-url').value.trim(),
      mqttBrokerUrl: document.getElementById('mqtt-broker-url').value.trim(),
      logsRetentionDays: parseInt(document.getElementById('logs-retention').value, 10),
      uiRefreshIntervalSeconds: parseInt(document.getElementById('refresh-interval').value, 10),
    };

    // Basic validation
    if (isNaN(settings.logsRetentionDays) || settings.logsRetentionDays <= 0) {
       showToast('Validation Error', 'Log retention must be a positive number of days.', 'warning');
       return;
    }
     if (isNaN(settings.uiRefreshIntervalSeconds) || settings.uiRefreshIntervalSeconds < 5) {
       showToast('Validation Error', 'UI Refresh interval must be at least 5 seconds.', 'warning');
       return;
    }
    // Add more validation as needed (e.g., URL format)

    window.socket.emit('save-settings', { type: 'general', settings }, (response) => {
       if (response && response.success) {
           showToast('Settings Saved', 'General settings saved successfully.', 'success');
       } else {
           showToast('Error Saving Settings', response?.message || 'Failed to save general settings.', 'danger');
       }
    });

  } catch (error) {
     console.error('Error preparing general settings:', error);
     showToast('Error', 'Could not read settings from the form.', 'danger');
  }
}

function saveTabletsSettings() {
   // Check for socket connection first
  if (!window.socket || !window.socket.connected) {
     showToast('Error', 'Cannot save settings. No connection to the server.', 'danger');
     return;
  }

  try {
    const settings = {
      allowAutoRegister: document.getElementById('auto-register-tablets').checked,
      heartbeatIntervalSeconds: parseInt(document.getElementById('heartbeat-interval').value, 10),
      offlineTimeoutSeconds: parseInt(document.getElementById('offline-timeout').value, 10),
    };

     // Basic validation
    if (isNaN(settings.heartbeatIntervalSeconds) || settings.heartbeatIntervalSeconds <= 0) {
       showToast('Validation Error', 'Heartbeat interval must be a positive number of seconds.', 'warning');
       return;
    }
     if (isNaN(settings.offlineTimeoutSeconds) || settings.offlineTimeoutSeconds <= settings.heartbeatIntervalSeconds) {
       showToast('Validation Error', 'Offline timeout must be greater than the heartbeat interval.', 'warning');
       return;
    }

     window.socket.emit('save-settings', { type: 'tablets', settings }, (response) => {
       if (response && response.success) {
           showToast('Settings Saved', 'Tablet settings saved successfully.', 'success');
       } else {
           showToast('Error Saving Settings', response?.message || 'Failed to save tablet settings.', 'danger');
       }
    });

  } catch (error) {
     console.error('Error preparing tablet settings:', error);
     showToast('Error', 'Could not read tablet settings from the form.', 'danger');
  }
}


function changeAdminPassword(event) {
  if (event) {
     event.preventDefault(); // Prevent default form submission if called from an event
  }

  // Check for socket connection first
  if (!window.socket || !window.socket.connected) {
     showToast('Error', 'Cannot change password. No connection to the server.', 'danger');
     return;
  }

  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Basic client-side validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Validation Error', 'All password fields are required.', 'warning');
    return;
  }

  if (newPassword.length < 8) { // Example: Enforce minimum length
     showToast('Validation Error', 'New password must be at least 8 characters long.', 'warning');
     return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Validation Error', 'New passwords do not match.', 'warning');
    return;
  }

   if (newPassword === currentPassword) {
    showToast('Validation Error', 'New password cannot be the same as the current password.', 'warning');
    return;
  }


  // Send request to server via Socket.IO
  window.socket.emit('change-password', { currentPassword, newPassword }, (response) => {
      if (response && response.success) {
          showToast('Password Changed', 'Admin password updated successfully.', 'success');
          // Clear password fields after successful change
          currentPasswordInput.value = '';
          newPasswordInput.value = '';
          confirmPasswordInput.value = '';
      } else {
          showToast('Error Changing Password', response?.message || 'Failed to change password. Check current password.', 'danger');
      }
  });
}


function clearLogsByTimePeriod(timePeriod) {
   // Check for socket connection first
  if (!window.socket || !window.socket.connected) {
     showToast('Error', 'Cannot clear logs. No connection to the server.', 'danger');
     return;
  }

  let cutoffTimeISO;
  const now = Date.now(); // Use timestamp for calculations

  switch (timePeriod) {
    case '1h':
      cutoffTimeISO = new Date(now - 3600 * 1000).toISOString();
      break;
    case '6h':
      cutoffTimeISO = new Date(now - 6 * 3600 * 1000).toISOString();
      break;
    case '24h':
      cutoffTimeISO = new Date(now - 24 * 3600 * 1000).toISOString();
      break;
    case '7d':
      cutoffTimeISO = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
      break;
    case '30d':
      cutoffTimeISO = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
      break;
    case 'all':
       // No cutoff time needed, server should handle 'all' specifically
       cutoffTimeISO = null; // Or a specific value server understands for 'all'
       break;
    default:
      showToast('Error', 'Invalid time period selected for clearing logs.', 'warning');
      return;
  }

  const payload = { timePeriod }; // Send the period identifier
  if (cutoffTimeISO) {
     payload.before = cutoffTimeISO; // Optionally send calculated time if server needs it
  }

  console.log(`Requesting log clear for period: ${timePeriod}`);
  window.socket.emit('clear-logs', payload, (response) => {
      if (response && response.success) {
          showToast('Logs Cleared', `Logs older than ${timePeriod} (or all) cleared successfully. Count: ${response.count || 0}`, 'success');
          // Optionally trigger a refresh of the log view
          // Example: if (window.requestLogUpdate) { window.requestLogUpdate(); }
      } else {
          showToast('Error Clearing Logs', response?.message || 'Failed to clear logs.', 'danger');
      }
  });
}


// --- Initialization and Global Exposure ---

// Store functions in an object for easier management
const globalFunctions = {
  getStatusBadgeClass,
  showToast,
  addLog,
  updateLogDisplay,
  updateServiceStatus,
  updateTabletStatus,
  handleDeviceResponse,
  applyTheme,
  saveGeneralSettings,
  saveTabletsSettings,
  changeAdminPassword,
  clearLogsByTimePeriod,
};

// Conditionally expose functions to the window object if in a browser environment
if (typeof window !== 'undefined') {
  Object.keys(globalFunctions).forEach(key => {
    window[key] = globalFunctions[key];
  });

  // Initialize theme on load
  document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light'; // Default to light
    applyTheme(savedTheme);

    // Add event listener for the theme switch if it exists
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
      themeSwitch.addEventListener('change', (event) => {
        applyTheme(event.target.checked ? 'dark' : 'light');
      });
    }

     // Add event listeners for save buttons etc. if they exist
     // Example for General Settings Save Button
     const saveGeneralBtn = document.getElementById('save-general-settings-btn');
     if (saveGeneralBtn) {
         saveGeneralBtn.addEventListener('click', saveGeneralSettings);
     }

      // Example for Tablets Settings Save Button
     const saveTabletsBtn = document.getElementById('save-tablets-settings-btn');
     if (saveTabletsBtn) {
         saveTabletsBtn.addEventListener('click', saveTabletsSettings);
     }

      // Example for Change Password Form
     const changePasswordForm = document.getElementById('change-password-form');
     if (changePasswordForm) {
         changePasswordForm.addEventListener('submit', changeAdminPassword);
     }

      // Example for Log Clearing Buttons (using event delegation might be better)
     const logClearControls = document.getElementById('log-clear-controls'); // Assuming a container
     if (logClearControls) {
         logClearControls.addEventListener('click', (event) => {
            if (event.target.matches('button[data-clear-period]')) {
                const period = event.target.getAttribute('data-clear-period');
                if (period) {
                    clearLogsByTimePeriod(period);
                }
            }
         });
     }

  });
}

// Export functions for potential use in Node.js environments (e.g., testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalFunctions;
}

// Example of using a function (can be removed, just for demo)
// showToast('Globals Loaded', 'Global functions are ready.', 'info');
