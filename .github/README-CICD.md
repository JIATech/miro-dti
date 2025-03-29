# CI/CD Minimalista para DTI Intercom

Este sistema de CI/CD está diseñado para ser lo más simple posible, enfocándose únicamente en la construcción y publicación de imágenes Docker.

## Qué hace este CI/CD

Cuando se hace push al branch `main`, GitHub Actions:
1. Construye todas las imágenes Docker definidas en docker-compose.yml
2. Publica estas imágenes a Docker Hub con el nombre `dtiteam/intercom-*`

## Configuración necesaria

Para que este CI/CD funcione, debes configurar dos secrets en tu repositorio de GitHub:

1. `DOCKER_USERNAME`: Tu nombre de usuario en Docker Hub (dtiteam)
2. `DOCKER_TOKEN`: Un token de acceso de Docker Hub (no uses tu contraseña)

### Cómo crear un token de acceso en Docker Hub:
1. Inicia sesión en [Docker Hub](https://hub.docker.com/)
2. Ve a Account Settings → Security → New Access Token
3. Dale un nombre descriptivo como "GitHub Actions"
4. Copia el token generado (solo se muestra una vez)

### Cómo agregar secrets a GitHub:
1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions → New repository secret
3. Agrega los dos secrets mencionados anteriormente

## Instrucciones para el equipo de infraestructura

Una vez que las imágenes se han actualizado, el equipo de infraestructura solo necesita ejecutar:

```bash
docker-compose pull
docker-compose up -d
```

No necesitan compilar nada ni modificar código, solo descargar las nuevas imágenes y reiniciar los contenedores.
