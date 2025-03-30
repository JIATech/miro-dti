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
    const { username, password, deviceInfo } = req.body;
    
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
    
    // Guardar información del dispositivo si proviene de WallPanel o tiene identificadores únicos
    if (deviceInfo) {
      await registerUserDevice(user, deviceInfo, req);
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
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña del usuario autenticado
 * @access  Privado
 */
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Validar datos requeridos
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere contraseña actual y nueva contraseña' 
      });
    }
    
    // Verificar longitud mínima de la contraseña
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'La nueva contraseña debe tener al menos 6 caracteres' 
      });
    }
    
    // Verificar contraseña actual
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'La contraseña actual es incorrecta' 
      });
    }
    
    // Actualizar contraseña
    req.user.password = newPassword;
    req.user.updatedAt = new Date();
    
    await req.user.save();
    
    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

/**
 * @route   POST /api/auth/verify-device
 * @desc    Verificar si un dispositivo está autorizado para recuperar contraseña
 * @access  Público
 */
router.post('/verify-device', async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    
    if (!deviceInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere información del dispositivo',
        verified: false
      });
    }
    
    // Obtener información adicional del request
    const ipAddress = req.headers['x-forwarded-for'] || 
                      req.socket.remoteAddress || 
                      '0.0.0.0';
                      
    // Agregar IP a la información del dispositivo
    deviceInfo.ipAddress = ipAddress;
    
    // Verificar si el dispositivo está autorizado
    const isVerified = await verifyAuthorizedDevice(deviceInfo);
    
    // Registrar el intento de verificación en la base de datos de auditoría
    await logDeviceVerificationAttempt(deviceInfo, isVerified);
    
    return res.json({
      success: true,
      message: isVerified ? 'Dispositivo verificado correctamente' : 'Dispositivo no autorizado',
      verified: isVerified
    });
    
  } catch (error) {
    console.error('Error al verificar dispositivo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor',
      verified: false
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Restablecer contraseña mediante verificación de dispositivo
 * @access  Público
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword, deviceInfo } = req.body;
    
    // Validar datos requeridos
    if (!username || !newPassword || !deviceInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Todos los campos son requeridos' 
      });
    }
    
    // Verificar longitud mínima de la contraseña
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'La nueva contraseña debe tener al menos 6 caracteres' 
      });
    }
    
    // Verificar si el dispositivo está autorizado
    const isAuthorized = await verifyAuthorizedDevice(deviceInfo);
    
    if (!isAuthorized) {
      // Registrar intento no autorizado
      await logPasswordResetAttempt(username, deviceInfo, false, 'Dispositivo no autorizado');
      
      return res.status(403).json({ 
        success: false, 
        message: 'Este dispositivo no está autorizado para restablecer contraseñas' 
      });
    }
    
    // Buscar usuario por nombre de usuario
    const user = await User.findOne({ username: username.toLowerCase() });
    
    // Verificar que el usuario existe
    if (!user) {
      // Registrar intento fallido
      await logPasswordResetAttempt(username, deviceInfo, false, 'Usuario no encontrado');
      
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }
    
    // Verificar que el usuario está activo
    if (!user.isActive) {
      // Registrar intento fallido
      await logPasswordResetAttempt(username, deviceInfo, false, 'Usuario inactivo');
      
      return res.status(403).json({ 
        success: false, 
        message: 'Este usuario está desactivado' 
      });
    }
    
    // Actualizar contraseña
    user.password = newPassword;
    user.updatedAt = new Date();
    
    await user.save();
    
    // Registrar restablecimiento exitoso
    await logPasswordResetAttempt(username, deviceInfo, true, 'Restablecimiento exitoso');
    
    res.json({
      success: true,
      message: 'Contraseña restablecida correctamente'
    });
    
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor' 
    });
  }
});

/**
 * @route   POST /api/auth/device-login
 * @desc    Autenticar usuario automáticamente por dispositivo
 * @access  Público
 */
