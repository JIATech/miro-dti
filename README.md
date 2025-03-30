# Sistema Intercom DTI

Aplicación estilo portero intercom basada en WebRTC utilizando MiroTalkSFU Lite para funciones de llamada, ringtone, atender y colgar.

## Estructura del Proyecto

```
/miro-dti/
├── admin/             # Panel de administración y monitoreo
├── sfu_lite/   # Servidor SFU Lite para WebRTC
├── pwa/               # Aplicación Web Progresiva (interfaz de usuario)
├── signaling/         # Servidor de señalización WebSocket
├── docker-compose.yml # Configuración principal de servicios
└── README.md          # Este archivo
```

## Componentes Principales

- **PWA**: Interfaz de usuario para tablets adaptada a diferentes roles (Portero, Administración, etc.)
- **Signaling Server**: Coordina los eventos de llamada entre dispositivos
- **MiroTalkSFU Lite**: Gestiona los streams de audio/video WebRTC de manera optimizada
- **Admin Panel**: Monitorización centralizada del sistema y dispositivos

## Arquitectura Docker

El sistema está containerizado utilizando Docker y orquestado con Docker Compose, optimizado para despliegue en producción.

### Imágenes Docker

| Servicio         | Imagen                            | Base           | Puerto | Descripción                             |
| ---------------- | --------------------------------- | -------------- | ------ | --------------------------------------- |
| PWA              | dtiteam/intercom-pwa:latest       | nginx:alpine   | 80     | Aplicación web para tablets             |
| Signaling        | dtiteam/intercom-signaling:latest | node:20-alpine | 3000   | Servidor de señalización WebSocket      |
| MiroTalkSFU Lite | dtiteam/intercom-sfu_lite:latest  | node:22-slim   | 8080   | Servidor WebRTC para llamadas           |
| Admin            | dtiteam/intercom-admin:latest     | node:20-alpine | 8090   | Panel de monitorización                 |
| MongoDB          | mongo:5.0                         | -              | 27017  | Base de datos para autenticación y logs |

### Seguridad y Usuarios con Privilegios Limitados

Todas las imágenes implementan el principio de menor privilegio mediante usuarios no-root:

#### PWA (Nginx)

- **Usuario**: `nginx` (pre-existente en imagen base)
- **Permisos**: Sólo acceso de lectura a archivos estáticos
- **Seguridad adicional**:
  - Encabezados HTTP de seguridad configurados (X-Frame-Options, X-XSS-Protection)
  - Sin acceso a archivos .htaccess

#### Signaling y Admin

- **Usuario**: `appuser` (UID 1000)
- **Permisos**: Acceso sólo a directorio /app y sus logs
- **Seguridad adicional**:
  - Instalación determinista con `npm ci`
  - Solo dependencias de producción instaladas

#### MiroTalkSFU Lite

- **Usuario**: `mirotalk` (UID 1000)
- **Permisos**: Acceso a directorios específicos (/src, /src/app/rec, /src/app/logs)
- **Consideraciones especiales**:
  - Permisos específicos para FFmpeg y WebRTC
  - Instalación optimizada para reducir tamaño

### Características de Seguridad

1. **Multi-stage Builds**:

   - Reducen superficie de ataque al incluir solo componentes necesarios
   - Separan entorno de construcción y ejecución

2. **Healthchecks**:

   - Cada servicio implementa verificaciones de salud
   - Monitorización automática de estado en tiempo real

3. **Optimización de Imágenes**:

   - Reducción de tamaño eliminando cachés y archivos temporales
   - Uso de imágenes Alpine donde es posible para minimizar superficie

4. **Configuración vía Variables de Entorno**:
   - Separación de código y configuración
   - Posibilidad de modificar comportamiento sin cambiar imágenes

## Configuración y Despliegue

### Variables de Entorno Principales

El equipo de infraestructura puede ajustar estas variables para personalizar el despliegue:

```dotenv
# Configuración de red
LOCAL_SFU_IP=192.168.1.100        # IP local del servidor SFU
FALLBACK_SFU_IP=example.com       # IP/dominio del servidor fallback
SIGNALING_PORT=3000               # Puerto del servidor de señalización
SFU_PORT=8080                     # Puerto del servidor MiroTalkSFU Lite
ADMIN_PORT=8090                   # Puerto del panel de administración

# Seguridad
API_KEY_SECRET=secret_key_here    # Clave para API de MiroTalkSFU Lite
JWT_KEY=jwt_secret_here           # Clave para autenticación JWT
ADMIN_USER=admin                  # Usuario del panel admin (default: admin)
ADMIN_PASSWORD=admin              # Contraseña (default: admin)
```

### Puertos y Rangos

