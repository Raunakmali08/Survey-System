import express from 'express';
import expressWs from 'express-ws';
import cors from 'cors';
import dotenv from 'dotenv';
import config from './config/config.js';
import logger from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticateToken } from './middleware/auth.js';
import surveyRoutes from './routes/surveys.js';
import responseRoutes from './routes/responses.js';
import healthRoutes from './routes/health.js';
import pool from './database/pool.js';
import redisManager from './modules/redis-manager.js';
import messageQueue from './modules/message-queue.js';
import autoSaveService from './services/auto-save.js';
import authRoutes from './routes/auth.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const { app: wsApp } = expressWs(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(requestLogger);

app.use('/auth', authRoutes);                        // add BEFORE the protected /api routes

// Health check endpoint (no auth required)
app.use('/health', healthRoutes);
app.use('/api/surveys', authenticateToken, surveyRoutes);
app.use('/api/surveys', authenticateToken, responseRoutes);

// API routes (protected with auth)

// In server/index.js — replace the existing wsApp.ws('/ws', ...) block
wsApp.ws('/ws', (ws, _req) => {
  let authenticated = false;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      // First message must be CONNECT with a valid token
      if (!authenticated) {
        if (data.type !== 'CONNECT' || !data.token) {
          ws.close(4001, 'Authentication required');
          return;
        }
        try {
          ws.user = jwt.verify(data.token, config.jwt.secret);
          authenticated = true;
          logger.info('WebSocket authenticated', { userId: ws.user.id });
          ws.send(JSON.stringify({ type: 'CONNECTED', userId: ws.user.id }));
        } catch {
          ws.close(4003, 'Invalid token');
        }
        return;
      }

      logger.debug('WebSocket message received:', data);
    } catch (error) {
      logger.error('WebSocket message parse error:', error);
    }
  });

  // Auto-close if not authenticated within 5s
  const authTimeout = setTimeout(() => {
    if (!authenticated) ws.close(4001, 'Authentication timeout');
  }, 5000);

  ws.on('close', () => {
    clearTimeout(authTimeout);
    logger.info('WebSocket connection closed');
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    // Test database connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('✓ Database connection established');

    // Initialize Redis
    await redisManager.connect();
    logger.info('✓ Redis connection established');

    // Initialize Message Queue
    await messageQueue.connect();
    logger.info('✓ Message Queue connection established');

    await autoSaveService.initializeEventQueue();
    logger.info('✓ Auto-save queue initialized');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  try {
    await pool.end();
    logger.info('✓ Database pool closed');
    
    await redisManager.disconnect();
    logger.info('✓ Redis disconnected');
    
    await messageQueue.disconnect();
    logger.info('✓ Message Queue disconnected');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  await initializeServices();
  
  const PORT = config.port;
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Log level: ${config.logLevel}`);
  });

  // Handle server errors
  server.on('error', (error) => {
    logger.error('Server error:', error);
    process.exit(1);
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
