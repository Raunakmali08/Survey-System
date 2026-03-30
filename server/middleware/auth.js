import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import logger from '../config/logger.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Missing authentication token');
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    logger.debug('Token verified for user:', { userId: decoded.id });
    next();
  } catch (error) {
    logger.warn('Token verification failed:', { error: error.message });
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry }
  );
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
    } catch (error) {
      logger.debug('Optional auth token verification failed:', { error: error.message });
    }
  }

  next();
}
