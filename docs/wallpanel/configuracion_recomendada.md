# Configuración Recomendada de WallPanel para Intercom DTI

## Configuración General

| Configuración | Valor Recomendado | Justificación |
|---------------|-------------------|---------------|
| URL Inicial | `http://[IP-SERVIDOR-INTERCOM]/pwa/` | Dirección de la aplicación Intercom DTI |
| Actualizar en inicio | Activado | Asegura que siempre se cargue la versión más reciente |
| Recargar al reactivar | Activado | Evita problemas de WebRTC al despertar el dispositivo |
| Iniciar en modo pantalla completa | Activado | Maximiza el área visible del intercom |
| Ocultar barra de navegación | Activado | Previene salidas accidentales |
| Ocultar barra de estado | Activado | Elimina distracciones |

## Gestión de Energía

| Configuración | Valor Recomendado | Justificación |
|---------------|-------------------|---------------|
| Mantener pantalla encendida | Activado | Garantiza disponibilidad inmediata |
| Brillo de pantalla | 80% | Balance entre visibilidad y consumo energético |
| Tiempo para apagar pantalla | 30 minutos | Ahorra energía cuando no se usa por periodos prolongados |
| Despertar con movimiento | Activado | Reactiva rápidamente ante presencia |

## Seguridad y Modos de Kiosco

| Configuración | Valor Recomendado | Justificación |
|---------------|-------------------|---------------|
| Modo Kiosco | Activado | Previene salida accidental de la aplicación |
| Bloquear botones físicos | Activado | Evita manipulación no autorizada |
| Permitir volumen físico | Activado | Facilita ajustes de audio por el usuario |
| Código PIN de administración | Definir uno seguro | Permite acceso de administración cuando sea necesario |

## Inicialización y Mantenimiento

| Configuración | Valor Recomendado | Justificación |
|---------------|-------------------|---------------|
| Iniciar al arranque | Activado | Garantiza funcionamiento después de reinicios |
| Iniciar servicio en segundo plano | Activado | Mejora la persistencia y recuperación |
| Reinicio programado | 3:00 AM diariamente | Mantiene el sistema limpio y actualizado |
| Recargar página si está inactiva | 60 minutos | Previene problemas de memoria |

## Permisos de Android

Asegúrate de conceder los siguientes permisos a WallPanel:

- Cámara (para videollamadas)
- Micrófono (para audio en llamadas)
- Almacenamiento (para guardar configuraciones)
- Ubicación (opcional, para identificación de dispositivo)
- Inicio automático (para arranque al encender)
- Ignorar optimizaciones de batería (para mantener servicio activo)

## Optimizaciones para WebRTC

Para mejorar el rendimiento de las videollamadas a través de MiroTalkSFU:

- Desactivar la rotación automática del dispositivo
- Fijar la orientación de pantalla en modo horizontal
- Permitir el uso de hardware para aceleración WebRTC
- Deshabilitar efectos de transición en WallPanel

## MQTT (Opcional)

Si se desea monitoreo centralizado:

- Activar MQTT
- Configurar broker: `mqtt://[IP-SERVIDOR-MONITOREO]:1883`
- Tópico base: `intercom/[ID-DISPOSITIVO]`
- Intervalo de publicación: 60 segundos
