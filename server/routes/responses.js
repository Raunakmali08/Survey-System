import express from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { query } from '../database/pool.js';
import logger from '../config/logger.js';
import redisManager from '../modules/redis-manager.js';
import messageQueue from '../modules/message-queue.js';

const router = express.Router();

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
    `INSERT INTO responses (survey_id, answers, status)
     VALUES ($1, $2, 'in_progress')
     RETURNING id, survey_id, answers, status, created_at, version`,
    [surveyId, JSON.stringify(answers || [])]
  );

  const response = createResult.rows[0];

  // Cache response
  await redisManager.setJson(`response:${response.id}`, response, 3600);

  // Publish event
  await messageQueue.publish('survey.events', 'response.created', {
    responseId: response.id,
    surveyId,
    timestamp: new Date().toISOString(),
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

  // Update response with version check
  const updateResult = await query(
    `UPDATE responses
     SET answers = $1, status = 'in_progress', version = version + 1
     WHERE id = $2 AND survey_id = $3
     RETURNING id, survey_id, answers, status, updated_at, version`,
    [JSON.stringify(answers || []), responseId, surveyId]
  );

  if (updateResult.rows.length === 0) {
    throw new AppError('Response not found', 404, 'NOT_FOUND');
  }

  const response = updateResult.rows[0];

  // Cache updated response
  await redisManager.setJson(`response:${response.id}`, response, 3600);

  // Publish event
  await messageQueue.publish('survey.events', 'response.updated', {
    responseId: response.id,
    surveyId,
    timestamp: new Date().toISOString(),
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
    `SELECT id, survey_id, answers, status, created_at, version
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

  const result = await query(
    `UPDATE responses
     SET status = 'completed', completed_at = CURRENT_TIMESTAMP, version = version + 1
     WHERE id = $1 AND survey_id = $2
     RETURNING id, status, completed_at, version`,
    [responseId, surveyId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Response not found', 404, 'NOT_FOUND');
  }

  // Invalidate cache
  await redisManager.del(`response:${responseId}`);

  // Publish event
  await messageQueue.publish('survey.events', 'response.completed', {
    responseId,
    surveyId,
    timestamp: new Date().toISOString(),
  });

  logger.info('Response completed', { responseId, surveyId });

  res.json(result.rows[0]);
}));

export default router;
