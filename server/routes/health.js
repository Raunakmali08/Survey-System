import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import pool, { healthCheck } from '../database/pool.js';
import redisManager from '../modules/redis-manager.js';
import logger from '../config/logger.js';

const router = express.Router();

// Health check endpoint
router.get('/', optionalAuth, async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    const redisHealth = await redisManager.health();

    const allHealthy = 
      dbHealth.status === 'connected' &&
      redisHealth.status === 'connected';

    const status = allHealthy ? 'healthy' : 'degraded';
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealth.status,
        redis: redisHealth.status,
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness probe (is the server running?)
router.get('/live', (req, res) => {
  res.json({ status: 'alive' });
});

// Readiness probe (is the server ready to accept traffic?)
router.get('/ready', async (req, res) => {
  try {
    // Quick check of critical services
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    res.json({ status: 'ready' });
  } catch (error) {
    logger.warn('Server not ready:', error.message);
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

export default router;
