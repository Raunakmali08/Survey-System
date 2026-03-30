import dotenv from 'dotenv';

dotenv.config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',
  
  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'surveyapp',
    password: process.env.DB_PASSWORD || 'surveysecret',
    database: process.env.DB_NAME || 'survey_db',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000,
    },
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || 'redispass',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    cacheTTL: parseInt(process.env.REDIS_CACHE_TTL, 10) || 3600,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiry: process.env.JWT_EXPIRY || '7d',
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  },
  
  // Server
  server: {
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
    workers: parseInt(process.env.WORKERS, 10) || 4,
  },
  
  // Features
  features: {
    autoSave: process.env.ENABLE_AUTO_SAVE !== 'false',
    autoSaveDebounceMs: parseInt(process.env.AUTO_SAVE_DEBOUNCE_MS, 10) || 1000,
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
    circuitBreakerTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS, 10) || 60000,
  },
};

export default config;
