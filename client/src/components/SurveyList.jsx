import { useState, useEffect } from 'react';
import { listSurveys } from '../services/api.js';

function SurveyList({ onSelectSurvey, onCreateNew }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadSurveys(page);
  }, [page]);

  const loadSurveys = async (pageNum) => {
    try {
      setLoading(true);
      const response = await listSurveys({ page: pageNum, limit: 10 });
      setSurveys(response.data);
      setTotalPages(response.pagination.pages);
      setError(null);
    } catch (err) {
      setError(err.message);
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="survey-list">
      <div className="list-header">
        <h2>Your Surveys</h2>
        <button className="btn-primary" onClick={onCreateNew}>
          ➕ Create New Survey
        </button>
      </div>

      {loading && <div className="loading">Loading surveys...</div>}
      {error && <div className="error">Error: {error}</div>}

      {surveys.length === 0 && !loading && (
        <div className="empty-state">
          <p>No surveys yet. Create one to get started!</p>
          <button className="btn-primary" onClick={onCreateNew}>
            Create First Survey
          </button>
        </div>
      )}

      {surveys.length > 0 && (
        <div className="surveys-grid">
          {surveys.map(survey => (
            <div key={survey.id} className="survey-card">
              <h3>{survey.title}</h3>
              <p className="description">{survey.description || 'No description'}</p>
              <div className="survey-meta">
                <span className={`status ${survey.status}`}>{survey.status}</span>
                <span className="responses">{survey.response_count || 0} responses</span>
              </div>
              <p className="date">
                Created: {new Date(survey.created_at).toLocaleDateString()}
              </p>
              <button 
                className="btn-secondary"
                onClick={() => onSelectSurvey(survey)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default SurveyList;
