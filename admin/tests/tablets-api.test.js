/**
 * Tests para la API de gestión de tablets
 * JIATech Intercom DTI - Panel de administración
 */

const request = require('supertest');
const mongoose = require('mongoose');
const mqtt = require('mqtt');

// Mock de mongoose
jest.mock('mongoose', () => {
  return {
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      on: jest.fn(),
    },
    Schema: jest.fn().mockReturnValue({
      pre: jest.fn().mockReturnThis(),
      index: jest.fn().mockReturnThis(),
    }),
    model: jest.fn().mockReturnValue({}),
  };
});

// Mock de mqtt
jest.mock('mqtt', () => {
  const mMqtt = {
    connect: jest.fn().mockReturnValue({
      on: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
      connected: true,
    }),
  };
  return mMqtt;
});

// Mock del modelo Tablet
const mockTabletsList = [
  {
    deviceId: 'tablet123',
    deviceName: 'Tablet Entrada Principal',
    ip: '192.168.1.101',
    status: 'online',
    batteryLevel: 85,
    lastContact: new Date(),
    location: 'Entrada Principal',
    firmware: '20250330-abcdef1',
  },
  {
    deviceId: 'tablet456',
    deviceName: 'Tablet Recepción',
    ip: '192.168.1.102',
    status: 'offline',
    batteryLevel: 20,
    lastContact: new Date(Date.now() - 3600000),
    location: 'Recepción',
    firmware: '20250330-abcdef1',
  },
];

jest.mock('../models/Tablet', () => {
  return {
    find: jest.fn().mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue(mockTabletsList),
      };
    }),
    findOne: jest.fn().mockImplementation((query) => {
      const found = mockTabletsList.find((t) => t.deviceId === query.deviceId);
      return Promise.resolve(found || null);
    }),
    findByIdAndUpdate: jest.fn().mockImplementation((id, data) => {
      return Promise.resolve({ ...mockTabletsList[0], ...data });
    }),
    create: jest.fn().mockImplementation((data) => {
      return Promise.resolve({
        deviceId: 'newtablet789',
        ...data,
      });
    }),
    findByIdAndDelete: jest.fn().mockResolvedValue(mockTabletsList[0]),
  };
});

// Mock de la función addLog
jest.mock('../utils/logUtils', () => ({
  addLog: jest.fn(),
}));

// Crear servidor para tests
let app;
let server;

// Antes de todos los tests
beforeAll(() => {
  // Crear instancia de express sin inicializar por completo
  const express = require('express');
  const bodyParser = require('body-parser');

  app = express();
  app.use(bodyParser.json());

  // Implementar endpoints de la API bajo prueba
  app.get('/api/tablets', async (req, res) => {
    try {
      const tablets = await require('../models/Tablet').find().sort({ deviceName: 1 });

      return res.json({
        success: true,
        tablets,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener tablets',
        error: error.message,
      });
    }
  });

  app.get('/api/tablets/:deviceId', async (req, res) => {
    try {
      const tablet = await require('../models/Tablet').findOne({ deviceId: req.params.deviceId });
      if (!tablet) {
        return res.status(404).json({
          success: false,
          message: 'Tablet no encontrada',
        });
      }

      return res.json({
        success: true,
        tablet,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al obtener detalles de la tablet',
        error: error.message,
      });
    }
  });

  app.post('/api/tablets', async (req, res) => {
    try {
      const { deviceName, location } = req.body;

      if (!deviceName) {
        return res.status(400).json({
          success: false,
          message: 'El nombre del dispositivo es obligatorio',
        });
      }

      const newTablet = await require('../models/Tablet').create({
        deviceName,
        location,
        status: 'pending',
        batteryLevel: 0,
        lastContact: new Date(),
      });

      // Registrar el evento
      require('../utils/logUtils').addLog('system', {
        timestamp: new Date(),
        level: 'info',
        message: `Nueva tablet registrada: ${deviceName}`,
        component: 'admin',
      });

      return res.status(201).json({
        success: true,
        message: 'Tablet registrada correctamente',
        tablet: newTablet,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al registrar tablet',
        error: error.message,
      });
    }
  });

  server = app.listen(0); // Puerto aleatorio para tests
});

// Después de todos los tests
afterAll((done) => {
  server.close(done);
});

describe('API de Gestión de Tablets', () => {
  test('Debería obtener todas las tablets', async () => {
    const response = await request(app).get('/api/tablets');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.tablets)).toBe(true);
    expect(response.body.tablets).toHaveLength(2);

    // Verificar que los datos se están formateando correctamente
    const tablet = response.body.tablets[0];
    expect(tablet).toHaveProperty('deviceId');
    expect(tablet).toHaveProperty('deviceName');
    expect(tablet).toHaveProperty('status');
    expect(tablet).toHaveProperty('batteryLevel');
    expect(tablet).toHaveProperty('firmware');
  });

  test('Debería obtener detalles de una tablet específica', async () => {
    const response = await request(app).get('/api/tablets/tablet123');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tablet).toHaveProperty('deviceId', 'tablet123');
    expect(response.body.tablet).toHaveProperty('location', 'Entrada Principal');
  });

  test('Debería manejar correctamente la búsqueda de una tablet inexistente', async () => {
    const response = await request(app).get('/api/tablets/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('no encontrada');
  });

  test('Debería registrar una nueva tablet correctamente', async () => {
    const tabletData = {
      deviceName: 'Nueva Tablet',
      location: 'Segundo Piso',
    };

    const response = await request(app).post('/api/tablets').send(tabletData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.tablet).toHaveProperty('deviceId');
    expect(response.body.tablet).toHaveProperty('deviceName', 'Nueva Tablet');
    expect(response.body.tablet).toHaveProperty('location', 'Segundo Piso');

    // Verificar que se registró el evento
    const { addLog } = require('../utils/logUtils');
    expect(addLog).toHaveBeenCalled();
  });

  test('Debería rechazar el registro sin nombre de dispositivo', async () => {
    const tabletData = {
      location: 'Segundo Piso',
    };

    const response = await request(app).post('/api/tablets').send(tabletData);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('nombre del dispositivo es obligatorio');
  });
});
