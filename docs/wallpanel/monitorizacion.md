# Monitorización de Dispositivos con WallPanel

Este documento detalla cómo aprovechar las capacidades de monitorización que ofrece WallPanel para el sistema Intercom DTI de JIATech.

## Datos Disponibles para Monitorización

WallPanel proporciona acceso a diversos datos del dispositivo que pueden ser monitorizados:

### Información de Hardware

| Dato             | Descripción                                 | Método JavaScript   | Ejemplo               |
| ---------------- | ------------------------------------------- | ------------------- | --------------------- |
| Nivel de Batería | Porcentaje de carga actual                  | `getBatteryLevel()` | `78` (porcentaje)     |
| Estado de Carga  | Si el dispositivo está cargando             | `isCharging()`      | `true/false`          |
| Dirección IP     | IP del dispositivo en la red                | `getIp()`           | `"192.168.1.100"`     |
| Dirección MAC    | Identificador de hardware de red            | `getMacAddress()`   | `"00:11:22:33:44:55"` |
| Temperatura      | Temperatura del dispositivo (si disponible) | _Vía MQTT_          | `38.5` (grados C)     |

### Estado del Sistema

| Dato                 | Descripción                    | Método JavaScript       | Ejemplo           |
| -------------------- | ------------------------------ | ----------------------- | ----------------- |
| Versión de Android   | Versión del SO                 | `getAndroidVersion()`   | `"11"`            |
| Pantalla Activa      | Si la pantalla está encendida  | `isScreenOn()`          | `true/false`      |
| Brillo de Pantalla   | Nivel actual de brillo         | `getScreenBrightness()` | `75` (porcentaje) |
| Versión de WallPanel | Versión de la aplicación       | `getAppVersion()`       | `"0.12.0"`        |
| Estado de Memoria    | Uso de memoria del dispositivo | _Vía MQTT_              | `"75%"`           |

### Sensores (si están habilitados)

| Dato             | Descripción                | Disponibilidad   | Ejemplo      |
| ---------------- | -------------------------- | ---------------- | ------------ |
| Luz Ambiental    | Nivel de luz en el entorno | MQTT             | `250` (lux)  |
| Movimiento       | Detección de movimiento    | MQTT + Evento JS | `true/false` |
| Presencia Facial | Detección de rostros       | MQTT + Evento JS | `true/false` |

## Métodos de Integración

### 1. JavaScript Directo

Para obtener datos en tiempo real desde tu aplicación PWA:

```javascript
// Función para obtener información básica del dispositivo
function getDeviceStatus() {
  if (typeof window.WallPanel !== 'undefined') {
    return {
      batteryLevel: window.WallPanel.getBatteryLevel(),
      isCharging: window.WallPanel.isCharging(),
      ipAddress: window.WallPanel.getIp(),
      screenBrightness: window.WallPanel.getScreenBrightness(),
      timestamp: new Date().toISOString(),
    };
  }
  return null;
}

// Ejemplo de envío periódico al servidor de monitorización
function reportDeviceStatus() {
  const status = getDeviceStatus();
  if (status) {
    fetch('/api/device-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(status),
    });
  }

  // Reportar cada 5 minutos
  setTimeout(reportDeviceStatus, 5 * 60 * 1000);
}
```

### 2. MQTT (Método Recomendado)

WallPanel puede publicar automáticamente datos de estado a un broker MQTT, ideal para monitorización centralizada:

#### Configuración en WallPanel

1. En configuración de WallPanel, activar MQTT
2. Configurar broker: `mqtt://[IP-SERVIDOR-MONITOREO]:1883`
3. Configurar tópico base: `intercom/[ID-DISPOSITIVO]`
4. Habilitar los sensores deseados
5. Establecer intervalo de publicación (por ejemplo, 60 segundos)

#### Estructura de Tópicos MQTT

WallPanel publicará en los siguientes tópicos:

```
intercom/[ID-DISPOSITIVO]/sensor/battery      → {"value": 75, "charging": true}
intercom/[ID-DISPOSITIVO]/sensor/light        → {"value": 250}
intercom/[ID-DISPOSITIVO]/sensor/motion       → {"value": true}
intercom/[ID-DISPOSITIVO]/sensor/face         → {"value": true, "count": 1}
intercom/[ID-DISPOSITIVO]/sensor/memory       → {"value": 524288, "total": 1048576}
intercom/[ID-DISPOSITIVO]/sensor/screen       → {"value": true}
intercom/[ID-DISPOSITIVO]/sensor/temperature  → {"value": 38.5}
```

#### Integración con Sistema de Monitorización Existente

Para integrar estos datos en el sistema de monitorización del Intercom DTI:

1. **Configurar cliente MQTT en el servidor de monitorización**:

   ```javascript
   // En el servidor Node.js de monitorización
   const mqtt = require('mqtt');
   const client = mqtt.connect('mqtt://localhost:1883');

   client.on('connect', () => {
     client.subscribe('intercom/+/sensor/#');
   });

   client.on('message', (topic, message) => {
     // Formato: intercom/DEVICE-ID/sensor/TYPE
     const parts = topic.split('/');
     const deviceId = parts[1];
     const sensorType = parts[3];

     try {
       const data = JSON.parse(message.toString());
       // Almacenar en base de datos o enviar a dashboard
       updateDeviceMonitoring(deviceId, sensorType, data);
     } catch (e) {
       console.error('Error parsing MQTT message', e);
     }
   });
   ```

2. **Añadir al dashboard de monitorización existente**:

   Actualizar el panel de control para incluir nuevas métricas:

   - Estado de batería de dispositivos
   - Última vez visto online
   - Temperatura del dispositivo
   - Estado (cargando/descargando)

## Alertas Recomendadas

Configurar alertas para las siguientes condiciones:

1. **Batería Baja**: Nivel por debajo del 20% sin cargar
2. **Dispositivo Offline**: Sin actualización en los últimos 15 minutos
3. **Temperatura Elevada**: Por encima de 45°C
4. **Uso de Memoria Alto**: Por encima del 90% de memoria utilizada
5. **Cambio Inesperado de IP**: Posible cambio de ubicación física

## Control Remoto vía MQTT

Además de monitorizar, se pueden enviar comandos al dispositivo a través de MQTT:

```
intercom/[ID-DISPOSITIVO]/command/relaunch    → {"value": true}
intercom/[ID-DISPOSITIVO]/command/reload      → {"value": true}
intercom/[ID-DISPOSITIVO]/command/brightness  → {"value": 80}
intercom/[ID-DISPOSITIVO]/command/url         → {"value": "http://new-url"}
intercom/[ID-DISPOSITIVO]/command/wake        → {"value": true}
intercom/[ID-DISPOSITIVO]/command/speak       → {"value": "Mensaje de prueba"}
```

Este enfoque permite gestionar remotamente la flota de dispositivos desde el sistema central.

## Consideraciones Finales

- MQTT es el método más eficiente para monitorización continua (menor impacto en batería)
- Para dispositivos críticos, considerar un intervalo de reporte más frecuente
- La monitorización JavaScript es útil para diagnósticos puntuales o reportes manuales
- Combinar ambos enfoques proporciona la mayor flexibilidad y robustez
