import { useState, useEffect } from 'react';
import AuthPanel from './components/AuthPanel.jsx';
import PublicSurveyPage from './components/PublicSurveyPage.jsx';
import SurveyList from './components/SurveyList.jsx';
import SurveyForm from './components/SurveyForm.jsx';
import { clearSession, getStoredUser } from './services/api.js';

function getPublicSurveyIdFromPath() {
  const match = window.location.pathname.match(/^\/form\/([^/]+)$/);
  return match ? match[1] : null;
}

function App() {
  const [currentPage, setCurrentPage] = useState('list');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState(() => getStoredUser());
  const [publicSurveyId, setPublicSurveyId] = useState(() => getPublicSurveyIdFromPath());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handlePopState = () => setPublicSurveyId(getPublicSurveyIdFromPath());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleSurveySelect = (survey) => {
    setSelectedSurvey(survey);
    setCurrentPage('form');
  };

  const handleCreateNew = () => {
    setSelectedSurvey(null);
    setCurrentPage('form');
  };

  const handleBack = () => {
    setCurrentPage('list');
    setSelectedSurvey(null);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setSelectedSurvey(null);
    setCurrentPage('list');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>📋 Survey System</h1>
        <div className="status-bar">
          {user && (
            <span className="user-badge">
              {user.name || user.email}
            </span>
          )}
          <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
          {user && (
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {publicSurveyId && (
          <PublicSurveyPage
            surveyId={publicSurveyId}
          />
        )}
        {!user && !publicSurveyId && (
          <AuthPanel onAuthSuccess={setUser} />
        )}
        {user && !publicSurveyId && currentPage === 'list' && (
          <SurveyList 
            onSelectSurvey={handleSurveySelect}
            onCreateNew={handleCreateNew}
          />
        )}
        {user && !publicSurveyId && currentPage === 'form' && (
          <SurveyForm
            survey={selectedSurvey}
            onBack={handleBack}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>© 2024 Survey System - Real-time Surveys for Everyone</p>
      </footer>
    </div>
  );
}

export default App;
