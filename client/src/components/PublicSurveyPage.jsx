import { useEffect, useMemo, useState } from 'react';
import { getPublicSurvey, submitPublicResponse } from '../services/api.js';

function buildInitialAnswers(questions = []) {
  return questions.reduce((acc, question) => {
    acc[question.id] = question.type === 'multiple_choice' ? [] : '';
    return acc;
  }, {});
}

function PublicSurveyPage({ surveyId, readOnly = false }) {
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSurvey() {
      setLoading(true);
      setError('');

      try {
        const data = await getPublicSurvey(surveyId);
        if (cancelled) {
          return;
        }
        setSurvey(data);
        setAnswers(buildInitialAnswers(data.questions));
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

    loadSurvey();

    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  const requiredQuestions = useMemo(
    () => (survey?.questions || []).filter(question => question.required),
    [survey]
  );

  const handleAnswerChange = (question, value) => {
    setAnswers(prev => ({
      ...prev,
      [question.id]: value,
    }));
  };

  const handleCheckboxOption = (question, option) => {
    const currentValues = answers[question.id] || [];
    const nextValues = currentValues.includes(option)
      ? currentValues.filter(item => item !== option)
      : [...currentValues, option];

    handleAnswerChange(question, nextValues);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (readOnly) {
      return;
    }

    const missingRequired = requiredQuestions.filter((question) => {
      const value = answers[question.id];
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return !value;
    });

    if (missingRequired.length > 0) {
      setError('Please answer all required questions before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitPublicResponse(surveyId, {
        respondentName,
        respondentEmail,
        answers,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="public-survey-shell">Loading survey...</div>;
  }

  if (error && !survey) {
    return (
      <div className="public-survey-shell">
        <div className="public-survey-card">
          <h2>Survey unavailable</h2>
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="public-survey-shell">
        <div className="public-survey-card">
          <h2>Thank you!</h2>
          <p>Your response has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-survey-shell">
      <div className="public-survey-card">
        <div className="public-survey-header">
          <div>
            <p className="public-survey-kicker">
              {readOnly ? 'Public Preview' : 'Public Response Form'}
            </p>
            <h2>{survey.title}</h2>
            <p className="public-survey-description">
              {survey.description || 'Please fill in the survey below.'}
            </p>
            {readOnly && (
              <p className="public-preview-note">
                Preview mode is read-only. This lets admins review the public form without submitting responses.
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Name</label>
            <input
              type="text"
              value={respondentName}
              onChange={(event) => setRespondentName(event.target.value)}
              placeholder="Optional"
              disabled={readOnly}
            />
          </div>

          <div className="form-group">
            <label>Your Email</label>
            <input
              type="email"
              value={respondentEmail}
              onChange={(event) => setRespondentEmail(event.target.value)}
              placeholder="Optional"
              disabled={readOnly}
            />
          </div>

          <div className="public-question-list">
            {survey.questions.map((question, index) => (
              <div key={question.id} className="public-question-card">
                <label className="public-question-title">
                  {index + 1}. {question.text}
                  {question.required && <span className="required-marker"> *</span>}
                </label>

                {['text', 'rating'].includes(question.type) && (
                  <input
                    type={question.type === 'rating' ? 'number' : 'text'}
                    min={question.type === 'rating' ? 1 : undefined}
                    max={question.type === 'rating' ? 5 : undefined}
                    value={answers[question.id] || ''}
                    onChange={(event) => handleAnswerChange(question, event.target.value)}
                    placeholder={question.type === 'rating' ? 'Rate from 1 to 5' : 'Type your answer'}
                    disabled={readOnly}
                  />
                )}

                {question.type === 'textarea' && (
                  <textarea
                    rows={4}
                    value={answers[question.id] || ''}
                    onChange={(event) => handleAnswerChange(question, event.target.value)}
                    placeholder="Type your answer"
                    disabled={readOnly}
                  />
                )}

                {question.type === 'single_choice' && (
                  <div className="public-options-list">
                    {question.options.map((option) => (
                      <label key={option} className="public-option-row">
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === option}
                          onChange={() => handleAnswerChange(question, option)}
                          disabled={readOnly}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'multiple_choice' && (
                  <div className="public-options-list">
                    {question.options.map((option) => (
                      <label key={option} className="public-option-row">
                        <input
                          type="checkbox"
                          checked={(answers[question.id] || []).includes(option)}
                          onChange={() => handleCheckboxOption(question, option)}
                          disabled={readOnly}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <div className="error auth-error">{error}</div>}

          {!readOnly && (
            <button className="submit-btn" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default PublicSurveyPage;