router.post('/device-login', async (req, res) => {
  try {
    const { deviceInfo } = req.body;
    
    if (!deviceInfo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere información del dispositivo' 
      });
    }
    
    // Comprobar si tiene identificadores únicos suficientes
    const hasUniqueIdentifiers = deviceInfo.deviceId || deviceInfo.androidId || 
                                deviceInfo.fingerprint || deviceInfo.uuid;
    
    if (!hasUniqueIdentifiers) {
      return res.status(400).json({
        success: false,
        message: 'Identificación de dispositivo insuficiente',
        requiresLogin: true
      });
    }
    
    // Buscar usuario propietario del dispositivo
    const user = await findUserByDevice(deviceInfo);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo no registrado',
        requiresLogin: true
      });
    }
    
    // Verificar que el usuario está activo
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Usuario desactivado',
        requiresLogin: true
      });
    }
    
    // Actualizar información del dispositivo
    await updateDeviceInfo(user, deviceInfo);
    
    // Generar token JWT
    const token = user.generateAuthToken();
    
    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();
    
    // Enviar respuesta
    res.json({
      success: true,
      message: 'Inicio de sesión automático exitoso',
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        settings: user.settings
      }
    });
    
    // Log del inicio automático
    console.log(`[AUTH] Inicio automático para ${user.username} desde dispositivo ${deviceInfo.source || 'desconocido'}`);
    
  } catch (error) {
    console.error('Error en login por dispositivo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor',
      requiresLogin: true
    });
  }
});

/**
 * Buscar usuario por información del dispositivo
 * @param {Object} deviceInfo - Información del dispositivo
 * @returns {Object|null} - Usuario encontrado o null
 */
async function findUserByDevice(deviceInfo) {
  try {
    let user = null;
    
    // Búsqueda por identificadores primarios (deviceId, androidId)
    if (deviceInfo.deviceId || deviceInfo.androidId) {
      const query = {
        'authorizedDevices': {
          $elemMatch: {
            $or: []
          }
        }
      };
      
      if (deviceInfo.deviceId) {
        query.authorizedDevices.$elemMatch.$or.push({ 'deviceId': deviceInfo.deviceId });
      }
      
      if (deviceInfo.androidId) {
        query.authorizedDevices.$elemMatch.$or.push({ 'androidId': deviceInfo.androidId });
      }
      
      if (query.authorizedDevices.$elemMatch.$or.length > 0) {
        user = await User.findOne(query);
        
        if (user) {
          return user;
        }
      }
    }
    
    // Búsqueda por identificadores secundarios (uuid, fingerprint)
    if ((deviceInfo.uuid || deviceInfo.fingerprint) && !user) {
      const query = {
        'authorizedDevices': {
          $elemMatch: {
            $or: []
          }
        }
      };
      
      if (deviceInfo.uuid) {
        query.authorizedDevices.$elemMatch.$or.push({ 'uuid': deviceInfo.uuid });
      }
      
      if (deviceInfo.fingerprint) {
        query.authorizedDevices.$elemMatch.$or.push({ 'fingerprint': deviceInfo.fingerprint });
      }
      
      if (query.authorizedDevices.$elemMatch.$or.length > 0) {
        user = await User.findOne(query);
      }
    }
    
    return user;
  } catch (error) {
    console.error('Error buscando usuario por dispositivo:', error);
    return null;
  }
}

/**
 * Actualizar información del dispositivo en el usuario
 * @param {Object} user - Documento de usuario
 * @param {Object} deviceInfo - Información del dispositivo
 */
async function updateDeviceInfo(user, deviceInfo) {
  try {
    if (!user || !deviceInfo) {
      return;
    }
    
    // Normalizar info del dispositivo
    const normalizedInfo = {
      source: deviceInfo.source || 'unknown',
      deviceId: deviceInfo.deviceId || null,
      androidId: deviceInfo.androidId || null,
      manufacturer: deviceInfo.manufacturer || null,
      model: deviceInfo.model || null,
      fingerprint: deviceInfo.fingerprint || null,
      uuid: deviceInfo.uuid || null,
      userAgent: deviceInfo.userAgent || null,
      ipAddress: deviceInfo.ipAddress || null,
      lastUsed: new Date()
    };
    
    let deviceToUpdate = null;
    
    // Buscar dispositivo por los identificadores principales
    if (normalizedInfo.deviceId || normalizedInfo.androidId) {
      deviceToUpdate = user.authorizedDevices.find(device => 
        (normalizedInfo.deviceId && device.deviceId === normalizedInfo.deviceId) || 
        (normalizedInfo.androidId && device.androidId === normalizedInfo.androidId)
      );
    }
    
    // Si no se encontró, buscar por identificadores secundarios
    if (!deviceToUpdate && (normalizedInfo.uuid || normalizedInfo.fingerprint)) {
      deviceToUpdate = user.authorizedDevices.find(device => 
        (normalizedInfo.uuid && device.uuid === normalizedInfo.uuid) || 
        (normalizedInfo.fingerprint && device.fingerprint === normalizedInfo.fingerprint)
      );
    }
    
    // Actualizar el dispositivo encontrado
    if (deviceToUpdate) {
      Object.assign(deviceToUpdate, {
        ...normalizedInfo,
        lastUsed: new Date()
      });
    }
    
    // No creamos dispositivos nuevos aquí porque solo se actualiza la info
    // de dispositivos ya registrados durante un inicio de sesión automático
    
  } catch (error) {
    console.error('Error actualizando información del dispositivo:', error);
  }
}

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

