/**
 * Tests para el Servidor de Señalización
 * JIATech Intercom DTI - Componente Signaling
 */

const io = require('socket.io-client');
const http = require('http');
const { Server } = require('socket.io');
const { expect } = require('chai');

// Cliente socket.io para pruebas
let clientSocket;
let adminSocket;
// Servidor de prueba
let httpServer;
let serverSocket;
let serverIo;

// Puerto para tests
const TEST_PORT = 5000;

describe('Servidor de Señalización - Tests Básicos', function () {
  this.timeout(10000); // Aumentar timeout para evitar problemas en CI

  // Configurar servidor y clientes antes de las pruebas
  beforeEach((done) => {
    // Crear servidor HTTP para tests
    httpServer = http.createServer();
    serverIo = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    httpServer.listen(TEST_PORT, () => {
      // Cliente normal
      clientSocket = io.connect(`http://localhost:${TEST_PORT}`, {
        'reconnection delay': 0,
        'reopen delay': 0,
        'force new connection': true,
        transports: ['websocket'],
      });

      // Cliente simulando admin
      adminSocket = io.connect(`http://localhost:${TEST_PORT}`, {
        'reconnection delay': 0,
        'reopen delay': 0,
        'force new connection': true,
        transports: ['websocket'],
        auth: {
          token: 'admintoken123', // Token simulado para admin
        },
      });

      // Manejar conexiones
      serverIo.on('connection', (socket) => {
        serverSocket = socket;

        // Implementar funcionalidad básica del servidor de señalización
        socket.on('join', ({ roomId, deviceName }) => {
          socket.join(roomId);
          socket.deviceName = deviceName || 'Dispositivo sin nombre';
          socket.roomId = roomId;

          // Informar a todos en la sala
          serverIo.to(roomId).emit('user-joined', {
            deviceId: socket.id,
            deviceName: socket.deviceName,
          });

          // Enviar lista de usuarios en la sala
          const room = serverIo.sockets.adapter.rooms.get(roomId);
          const users = [];

          if (room) {
            room.forEach((id) => {
              const user = serverIo.sockets.sockets.get(id);
              if (user && user.id !== socket.id) {
                users.push({
                  deviceId: user.id,
                  deviceName: user.deviceName || 'Unknown',
                });
              }
            });
          }

          socket.emit('room-users', users);
        });

        socket.on('signal', ({ to, signal }) => {
          if (to && signal) {
            serverIo.to(to).emit('signal', {
              from: socket.id,
              deviceName: socket.deviceName,
              signal,
            });
          }
        });

        socket.on('disconnect', () => {
          if (socket.roomId) {
            serverIo.to(socket.roomId).emit('user-left', {
              deviceId: socket.id,
              deviceName: socket.deviceName,
            });
          }
        });

        // API de administración
        socket.on('admin:get-rooms', () => {
          // Verificar autenticación
          if (!socket.handshake.auth || socket.handshake.auth.token !== 'admintoken123') {
            socket.emit('admin:error', { message: 'No autorizado' });
            return;
          }

          const rooms = [];
          serverIo.sockets.adapter.rooms.forEach((_, key) => {
            // Omitir salas de socket.io internas
            if (!key.startsWith('/')) {
              const roomInfo = {
                roomId: key,
                participants: serverIo.sockets.adapter.rooms.get(key).size,
              };
              rooms.push(roomInfo);
            }
          });

          socket.emit('admin:rooms', rooms);
        });
      });

      // Esperar a que los clientes se conecten antes de ejecutar tests
      clientSocket.on('connect', () => {
        adminSocket.on('connect', () => {
          done();
        });
      });
    });
  });

  // Limpiar después de cada test
  afterEach((done) => {
    if (serverIo) {
      serverIo.close();
    }
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (adminSocket.connected) {
      adminSocket.disconnect();
    }
    httpServer.close();
    done();
  });

  // Tests

  it('Debería permitir a un cliente unirse a una sala', (done) => {
    const roomId = 'test-room-1';
    const deviceName = 'Tablet Prueba';

    clientSocket.on('room-users', (users) => {
      expect(Array.isArray(users)).to.be.true;
      expect(users.length).to.equal(0); // Primer usuario, sala vacía
      done();
    });

    clientSocket.emit('join', { roomId, deviceName });
  });

  it('Debería notificar a los usuarios existentes cuando un nuevo usuario se une', (done) => {
    const roomId = 'test-room-2';

    // Primer cliente se une a la sala
    clientSocket.emit('join', { roomId, deviceName: 'Cliente 1' });

    // Cuando el primer cliente recibe notificación de sala, creamos segundo cliente
    clientSocket.on('room-users', () => {
      // Esperar notificación de nuevo usuario
      clientSocket.on('user-joined', (user) => {
        expect(user).to.have.property('deviceId');
        expect(user).to.have.property('deviceName', 'Cliente 2');
        done();
      });

      // Conectar segundo cliente
      const secondClient = io.connect(`http://localhost:${TEST_PORT}`, {
        'force new connection': true,
        transports: ['websocket'],
      });

      secondClient.on('connect', () => {
        secondClient.emit('join', { roomId, deviceName: 'Cliente 2' });
      });
    });
  });

  it('Debería enviar señales entre clientes correctamente', (done) => {
    const roomId = 'test-room-3';

    // Primer cliente se une
    clientSocket.emit('join', { roomId, deviceName: 'Emisor' });

    // Segundo cliente
    const receiverClient = io.connect(`http://localhost:${TEST_PORT}`, {
      'force new connection': true,
      transports: ['websocket'],
    });

    receiverClient.on('connect', () => {
      receiverClient.emit('join', { roomId, deviceName: 'Receptor' });

      // Escuchar señales
      receiverClient.on('signal', (data) => {
        expect(data).to.have.property('from');
        expect(data).to.have.property('signal', 'test-signal-data');
        receiverClient.disconnect();
        done();
      });

      // Una vez que el cliente receptor está en la sala, emitimos la señal
      clientSocket.on('room-users', (users) => {
        if (users.length > 0) {
          // Enviar señal al otro cliente
          clientSocket.emit('signal', {
            to: users[0].deviceId,
            signal: 'test-signal-data',
          });
        }
      });
    });
  });

  it('Debería notificar cuando un usuario abandona la sala', (done) => {
    const roomId = 'test-room-4';

    // Cliente que se quedará observando
    clientSocket.emit('join', { roomId, deviceName: 'Observador' });

    // Cliente que se desconectará
    const leavingClient = io.connect(`http://localhost:${TEST_PORT}`, {
      'force new connection': true,
      transports: ['websocket'],
    });

    leavingClient.on('connect', () => {
      leavingClient.emit('join', { roomId, deviceName: 'Usuario saliente' });

      // Esperar a que ambos estén en la sala
      clientSocket.on('user-joined', (user) => {
        if (user.deviceName === 'Usuario saliente') {
          // Escuchar evento de usuario que sale
          clientSocket.on('user-left', (data) => {
            expect(data).to.have.property('deviceId');
            expect(data).to.have.property('deviceName', 'Usuario saliente');
            done();
          });

          // Desconectar cliente
          leavingClient.disconnect();
        }
      });
    });
  });

  it('Debería permitir que los admin obtengan información de las salas', (done) => {
    const roomId = 'test-room-admin';

    // Cliente normal se une a una sala
    clientSocket.emit('join', { roomId, deviceName: 'Cliente Normal' });

    // Esperar que el cliente esté en la sala
    clientSocket.on('room-users', () => {
      // Admin solicita info de salas
      adminSocket.emit('admin:get-rooms');

      adminSocket.on('admin:rooms', (rooms) => {
        expect(Array.isArray(rooms)).to.be.true;

        // Verificar que la sala de prueba está en la lista
        const testRoom = rooms.find((room) => room.roomId === roomId);
        expect(testRoom).to.exist;
        expect(testRoom).to.have.property('participants').that.equals(1);
        done();
      });
    });
  });

  it('Debería denegar acceso a funciones admin sin autenticación', (done) => {
    // Cliente sin token de autenticación
    const unauthorizedClient = io.connect(`http://localhost:${TEST_PORT}`, {
      'force new connection': true,
      transports: ['websocket'],
    });

    unauthorizedClient.on('connect', () => {
      // Intentar acceder a API de admin
      unauthorizedClient.emit('admin:get-rooms');

      unauthorizedClient.on('admin:error', (error) => {
        expect(error).to.have.property('message', 'No autorizado');
        unauthorizedClient.disconnect();
        done();
      });
    });
  });
});
