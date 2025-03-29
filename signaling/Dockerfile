FROM node:20-alpine

# Metadatos de la imagen
LABEL maintainer="DTI Team <j.arnaboldi@spb.gba.gov.ar>"
LABEL version="1.0.0"
LABEL description="DTI Intercom Signaling Server"

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package.json ./
COPY package-lock.json ./

# Instalar dependencias usando npm con fallback a npm install si npm ci falla
RUN npm ci --only=production 2>/dev/null || npm install --only=production && \
    # Limpiar caché npm para reducir el tamaño de la imagen
    npm cache clean --force

# Crear directorio de logs y garantizar permisos
RUN mkdir -p /app/logs && \
    # Crear usuario no-root para ejecutar la aplicación (comprobando primero si ya existe)
    getent group appuser || addgroup -g 1000 appuser || addgroup appuser && \
    getent passwd appuser || adduser -u 1000 -G appuser -s /bin/sh -D appuser || adduser -G appuser -s /bin/sh -D appuser && \
    # Establecer permisos
    chown -R appuser:appuser /app

# Copiar código fuente con los permisos correctos
COPY --chown=appuser:appuser . .

# Exponer puerto
EXPOSE 3000

# Cambiar a usuario no-root
USER appuser

# Verificación de salud
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["node", "index.js"]
