import express from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { query } from '../database/pool.js';
import logger from '../config/logger.js';
import redisManager from '../modules/redis-manager.js';
import { recordResponseHistory } from '../services/history-service.js';

const router = express.Router();

router.post('/public/:surveyId', asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { answers, respondentName, respondentEmail } = req.body;

  const surveyResult = await query(
    `SELECT id, title, status
     FROM surveys
     WHERE id = $1 AND status = 'published'`,
    [surveyId]
  );

  if (surveyResult.rows.length === 0) {
    throw new AppError('Published survey not found', 404, 'NOT_FOUND');
  }

  const metadata = {
    respondentName: respondentName || null,
    respondentEmail: respondentEmail || null,
    submittedFrom: 'public-form',
  };

  const createResult = await query(
    `INSERT INTO responses (survey_id, answers, metadata, status, completed_at)
     VALUES ($1, $2, $3, 'completed', CURRENT_TIMESTAMP)
     RETURNING id, survey_id, answers, metadata, status, created_at, completed_at, version`,
    [surveyId, JSON.stringify(answers || {}), JSON.stringify(metadata)]
  );

  const response = createResult.rows[0];

  await redisManager.setJson(`response:${response.id}`, response, 3600);

  await recordResponseHistory({
    responseId: response.id,
    surveyId,
    action: 'PUBLIC_SUBMIT',
    snapshot: response,
    req,
    actorMetadata: {
      email: respondentEmail || null,
      name: respondentName || null,
      userType: 'public',
    },
    changeMetadata: {
      source: 'public-form',
      respondentEmail: respondentEmail || null,
      respondentName: respondentName || null,
    },
  });

  logger.info('Public response submitted', {
    responseId: response.id,
    surveyId,
  });

  res.status(201).json(response);
}));

/**
 * @route   POST /api/surveys/:surveyId/responses
 * @desc    Submit a new survey response
 * @access  Private
 */
router.post('/:surveyId/responses', asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const { answers } = req.body;

  // Verify survey exists
  const surveyResult = await query(
    'SELECT id FROM surveys WHERE id = $1',
    [surveyId]
  );

  if (surveyResult.rows.length === 0) {
    throw new AppError('Survey not found', 404, 'NOT_FOUND');
  }

  // Create new response
  const createResult = await query(
    `INSERT INTO responses (survey_id, user_id, answers, status)
     VALUES ($1, $2, $3, 'in_progress')
     RETURNING id, survey_id, user_id, answers, metadata, status, created_at, version`,
    [surveyId, req.user.id, JSON.stringify(answers || [])]
  );

  const response = createResult.rows[0];

  // Cache response
  await redisManager.setJson(`response:${response.id}`, response, 3600);

  await recordResponseHistory({
    responseId: response.id,
    surveyId,
    action: 'CREATE',
    snapshot: response,
    req,
    changeMetadata: { source: 'api' },
  });

  logger.info('Response created', { responseId: response.id, surveyId });

  res.status(201).json(response);
}));

/**
 * @route   PATCH /api/surveys/:surveyId/responses/:responseId
 * @desc    Update an existing response (autosave)
 * @access  Private
 */
router.patch('/:surveyId/responses/:responseId', asyncHandler(async (req, res) => {
  const { surveyId, responseId } = req.params;
  const { answers } = req.body;

  const currentResult = await query(
    `SELECT * FROM responses WHERE id = $1 AND survey_id = $2`,
    [responseId, surveyId]
  );

  if (currentResult.rows.length === 0) {
    throw new AppError('Response not found', 404, 'NOT_FOUND');
  }

  // Update response with version check
  const updateResult = await query(
    `UPDATE responses
     SET answers = $1, status = 'in_progress', version = version + 1
     WHERE id = $2 AND survey_id = $3
     RETURNING id, survey_id, user_id, answers, metadata, status, updated_at, version`,
    [JSON.stringify(answers || []), responseId, surveyId]
  );

  if (updateResult.rows.length === 0) {
    throw new AppError('Response not found', 404, 'NOT_FOUND');
  }

  const response = updateResult.rows[0];

  // Cache updated response
  await redisManager.setJson(`response:${response.id}`, response, 3600);

  await recordResponseHistory({
    responseId,
    surveyId,
    action: 'UPDATE',
    snapshot: response,
    previousSnapshot: currentResult.rows[0],
    req,
    changeMetadata: {
      source: 'api',
      versionBefore: currentResult.rows[0].version,
      versionAfter: response.version,
    },
  });

  logger.info('Response updated', { responseId: response.id, surveyId });

  res.json(response);
}));

/**
 * @route   GET /api/surveys/:surveyId/responses
 * @desc    Get all responses for a survey
 * @access  Private
 */
router.get('/:surveyId/responses', asyncHandler(async (req, res) => {
  const { surveyId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT id, survey_id, answers, metadata, status, created_at, version
     FROM responses
     WHERE survey_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [surveyId, limit, offset]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM responses WHERE survey_id = $1',
    [surveyId]
  );

  res.json({
    data: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
    },
  });
}));

/**
 * @route   POST /api/surveys/:surveyId/responses/:responseId/complete
 * @desc    Mark a response as completed
 * @access  Private
 */
router.post('/:surveyId/responses/:responseId/complete', asyncHandler(async (req, res) => {
  const { surveyId, responseId } = req.params;

  const currentResult = await query(
    `SELECT * FROM responses WHERE id = $1 AND survey_id = $2`,
    [responseId, surveyId]
  );

  if (currentResult.rows.length === 0) {
    throw new AppError('Response not found', 404, 'NOT_FOUND');
  }

  const result = await query(
    `UPDATE responses
     SET status = 'completed', completed_at = CURRENT_TIMESTAMP, version = version + 1
     WHERE id = $1 AND survey_id = $2
     RETURNING id, survey_id, user_id, answers, metadata, status, completed_at, version`,
    [responseId, surveyId]
  );

  // Invalidate cache
  await redisManager.del(`response:${responseId}`);

  await recordResponseHistory({
    responseId,
    surveyId,
    action: 'COMPLETE',
    snapshot: result.rows[0],
    previousSnapshot: currentResult.rows[0],
    req,
    changeMetadata: {
      source: 'api',
      versionBefore: currentResult.rows[0].version,
      versionAfter: result.rows[0].version,
    },
  });

  logger.info('Response completed', { responseId, surveyId });

  res.json(result.rows[0]);
}));

export default router;
