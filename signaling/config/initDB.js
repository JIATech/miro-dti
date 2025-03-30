/**
 * Script de inicialización de la base de datos
 *
 * Este script crea los usuarios predeterminados en MongoDB
 * si no existen previamente.
 */

const User = require('../models/User');

/**
 * Usuarios predeterminados del sistema
 */
const defaultUsers = [
  {
    username: 'portero',
    password: 'portero1234',
    displayName: 'Portero',
    role: 'portero',
    allowedRooms: ['*'],
  },
  {
    username: 'administracion',
    password: 'admin1234',
    displayName: 'Administración',
    role: 'administracion',
    allowedRooms: ['*'],
  },
  {
    username: 'sistemas',
    password: 'sistemas1234',
    displayName: 'Sistemas',
    role: 'sistemas',
    allowedRooms: ['*'],
  },
  {
    username: 'infraestructura',
    password: 'infra1234',
    displayName: 'Infraestructura',
    role: 'infraestructura',
    allowedRooms: ['*'],
  },
  {
    username: 'soporte',
    password: 'soporte1234',
    displayName: 'Soporte',
    role: 'soporte',
    allowedRooms: ['*'],
  },
];

/**
 * Inicializa la base de datos con usuarios predeterminados
 * si no existen previamente.
 */
async function initializeDatabase() {
  try {
    console.log('🟠 Comprobando usuarios predeterminados...');

    // Para cada usuario predeterminado
    for (const userData of defaultUsers) {
      // Comprobar si ya existe
      const existingUser = await User.findOne({ username: userData.username });

      if (!existingUser) {
        // Crear el usuario si no existe
        const newUser = new User(userData);
        await newUser.save();
        console.log(`🟢 Usuario creado: ${userData.displayName} (${userData.role})`);
      } else {
        console.log(`🟠 Usuario ya existe: ${userData.displayName} (${userData.role})`);
      }
    }

    // Contar usuarios
    const userCount = await User.countDocuments();
    console.log(`🟢 Base de datos inicializada. Total de usuarios: ${userCount}`);

    return true;
  } catch (error) {
    console.error('🔴 Error al inicializar la base de datos:', error);
    return false;
  }
}

module.exports = {
  initializeDatabase,
};