Para WebRTC es crucial configurar correctamente:

- **TCP**: 80 (PWA), 3000 (Signaling), 8080 (MiroTalkSFU Lite), 8090 (Admin), 27017 (MongoDB)
- **UDP**: 40000-40010 (Puertos WebRTC para streams de audio/video)

### Despliegue en Producción

```bash
# Descargar imágenes
docker-compose pull

# Desplegar todos los servicios
docker-compose up -d

# Verificar estado
docker-compose ps
```

### Persistencia de Datos

Los siguientes volúmenes preservan datos entre reinicios:

- `/mongodb_data`: Base de datos MongoDB
- `./signaling/logs`: Logs del servidor de señalización
- `./sfu_lite/app/rec`: Grabaciones (si se habilitan)
- `./admin/logs`: Logs del panel de administración

## Monitorización y Administración

El panel de administración ofrece monitorización centralizada:

- **URL**: http://servidor:8090
- **Autenticación**: Usuario/contraseña (por defecto admin/admin)
- **Funcionalidades**:
  - Log central con todas las tablets
  - Métricas de calidad de llamadas
  - Estado de tablets y dispositivos
  - Configuración remota

## Flujo de Trabajo para el Desarrollo

```bash
# Clonar repositorio
git clone https://github.com/JIATech/miro-dti.git
cd miro-dti

# Desarrollo con contenedores
docker-compose -f docker-compose.develop.yml up -d

# Construir nuevas imágenes
docker-compose build

# Publicar en Docker Hub
docker-compose push
```

## Notas sobre Seguridad

Este sistema implementa:

1. **Seguridad por capas**:

   - Red Docker aislada
   - Usuarios no-root en cada contenedor
   - Permisos mínimos necesarios

2. **Autenticación**:

   - Básica para panel de administración
   - Basada en roles para la PWA

3. **Logs centralizados**:

   - Todos los componentes envían logs al panel admin
   - Asegura audit trail para problemas de seguridad

4. **Ambiente de producción**:
   - Se recomienda habilitar autenticación en MongoDB
   - Implementar HTTPS con certificados válidos
   - Configurar firewall con puertos específicos

## Componentes Externos

### MiroTalkSFU Lite

MiroTalkSFU Lite es un fork optimizado de MiroTalkSFU, adaptado específicamente para las necesidades del sistema Intercom DTI. A diferencia de versiones anteriores del proyecto, ahora este componente está **integrado directamente** en el repositorio (no es un submódulo) en la carpeta `/sfu_lite`.

Las principales optimizaciones realizadas incluyen:

- Reducción significativa de puertos utilizados (solo 3000/TCP y 40000-40010/UDP)
- Interfaz simplificada para uso específico como intercom
- Desactivación de características innecesarias (chat, pizarra, etc.)
- Configuración optimizada para sistemas con 5-10 dispositivos

Este fork está basado en el excelente trabajo de Miroslav Pejic en [MiroTalkSFU](https://github.com/miroslavpejic85/mirotalksfu), al cual damos todo el crédito por el código base original.

### Actualización y Mantenimiento

Como este componente ahora es parte integral del repositorio principal, se actualiza junto con el resto del proyecto:

```bash
# Clonar el repositorio completo
git clone https://github.com/JIATech/miro-dti.git
cd miro-dti
```

Si deseas contribuir mejoras específicas a MiroTalkSFU Lite:

1. Realiza los cambios en la carpeta `/sfu_lite`
2. Asegúrate de probar localmente con `docker-compose up`
3. Envía un Pull Request con tus modificaciones

### Personalización Adicional

Si necesitas adaptar aún más la configuración de MiroTalkSFU Lite, puedes modificar los siguientes archivos:

- `/sfu_lite/app/src/config.js`: Configuración principal del servicio
- `/sfu_lite/docker-compose.template.yml`: Plantilla para despliegue independiente

### WallPanel

Para el despliegue en tablets, este proyecto utiliza WallPanel como aplicación contenedora, aprovechando sus capacidades de:

- Identificación única de dispositivos
- Modo kiosco para aplicación en pantalla completa
- Inicio automático después de reinicios
- Integración profunda con hardware Android

La documentación detallada sobre la integración con WallPanel se encuentra en la carpeta `/docs/wallpanel` e incluye:

- [Introducción y descripción general](./docs/wallpanel/README.md)
- [Configuración recomendada](./docs/wallpanel/configuracion_recomendada.md)
- [Referencia de la API de JavaScript](./docs/wallpanel/api_reference.md)

El código fuente de referencia (solo para análisis) se encuentra en `/libs/wallpanel`.

WallPanel es un proyecto de código abierto y se puede descargar desde:
https://github.com/WallPanel-Project/wallpanel-android
