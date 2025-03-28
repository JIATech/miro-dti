/**
 * Servidor de Señalización para Sistema Intercom DTI
 * 
 * Este servidor maneja las conexiones WebSocket para coordinar
 * las llamadas entre diferentes dispositivos utilizando WebRTC.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Configuración de servidor Express
const app = express();
const server = http.createServer(app);

// Configuración de CORS
app.use(cors());

// Opcional: Servir la PWA 
app.use(express.static(path.join(__dirname, '../pwa')));

// Configuración de Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Almacenamiento en memoria de dispositivos conectados
const devices = new Map();
const activeRooms = new Map();

// Manejo de conexiones WebSocket
io.on('connection', (socket) => {
  console.log('🟢 Nuevo cliente conectado:', socket.id);

  // Registro de dispositivo
  socket.on('register', ({ deviceName, deviceType }) => {
    console.log(`📱 Dispositivo registrado: ${deviceName} (${deviceType})`);
    
    // Guardar info del dispositivo
    devices.set(deviceName, {
      socketId: socket.id,
      deviceType,
      status: 'available'
    });

    socket.join(deviceName);
    
    // Notificar a todos los dispositivos la lista actualizada
    io.emit('deviceList', Array.from(devices.keys()).map(name => ({
      name,
      type: devices.get(name).deviceType,
      status: devices.get(name).status
    })));
  });

  // Solicitud de llamada
  socket.on('callRequest', ({ from, to, roomId }) => {
    console.log(`📞 Solicitud de llamada: ${from} -> ${to}`);
    
    const targetDevice = devices.get(to);
    
    if (!targetDevice) {
      socket.emit('callError', { 
        message: 'Dispositivo no disponible',
        code: 'DEVICE_NOT_FOUND'
      });
      return;
    }
    
    if (targetDevice.status !== 'available') {
      socket.emit('callError', { 
        message: 'Dispositivo ocupado',
        code: 'DEVICE_BUSY'
      });
      return;
    }
    
    // Actualizar estado de los dispositivos
    devices.get(from).status = 'calling';
    targetDevice.status = 'ringing';
    
    // Crear sala para la llamada
    const room = roomId || `${from}-${to}-${Date.now()}`;
    activeRooms.set(room, { from, to, startTime: Date.now() });
    
    // Notificar al destinatario
    io.to(to).emit('incomingCall', { 
      from, 
      room,
      timestamp: Date.now()
    });
    
    // Actualizar lista de dispositivos
    updateDeviceList();
  });

  // Respuesta a llamada
  socket.on('callAnswer', ({ room, answer }) => {
    console.log(`📞 Respuesta a llamada en sala ${room}: ${answer ? 'Aceptada' : 'Rechazada'}`);
    
    const roomData = activeRooms.get(room);
    
    if (!roomData) {
      socket.emit('callError', { 
        message: 'Sala de llamada no encontrada',
        code: 'ROOM_NOT_FOUND'
      });
      return;
    }
    
    const { from, to } = roomData;
    
    if (answer) {
      // Llamada aceptada
      devices.get(from).status = 'inCall';
      devices.get(to).status = 'inCall';
      
      // Notificar a ambos participantes
      io.to(room).emit('callAccepted', { room });
    } else {
      // Llamada rechazada
      devices.get(from).status = 'available';
      devices.get(to).status = 'available';
      
      // Notificar al llamante
      io.to(from).emit('callRejected', { room });
      
      // Eliminar la sala
      activeRooms.delete(room);
    }
    
    // Actualizar lista de dispositivos
    updateDeviceList();
  });

  // Finalización de llamada
  socket.on('callHangup', ({ room }) => {
    console.log(`📞 Llamada finalizada en sala ${room}`);
    
    const roomData = activeRooms.get(room);
    
    if (!roomData) {
      return;
    }
    
    const { from, to } = roomData;
    
    // Actualizar estados
    if (devices.has(from)) devices.get(from).status = 'available';
    if (devices.has(to)) devices.get(to).status = 'available';
    
    // Notificar a todos los participantes
    io.to(room).emit('callEnded', { room });
    
    // Eliminar la sala
    activeRooms.delete(room);
    
    // Actualizar lista de dispositivos
    updateDeviceList();
  });

  // Señalización WebRTC
  socket.on('webrtcSignal', ({ room, signal, to }) => {
    io.to(to).emit('webrtcSignal', {
      room,
      signal,
      from: socket.id
    });
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
    
    // Buscar y eliminar el dispositivo
    for (const [deviceName, device] of devices.entries()) {
      if (device.socketId === socket.id) {
        // Terminar llamadas activas
        for (const [room, roomData] of activeRooms.entries()) {
          if (roomData.from === deviceName || roomData.to === deviceName) {
            const otherParty = roomData.from === deviceName ? roomData.to : roomData.from;
            
            if (devices.has(otherParty)) {
              devices.get(otherParty).status = 'available';
              io.to(otherParty).emit('callEnded', { 
                room,
                reason: 'PEER_DISCONNECTED'
              });
            }
            
            activeRooms.delete(room);
          }
        }
        
        // Eliminar dispositivo
        devices.delete(deviceName);
        break;
      }
    }
    
    // Actualizar lista de dispositivos
    updateDeviceList();
  });
  
  // Función para actualizar la lista de dispositivos
  function updateDeviceList() {
    io.emit('deviceList', Array.from(devices.keys()).map(name => ({
      name,
      type: devices.get(name).deviceType,
      status: devices.get(name).status
    })));
  }
});

// Ruta para health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    devices: devices.size,
    activeRooms: activeRooms.size
  });
});

// Iniciar el servidor
const PORT = process.env.SIGNALING_PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor de señalización iniciado en puerto ${PORT}`);
  console.log(`📱 Interfaz web disponible en http://localhost:${PORT}`);
});

// Manejo de terminación del proceso
process.on('SIGINT', () => {
  console.log('Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
});
