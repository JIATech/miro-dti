/**
 * Rutas de autenticación
 * 
 * Implementa los endpoints para autenticar usuarios,
 * crear cuentas y gestionar la información de usuarios.
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener token
 * @access  Público
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validar datos de entrada
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere nombre de usuario y contraseña' 
      });
    }
    
    // Buscar usuario por nombre de usuario
    const user = await User.findOne({ username: username.toLowerCase() });
    
    // Verificar que el usuario existe
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }
    
    // Verificar que el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario desactivado' 
      });
    }
    
    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }
    
    // Generar token JWT
    const token = user.generateAuthToken();
    
    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();
    
    // Enviar respuesta
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

/**
 * @route   GET /api/auth/user
 * @desc    Obtener información del usuario autenticado
 * @access  Privado
 */
router.get('/user', auth, async (req, res) => {
  try {
    // El middleware auth ya adjuntó el usuario al request
    const user = req.user;
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        allowedRooms: user.allowedRooms,
        settings: user.settings,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

/**
 * @route   PUT /api/auth/settings
 * @desc    Actualizar configuración del usuario
 * @access  Privado
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un objeto de configuración válido' 
      });
    }
    
    // Actualizar configuración
    req.user.settings = { ...req.user.settings, ...settings };
    req.user.updatedAt = new Date();
    
    await req.user.save();
    
    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      settings: req.user.settings
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

/**
 * Rutas administrativas - Solo disponibles para usuarios con rol de administración
 */

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario (solo administradores)
 * @access  Privado (admin)
 */
router.post('/register', auth, async (req, res) => {
  try {
    // Verificar si el usuario actual tiene permisos de administrador
    if (req.user.role !== 'sistemas') {
      return res.status(403).json({ 
        success: false, 
        message: 'No tiene permisos para realizar esta acción' 
      });
    }
    
    const { username, password, displayName, role, allowedRooms } = req.body;
    
    // Validar datos requeridos
    if (!username || !password || !displayName || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Todos los campos son requeridos' 
      });
    }
    
    // Verificar que el rol sea válido
    const validRoles = ['portero', 'administracion', 'sistemas', 'infraestructura', 'soporte'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rol inválido' 
      });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'El nombre de usuario ya está en uso' 
      });
    }
    
    // Crear nuevo usuario
    const newUser = new User({
      username: username.toLowerCase(),
      password,
      displayName,
      role,
      allowedRooms: allowedRooms || ['*']
    });
    
    // Guardar usuario
    await newUser.save();
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser._id,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

/**
 * @route   GET /api/auth/users
 * @desc    Obtener lista de usuarios (solo administradores)
 * @access  Privado (admin)
 */
router.get('/users', auth, async (req, res) => {
  try {
    // Verificar si el usuario actual tiene permisos de administrador
    if (req.user.role !== 'sistemas') {
      return res.status(403).json({ 
        success: false, 
        message: 'No tiene permisos para realizar esta acción' 
      });
    }
    
    // Obtener todos los usuarios (excluyendo la contraseña)
    const users = await User.find({}).select('-password');
    
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

module.exports = router;
