# Sistema Intercom con MiroTalkSFU

Aplicación estilo portero intercom basada en WebRTC utilizando MiroTalkSFU para funciones de llamada, ringtone, atender y colgar.

## Estructura del Proyecto

```
/miro-dti/
├── mirotalksfu/        # Código fuente de MiroTalkSFU
├── pwa/                # Aplicación Web Progresiva (PWA)
│   ├── index.html      # Interfaz principal con botones
│   ├── app.js          # Lógica de la aplicación
│   ├── styles.css      # Estilos
│   ├── manifest.json   # Configuración PWA
│   ├── service-worker.js # Service Worker para PWA
│   ├── icons/          # Iconos para PWA
│   └── Dockerfile      # Configuración para servir con Nginx
└── docker-compose.yml  # Configuración de servicios
```

## Características

- **Interfaz adaptable** para diferentes roles (Portero, Administración, etc)
- **Botones grandes** para fácil interacción
- **Capacidad PWA** para instalación en dispositivos
- **Integración con MiroTalkSFU** para videollamadas WebRTC
- **Modo Kiosk** para uso en tablets dedicadas

## Instalación y Ejecución

### Desarrollo local

Para probar la PWA localmente:

```bash
cd pwa
# Puedes usar un servidor web simple como:
python -m http.server 8080
# O con Node.js:
npx serve
```

### Usando Docker

Para desplegar con Docker:

```bash
# Construir y ejecutar solo la PWA
cd pwa
docker build -t intercom-pwa .
docker run -p 80:80 intercom-pwa

# O usando docker-compose para todo el sistema
cd ..
docker-compose up -d
```

## Integración con JamiPortero

Esta aplicación está diseñada para funcionar como parte del sistema JamiPortero, aprovechando sus capacidades avanzadas:

- Modo Kiosk completo con bloqueo de tareas
- Gestión avanzada de aplicaciones y control de inactividad
- Interfaz de usuario optimizada para uso como terminal dedicado