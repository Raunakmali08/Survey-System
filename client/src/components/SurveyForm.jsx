import { useState, useEffect, useCallback } from 'react';
import { useAutoSave } from '../hooks/useAutoSave.js';
import { createSurvey, getSurvey, updateSurvey } from '../services/api.js';

function createQuestion() {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    type: 'text',
    required: false,
    options: [],
  };
}

function normalizeQuestions(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [createQuestion()];
  }

  return questions.map((question) => ({
    id: question.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: question.text || '',
    type: question.type || 'text',
    required: Boolean(question.required),
    options: Array.isArray(question.options) ? question.options : [],
  }));
}

function SurveyForm({ survey, onBack }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questions: [createQuestion()],
  });
  const [errors, setErrors] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [conflictDialog, setConflictDialog] = useState(null);
  const [isLoadingSurvey, setIsLoadingSurvey] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(survey?.version || 1);

  const { debouncedSave } = useAutoSave({
    onSaveStart: () => setSaveStatus('saving'),
    onSaveSuccess: (result) => {
      setSaveStatus('saved');
      if (result?.version) {
        setCurrentVersion(result.version);
      }
    },
    onSaveError: (error) => {
      setSaveStatus('error');
      if (error.conflicts) {
        setConflictDialog(error);
      }
      if (error.currentVersion) {
        setCurrentVersion(error.currentVersion);
      }
    },
    save: async (payload) => {
      if (!survey?.id) {
        throw new Error('No survey selected for auto-save');
      }
      return updateSurvey(survey.id, payload);
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSurveyDetails() {
      if (!survey) {
        setFormData({
          title: '',
          description: '',
          questions: [createQuestion()],
        });
        setCurrentVersion(1);
        return;
      }

      setIsLoadingSurvey(true);

      try {
        const fullSurvey = survey.questions ? survey : await getSurvey(survey.id);

        if (cancelled) {
          return;
        }

        setFormData({
          title: fullSurvey.title || '',
          description: fullSurvey.description || '',
          questions: normalizeQuestions(fullSurvey.questions),
        });
        setCurrentVersion(fullSurvey.version || 1);
      } catch (error) {
        if (!cancelled) {
          setErrors([error.response?.data?.message || error.message]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSurvey(false);
        }
      }
    }

    loadSurveyDetails();

    return () => {
      cancelled = true;
    };
  }, [survey]);

  const buildSurveyPayload = useCallback((nextFormData) => ({
    title: nextFormData.title,
    description: nextFormData.description,
    questions: nextFormData.questions.map((question) => ({
      id: question.id,
      text: question.text,
      type: question.type,
      required: question.required,
      options: ['single_choice', 'multiple_choice'].includes(question.type)
        ? question.options.filter(Boolean)
        : [],
    })),
  }), []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const nextFormData = {
        ...prev,
        [name]: value,
      };

      // Auto-save on change (debounced)
      if (survey) {
        debouncedSave({
          ...buildSurveyPayload(nextFormData),
          version: currentVersion,
        });
      }

      return nextFormData;
    });
  }, [buildSurveyPayload, currentVersion, debouncedSave, survey]);

  const handleQuestionChange = useCallback((questionId, field, value) => {
    setFormData(prev => {
      const nextQuestions = prev.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextQuestion = {
          ...question,
          [field]: value,
        };

        if (field === 'type' && !['single_choice', 'multiple_choice'].includes(value)) {
          nextQuestion.options = [];
        }

        return nextQuestion;
      });

      const nextFormData = {
        ...prev,
        questions: nextQuestions,
      };

      if (survey) {
        debouncedSave({
          ...buildSurveyPayload(nextFormData),
          version: currentVersion,
        });
      }

      return nextFormData;
    });
  }, [buildSurveyPayload, currentVersion, debouncedSave, survey]);

  const handleQuestionOptionsChange = useCallback((questionId, rawValue) => {
    const options = rawValue
      .split('\n')
      .map(option => option.trim())
      .filter(Boolean);

    handleQuestionChange(questionId, 'options', options);
  }, [handleQuestionChange]);

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, createQuestion()],
    }));
  };

  const removeQuestion = (questionId) => {
    setFormData(prev => {
      const nextQuestions = prev.questions.filter(question => question.id !== questionId);
      return {
        ...prev,
        questions: nextQuestions.length > 0 ? nextQuestions : [createQuestion()],
      };
    });
  };

  const handleQuestionBlur = useCallback(() => {
    if (survey) {
      debouncedSave({
        ...buildSurveyPayload(formData),
        version: currentVersion,
      });
    }
  }, [buildSurveyPayload, currentVersion, debouncedSave, formData, survey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    setErrors([]);

    try {
      const payload = buildSurveyPayload(formData);

      if (survey?.id) {
        const updatedSurvey = await updateSurvey(survey.id, { ...payload, version: currentVersion });
        if (updatedSurvey?.version) {
          setCurrentVersion(updatedSurvey.version);
        }
      } else {
        const createdSurvey = await createSurvey(payload);
        if (createdSurvey?.version) {
          setCurrentVersion(createdSurvey.version);
        }
      }

      setSaveStatus('saved');
      setTimeout(() => onBack(), 1000);
    } catch (error) {
      setSaveStatus('error');
      setErrors([error.response?.data?.message || error.message]);
    }
  };

  const resolveConflict = async (_resolution) => {
    // Handle conflict resolution
    setConflictDialog(null);
    setSaveStatus('saving');

      try {
        // Re-attempt save with resolved values
        await debouncedSave({
          ...buildSurveyPayload(formData),
          version: currentVersion,
        });
      } catch (error) {
        setSaveStatus('error');
    }
  };

  return (
    <div className="survey-form">
      <button className="back-btn" onClick={onBack}>← Back</button>

      {isLoadingSurvey && <div className="loading">Loading survey details...</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Survey Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Enter survey title"
            required
            disabled={isLoadingSurvey}
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Enter survey description"
            rows={4}
            disabled={isLoadingSurvey}
          />
        </div>

        <div className="questions-section">
          <div className="questions-header">
            <h3>Questions</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={addQuestion}
              disabled={isLoadingSurvey}
            >
              Add Question
            </button>
          </div>

          {formData.questions.map((question, index) => (
            <div key={question.id} className="question-card">
              <div className="question-card-header">
                <h4>Question {index + 1}</h4>
                <button
                  type="button"
                  className="remove-question-btn"
                  onClick={() => removeQuestion(question.id)}
                  disabled={isLoadingSurvey}
                >
                  Remove
                </button>
              </div>

              <div className="form-group">
                <label>Question Text</label>
                <input
                  type="text"
                  value={question.text}
                  onChange={(event) => handleQuestionChange(question.id, 'text', event.target.value)}
                  onBlur={handleQuestionBlur}
                  placeholder="Enter your question"
                  required
                  disabled={isLoadingSurvey}
                />
              </div>

              <div className="question-grid">
                <div className="form-group">
                  <label>Question Type</label>
                  <select
                    value={question.type}
                    onChange={(event) => handleQuestionChange(question.id, 'type', event.target.value)}
                    onBlur={handleQuestionBlur}
                    disabled={isLoadingSurvey}
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="single_choice">Single Choice</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="rating">Rating</option>
                  </select>
                </div>

                <label className="question-required-toggle">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) => handleQuestionChange(question.id, 'required', event.target.checked)}
                    onBlur={handleQuestionBlur}
                    disabled={isLoadingSurvey}
                  />
                  Required
                </label>
              </div>

              {['single_choice', 'multiple_choice'].includes(question.type) && (
                <div className="form-group">
                  <label>Options</label>
                  <textarea
                    value={question.options.join('\n')}
                    onChange={(event) => handleQuestionOptionsChange(question.id, event.target.value)}
                    onBlur={handleQuestionBlur}
                    placeholder={'One option per line\nOption 1\nOption 2'}
                    rows={4}
                    disabled={isLoadingSurvey}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="status-area">
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === 'saving' && '💾 Saving...'}
            {saveStatus === 'saved' && '✅ Saved'}
            {saveStatus === 'error' && '❌ Error'}
            {saveStatus === 'idle' && ''}
          </span>
        </div>

        {errors.length > 0 && (
          <div className="error-list">
            {errors.map((error, idx) => (
              <p key={idx} className="error-message">{error}</p>
            ))}
          </div>
        )}

        <button type="submit" className="submit-btn">
          {survey ? 'Update Survey' : 'Create Survey'}
        </button>
      </form>

      {conflictDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Conflict Detected</h3>
            <p>This response was modified by another user.</p>
            <div className="conflicts-list">
              {conflictDialog.conflicts?.map((conflict, idx) => (
                <div key={idx} className="conflict-item">
                  <p>Question: {conflict.questionId}</p>
                  <p>Your value: {JSON.stringify(conflict.clientValue)}</p>
                  <p>Server value: {JSON.stringify(conflict.serverValue)}</p>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => resolveConflict('server')}>Use Server Values</button>
              <button onClick={() => resolveConflict('client')}>Use Your Values</button>
              <button onClick={() => setConflictDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SurveyForm;
