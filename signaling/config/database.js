/**
 * Configuración de conexión a MongoDB
 * 
 * Este módulo gestiona la conexión a la base de datos MongoDB
 * utilizada para almacenar información de usuarios y configuración.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Recuperar la URI de MongoDB de las variables de entorno
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/intercom';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'intercom';

// Opciones de conexión
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: MONGO_DB_NAME
};

// Función para conectar a MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, options);
    console.log('🟢 Conexión a MongoDB establecida con éxito');
    return true;
  } catch (error) {
    console.error('🔴 Error al conectar a MongoDB:', error.message);
    return false;
  }
}

// Eventos de conexión
mongoose.connection.on('connected', () => {
  console.log(`🟢 MongoDB conectado a: ${MONGO_URI}`);
});

mongoose.connection.on('error', (err) => {
  console.error(`🔴 Error de conexión MongoDB: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('🟠 MongoDB desconectado');
});

// Manejador de cierre de aplicación para cerrar la conexión
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🟠 Conexión a MongoDB cerrada por finalización de la aplicación');
  process.exit(0);
});

module.exports = {
  connectDB
};
