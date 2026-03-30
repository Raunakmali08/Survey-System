import { createClient } from 'redis';
import config from '../config/config.js';
import logger from '../config/logger.js';

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
        password: config.redis.password,
        database: config.redis.db,
      });

      this.client.on('error', (error) => {
        logger.error('Redis error:', error);
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis ready');
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis reconnecting...');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) return null;
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis get error:', { key, error: error.message });
      return null;
    }
  }

  async getJson(key) {
    try {
      const data = await this.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis getJson error:', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = config.redis.cacheTTL) {
    try {
      if (!this.isConnected) return false;
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', { key, error: error.message });
      return false;
    }
  }

  async setJson(key, value, ttl = config.redis.cacheTTL) {
    return this.set(key, JSON.stringify(value), ttl);
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis del error:', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) return false;
      return (await this.client.exists(key)) > 0;
    } catch (error) {
      logger.error('Redis exists error:', { key, error: error.message });
      return false;
    }
  }

  async expire(key, ttl) {
    try {
      if (!this.isConnected) return false;
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Redis expire error:', { key, error: error.message });
      return false;
    }
  }

  async incr(key) {
    try {
      if (!this.isConnected) return null;
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis incr error:', { key, error: error.message });
      return null;
    }
  }

  async lpush(key, value) {
    try {
      if (!this.isConnected) return false;
      await this.client.lPush(key, value);
      return true;
    } catch (error) {
      logger.error('Redis lpush error:', { key, error: error.message });
      return false;
    }
  }

  async rpop(key) {
    try {
      if (!this.isConnected) return null;
      return await this.client.rPop(key);
    } catch (error) {
      logger.error('Redis rpop error:', { key, error: error.message });
      return null;
    }
  }

  async health() {
    try {
      if (!this.isConnected) return { status: 'disconnected' };
      await this.client.ping();
      return { status: 'connected' };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }
}

const redisManager = new RedisManager();
export default redisManager;
