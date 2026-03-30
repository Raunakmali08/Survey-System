import { query } from '../database/pool.js';

function buildActorMetadata(req, fallback = {}) {
  return {
    userId: req?.user?.id || fallback.userId || null,
    email: req?.user?.email || fallback.email || null,
    name: req?.user?.name || fallback.name || null,
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || fallback.ipAddress || null,
    userAgent: req?.headers?.['user-agent'] || fallback.userAgent || null,
    ...fallback,
  };
}

export async function recordSurveyHistory({
  surveyId,
  action,
  snapshot,
  previousSnapshot = null,
  req = null,
  actorMetadata = {},
  changeMetadata = {},
}) {
  await query(
    `INSERT INTO survey_history
      (survey_id, action, snapshot, previous_snapshot, actor_user_id, actor_metadata, change_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      surveyId,
      action,
      JSON.stringify(snapshot || {}),
      previousSnapshot ? JSON.stringify(previousSnapshot) : null,
      req?.user?.id || actorMetadata.userId || null,
      JSON.stringify(buildActorMetadata(req, actorMetadata)),
      JSON.stringify(changeMetadata || {}),
    ]
  );
}

export async function recordResponseHistory({
  responseId,
  surveyId,
  action,
  snapshot,
  previousSnapshot = null,
  req = null,
  actorMetadata = {},
  changeMetadata = {},
}) {
  await query(
    `INSERT INTO response_history
      (response_id, survey_id, action, snapshot, previous_snapshot, actor_user_id, actor_metadata, change_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      responseId,
      surveyId,
      action,
      JSON.stringify(snapshot || {}),
      previousSnapshot ? JSON.stringify(previousSnapshot) : null,
      req?.user?.id || actorMetadata.userId || null,
      JSON.stringify(buildActorMetadata(req, actorMetadata)),
      JSON.stringify(changeMetadata || {}),
    ]
  );
}
