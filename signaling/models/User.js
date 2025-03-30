/**
 * Modelo de Usuario para el sistema Intercom DTI
 * 
 * Define la estructura de los usuarios en MongoDB
 * y métodos relacionados con la autenticación
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Schema de usuario para MongoDB
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['portero', 'administracion', 'sistemas', 'infraestructura', 'soporte'],
    required: true
  },
  allowedRooms: {
    type: [String],
    default: ['*'] // * significa todos los rooms permitidos
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  settings: {
    type: Object,
    default: {
      audio: true,
      video: true,
      notifications: true
    }
  },
  authorizedDevices: {
    type: [{
      deviceId: String,
      androidId: String,
      source: String,
      manufacturer: String,
      model: String,
      fingerprint: String,
      uuid: String,
      userAgent: String,
      ipAddress: String,
      autoLogin: {
        type: Boolean,
        default: true
      },
      lastUsed: Date,
      firstRegistered: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pre-save para encriptar contraseña
userSchema.pre('save', async function(next) {
  const user = this;
  
  // Solo encriptar si la contraseña ha sido modificada o es nueva
  if (!user.isModified('password')) return next();
  
  try {
    // Generar salt
    const salt = await bcrypt.genSalt(10);
    // Encriptar contraseña
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Método para generar token JWT
userSchema.methods.generateAuthToken = function() {
  const token = jwt.sign(
    { 
      id: this._id,
      username: this.username,
      role: this.role,
      displayName: this.displayName
    },
    process.env.JWT_KEY || 'intercom_jwt_secret',
    { expiresIn: process.env.JWT_EXPIRATION || '365d' }
  );
  
  return token;
};

// Crear y exportar el modelo
const User = mongoose.model('User', userSchema);

module.exports = User;
