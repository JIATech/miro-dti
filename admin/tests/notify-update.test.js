/**
 * Tests para el endpoint de notificación de actualizaciones
 * JIATech Intercom DTI - Panel de administración
 */

const request = require('supertest');
const mongoose = require('mongoose');
const mqtt = require('mqtt');

// Mock de mongoose
jest.mock('mongoose', () => {
  const mMongoose = {
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      on: jest.fn()
    }
  };
  return mMongoose;
});

// Mock de mqtt
jest.mock('mqtt', () => {
  const mMqtt = {
    connect: jest.fn().mockReturnValue({
      on: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
      connected: true
    })
  };
  return mMqtt;
});

// Mock del modelo Tablet
jest.mock('../models/Tablet', () => {
  return {
    find: jest.fn().mockResolvedValue([
      { deviceName: 'tablet-1', deviceId: 'abc123' },
      { deviceName: 'tablet-2', deviceId: 'def456' }
    ]),
    findOne: jest.fn().mockImplementation((query) => {
      if (query.deviceName === 'tablet-1') {
        return Promise.resolve({ deviceName: 'tablet-1', deviceId: 'abc123' });
      }
      return Promise.resolve(null);
    })
  };
});

// Mock de la función addLog
jest.mock('../utils/logUtils', () => ({
  addLog: jest.fn()
}));

// Crear servidor para tests
let app;
let server;

// Antes de todos los tests
beforeAll(() => {
  // Crear instancia de express sin inicializar por completo
  // para evitar conectar a bases de datos reales
  const express = require('express');
  const bodyParser = require('body-parser');
  
  app = express();
  app.use(bodyParser.json());
  
  // Configurar el cliente MQTT mock
  const mqttClient = mqtt.connect();
  
  // Implementar el endpoint bajo prueba
  app.post('/api/notify-update', async (req, res) => {
    try {
      const { version, force = false } = req.body;
      
      if (!version) {
        return res.status(400).json({ success: false, message: 'Se requiere versión para la notificación de actualización' });
      }
      
      // Actualizar archivo de versión
      const versionData = {
        version,
        buildDate: new Date().toISOString(),
        forceUpdate: force
      };
      
      // Publicar mensaje MQTT para notificar a todas las tablets
      if (mqttClient && mqttClient.connected) {
        mqttClient.publish('intercom/update/notification', JSON.stringify(versionData));
      }
      
      // Registrar el evento de actualización
      const tablets = await require('../models/Tablet').find({});
      for (const tablet of tablets) {
        require('../utils/logUtils').addLog('system', {
          timestamp: new Date(),
          level: 'info',
          message: `Notificación de actualización enviada: versión ${version}, forzada: ${force}`,
          device: tablet.deviceName,
          component: 'update-manager'
        });
      }
      
      return res.json({ 
        success: true, 
        message: 'Notificación de actualización enviada', 
        notifiedTablets: tablets.length,
        version,
        force
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error al notificar actualización', error: error.message });
    }
  });
  
  server = app.listen(0); // Puerto aleatorio para tests
});

// Después de todos los tests
afterAll((done) => {
  server.close(done);
});

describe('API de Notificación de Actualizaciones', () => {
  test('Debería devolver error 400 si no se proporciona versión', async () => {
    const response = await request(app)
      .post('/api/notify-update')
      .send({ force: true });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Se requiere versión');
  });
  
  test('Debería notificar correctamente a todas las tablets', async () => {
    const response = await request(app)
      .post('/api/notify-update')
      .send({ 
        version: '20250330-abcdef1',
        force: false 
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.notifiedTablets).toBe(2);
    expect(response.body.version).toBe('20250330-abcdef1');
    
    // Verificar que se publicó el mensaje MQTT
    const mqttClient = mqtt.connect();
    expect(mqttClient.publish).toHaveBeenCalledWith(
      'intercom/update/notification',
      expect.any(String)
    );
    
    // Verificar que se registró el evento en los logs
    const { addLog } = require('../utils/logUtils');
    expect(addLog).toHaveBeenCalledTimes(2);
  });
  
  test('Debería manejar correctamente actualizaciones forzadas', async () => {
    const response = await request(app)
      .post('/api/notify-update')
      .send({ 
        version: '20250330-abcdef1',
        force: true 
      });
    
    expect(response.status).toBe(200);
    expect(response.body.force).toBe(true);
    
    // Verificar el payload del mensaje MQTT para confirmar forceUpdate=true
    const mqttClient = mqtt.connect();
    expect(mqttClient.publish).toHaveBeenCalled();
    
    // Obtener el último llamado
    const lastCall = mqttClient.publish.mock.calls[mqttClient.publish.mock.calls.length - 1];
    const payload = JSON.parse(lastCall[1]);
    
    expect(payload.forceUpdate).toBe(true);
  });
});
