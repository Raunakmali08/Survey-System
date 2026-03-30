import amqp from 'amqplib';
import config from '../config/config.js';
import logger from '../config/logger.js';

class MessageQueue {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const url = `amqp://${config.rabbitmq.user}:${config.rabbitmq.password}@${config.rabbitmq.host}:${config.rabbitmq.port}/${config.rabbitmq.vhost}`;
      
      this.connection = await amqp.connect(url);
      
      this.connection.on('error', (error) => {
        logger.error('RabbitMQ connection error:', error);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
      });

      this.channel = await this.connection.createChannel();
      
      this.channel.on('error', (error) => {
        logger.error('RabbitMQ channel error:', error);
      });

      this.isConnected = true;
      logger.info('RabbitMQ connected');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      logger.info('RabbitMQ disconnected');
    } catch (error) {
      logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  async assertQueue(queueName, options = {}) {
    try {
      if (!this.isConnected) throw new Error('Not connected to RabbitMQ');
      return await this.channel.assertQueue(queueName, {
        durable: true,
        ...options,
      });
    } catch (error) {
      logger.error('Failed to assert queue:', { queueName, error: error.message });
      throw error;
    }
  }

  async assertExchange(exchangeName, type = 'topic', options = {}) {
    try {
      if (!this.isConnected) throw new Error('Not connected to RabbitMQ');
      return await this.channel.assertExchange(exchangeName, type, {
        durable: true,
        ...options,
      });
    } catch (error) {
      logger.error('Failed to assert exchange:', { exchangeName, error: error.message });
      throw error;
    }
  }

  async bindQueue(queueName, exchangeName, routingKey) {
    try {
      if (!this.isConnected) throw new Error('Not connected to RabbitMQ');
      return await this.channel.bindQueue(queueName, exchangeName, routingKey);
    } catch (error) {
      logger.error('Failed to bind queue:', { queueName, exchangeName, routingKey, error: error.message });
      throw error;
    }
  }

  async publish(exchange, routingKey, message, options = {}) {
    try {
      if (!this.isConnected) return false;
      
      const buffer = Buffer.from(JSON.stringify(message));
      const defaultOptions = {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        ...options,
      };

      return this.channel.publish(exchange, routingKey, buffer, defaultOptions);
    } catch (error) {
      logger.error('Failed to publish message:', { exchange, routingKey, error: error.message });
      return false;
    }
  }

  async sendToQueue(queueName, message, options = {}) {
    try {
      if (!this.isConnected) return false;
      
      const buffer = Buffer.from(JSON.stringify(message));
      const defaultOptions = {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        ...options,
      };

      return this.channel.sendToQueue(queueName, buffer, defaultOptions);
    } catch (error) {
      logger.error('Failed to send message to queue:', { queueName, error: error.message });
      return false;
    }
  }

  async consume(queueName, callback, options = {}) {
    try {
      if (!this.isConnected) throw new Error('Not connected to RabbitMQ');
      
      const defaultOptions = {
        noAck: false,
        ...options,
      };

      return await this.channel.consume(queueName, async (msg) => {
        try {
          if (msg) {
            const content = JSON.parse(msg.content.toString());
            await callback(content, msg);
            this.channel.ack(msg);
          }
        } catch (error) {
          logger.error('Error processing message:', error);
          this.channel.nack(msg, false, true);
        }
      }, defaultOptions);
    } catch (error) {
      logger.error('Failed to set up consumer:', { queueName, error: error.message });
      throw error;
    }
  }

  async purgeQueue(queueName) {
    try {
      if (!this.isConnected) throw new Error('Not connected to RabbitMQ');
      return await this.channel.purgeQueue(queueName);
    } catch (error) {
      logger.error('Failed to purge queue:', { queueName, error: error.message });
      throw error;
    }
  }

  async health() {
    try {
      if (!this.isConnected) return { status: 'disconnected' };

      await this.channel.checkExchange('amq.direct');
      return { status: 'connected' };
    } catch (error) {
      logger.error('RabbitMQ health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }
}

const messageQueue = new MessageQueue();
export default messageQueue;
