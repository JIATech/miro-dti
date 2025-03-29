# Sistema Intercom DTI

Aplicación estilo portero intercom basada en WebRTC utilizando MiroTalkSFU para funciones de llamada, ringtone, atender y colgar.

## Estructura del Proyecto

```
/miro-dti/
├── admin/             # Panel de administración y monitoreo
├── mirotalksfu/       # Servidor SFU para WebRTC
├── pwa/               # Aplicación Web Progresiva (interfaz de usuario)
├── signaling/         # Servidor de señalización WebSocket
├── docker-compose.yml # Configuración principal de servicios
└── README.md          # Este archivo
```

## Componentes Principales

- **PWA**: Interfaz de usuario para tablets adaptada a diferentes roles (Portero, Administración, etc.)
- **Signaling Server**: Coordina los eventos de llamada entre dispositivos
- **MiroTalkSFU**: Gestiona los streams de audio/video WebRTC
- **Admin Panel**: Monitorización centralizada del sistema y dispositivos

## Arquitectura Docker

El sistema está containerizado utilizando Docker y orquestado con Docker Compose, optimizado para despliegue en producción.

### Imágenes Docker

| Servicio    | Imagen                          | Base           | Puerto | Descripción                            |
|-------------|--------------------------------|----------------|--------|----------------------------------------|
| PWA         | dtiteam/intercom-pwa:latest    | nginx:alpine   | 80     | Aplicación web para tablets            |
| Signaling   | dtiteam/intercom-signaling:latest | node:20-alpine | 3000   | Servidor de señalización WebSocket     |
| MiroTalkSFU | dtiteam/intercom-mirotalksfu:latest | node:22-slim | 8080   | Servidor WebRTC para llamadas          |
| Admin       | dtiteam/intercom-admin:latest  | node:20-alpine | 8090   | Panel de monitorización                |
| MongoDB     | mongo:5.0                      | -              | 27017  | Base de datos para autenticación y logs|

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

#### MiroTalkSFU
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
SFU_PORT=8080                     # Puerto del servidor MiroTalkSFU
ADMIN_PORT=8090                   # Puerto del panel de administración

# Seguridad
API_KEY_SECRET=secret_key_here    # Clave para API de MiroTalkSFU
JWT_KEY=jwt_secret_here           # Clave para autenticación JWT
ADMIN_USER=admin                  # Usuario del panel admin (default: admin)
ADMIN_PASSWORD=admin              # Contraseña (default: admin)
```

### Puertos y Rangos

Para WebRTC es crucial configurar correctamente:

- **TCP**: 80 (PWA), 3000 (Signaling), 8080 (MiroTalk), 8090 (Admin), 27017 (MongoDB)
- **UDP**: 40000-50000 (Puertos WebRTC para streams de audio/video)

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
- `./mirotalksfu/app/rec`: Grabaciones (si se habilitan)
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
git clone https://github.com/tu-organizacion/miro-dti.git
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

## Desarrollo Avanzado

### Gestión de MiroTalkSFU como Submódulo Git

MiroTalkSFU se gestiona como un submódulo Git para mantener la referencia al repositorio original mientras se permite su integración con este proyecto. Esto asegura que los desarrolladores puedan acceder al código fuente completo y actualizado.

#### Para quienes clonan este repositorio:

Para asegurarte de que la carpeta `mirotalksfu` contenga todo el código fuente después de clonar el repositorio, ejecuta:

```bash
# Clonar el repositorio principal
git clone https://github.com/tu-organizacion/miro-dti.git
cd miro-dti

# Inicializar y actualizar el submódulo de MiroTalkSFU
git submodule update --init --recursive
```

Este comando descargará automáticamente el código fuente original de MiroTalkSFU en la carpeta correspondiente.

#### Configuración del submódulo:

MiroTalkSFU ya está configurado como submódulo Git en este repositorio. No es necesario realizar ninguna configuración adicional para utilizarlo.

#### Actualización del submódulo a versiones más recientes:

Para actualizar el submódulo a la última versión del repositorio original:

```bash
# Entrar al directorio del submódulo
cd mirotalksfu

# Cambiar a la rama principal y actualizar
git checkout main
git pull origin main

# Volver al directorio raíz y confirmar la actualización
cd ..
git add mirotalksfu
git commit -m "Actualizar submódulo MiroTalkSFU a la última versión"
```

#### Personalizaciones sobre MiroTalkSFU

Las personalizaciones específicas para el sistema Intercom DTI deben gestionarse cuidadosamente para facilitar futuras actualizaciones del submódulo. Se recomienda documentar todos los cambios realizados sobre la versión original.