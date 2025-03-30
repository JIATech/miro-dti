/**
 * Test de integración extremo a extremo para el flujo de actualización
 * JIATech Intercom DTI - Sistema completo
 */

const { expect } = require('chai');
const axios = require('axios');
const mqtt = require('mqtt');

// Configuraciones para las pruebas
const config = {
  admin: {
    url: process.env.ADMIN_URL || 'http://localhost:8090',
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || 'intercom',
    password: process.env.MQTT_PASSWORD || 'intercom123',
  },
  pwa: {
    url: process.env.PWA_URL || 'http://localhost:3000',
  },
};

describe('Flujo de actualización extremo a extremo', function () {
  this.timeout(30000); // Las pruebas E2E pueden tomar tiempo

  let mqttClient;
  let authToken;
  let mqttMessages = [];

  // Antes de todas las pruebas
  before(async function () {
    // Iniciar cliente MQTT
    mqttClient = mqtt.connect(config.mqtt.broker, {
      username: config.mqtt.username,
      password: config.mqtt.password,
    });

    // Esperar a que se conecte MQTT
    await new Promise((resolve, reject) => {
      mqttClient.on('connect', () => {
        console.log('MQTT conectado');
        resolve();
      });
      mqttClient.on('error', (err) => {
        console.error('Error en conexión MQTT', err);
        reject(err);
      });
      // Timeout por si nunca se conecta
      setTimeout(() => reject(new Error('Timeout en conexión MQTT')), 5000);
    });

    // Suscribirse al tema de actualizaciones
    mqttClient.subscribe('intercom/update/notification');

    // Capturar mensajes
    mqttClient.on('message', (topic, message) => {
      if (topic === 'intercom/update/notification') {
        try {
          const data = JSON.parse(message.toString());
          mqttMessages.push(data);
          console.log('Mensaje MQTT recibido:', data);
        } catch (error) {
          console.error('Error al procesar mensaje MQTT:', error);
        }
      }
    });

    // Obtener token de autenticación para el panel de administración
    try {
      const response = await axios.post(`${config.admin.url}/api/auth/login`, {
        username: config.admin.user,
        password: config.admin.password,
      });

      if (response.data && response.data.token) {
        authToken = response.data.token;
        console.log('Token de autenticación obtenido');
      } else {
        throw new Error('No se pudo obtener token de autenticación');
      }
    } catch (error) {
      console.error('Error al autenticar:', error.message);
      // Si no podemos autenticar, intentemos con autenticación básica
      authToken = `Basic ${Buffer.from(`${config.admin.user}:${config.admin.password}`).toString('base64')}`;
      console.log('Usando autenticación básica');
    }
  });

  // Después de todas las pruebas
  after(function () {
    // Cerrar conexiones
    if (mqttClient) {
      mqttClient.end();
    }
  });

  // Pruebas del flujo de actualización
  it('Debería enviar notificación de actualización desde Admin', async function () {
    const version = `test-${Date.now()}`;

    // Limpiar mensajes anteriores
    mqttMessages = [];

    // Enviar notificación de actualización
    const headers = { Authorization: authToken };

    try {
      const response = await axios.post(
        `${config.admin.url}/api/notify-update`,
        { version, force: false },
        { headers }
      );

      expect(response.status).to.equal(200);
      expect(response.data.success).to.be.true;

      // Esperar a que llegue el mensaje MQTT (hasta 5 segundos)
      await waitForMqttMessage(5000, (messages) => messages.some((msg) => msg.version === version));

      // Verificar que se recibió el mensaje con la versión correcta
      const message = mqttMessages.find((msg) => msg.version === version);
      expect(message).to.exist;
      expect(message.forceUpdate).to.be.false;
    } catch (error) {
      console.error('Error al probar notificación:', error.message);
      throw error;
    }
  });

  it('Debería enviar notificación forzada correctamente', async function () {
    const version = `force-test-${Date.now()}`;

    // Limpiar mensajes anteriores
    mqttMessages = [];

    // Enviar notificación de actualización forzada
    const headers = { Authorization: authToken };

    try {
      const response = await axios.post(
        `${config.admin.url}/api/notify-update`,
        { version, force: true },
        { headers }
      );

      expect(response.status).to.equal(200);
      expect(response.data.success).to.be.true;

      // Esperar a que llegue el mensaje MQTT (hasta 5 segundos)
      await waitForMqttMessage(5000, (messages) => messages.some((msg) => msg.version === version));

      // Verificar que se recibió el mensaje con force=true
      const message = mqttMessages.find((msg) => msg.version === version);
      expect(message).to.exist;
      expect(message.forceUpdate).to.be.true;
    } catch (error) {
      console.error('Error al probar notificación forzada:', error.message);
      throw error;
    }
  });

  it('Debería verificar la salud del servicio PWA', async function () {
    try {
      const response = await axios.get(`${config.pwa.url}/health`);
      expect(response.status).to.equal(200);
      expect(response.data.status).to.equal('ok');
    } catch (error) {
      console.error('Error al verificar salud del PWA:', error.message);
      throw error;
    }
  });
});

// Función de utilidad para esperar a que llegue un mensaje MQTT
async function waitForMqttMessage(timeout, condition) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition(mqttMessages)) {
      return true;
    }

    // Esperar 100ms antes de verificar de nuevo
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timeout esperando mensaje MQTT');
}
