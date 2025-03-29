# Guía de Despliegue del Sistema Intercom DTI

Esta guía está destinada al equipo de infraestructura para facilitar el despliegue del sistema de intercomunicación basado en MiroTalkSFU.

## Requisitos previos

- Docker y Docker Compose instalados
- Acceso a los puertos requeridos: 80, 3000, 8080, 27017 y rango 40000-50000/UDP
- IP estática local para el servidor dentro de la red del edificio
- IP pública o dominio para acceso desde internet (opcional para el fallback)

## Pasos para el despliegue

### 1. Preparar el entorno

1. Clone o descargue este repositorio en el servidor
2. Copie el archivo de ejemplo a su archivo de configuración:

```bash
cp .env.example .env
```

### 2. Configuración del archivo .env

Edite el archivo `.env` y **modifique al menos** estos dos parámetros importantes:

```
LOCAL_SFU_IP=192.168.1.100     # Cambiar a la IP local real del servidor
FALLBACK_SFU_IP=X.X.X.X        # Cambiar a la IP pública o dominio
```

Si va a desplegar en producción, también debería cambiar estas claves de seguridad:

```
API_KEY_SECRET=cambiar_a_clave_segura
JWT_KEY=cambiar_a_clave_segura
```

### 3. Despliegue con Docker Compose

Una vez configurado el archivo `.env`, ejecute:

```bash
docker-compose up -d
```

Este comando:
- Descargará las imágenes del Docker Hub (si no existen localmente)
- Creará y ejecutará todos los contenedores necesarios
- Configurará la red interna entre los servicios

### 4. Verificación del despliegue

Puede verificar que todos los servicios están funcionando correctamente con:

```bash
docker-compose ps
```

Los servicios expuestos serán:
- PWA (interfaz web): http://IP-SERVIDOR
- MiroTalkSFU: http://IP-SERVIDOR:8080
- Servicio de señalización: http://IP-SERVIDOR:3000
- MongoDB (solo accesible internamente)

### 5. Logs y monitoreo

Para ver los logs de los servicios:

```bash
# Todos los servicios
docker-compose logs

# Un servicio específico (ej: mirotalksfu)
docker-compose logs mirotalksfu
```

### 6. Funcionamiento del sistema de fallback

El sistema está configurado para usar primero el servidor local (dentro del edificio). Si este no está disponible, cambiará automáticamente al servidor de fallback (internet).

Este cambio es transparente para los usuarios y se gestiona desde la PWA.

## Resolución de problemas

Si encuentra algún problema durante el despliegue:

1. Verifique que los puertos requeridos no estén bloqueados
2. Asegúrese de que las IPs configuradas son correctas y accesibles
3. Revise los logs de Docker para identificar errores específicos

## Contacto

Para cualquier consulta técnica adicional, contacte con el equipo de desarrollo.
