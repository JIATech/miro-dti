FROM node:20-alpine

# Metadatos de la imagen
LABEL maintainer="DTI Team <j.arnaboldi@spb.gba.gov.ar>"
LABEL version="1.0.0"
LABEL description="DTI Intercom Admin Panel"

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

# Instalar dependencias usando npm ci para una instalación determinista
RUN npm ci --only=production && \
    # Limpiar caché npm para reducir el tamaño de la imagen
    npm cache clean --force

# Crear directorio de logs y garantizar permisos
RUN mkdir -p /app/logs && \
    # Crear usuario no-root para ejecutar la aplicación
    addgroup -g 1000 appuser && \
    adduser -u 1000 -G appuser -s /bin/sh -D appuser && \
    # Establecer permisos
    chown -R appuser:appuser /app

# Copiar código fuente con los permisos correctos
COPY --chown=appuser:appuser . .

# Exponer puerto
EXPOSE 8090

# Cambiar a usuario no-root
USER appuser

# Verificación de salud
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8090/health || exit 1

# Comando de inicio
CMD ["node", "server.js"]
