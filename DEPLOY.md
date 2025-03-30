# Guía de Despliegue Completa del Sistema Intercom DTI

Esta guía de despliegue está diseñada para el equipo de infraestructura responsable de implementar y mantener el sistema de intercomunicación DTI basado en MiroTalkSFU.

## Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Requisitos de Hardware y Red](#requisitos-de-hardware-y-red)
3. [Configuración Inicial](#configuración-inicial)
4. [Despliegue con Docker Hub](#despliegue-con-docker-hub)
5. [Configuración de Seguridad](#configuración-de-seguridad)
6. [Verificación del Sistema](#verificación-del-sistema)
7. [Monitoreo y Healthchecks](#monitoreo-y-healthchecks)
8. [Gestión del Ciclo de Vida](#gestión-del-ciclo-de-vida)
9. [Backup y Recuperación](#backup-y-recuperación)
10. [Configuración de Tablets Android](#configuración-de-tablets-android)
11. [Resolución de Problemas](#resolución-de-problemas)
12. [Documentación Técnica Adicional](#documentación-técnica-adicional)

## Arquitectura del Sistema

El sistema Intercom DTI se compone de los siguientes componentes principales:

- **PWA (Progressive Web Application)**: Interfaz de usuario principal alojada en NGINX
- **Signaling Server**: Servidor Node.js que gestiona el protocolo de señalización para videollamadas
- **MiroTalkSFU**: Motor WebRTC basado en mediasoup para streaming de audio/video
- **Panel Admin**: Aplicación web para monitoreo y administración del sistema
- **MongoDB**: Base de datos para autenticación y configuración del sistema

## Requisitos de Hardware y Red

### Hardware Recomendado

| Componente     | Mínimo    | Recomendado | Notas                                                  |
| -------------- | --------- | ----------- | ------------------------------------------------------ |
| CPU            | 4 núcleos | 8+ núcleos  | Los procesos de WebRTC son intensivos en CPU           |
| RAM            | 8 GB      | 16+ GB      | MiroTalkSFU requiere memoria para múltiples conexiones |
| Almacenamiento | 20 GB SSD | 100+ GB SSD | Para logs, MongoDB y posibles grabaciones              |
| Tarjeta de Red | 1 Gbps    | 1+ Gbps     | Esencial para streaming de video de calidad            |

### Requisitos de Red

- **Puertos Internos**:

  - TCP/80: PWA (interfaz web)
  - TCP/3000: Servicio de señalización
  - TCP/8080: MiroTalkSFU WebRTC
  - TCP/8090: Panel de administración
  - TCP/27017: MongoDB (solo acceso interno)
  - UDP/40000-40100: Rango para tráfico de medios WebRTC

- **Puertos Externos** (si se usa acceso desde internet):

  - TCP/80 o TCP/443 (con SSL): Para acceso a la PWA
  - UDP/40000-40100: Para tráfico WebRTC

- **Firewall**: Configurar para permitir tráfico UDP bidireccional en el rango especificado
- **QoS recomendado**: Priorizar tráfico UDP para reducir la latencia de audio/video

## Configuración Inicial

### 1. Preparación del Servidor

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y curl git docker.io docker-compose

# Iniciar y habilitar Docker
sudo systemctl start docker
sudo systemctl enable docker

# Agregar usuario actual al grupo docker (opcional, para ejecutar sin sudo)
sudo usermod -aG docker $USER
# Cierre sesión y vuelva a iniciar para que los cambios tengan efecto
```

### 2. Obtención del Código Fuente

```bash
# Clonar repositorio
git clone https://github.com/JIATech/miro-dti.git
cd miro-dti

# Preparar archivo de configuración
cp .env.example .env
```

### 3. Configuración del Archivo .env

Este archivo contiene todas las variables de entorno utilizadas por los servicios. Los parámetros críticos incluyen:

```
# Configuración del Servidor Local (RED INTERNA)
LOCAL_IP=192.168.1.100        # CAMBIAR: IP local real del servidor
LOCAL_SFU_PORT=8080           # Puerto para MiroTalkSFU
LOCAL_SFU_MIN_PORT=40000      # Puerto inicial para rango UDP WebRTC
LOCAL_SFU_MAX_PORT=40100      # Puerto final para rango UDP WebRTC

# Configuración del Servidor Fallback (INTERNET)
FALLBACK_SFU_ENABLED=true     # Activa el sistema de fallback
FALLBACK_SFU_IP=xx.xx.xx.xx   # CAMBIAR: IP pública o dominio
FALLBACK_SFU_PORT=8080        # Puerto MiroTalkSFU en servidor de fallback

# Seguridad (CAMBIAR TODOS ESTOS VALORES)
API_KEY_SECRET=reemplazar_con_clave_segura_aleatoria_1
JWT_KEY=reemplazar_con_clave_segura_aleatoria_2
ADMIN_USER=admin_username     # Usuario para panel admin
ADMIN_PASSWORD=admin_password # Contraseña para panel admin
```

## Despliegue con Docker Hub

Las imágenes del sistema están publicadas en Docker Hub, lo que facilita el despliegue:

### 1. Despliegue Inicial

```bash
# Iniciar todos los servicios
docker-compose up -d
```

Este comando descargará las imágenes necesarias desde Docker Hub y creará los contenedores:

- `dtiteam/intercom-pwa:latest`
- `dtiteam/intercom-signaling:latest`
- `dtiteam/intercom-mirotalksfu:latest`
- `dtiteam/intercom-admin:latest`
- MongoDB (imagen oficial)

### 2. Verificación del Despliegue

```bash
# Verificar estado de los contenedores
docker-compose ps

# Ver logs de todos los servicios
docker-compose logs

# Ver logs de un servicio específico con seguimiento
docker-compose logs -f mirotalksfu
```

## Configuración de Seguridad

### Seguridad de Contenedores

Todas las imágenes han sido configuradas con las siguientes medidas de seguridad:

- **Usuarios no-root**: Cada servicio se ejecuta como un usuario no privilegiado:

  - PWA: usuario `nginx`
  - Signaling: usuario `appuser` (UID 1000)
  - MiroTalkSFU: usuario `mirotalk` (UID 1000)
  - Admin Panel: usuario `appuser` (UID 1000)

- **Optimización de imágenes**:
  - Builds multi-etapa para reducir tamaño
  - Eliminación de herramientas innecesarias
  - Tagging específico y metadatos para trazabilidad

### Configuración de MongoDB

Por defecto, MongoDB no tiene autenticación habilitada para facilitar el desarrollo. Para un entorno de producción, habilite la autenticación:

1. Modifique el archivo `docker-compose.yml`:

```yaml
mongodb:
  environment:
    - MONGO_INITDB_ROOT_USERNAME=admin
    - MONGO_INITDB_ROOT_PASSWORD=secure_password
```

2. Actualice las variables de entorno en los servicios que usan MongoDB:

```yaml
signaling:
  environment:
    - MONGO_URI=mongodb://admin:secure_password@mongodb:27017/intercom
```

### Seguridad de la Red

Recomendaciones para la configuración de seguridad de red:

- **Implementar SSL/TLS**: Utilice un reverse proxy como Nginx con certificados SSL para tráfico externo
- **Restricción de IP**: Limit el acceso al panel de administración solo a IPs autorizadas
- **Segmentación**: Coloque el sistema en una VLAN dedicada

## Verificación del Sistema

### Lista de Comprobación Post-Despliegue

1. Verificar respuesta HTTP 200 de todos los servicios web:

   - PWA: `http://LOCAL_IP/`
   - Signaling: `http://LOCAL_IP:3000/health`
   - MiroTalkSFU: `http://LOCAL_IP:8080/health`
   - Admin: `http://LOCAL_IP:8090/health`

2. Verificar conexión a MongoDB:

   ```bash
   docker-compose exec signaling sh -c "curl -s mongodb:27017"
   ```

3. Probar una videollamada completa entre dos dispositivos

## Monitoreo y Healthchecks

### Healthchecks Implementados

Todos los servicios incluyen healthchecks que Docker utiliza para monitorear su estado:

```bash
# Ver estado de healthchecks
docker inspect --format "{{.State.Health.Status}}" intercom-pwa
docker inspect --format "{{.State.Health.Status}}" intercom-signaling
docker inspect --format "{{.State.Health.Status}}" intercom-mirotalksfu
docker inspect --format "{{.State.Health.Status}}" intercom-admin
docker inspect --format "{{.State.Health.Status}}" intercom-mongodb
```

### Integración con Sistemas de Monitoreo

El sistema se puede integrar con herramientas como Prometheus, Grafana o Zabbix:

1. **Endpoints de Health**:

   - `/health` en cada servicio devuelve estado 200 si está operativo
   - Estos endpoints pueden ser consumidos por cualquier sistema de monitoreo

2. **Métricas a Monitorear**:
   - Uso de CPU y memoria de cada contenedor
   - Latencia de red entre servicios
   - Uso de puertos UDP para WebRTC
   - Espacio disponible para logs y MongoDB

### Gestión de Logs del Sistema

El panel de administración proporciona capacidades avanzadas para gestionar logs:

1. **Visualización Centralizada**:

   - Log central categorizado (Sistema, Llamadas, Errores, Rendimiento)
   - Filtros por tipo, nivel, fuente y tablet específica
   - Búsqueda en tiempo real de mensajes de logs

2. **Limpieza Manual de Logs por Períodos**:

   - Borrado selectivo según intervalos de tiempo predefinidos:
     - Última hora
     - Últimas 24 horas
     - Últimos 7 días
     - Últimas 4 semanas
     - Borrado completo (desde siempre)
   - Confirmación obligatoria antes de borrado para prevenir pérdida accidental de datos
   - Sin borrado automático para garantizar control total sobre los datos históricos

3. **Exportación de Logs**:
   - Capacidad de exportar logs para análisis externo
   - Formato JSON para compatibilidad con herramientas de análisis

## Gestión del Ciclo de Vida

### Actualizaciones del Sistema

Para actualizar los servicios a nuevas versiones:

```bash
# Obtener los últimos cambios del código
git pull

# Detener servicios actuales
docker-compose down

# Reconstruir y desplegar con las nuevas imágenes
docker-compose pull
docker-compose up -d
```

### Mantenimiento Programado

Procedimientos recomendados para mantenimiento:

1. **Notificación**: Informe a los usuarios sobre ventanas de mantenimiento programado
2. **Respaldo**: Siempre realice backup antes de operaciones de mantenimiento
3. **Registro**: Mantenga un registro detallado de todos los cambios durante el mantenimiento

## Backup y Recuperación

### Backup de MongoDB

```bash
# Backup completo de la base de datos
docker-compose exec -T mongodb mongodump --archive --db=intercom > intercom_backup_$(date +%Y%m%d).archive

# Restauración desde backup
docker-compose exec -T mongodb mongorestore --archive --nsInclude=intercom.* < intercom_backup_20250101.archive
```

### Respaldo de Configuración

```bash
# Backup de archivos de configuración
cp .env .env.backup.$(date +%Y%m%d)
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d)
```

### Plan de Recuperación ante Desastres

1. **Escenario**: Pérdida completa del servidor

   - Aprovisionar nuevo servidor con hardware equivalente
   - Instalar Docker y dependencias
   - Restaurar configuración y datos de MongoDB desde backup
   - Redesplegue de servicios con Docker Compose

2. **Escenario**: Fallo de un servicio específico
   - Verificar logs del servicio afectado
   - Reiniciar únicamente el servicio problemático:
     ```bash
     docker-compose restart <nombre_servicio>
     ```

## Configuración de Tablets Android

El sistema está diseñado para funcionar con 5 tablets Android (1 para Portero y 4 para departamentos):

### Requisitos de Tablets

- Android 10+ recomendado
- 2GB RAM mínimo
- Cámara y micrófono funcionales
- WiFi confiable

### Pasos de Configuración

1. Asegure que las tablets estén conectadas a la misma red que el servidor
2. Abra Chrome en cada tablet y navegue a `http://LOCAL_IP`
3. Para cada tablet, seleccione el rol apropiado:

   - **Portero**: Puede iniciar llamadas a cualquier departamento
   - **Departamentos** (Administración/Sistemas/Infraestructura/Soporte): Reciben llamadas

4. Configure cada tablet para iniciar automáticamente la PWA al encenderse:
   - Instale como aplicación desde Chrome (botón "Añadir a pantalla principal")
   - Configure el inicio automático en los ajustes de Android

### Monitoreo de Tablets

El panel de administración permite monitorear el estado de todas las tablets conectadas:

- Estado de conexión
- Calidad de conexión de red
- Historial de llamadas
- Logs específicos por dispositivo

## Resolución de Problemas

### Problemas Comunes

| Problema                      | Posible Causa                    | Solución                                            |
| ----------------------------- | -------------------------------- | --------------------------------------------------- |
| No se puede realizar llamadas | Puertos UDP bloqueados           | Verificar firewall para tráfico UDP 40000-40100     |
| Video lento o congelado       | Ancho de banda insuficiente      | Verificar QoS o disponibilidad de red               |
| Error "ICE connection failed" | NAT/Firewall bloqueando conexión | Configurar correctamente LOCAL_IP y FALLBACK_SFU_IP |
| MongoDB inaccesible           | Problema con volumen persistente | Verificar permisos en directorio de datos           |

### Logs y Diagnóstico

Cada servicio genera logs detallados:

```bash
# Ver logs detallados
docker-compose logs --tail=100 signaling

# Filtrar logs por término específico
docker-compose logs | grep "ERROR"
```

### Procedimiento de Rollback

Si una actualización causa problemas:

```bash
# Volver a la versión anterior
git checkout <commit_anterior>
docker-compose down
docker-compose up -d --build
```

## Documentación Técnica Adicional

### Almacenamiento de Datos

- **MongoDB**: Utilizado exclusivamente para autenticación y gestión de usuarios (5 cuentas)
- **Datos Locales**: Cada tablet almacena su información en IndexDB o SQLite local:
  - Historial de llamadas
  - Configuraciones de audio/video
  - Métricas y logs de uso

### Flujos de Tráfico

1. **Llamada Normal** (red interna):

   - Conexión inicial PWA → Signaling Server
   - Negociación WebRTC a través de MiroTalkSFU local
   - Flujo directo de audio/video por UDP

2. **Escenario de Fallback** (desde internet):
   - Detección automática de fallo en servidor local
   - Conexión a servidor de fallback configurado
   - Mismo flujo pero utilizando servidor externo

### Soporte y Contacto

Para problemas técnicos avanzados, contacte al equipo de desarrollo:

- **Email**: sistemas.dti@spb.gba.gov.ar o j.arnaboldi@spb.gba.gov.ar
- **Repositorio**: https://github.com/JIATech/miro-dti
- **Documentación Técnica**: Proximamente...
