// server/routes/auth.js  (new file)
import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../database/pool.js';
import { generateToken } from '../middleware/auth.js';
import config from '../config/config.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'email, password and name are required' });

    const hash = await bcrypt.hash(password, config.security.bcryptRounds);
    const result = await query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email, hash, name]
    );
    const user = result.rows[0];
    res.status(201).json({ ...user, token: generateToken(user) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await query(`SELECT * FROM users WHERE email = $1 AND is_active = true`, [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });

    await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);
    res.json({ token: generateToken(user), user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) { next(err); }
});

export default router;
