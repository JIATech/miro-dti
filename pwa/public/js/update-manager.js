/**
 * Gestor de Actualizaciones para Intercom DTI
 * JIATech - Sistema de actualización automática para tablets
 */

class UpdateManager {
  constructor() {
    this.currentVersion = 'initial';
    this.updateAvailable = false;
    this.updateVersion = null;
    this.forceUpdate = false;
    this.initEventListeners();
    this.checkForUpdates();
  }

  initEventListeners() {
    // Escuchar mensajes del service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          this.handleUpdateAvailable(event.data.version, event.data.force);
        } else if (event.data && event.data.type === 'RELOAD_PAGE') {
          window.location.reload();
        }
      });

      // Escuchar cambios en el estado de la red
      window.addEventListener('online', () => {
        console.log('Dispositivo en línea, verificando actualizaciones...');
        this.checkForUpdates();
      });
    }

    // Escuchar mensajes MQTT para actualizaciones (integración con MQTT de WallPanel)
    if (window.wallpanel && typeof window.wallpanel.mqtt !== 'undefined') {
      console.log('Iniciando listener MQTT para actualizaciones');
      window.wallpanel.mqtt.subscribe('intercom/update/notification');

      // Función para recibir mensajes MQTT
      window.wallpanel.mqtt.onMessage = (topic, message) => {
        if (topic === 'intercom/update/notification') {
          try {
            const updateData = JSON.parse(message);
            console.log('Notificación de actualización recibida vía MQTT:', updateData);
            this.handleUpdateAvailable(updateData.version, updateData.forceUpdate);
          } catch (error) {
            console.error('Error al procesar mensaje MQTT de actualización:', error);
          }
        }
      };
    }
  }

  checkForUpdates() {
    // Verificar si hay service worker registrado
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      console.log('Solicitando verificación de actualizaciones al Service Worker');
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_UPDATE',
      });

      // También comprobar directamente
      fetch('/config/version.json?_=' + new Date().getTime(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.version && data.version !== this.currentVersion && data.version !== 'initial') {
            this.handleUpdateAvailable(data.version, data.forceUpdate);
          }
        })
        .catch((err) => {
          console.error('Error verificando actualizaciones:', err);
        });
    }
  }

  handleUpdateAvailable(version, force = false) {
    console.log(`Nueva actualización disponible: ${version}, forzada: ${force}`);

    this.updateAvailable = true;
    this.updateVersion = version;
    this.forceUpdate = force;

    // Registrar evento de actualización disponible
    if (window.wallpanel) {
      window.wallpanel.publishEvent('updateAvailable', {
        version: version,
        force: force,
        timestamp: new Date().toISOString(),
      });
    }

    // Mostrar notificación de actualización
    this.showUpdateNotification();

    // Si es forzada, actualizar inmediatamente
    if (force) {
      console.log('Actualización forzada, recargando la aplicación...');
      setTimeout(() => {
        window.location.reload();
      }, 3000); // Dar tiempo para mostrar la notificación
    }
  }

  showUpdateNotification() {
    // Crear elemento de notificación si no existe
    if (!document.getElementById('update-notification')) {
      const notification = document.createElement('div');
      notification.id = 'update-notification';
      notification.className = 'update-notification';
      notification.innerHTML = `
                <div class="update-content">
                    <h3>¡Nueva actualización disponible!</h3>
                    <p>Versión: <span id="update-version">${this.updateVersion}</span></p>
                    <div class="update-actions">
                        <button id="update-now" class="btn-primary">Actualizar ahora</button>
                        <button id="update-later" class="btn-secondary">Más tarde</button>
                    </div>
                </div>
            `;

      document.body.appendChild(notification);

      // Añadir estilos para la notificación
      const style = document.createElement('style');
      style.textContent = `
                .update-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #f8f9fa;
                    border-left: 4px solid #007bff;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    padding: 15px;
                    z-index: 1000;
                    border-radius: 5px;
                    width: 300px;
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .update-content h3 {
                    margin-top: 0;
                    color: #343a40;
                }
                .update-actions {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 15px;
                }
                .btn-primary {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
            `;
      document.head.appendChild(style);

      // Añadir event listeners a los botones
      document.getElementById('update-now').addEventListener('click', () => {
        this.installUpdate();
      });

      document.getElementById('update-later').addEventListener('click', () => {
        this.dismissUpdateNotification();
      });
    } else {
      // Actualizar contenido si ya existe
      document.getElementById('update-version').textContent = this.updateVersion;
      document.getElementById('update-notification').style.display = 'block';
    }
  }

  dismissUpdateNotification() {
    const notification = document.getElementById('update-notification');
    if (notification) {
      notification.style.display = 'none';
    }
  }

  installUpdate() {
    console.log('Instalando actualización...');

    // Mostrar spinner o indicador de carga
    const updateBtn = document.getElementById('update-now');
    if (updateBtn) {
      updateBtn.textContent = 'Actualizando...';
      updateBtn.disabled = true;
    }

    // Registrar evento de instalación de actualización
    if (window.wallpanel) {
      window.wallpanel.publishEvent('updateInstalled', {
        version: this.updateVersion,
        timestamp: new Date().toISOString(),
      });
    }

    // Recargar para aplicar la actualización
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

// Inicializar el gestor de actualizaciones cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
  window.updateManager = new UpdateManager();
  console.log('Gestor de actualizaciones inicializado');
});
