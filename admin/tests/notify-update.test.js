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

/**
 * Test para la funcionalidad de notificación de actualización
 * JIATech Intercom DTI - Componente Admin
 */

const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');

// Mock de la librería MQTT
jest.mock('mqtt');

describe('API de notificación de actualización', () => {
  let app;
  let mockMqttClient;
  
  beforeEach(() => {
    // Configurar mocks
    mockMqttClient = {
      publish: jest.fn((topic, message, opts, callback) => {
        if (callback) callback(null);
      }),
      on: jest.fn(),
      end: jest.fn()
    };
    
    mqtt.connect.mockReturnValue(mockMqttClient);
    
    // Crear una aplicación Express para pruebas
    app = express();
    app.use(bodyParser.json());
    
    // Implementar el endpoint de notificación
    app.post('/api/notify-update', (req, res) => {
      const { version, force = false } = req.body;
      
      if (!version) {
        return res.status(400).json({ success: false, message: 'Version is required' });
      }
      
      // Publicar en MQTT
      const topic = 'intercom/update/notification';
      const message = JSON.stringify({
        version,
        forceUpdate: force,
        timestamp: new Date().toISOString()
      });
      
      try {
        const mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://localhost:1883', {
          username: process.env.MQTT_USERNAME || 'intercom',
          password: process.env.MQTT_PASSWORD || 'intercom123'
        });
        
        mqttClient.publish(topic, message, { qos: 1, retain: true }, (err) => {
          if (err) {
            console.error('Error al publicar mensaje MQTT:', err);
            return res.status(500).json({ success: false, message: 'Failed to publish update notification' });
          }
          
          mqttClient.end();
          res.json({ success: true, message: 'Update notification sent' });
        });
        
      } catch (error) {
        console.error('Error al conectar con MQTT:', error);
        res.status(500).json({ success: false, message: 'Failed to connect to MQTT broker' });
      }
    });
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  it('debería devolver 400 si no se proporciona versión', async () => {
    const response = await request(app)
      .post('/api/notify-update')
      .send({ force: true });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
  
  it('debería publicar mensaje MQTT con la versión y force=false por defecto', async () => {
    const response = await request(app)
      .post('/api/notify-update')
      .send({ version: '1.0.0' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verificar que se llamó a mqtt.connect
    expect(mqtt.connect).toHaveBeenCalledWith(
      'mqtt://localhost:1883',
      expect.objectContaining({
        username: 'intercom',
        password: 'intercom123'
      })
    );
    
    // Verificar que se publicó el mensaje correcto
    expect(mockMqttClient.publish).toHaveBeenCalledWith(
      'intercom/update/notification',
      expect.stringContaining('"version":"1.0.0"'),
      expect.objectContaining({ qos: 1, retain: true }),
      expect.any(Function)
    );
    
    // Verificar el contenido del mensaje
    const publishCall = mockMqttClient.publish.mock.calls[0];
    const messageJson = JSON.parse(publishCall[1]);
    
    expect(messageJson).toHaveProperty('version', '1.0.0');
    expect(messageJson).toHaveProperty('forceUpdate', false);
    expect(messageJson).toHaveProperty('timestamp');
  });
  
  it('debería publicar mensaje MQTT con force=true cuando se especifica', async () => {
    const response = await request(app)
      .post('/api/notify-update')
      .send({ version: '1.0.0', force: true });
    
    expect(response.status).toBe(200);
    
    // Verificar el contenido del mensaje
    const publishCall = mockMqttClient.publish.mock.calls[0];
    const messageJson = JSON.parse(publishCall[1]);
    
    expect(messageJson).toHaveProperty('forceUpdate', true);
  });
  
  it('debería manejar errores de conexión MQTT', async () => {
    // Simular un error de conexión
    mqtt.connect.mockImplementation(() => {
      throw new Error('Connection failed');
    });
    
    const response = await request(app)
      .post('/api/notify-update')
      .send({ version: '1.0.0' });
    
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
  
  it('debería manejar errores de publicación MQTT', async () => {
    // Simular un error de publicación
    mockMqttClient.publish.mockImplementation((topic, message, opts, callback) => {
      callback(new Error('Publication failed'));
    });
    
    const response = await request(app)
      .post('/api/notify-update')
      .send({ version: '1.0.0' });
    
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});
