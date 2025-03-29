# pwa/Dockerfile
# Etapa de construcción
FROM nginx:alpine as builder
WORKDIR /app
COPY . .

# Etapa final
FROM nginx:alpine
LABEL maintainer="DTI Team <j.arnaboldi@spb.gba.gov.ar>"
LABEL version="1.0.0"
LABEL description="DTI Intercom Progressive Web App"

# Crear archivo de configuración para nginx que soporte SPA
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    # Soporte para SPA y rutas \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    # Prevenir el acceso directo a archivos .htaccess \
    location ~ /\.ht { \
        deny all; \
    } \
    # Configurar encabezados de seguridad \
    add_header X-Frame-Options "SAMEORIGIN"; \
    add_header X-XSS-Protection "1; mode=block"; \
    add_header X-Content-Type-Options "nosniff"; \
    # Configurar caché para recursos estáticos \
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ { \
        expires 30d; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Copiar archivos de la etapa de construcción
COPY --from=builder /app /usr/share/nginx/html

# Establecer usuario no-root y permisos correctos
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
