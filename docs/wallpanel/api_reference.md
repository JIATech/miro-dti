# Referencia de API de WallPanel para el Sistema Intercom DTI

## API de JavaScript

WallPanel expone un objeto global `window.WallPanel` que proporciona métodos para interactuar con el dispositivo. Esta referencia documenta los métodos más relevantes para la integración con el sistema Intercom DTI.

### Identificación de Dispositivo

| Método | Descripción | Tipo de Retorno | Ejemplo |
|--------|-------------|-----------------|---------|
| `getDeviceId()` | Obtiene un identificador único del dispositivo | String | `"wallpanel-xyz123"` |
| `getAndroidId()` | Obtiene el ID único de Android del dispositivo | String | `"123456789abcdef0"` |
| `getDeviceManufacturer()` | Obtiene el fabricante del dispositivo | String | `"Samsung"` |
| `getDeviceModel()` | Obtiene el modelo del dispositivo | String | `"SM-T510"` |
| `getAppVersion()` | Obtiene la versión de WallPanel | String | `"0.9.18"` |
| `getSerialNumber()` | Obtiene el número de serie del dispositivo (requiere permisos especiales) | String | `"R52M80ABCDE"` |

### Hardware y Sistema

| Método | Descripción | Tipo de Retorno | Ejemplo |
|--------|-------------|-----------------|---------|
| `getBatteryLevel()` | Obtiene el nivel actual de batería | Number | `85` (porcentaje) |
| `isCharging()` | Indica si el dispositivo está cargando | Boolean | `true` o `false` |
| `getScreenBrightness()` | Obtiene el brillo actual de la pantalla | Number | `75` (porcentaje) |
| `setScreenBrightness(value)` | Establece el brillo de la pantalla | Void | `setScreenBrightness(80)` |
| `getIp()` | Obtiene la dirección IP del dispositivo | String | `"192.168.1.100"` |
| `getMacAddress()` | Obtiene la dirección MAC del dispositivo | String | `"00:11:22:33:44:55"` |
| `getAndroidVersion()` | Obtiene la versión de Android | String | `"11"` |
| `isScreenOn()` | Indica si la pantalla está encendida | Boolean | `true` o `false` |
| `isDeviceOwner()` | Indica si WallPanel tiene permisos de propietario del dispositivo | Boolean | `true` o `false` |

### Control de Pantalla

| Método | Descripción | Tipo de Retorno | Ejemplo |
|--------|-------------|-----------------|---------|
| `turnScreenOn()` | Enciende la pantalla | Void | `turnScreenOn()` |
| `turnScreenOff()` | Apaga la pantalla | Void | `turnScreenOff()` |
| `setFullscreen(value)` | Establece el modo pantalla completa | Void | `setFullscreen(true)` |
| `relaunchApp()` | Reinicia la aplicación WallPanel | Void | `relaunchApp()` |
| `clearCache()` | Limpia la caché del navegador | Void | `clearCache()` |
| `reloadPage()` | Recarga la página actual | Void | `reloadPage()` |

### Audio y Multimedia

| Método | Descripción | Tipo de Retorno | Ejemplo |
|--------|-------------|-----------------|---------|
| `setMediaVolume(value)` | Establece el volumen multimedia | Void | `setMediaVolume(75)` |
| `getMediaVolume()` | Obtiene el volumen multimedia actual | Number | `75` (porcentaje) |
| `speak(text)` | Utiliza texto a voz para pronunciar el texto | Void | `speak("Llamada entrante")` |
| `playSound(url)` | Reproduce un sonido desde la URL proporcionada | Void | `playSound("https://example.com/alert.mp3")` |

### Eventos y Sensores

WallPanel puede enviar eventos a JavaScript mediante mensajes. Para capturarlos, puedes usar:

```javascript
window.addEventListener('message', function(event) {
    if (event.data && event.data.from === 'WallPanel') {
        // Procesar evento de WallPanel
        console.log('Evento WallPanel:', event.data);
        
        // Ejemplos de datos en event.data:
        // { type: 'motion', value: true } - Detección de movimiento
        // { type: 'battery', level: 75, charging: true } - Estado de batería
        // { type: 'network', connected: true, ssid: "WiFi-Name" } - Estado de red
    }
});
```

## Uso Óptimo para Intercom DTI

### Detección y Fallback

Siempre implementa detección y fallback para garantizar que la aplicación funcione incluso sin WallPanel:

```javascript
function getDeviceIdentifier() {
    // Intentar obtener ID a través de WallPanel
    if (typeof window.WallPanel !== 'undefined') {
        try {
            return {
                source: 'wallpanel',
                deviceId: window.WallPanel.getDeviceId(),
                androidId: window.WallPanel.getAndroidId()
            };
        } catch (e) {
            console.error('Error accediendo a WallPanel:', e);
        }
    }
    
    // Fallback: generar/obtener ID mediante navegador
    return {
        source: 'browser',
        uuid: generateUUID(),
        userAgent: navigator.userAgent
    };
}
```

### Optimización para WebRTC

Para optimizar la experiencia de videollamadas en el Intercom DTI:

```javascript
function optimizeForWebRTC() {
    if (typeof window.WallPanel !== 'undefined') {
        try {
            // Mantener pantalla encendida durante videollamadas
            window.WallPanel.turnScreenOn();
            
            // Ajustar brillo para conservar batería
            window.WallPanel.setScreenBrightness(70);
            
            // Asegurar volumen adecuado
            window.WallPanel.setMediaVolume(80);
            
            // Prevenir que el sistema suspenda la aplicación
            window.WallPanel.keepAwake(true);
        } catch (e) {
            console.error('Error optimizando para WebRTC:', e);
        }
    }
}
```

## Consideraciones de Seguridad

- Los métodos de WallPanel que acceden a información sensible del dispositivo requieren que la aplicación tenga los permisos adecuados
- Algunas funciones pueden estar limitadas dependiendo de la versión de Android y los permisos concedidos
- En dispositivos no rooteados, cierta información como `getSerialNumber()` puede no estar disponible
