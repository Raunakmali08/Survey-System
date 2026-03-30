import bcrypt from 'bcrypt';
import { query } from './pool.js';
import config from '../config/config.js';
import logger from '../config/logger.js';

const seedUser = {
  name: process.env.SEED_USER_NAME || 'Ronin Demo',
  email: process.env.SEED_USER_EMAIL || 'test@example.com',
  password: process.env.SEED_USER_PASSWORD || 'password123',
};

const demoQuestions = [
  {
    id: 'q_overall',
    text: 'How would you rate your overall experience?',
    type: 'rating',
    required: true,
    options: [],
  },
  {
    id: 'q_like',
    text: 'What did you like the most?',
    type: 'textarea',
    required: true,
    options: [],
  },
  {
    id: 'q_features',
    text: 'Which features mattered most to you?',
    type: 'multiple_choice',
    required: false,
    options: ['Fast loading', 'Simple design', 'Real-time updates', 'Easy sharing'],
  },
];

const demoResponses = [
  {
    respondentName: 'Aarav',
    respondentEmail: 'aarav.demo@example.com',
    answers: {
      q_overall: '5',
      q_like: 'The form was simple and very quick to finish.',
      q_features: ['Simple design', 'Easy sharing'],
    },
  },
  {
    respondentName: 'Mira',
    respondentEmail: 'mira.demo@example.com',
    answers: {
      q_overall: '4',
      q_like: 'I liked the clean look and the instant response flow.',
      q_features: ['Fast loading', 'Real-time updates'],
    },
  },
];

async function seed() {
  try {
    logger.info('Starting seed process...');

    let existingUser = await query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [seedUser.email]
    );

    if (existingUser.rows.length === 0) {
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

      existingUser = { rows: [result.rows[0]] };
    } else {
      logger.info('Seed user already exists', existingUser.rows[0]);
    }

    const user = existingUser.rows[0];

    let surveyResult = await query(
      `SELECT id, title, status
       FROM surveys
       WHERE user_id = $1 AND title = $2`,
      [user.id, 'Customer Feedback Demo']
    );

    let surveyId;

    if (surveyResult.rows.length === 0) {
      const createdSurvey = await query(
        `INSERT INTO surveys (user_id, title, description, questions, status, published_at)
         VALUES ($1, $2, $3, $4, 'published', CURRENT_TIMESTAMP)
         RETURNING id, title, status, created_at`,
        [
          user.id,
          'Customer Feedback Demo',
          'A default presentation survey with example questions and feedback.',
          JSON.stringify(demoQuestions),
        ]
      );

      surveyId = createdSurvey.rows[0].id;
      logger.info('Demo survey created', createdSurvey.rows[0]);
    } else {
      surveyId = surveyResult.rows[0].id;

      await query(
        `UPDATE surveys
         SET description = $1,
             questions = $2,
             status = 'published',
             published_at = COALESCE(published_at, CURRENT_TIMESTAMP)
         WHERE id = $3`,
        [
          'A default presentation survey with example questions and feedback.',
          JSON.stringify(demoQuestions),
          surveyId,
        ]
      );

      logger.info('Demo survey already exists', surveyResult.rows[0]);
    }

    for (const sample of demoResponses) {
      const existingResponse = await query(
        `SELECT id
         FROM responses
         WHERE survey_id = $1
           AND metadata->>'respondentEmail' = $2`,
        [surveyId, sample.respondentEmail]
      );

      if (existingResponse.rows.length > 0) {
        continue;
      }

      await query(
        `INSERT INTO responses (survey_id, answers, metadata, status, completed_at)
         VALUES ($1, $2, $3, 'completed', CURRENT_TIMESTAMP)`,
        [
          surveyId,
          JSON.stringify(sample.answers),
          JSON.stringify({
            respondentName: sample.respondentName,
            respondentEmail: sample.respondentEmail,
            submittedFrom: 'seed',
          }),
        ]
      );
    }

    logger.info('Demo feedback responses ensured', {
      surveyId,
      seededResponses: demoResponses.length,
    });
  } catch (error) {
    logger.error('Seed failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
