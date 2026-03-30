import pg from 'pg';
import config from '../config/config.js';
import logger from '../config/logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: config.database.pool.max,
  min: config.database.pool.min,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
});

pool.on('error', (error) => {
  logger.error('Unexpected error on idle client:', error);
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('remove', () => {
  logger.debug('Connection removed from pool');
});

// Health check query
export async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW()');
    return {
      status: 'connected',
      timestamp: result.rows[0].now,
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'disconnected',
      error: error.message,
    };
  }
}

// Query with logging
export async function query(text, values) {
  const start = Date.now();
  try {
    const result = await pool.query(text, values);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms):`, { text, values });
    }
    return result;
  } catch (error) {
    logger.error('Query error:', { text, values, error: error.message });
    throw error;
  }
}

// Transaction support
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