/**
 * Verificar si un dispositivo está autorizado para restablecer contraseñas
 * @param {Object} deviceInfo - Información del dispositivo
 * @returns {Boolean} - true si está autorizado, false si no
 */
async function verifyAuthorizedDevice(deviceInfo) {
  try {
    if (!deviceInfo || typeof deviceInfo !== 'object') {
      return false;
    }

    // Si no se proporciona usuario, no podemos verificar
    if (!deviceInfo.username) {
      // Para compatibilidad con versiones anteriores y modo temporal de desarrollo
      // permitimos verificar con la lista predeterminada
      console.log('[WARNING] Verificación de dispositivo sin username, usando lista predeterminada');
      return verifyAgainstDefaultList(deviceInfo);
    }
    
    // Buscar usuario por nombre de usuario
    const user = await User.findOne({ 
      username: deviceInfo.username.toLowerCase() 
    });
    
    // Si el usuario no existe, no está autorizado
    if (!user) {
      console.log(`[INFO] Usuario no encontrado para verificación: ${deviceInfo.username}`);
      return false;
    }
    
    // Si el usuario no tiene dispositivos autorizados, verificar con lista predeterminada
    if (!user.authorizedDevices || user.authorizedDevices.length === 0) {
      console.log(`[INFO] Usuario ${user.username} sin dispositivos registrados. Usando lista predeterminada.`);
      return verifyAgainstDefaultList(deviceInfo);
    }
    
    // Verificar si el dispositivo está en la lista de dispositivos autorizados del usuario
    let isAuthorized = false;
    
    // Verificar por identificadores primarios (deviceId, androidId)
    if (deviceInfo.deviceId || deviceInfo.androidId) {
      isAuthorized = user.authorizedDevices.some(device => 
        (deviceInfo.deviceId && device.deviceId === deviceInfo.deviceId) || 
        (deviceInfo.androidId && device.androidId === deviceInfo.androidId)
      );
    }
    
    // Si no se encontró, verificar por identificadores secundarios (uuid, fingerprint)
    if (!isAuthorized && (deviceInfo.uuid || deviceInfo.fingerprint)) {
      isAuthorized = user.authorizedDevices.some(device => 
        (deviceInfo.uuid && device.uuid === deviceInfo.uuid) || 
        (deviceInfo.fingerprint && device.fingerprint === deviceInfo.fingerprint)
      );
    }
    
    // Verificar por características del dispositivo (más permisivo)
    if (!isAuthorized && deviceInfo.source === 'browser') {
      isAuthorized = user.authorizedDevices.some(device => {
        // Debe coincidir al menos 3 características para considerar que es el mismo dispositivo
        let matchCount = 0;
        
        if (device.userAgent && device.userAgent === deviceInfo.userAgent) matchCount++;
        if (device.ipAddress && device.ipAddress === deviceInfo.ipAddress) matchCount++;
        if (deviceInfo.platform && device.platform === deviceInfo.platform) matchCount++;
        if (deviceInfo.screenResolution && device.screenResolution === deviceInfo.screenResolution) matchCount++;
        
        return matchCount >= 2; // Reducimos a 2 para ser más permisivos
      });
    }
    
    // Verificar si es un dispositivo WallPanel pero aún no está registrado
    // Solo para desarrollo y facilitar la primera autorización de tablets
    if (!isAuthorized && deviceInfo.source && deviceInfo.source.includes('wallpanel')) {
      console.log(`[INFO] Primera autorización de WallPanel para: ${user.username}`);
      // Durante el periodo inicial, autorizamos automáticamente los dispositivos WallPanel
      // Esta lógica puede eliminarse después del periodo de implementación inicial
      
      // Registrar el dispositivo para futuros usos
      if (!user.authorizedDevices) {
        user.authorizedDevices = [];
      }
      
      user.authorizedDevices.push({
        source: deviceInfo.source,
        deviceId: deviceInfo.deviceId || null,
        androidId: deviceInfo.androidId || null,
        manufacturer: deviceInfo.manufacturer || null,
        model: deviceInfo.model || null,
        fingerprint: deviceInfo.fingerprint || null,
        uuid: deviceInfo.uuid || null,
        userAgent: deviceInfo.userAgent || null,
        ipAddress: deviceInfo.ipAddress || null,
        firstRegistered: new Date(),
        lastUsed: new Date()
      });
      
      await user.save();
      
      return true; // Autorizar dispositivo WallPanel en primera solicitud
    }
    
    return isAuthorized;
    
  } catch (error) {
    console.error('Error al verificar dispositivo autorizado:', error);
    // En caso de error, denegar por seguridad
    return false;
  }
}

