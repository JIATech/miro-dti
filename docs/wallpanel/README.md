# WallPanel para el Sistema Intercom DTI de JIATech

Este documento proporciona información sobre la integración de WallPanel con el sistema Intercom DTI.

## ¿Qué es WallPanel?

WallPanel es una aplicación Android de código abierto diseñada para ser utilizada como un panel de pared para casas inteligentes, tableros de información y sistemas de kiosco. Para el sistema Intercom DTI, utilizamos WallPanel como contenedor de nuestra aplicación PWA, proporcionando capacidades adicionales como:

- Gestión de hardware (micrófono, cámara, pantalla)
- Identificación única del dispositivo
- Modo kiosco para prevenir salidas accidentales
- Arranque automático
- Recuperación automática en caso de fallos

## Repositorio Oficial

El código fuente original de WallPanel se encuentra en:
https://github.com/WallPanel-Project/wallpanel-android

## API de JavaScript

WallPanel expone las siguientes funciones JavaScript que utilizamos en el Intercom DTI:

```javascript
// Verificar si la aplicación se está ejecutando en WallPanel
function isWallPanelAvailable() {
  return typeof window.WallPanel !== 'undefined';
}

// Obtener ID único del dispositivo
function getWallPanelDeviceId() {
  if (isWallPanelAvailable()) {
    return window.WallPanel.getDeviceId();
  }
  return null;
}

// Obtener el ID único de Android
function getWallPanelAndroidId() {
  if (isWallPanelAvailable()) {
    return window.WallPanel.getAndroidId();
  }
  return null;
}

// Obtener información del fabricante del dispositivo
function getWallPanelManufacturer() {
  if (isWallPanelAvailable()) {
    return window.WallPanel.getDeviceManufacturer();
  }
  return null;
}

// Obtener el modelo del dispositivo
function getWallPanelModel() {
  if (isWallPanelAvailable()) {
    return window.WallPanel.getDeviceModel();
  }
  return null;
}
```

## Características utilizadas en el proyecto

En el proyecto Intercom DTI utilizamos WallPanel para:

1. **Identificación única de dispositivo**: Para el inicio de sesión automático y recuperación de contraseñas
2. **Modo kiosco**: Para mantener la aplicación en pantalla completa y prevenir salidas accidentales
3. **Gestión de arranque**: Para iniciar automáticamente después de reinicios
4. **Habilitación de WebRTC**: Para asegurar acceso permanente a cámara y micrófono

## Consideraciones de configuración

Al configurar WallPanel para el Intercom DTI, se recomienda:

1. Configurar la URL inicial a la dirección del servidor Intercom DTI
2. Habilitar el arranque automático
3. Configurar la pantalla para que no se apague
4. Deshabilitar las barras de navegación y estado
5. Otorgar todos los permisos solicitados (cámara, micrófono, etc.)

## Análisis del código fuente

El código fuente incluido en `/libs/wallpanel` sirve solo como referencia para comprender y documentar la interacción entre WallPanel y nuestra aplicación PWA. No modificamos el código de WallPanel - utilizamos el APK oficial compilado.
