import bcrypt from 'bcrypt';
import { query } from './pool.js';
import config from '../config/config.js';
import logger from '../config/logger.js';

const seedUser = {
  name: process.env.SEED_USER_NAME || 'Ronin Demo',
  email: process.env.SEED_USER_EMAIL || 'test@example.com',
  password: process.env.SEED_USER_PASSWORD || 'password123',
};

async function seed() {
  try {
    logger.info('Starting seed process...');

    const existingUser = await query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [seedUser.email]
    );

    if (existingUser.rows.length > 0) {
      logger.info('Seed user already exists', existingUser.rows[0]);
      return;
    }

    const passwordHash = await bcrypt.hash(
      seedUser.password,
      config.security.bcryptRounds
    );

    const result = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [seedUser.email, passwordHash, seedUser.name]
    );

    logger.info('Seed user created successfully', {
      ...result.rows[0],
      password: seedUser.password,
    });
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