/**
 * Verificar contra lista predeterminada (compatibilidad y desarrollo)
 * @param {Object} deviceInfo 
 * @returns {Boolean}
 */
function verifyAgainstDefaultList(deviceInfo) {
  // Verificar si el dispositivo es WallPanel (prioridad más alta)
  if (deviceInfo.source && deviceInfo.source.includes('wallpanel')) {
    // Durante el periodo inicial, autorizamos automáticamente los dispositivos WallPanel
    return true;
  }
  
  // Otros dispositivos requieren verificación más estricta
  return false;
}

/**
 * Obtener lista de dispositivos autorizados
 * @returns {Array} - Lista de dispositivos autorizados
 */
async function getAuthorizedDevices() {
  try {
    // En un sistema real, esto debería obtener la lista desde:
    // 1. Una colección en MongoDB
    // 2. Un archivo de configuración
    // 3. Una API externa
    
    // Para simplificar la implementación inicial, vamos a devolver una lista
    // predeterminada que permita cualquier tablet con WallPanel
    
    // NOTA: En producción, esto debe ser reemplazado por una implementación real
    return [
      // Cualquier dispositivo con WallPanel se considera autorizado inicialmente
      { source: 'wallpanel', isAuthorized: true },
      
      // Ejemplos para una implementación completa:
      // { deviceId: 'dispositivo-wallpanel-1', androidId: 'android-id-1', isAuthorized: true },
      // { uuid: 'uuid-dispositivo-1', fingerprint: 'fingerprint-1', isAuthorized: true },
    ];
    
  } catch (error) {
    console.error('Error al obtener dispositivos autorizados:', error);
    return [];
  }
}

/**
 * Registrar intento de verificación de dispositivo
 * @param {Object} deviceInfo - Información del dispositivo
 * @param {Boolean} isVerified - Si el dispositivo fue verificado correctamente
 */
async function logDeviceVerificationAttempt(deviceInfo, isVerified) {
  try {
    // En un sistema real, esto debería guardar el log en una colección de MongoDB
    // Por ahora, solo lo imprimimos en consola
    
    console.log('[AUDIT] Intento de verificación de dispositivo:', {
      timestamp: new Date(),
      deviceInfo: JSON.stringify(deviceInfo),
      isVerified: isVerified,
      ip: 'TO-DO: Obtener IP del request'
    });
    
    // Para una implementación real, crear un modelo AuditLog y guardar el registro
    
  } catch (error) {
    console.error('Error al registrar verificación de dispositivo:', error);
  }
}

/**
 * Registrar intento de restablecimiento de contraseña
 * @param {String} username - Nombre de usuario
 * @param {Object} deviceInfo - Información del dispositivo
 * @param {Boolean} isSuccessful - Si el restablecimiento fue exitoso
 * @param {String} reason - Razón del resultado
 */
async function logPasswordResetAttempt(username, deviceInfo, isSuccessful, reason) {
  try {
    // En un sistema real, esto debería guardar el log en una colección de MongoDB
    // Por ahora, solo lo imprimimos en consola
    
    console.log('[AUDIT] Intento de restablecimiento de contraseña:', {
      timestamp: new Date(),
      username: username,
      deviceInfo: JSON.stringify(deviceInfo),
      isSuccessful: isSuccessful,
      reason: reason,
      ip: 'TO-DO: Obtener IP del request'
    });
    
    // Para una implementación real, crear un modelo AuditLog y guardar el registro
    
  } catch (error) {
    console.error('Error al registrar intento de restablecimiento:', error);
  }
}

