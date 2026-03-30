import express from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { query } from '../database/pool.js';
import logger from '../config/logger.js';
import redisManager from '../modules/redis-manager.js';
import { recordSurveyHistory } from '../services/history-service.js';

const router = express.Router();

router.get('/public/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, title, description, questions, status, published_at
     FROM surveys
     WHERE id = $1 AND status = 'published'`,
    [req.params.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Published survey not found', 404, 'NOT_FOUND');
  }

  res.json(result.rows[0]);
}));

// Get all surveys for user
router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const sort = req.query.sort || '-created_at';

  const whereConditions = ['user_id = $1'];
  const params = [req.user.id];

  if (status) {
    whereConditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  const orderBy = sort.startsWith('-') ? `${sort.substring(1)} DESC` : `${sort} ASC`;

  const result = await query(
    `SELECT id, title, description, status, created_at, updated_at, version,
            (SELECT COUNT(*) FROM responses WHERE survey_id = surveys.id) as response_count
     FROM surveys
     WHERE ${whereConditions.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM surveys WHERE ${whereConditions.join(' AND ')}`,
    params
  );

  const total = parseInt(countResult.rows[0].total);

  res.json({
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Create survey
router.post('/', asyncHandler(async (req, res) => {
  const { title, description, questions } = req.body;

  if (!title) {
    throw new AppError('Survey title is required', 400, 'VALIDATION_ERROR');
  }

  const result = await query(
    `INSERT INTO surveys (user_id, title, description, questions, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING id, title, description, questions, status, created_at, updated_at, version`,
    [req.user.id, title, description || null, JSON.stringify(questions || [])]
  );

  await recordSurveyHistory({
    surveyId: result.rows[0].id,
    action: 'CREATE',
    snapshot: result.rows[0],
    req,
    changeMetadata: { source: 'api', createdBy: req.user.id },
  });

  logger.info('Survey created', { surveyId: result.rows[0].id, userId: req.user.id });

  res.status(201).json(result.rows[0]);
}));

// Get survey by ID
router.get('/:id', asyncHandler(async (req, res) => {
  // Try cache first
  const cached = await redisManager.getJson(`survey:${req.params.id}`);
  if (cached && cached.user_id === req.user.id) {
    logger.debug('Survey retrieved from cache', { surveyId: req.params.id });
    return res.json(cached);
  }

  const result = await query(
    `SELECT * FROM surveys WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Survey not found', 404, 'NOT_FOUND');
  }

  const survey = result.rows[0];
  
  // Cache for 1 hour
  await redisManager.setJson(`survey:${req.params.id}`, survey, 3600);

  res.json(survey);
}));

// Update survey
router.patch('/:id', asyncHandler(async (req, res) => {
  const { title, description, status, questions, version } = req.body;

  // Check version for conflict
  const currentResult = await query(
    `SELECT * FROM surveys WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );

  if (currentResult.rows.length === 0) {
    throw new AppError('Survey not found', 404, 'NOT_FOUND');
  }

  if (version && currentResult.rows[0].version !== version) {
    logger.warn('Survey version conflict', {
      surveyId: req.params.id,
      clientVersion: version,
      serverVersion: currentResult.rows[0].version,
    });
    return res.status(409).json({
      error: 'VERSION_CONFLICT',
      message: 'Survey was updated by another user',
      currentVersion: currentResult.rows[0].version,
    });
  }

  const currentSurvey = currentResult.rows[0];

  const updates = [];
  const params = [req.params.id, req.user.id];

  if (title !== undefined) {
    updates.push(`title = $${params.length + 1}`);
    params.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${params.length + 1}`);
    params.push(description);
  }
  if (status !== undefined) {
    updates.push(`status = $${params.length + 1}`);
    params.push(status);
    if (status === 'published') {
      updates.push(`published_at = CURRENT_TIMESTAMP`);
    }
  }
  if (questions !== undefined) {
    updates.push(`questions = $${params.length + 1}`);
    params.push(JSON.stringify(questions));
  }

  updates.push(`version = version + 1`);

  const result = await query(
    `UPDATE surveys
     SET ${updates.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    params
  );

  // Invalidate cache
  await redisManager.del(`survey:${req.params.id}`);

  const updatedSurvey = result.rows[0];

  await recordSurveyHistory({
    surveyId: req.params.id,
    action: status === 'published' ? 'PUBLISH' : status === 'closed' ? 'CLOSE' : 'UPDATE',
    snapshot: updatedSurvey,
    previousSnapshot: currentSurvey,
    req,
    changeMetadata: {
      source: 'api',
      fields: Object.keys(req.body),
      versionBefore: currentSurvey.version,
      versionAfter: updatedSurvey.version,
    },
  });

  logger.info('Survey updated', { surveyId: req.params.id, userId: req.user.id });

  res.json({
    id: updatedSurvey.id,
    title: updatedSurvey.title,
    description: updatedSurvey.description,
    status: updatedSurvey.status,
    updated_at: updatedSurvey.updated_at,
    version: updatedSurvey.version,
  });
}));

// Delete survey
router.delete('/:id', asyncHandler(async (req, res) => {
  const currentResult = await query(
    `SELECT * FROM surveys WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );

  if (currentResult.rows.length === 0) {
    throw new AppError('Survey not found', 404, 'NOT_FOUND');
  }

  await query(
    `DELETE FROM surveys WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id]
  );

  // Invalidate cache
  await redisManager.del(`survey:${req.params.id}`);

  await recordSurveyHistory({
    surveyId: req.params.id,
    action: 'DELETE',
    snapshot: {
      id: req.params.id,
      deleted: true,
    },
    previousSnapshot: currentResult.rows[0],
    req,
    changeMetadata: { source: 'api' },
  });

  logger.info('Survey deleted', { surveyId: req.params.id, userId: req.user.id });

  res.status(204).send();
}));

export default router;
