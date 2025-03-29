FROM node:20-alpine

# Metadatos de la imagen
LABEL maintainer="DTI Team <j.arnaboldi@spb.gba.gov.ar>"
LABEL version="1.0.0"
LABEL description="DTI Intercom Admin Panel"

# Crear directorio de la aplicación
WORKDIR /app

# Crear package.json vacío si no existe
RUN echo '{"name":"admin","version":"1.0.0","private":true}' > default-package.json

# Copiar archivos de dependencias si existen, o usar los predeterminados
COPY package.json* ./
COPY package-lock.json* ./
RUN if [ ! -s package.json ]; then cp default-package.json package.json; fi

# Instalar dependencias con fallback a instalación simple si fallan los archivos de dependencias
RUN if [ -f package-lock.json ] && [ -s package-lock.json ]; then \
      npm ci --only=production || npm install --only=production; \
    else \
      npm install --only=production; \
    fi && \
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
EXPOSE 8090

# Cambiar a usuario no-root
USER appuser

# Verificación de salud
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8090/health || exit 1

# Comando de inicio
CMD ["node", "server.js"]
