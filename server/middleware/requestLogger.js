import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

export function requestLogger(req, res, next) {
  // Assign request ID for tracing
  req.id = req.headers['x-request-id'] || uuidv4();
  
  // Store original send function
  const originalSend = res.send;
  
  // Record request start time
  const startTime = Date.now();
  
  // Override send to log response
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log request/response
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`${req.method} ${req.path}`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
    });
    
    // Add request ID to response headers
    res.set('X-Request-ID', req.id);
    
    // Call original send
    return originalSend.call(this, data);
  };
  
  next();
}