/**
 * Registra o actualiza la información del dispositivo para un usuario
 * @param {Object} user - El documento del usuario en MongoDB
 * @param {Object} deviceInfo - Información del dispositivo
 * @param {Object} req - El objeto request para obtener info adicional como la IP
 * @returns {Promise<void>}
 */
async function registerUserDevice(user, deviceInfo, req) {
  try {
    if (!user || !deviceInfo) {
      return;
    }
    
    // Obtener IP del cliente
    const ipAddress = req.headers['x-forwarded-for'] || 
                      req.socket.remoteAddress || 
                      '0.0.0.0';
    
    // Normalizar la información del dispositivo
    const normalizedDeviceInfo = {
      source: deviceInfo.source || 'unknown',
      deviceId: deviceInfo.deviceId || null,
      androidId: deviceInfo.androidId || null,
      manufacturer: deviceInfo.manufacturer || null,
      model: deviceInfo.model || null,
      fingerprint: deviceInfo.fingerprint || null,
      uuid: deviceInfo.uuid || null,
      userAgent: deviceInfo.userAgent || req.headers['user-agent'] || null,
      ipAddress: ipAddress,
      lastUsed: new Date()
    };
    
    // Si el dispositivo no tiene identificadores únicos y no es WallPanel, no lo registramos
    const hasUniqueIdentifiers = normalizedDeviceInfo.deviceId || 
                                normalizedDeviceInfo.androidId || 
                                normalizedDeviceInfo.fingerprint || 
                                normalizedDeviceInfo.uuid;
                                
    const isWallPanel = normalizedDeviceInfo.source && 
                      normalizedDeviceInfo.source.includes('wallpanel');
                      
    if (!hasUniqueIdentifiers && !isWallPanel) {
      console.log('[INFO] Dispositivo sin identificadores únicos, no se registrará:', ipAddress);
      return;
    }
    
    // Verificar si el dispositivo ya está registrado para este usuario
    if (!user.authorizedDevices) {
      user.authorizedDevices = [];
    }
    
    let existingDevice = null;
    
    // Buscar por deviceId o androidId (identificadores primarios)
    if (normalizedDeviceInfo.deviceId || normalizedDeviceInfo.androidId) {
      existingDevice = user.authorizedDevices.find(device => 
        (normalizedDeviceInfo.deviceId && device.deviceId === normalizedDeviceInfo.deviceId) || 
        (normalizedDeviceInfo.androidId && device.androidId === normalizedDeviceInfo.androidId)
      );
    }
    
    // Si no se encontró, buscar por uuid o fingerprint (identificadores secundarios)
    if (!existingDevice && (normalizedDeviceInfo.uuid || normalizedDeviceInfo.fingerprint)) {
      existingDevice = user.authorizedDevices.find(device => 
        (normalizedDeviceInfo.uuid && device.uuid === normalizedDeviceInfo.uuid) || 
        (normalizedDeviceInfo.fingerprint && device.fingerprint === normalizedDeviceInfo.fingerprint)
      );
    }
    
    // Actualizar dispositivo existente o agregar uno nuevo
    if (existingDevice) {
      // Actualizar información del dispositivo
      Object.assign(existingDevice, {
        ...normalizedDeviceInfo,
        lastUsed: new Date()
      });
      
      console.log(`[INFO] Dispositivo actualizado para usuario ${user.username}: ${normalizedDeviceInfo.source}`);
    } else {
      // Agregar nuevo dispositivo
      user.authorizedDevices.push({
        ...normalizedDeviceInfo,
        firstRegistered: new Date(),
        lastUsed: new Date()
      });
      
      console.log(`[INFO] Nuevo dispositivo registrado para usuario ${user.username}: ${normalizedDeviceInfo.source}`);
    }
    
    // Guardar los cambios en el usuario
    await user.save();
    
    return;
  } catch (error) {
    console.error('Error al registrar dispositivo del usuario:', error);
    // No propagamos el error para que no interrumpa el flujo de login
  }
}

module.exports = router;
