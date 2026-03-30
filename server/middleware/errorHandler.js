import logger from '../config/logger.js';

export function errorHandler(err, req, res, _next) {
  const requestId = req.id || 'unknown';
  
  logger.error('Error handler:', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Operational errors
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      error: err.code || 'INTERNAL_ERROR',
      message: err.message,
      requestId,
    });
  }

  // Database errors
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'DUPLICATE_ENTRY',
      message: 'A record with this value already exists',
      requestId,
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'FOREIGN_KEY_VIOLATION',
      message: 'Referenced resource does not exist',
      requestId,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: err.details,
      requestId,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
      requestId,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
      requestId,
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  
  res.status(statusCode).json({
    error: errorCode,
    message: statusCode === 500 ? 'An unexpected error occurred' : err.message,
    requestId,
  });
}

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
