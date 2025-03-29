/**
 * Middleware de autenticación
 * 
 * Verifica la autenticidad de los tokens JWT para proteger
 * rutas y acciones que requieren autenticación.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware para verificar token JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
async function auth(req, res, next) {
  try {
    // Extraer token del header Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Acceso denegado. Token no proporcionado o formato inválido' 
      });
    }
    
    // Extraer el token sin el prefijo 'Bearer '
    const token = authHeader.substring(7);
    
    // Verificar y decodificar el token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_KEY || 'intercom_jwt_secret'
    );
    
    // Buscar al usuario por ID
    const user = await User.findById(decoded.id);
    
    // Verificar que el usuario existe y está activo
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no encontrado o desactivado' 
      });
    }
    
    // Adjuntar usuario al objeto de solicitud
    req.user = user;
    req.token = token;
    
    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();
    
    // Continuar con la siguiente función
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido' 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expirado' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor al autenticar' 
    });
  }
}

module.exports = auth;
