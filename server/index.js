import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import config from './config/config.js';
import logger from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticateToken, optionalAuth } from './middleware/auth.js';
import surveyRoutes from './routes/surveys.js';
import responseRoutes from './routes/responses.js';
import healthRoutes from './routes/health.js';
import pool from './database/pool.js';
import redisManager from './modules/redis-manager.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(requestLogger);

app.use('/auth', authRoutes);                        // add BEFORE the protected /api routes

// Health check endpoint (no auth required)
app.use('/health', healthRoutes);
app.use('/api/public/surveys', optionalAuth, surveyRoutes);
app.use('/api/public/responses', optionalAuth, responseRoutes);
app.use('/api/surveys', authenticateToken, surveyRoutes);
app.use('/api/surveys', authenticateToken, responseRoutes);

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
