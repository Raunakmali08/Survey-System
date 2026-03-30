import { useState, useEffect } from 'react';
import AuthPanel from './components/AuthPanel.jsx';
import SurveyList from './components/SurveyList.jsx';
import SurveyForm from './components/SurveyForm.jsx';
import { clearSession, getStoredUser } from './services/api.js';

function App() {
  const [currentPage, setCurrentPage] = useState('list');
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
        {!user && (
          <AuthPanel onAuthSuccess={setUser} />
        )}
        {user && currentPage === 'list' && (
          <SurveyList 
            onSelectSurvey={handleSurveySelect}
            onCreateNew={handleCreateNew}
          />
        )}
        {user && currentPage === 'form' && (
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
