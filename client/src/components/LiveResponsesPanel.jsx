import { useEffect, useMemo, useState } from 'react';
import { getSurveyResponses } from '../services/api.js';

function formatAnswerPreview(answerValue) {
  if (Array.isArray(answerValue)) {
    return answerValue.join(', ');
  }
  if (answerValue && typeof answerValue === 'object') {
    return JSON.stringify(answerValue);
  }
  return answerValue || 'No answer';
}

function LiveResponsesPanel({ surveyId, questions = [] }) {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const questionMap = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question.text])),
    [questions]
  );

  useEffect(() => {
    if (!surveyId) {
      return undefined;
    }

    let cancelled = false;

    async function fetchResponses() {
      try {
        const result = await getSurveyResponses(surveyId, { page: 1, limit: 20 });
        if (cancelled) {
          return;
        }
        setResponses(result.data);
        setLastUpdated(new Date());
        setError('');
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchResponses();
    const intervalId = setInterval(fetchResponses, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [surveyId]);

  return (
    <aside className="live-responses-panel">
      <div className="live-responses-header">
        <div>
          <p className="public-survey-kicker">Live Responses</p>
          <h3>Admin Monitor</h3>
        </div>
        <span className="live-badge">Auto refresh: 5s</span>
      </div>

      {lastUpdated && (
        <p className="live-updated-at">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {loading && <p>Loading responses...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && responses.length === 0 && (
        <div className="empty-state live-empty-state">
          <p>No public responses yet. Submit one from the public form to see it appear here.</p>
        </div>
      )}

      {responses.length > 0 && (
        <div className="live-response-list">
          {responses.map((response) => (
            <div key={response.id} className="live-response-card">
              <div className="live-response-meta">
                <strong>
                  {response.metadata?.respondentName || response.metadata?.respondentEmail || 'Anonymous respondent'}
                </strong>
                <span>{new Date(response.created_at).toLocaleString()}</span>
              </div>

              <div className="live-response-tags">
                <span className={`status ${response.status}`}>{response.status}</span>
                {response.metadata?.submittedFrom && (
                  <span className="live-source-tag">{response.metadata.submittedFrom}</span>
                )}
              </div>

              <div className="live-answer-list">
                {Object.entries(response.answers || {}).map(([questionId, answer]) => (
                  <div key={questionId} className="live-answer-item">
                    <p className="live-answer-question">
                      {questionMap[questionId] || questionId}
                    </p>
                    <p className="live-answer-value">{formatAnswerPreview(answer)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export default LiveResponsesPanel;
