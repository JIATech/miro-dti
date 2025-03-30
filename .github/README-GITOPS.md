# GitOps con Docker: Sistema de Despliegue Continuo para Intercom DTI

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura](#arquitectura)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Configuración y Uso](#configuración-y-uso)
6. [Troubleshooting](#troubleshooting)
7. [Seguridad](#seguridad)
8. [Referencias](#referencias)

## Introducción

Este documento describe la implementación de GitOps con Docker para el sistema Intercom DTI de JIATech. Esta solución permite desplegar actualizaciones automáticamente a todas las tablets cuando se realizan cambios en el repositorio principal.

### ¿Qué es GitOps?

GitOps es una metodología que utiliza Git como fuente única de verdad para la infraestructura declarativa. Los cambios en el repositorio desencadenan automáticamente actualizaciones en los sistemas de producción.

### Beneficios para JIATech

- **Despliegue Continuo**: Las tablets se actualizan automáticamente con cada push a la rama principal
- **Trazabilidad**: Registro completo de cambios y despliegues
- **Reversibilidad**: Capacidad de volver a versiones anteriores fácilmente
- **Automatización**: Reducción de errores humanos durante el despliegue

## Arquitectura

![Arquitectura GitOps](https://via.placeholder.com/800x400?text=Diagrama+de+Arquitectura+GitOps+JIATech)

La arquitectura implementada consta de:

1. **Repositorio Git**: Fuente única de verdad
2. **Pipeline de CI/CD**: GitHub Actions para construir y publicar imágenes Docker
3. **Orquestación de Contenedores**: Docker Compose para gestionar los servicios
4. **Sistema de Notificación**: Comunicación con las tablets para aplicar actualizaciones
5. **Actualización de PWA**: Service Worker para gestionar la actualización del cliente

## Componentes del Sistema

### 1. GitHub Actions Workflow

El archivo `.github/workflows/deploy-intercom.yml` define el flujo de trabajo de CI/CD:

```yaml
name: Deploy Intercom DTI

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Entorno de despliegue'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
```

Este workflow se activa automáticamente con cada push a la rama main, o manualmente seleccionando el entorno.

### 2. Service Worker para PWA

El archivo `pwa/public/js/service-worker.js` gestiona las actualizaciones del cliente:

```javascript
// Verificar actualizaciones periódicamente
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

function checkForUpdates() {
  console.log('[Service Worker] Checking for updates...');

  fetch('/config/version.json?_=' + new Date().getTime(), {
    cache: 'no-store',
  })
    .then((response) => response.json())
    .then((data) => {
      const newVersion = data.version;
      // Procesar actualizaciones...
    });
}
```

### 3. API de Notificación

El servidor de administración incluye un endpoint para notificar a las tablets:

```javascript
app.post('/api/notify-update', async (req, res) => {
  try {
    const { version, force = false } = req.body;

    // Publicar mensaje MQTT para notificar a todas las tablets
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish('intercom/update/notification', JSON.stringify(versionData));
    }

    // Registrar evento...
  } catch (error) {
    // Manejar errores...
  }
});
```

### 4. Gestor de Actualizaciones del Cliente

El archivo `pwa/public/js/update-manager.js` implementa la lógica para recibir y aplicar actualizaciones:

```javascript
// Escuchar mensajes MQTT para actualizaciones
if (window.wallpanel && typeof window.wallpanel.mqtt !== 'undefined') {
  window.wallpanel.mqtt.subscribe('intercom/update/notification');

  window.wallpanel.mqtt.onMessage = (topic, message) => {
    if (topic === 'intercom/update/notification') {
      // Procesar notificación de actualización...
    }
  };
}
```

## Flujo de Trabajo

### Flujo de Despliegue Automatizado

1. **Desarrollo**:

   - Los desarrolladores realizan cambios en su entorno local
   - Prueban los cambios y crean un Pull Request

2. **Revisión y Aprobación**:

   - Revisión de código por otros desarrolladores
   - Pruebas automatizadas para validar cambios
   - Aprobación y merge a la rama principal

3. **Construcción y Publicación**:

   - GitHub Actions detecta el push a main
   - Construye imágenes Docker para cada componente
   - Publica las imágenes en GitHub Container Registry
   - Etiqueta las imágenes con la versión actual

4. **Despliegue en Staging**:

   - Se despliegan automáticamente en el entorno de staging
   - Se ejecutan pruebas de integración

5. **Despliegue en Producción**:

   - Despliegue automático o manual según configuración
   - Notificación a las tablets sobre la actualización disponible

6. **Actualización de Tablets**:
   - Las tablets reciben la notificación vía MQTT
   - El Service Worker descarga la nueva versión
   - La PWA se actualiza automáticamente o solicita confirmación al usuario

### Versiones y Etiquetado

Cada versión desplegada se etiqueta con:

- Fecha de compilación (YYYYMMDD)
- Hash corto del commit (7 caracteres)
- Ejemplo: `20250330-a1b2c3d`

## Configuración y Uso

### Configuración Inicial

1. **Secrets de GitHub**:

   Es necesario configurar los siguientes secrets en el repositorio:

   - `STAGING_HOST`: Dirección IP del servidor de staging
   - `STAGING_USERNAME`: Usuario SSH para staging
   - `STAGING_SSH_KEY`: Clave SSH para staging
   - `PRODUCTION_HOST`: Dirección IP del servidor de producción
   - `PRODUCTION_USERNAME`: Usuario SSH para producción
   - `PRODUCTION_SSH_KEY`: Clave SSH para producción

2. **Entornos de GitHub**:

   Crear dos entornos en la configuración del repositorio:

   - `staging`: Para despliegues de prueba
   - `production`: Para despliegues en producción (con aprobación requerida)

### Uso Diario

#### Despliegue Automático

1. Simplemente hacer push a la rama `main` para desencadenar el despliegue

#### Despliegue Manual

1. Ir a la pestaña "Actions" en GitHub
2. Seleccionar el workflow "Deploy Intercom DTI"
3. Hacer clic en "Run workflow"
4. Seleccionar el entorno (staging/production)
5. Hacer clic en "Run workflow"

### Monitoreo de Despliegues

- Los logs de despliegue están disponibles en la pestaña "Actions" de GitHub
- El panel de administración muestra la versión actual en cada tablet
- Los eventos de actualización se registran en la sección de logs del sistema

## Troubleshooting

### Problemas Comunes y Soluciones

1. **La tablet no recibe la actualización**:

   - Verificar conexión MQTT en la tablet
   - Comprobar que el Service Worker esté registrado
   - Forzar actualización desde el panel de administración

2. **Fallos en el pipeline de CI/CD**:

   - Verificar que las credenciales SSH estén configuradas correctamente
   - Comprobar acceso a GitHub Container Registry
   - Verificar que el servidor de despliegue tenga permisos para hacer pull de las imágenes

3. **Rollback a versión anterior**:
   - Usar el panel de administración para desplegar una versión específica
   - Alternativamente, hacer un revert en Git y push a main

## Seguridad

### Consideraciones de Seguridad

1. **Protección de Credenciales**:

   - Todas las claves y secretos se almacenan en GitHub Secrets
   - No se incluyen credenciales en el código fuente

2. **Acceso a Servidores**:

   - Se utilizan claves SSH con acceso limitado
   - Solo los puertos necesarios están abiertos en los servidores

3. **Verificación de Imágenes**:
   - Las imágenes Docker se construyen desde el código fuente verificado
   - No se utilizan imágenes de terceros sin verificación

## Referencias

- [Documentación de GitHub Actions](https://docs.github.com/es/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PWA Service Workers](https://developers.google.com/web/fundamentals/primers/service-workers)
- [Principios de GitOps](https://www.weave.works/technologies/gitops/)

---

Documentación preparada por el equipo de JIATech, 2025.
