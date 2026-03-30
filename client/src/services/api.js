import axios from 'axios';
import { openDB } from 'idb';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// IndexedDB setup for offline support
async function getDB() {
  return openDB('survey-system', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('surveys')) {
        db.createObjectStore('surveys', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('responses')) {
        db.createObjectStore('responses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending-syncs')) {
        db.createObjectStore('pending-syncs', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// API client with fallback to IndexedDB
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

export function getStoredUser() {
  const rawUser = localStorage.getItem('survey-user');
  return rawUser ? JSON.parse(rawUser) : null;
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('survey-user');
}

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors and offline scenarios
apiClient.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearSession();
    }
    if (!navigator.onLine) {
      console.log('Offline - using cached data');
      // Return cached data if available
    }
    return Promise.reject(error);
  }
);

export async function registerUser(data) {
  const response = await axios.post('/auth/register', {
    name: data.name,
    email: data.email,
    password: data.password,
  });
  return response.data;
}

export async function loginUser(data) {
  const response = await axios.post('/auth/login', {
    email: data.email,
    password: data.password,
  });
  return response.data;
}

// Surveys API
export async function listSurveys(params = {}) {
  try {
    const response = await apiClient.get('/surveys', { params });
    
    // Cache surveys
    const db = await getDB();
    for (const survey of response.data.data) {
      await db.put('surveys', survey);
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to list surveys:', error);
    
    // Fallback to cached data
    if (!navigator.onLine) {
      const db = await getDB();
      const surveys = await db.getAll('surveys');
      return {
        data: surveys,
        pagination: { page: 1, limit: 20, total: surveys.length, pages: 1 },
      };
    }
    
    throw error;
  }
}

export async function getSurvey(id) {
  try {
    const response = await apiClient.get(`/surveys/${id}`);
    
    // Cache survey
    const db = await getDB();
    await db.put('surveys', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Failed to get survey:', error);
    throw error;
  }
}

export async function getPublicSurvey(id) {
  const response = await axios.get(`/api/public/surveys/public/${id}`);
  return response.data;
}

export async function createSurvey(data) {
  try {
    const response = await apiClient.post('/surveys', data);
    
    // Cache new survey
    const db = await getDB();
    await db.put('surveys', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Failed to create survey:', error);
    
    // Save for later sync if offline
    if (!navigator.onLine) {
      const db = await getDB();
      await db.add('pending-syncs', {
        type: 'create-survey',
        data,
        timestamp: Date.now(),
      });
    }
    
    throw error;
  }
}

export async function updateSurvey(id, data) {
  try {
    const response = await apiClient.patch(`/surveys/${id}`, data);
    
    // Update cache
    const db = await getDB();
    const survey = await db.get('surveys', id);
    if (survey) {
      await db.put('surveys', { ...survey, ...response.data });
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to update survey:', error);
    throw error;
  }
}

export async function deleteSurvey(id) {
  try {
    await apiClient.delete(`/surveys/${id}`);
    
    // Remove from cache
    const db = await getDB();
    await db.delete('surveys', id);
  } catch (error) {
    console.error('Failed to delete survey:', error);
    throw error;
  }
}

// Responses API
export async function submitResponse(surveyId, data) {
  try {
    const response = await apiClient.post(`/surveys/${surveyId}/responses`, data);
    
    // Cache response
    const db = await getDB();
    await db.put('responses', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Failed to submit response:', error);
    
    // Save for later sync if offline
    if (!navigator.onLine) {
      const db = await getDB();
      await db.add('pending-syncs', {
        type: 'submit-response',
        surveyId,
        data,
        timestamp: Date.now(),
      });
    }
    
    throw error;
  }
}

export async function submitPublicResponse(surveyId, data) {
  const response = await axios.post(`/api/public/responses/public/${surveyId}`, data);
  return response.data;
}

export async function updateResponse(surveyId, responseId, data) {
  try {
    const response = await apiClient.patch(
      `/surveys/${surveyId}/responses/${responseId}`,
      data
    );
    // ... cache update logic
    return response.data;
  } catch (error) {
    console.error('Failed to update response:', error);
    throw error;
  }
}

export async function getSurveyResponses(surveyId, params = {}) {
  try {
    const response = await apiClient.get(`/surveys/${surveyId}/responses`, { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get responses:', error);
    throw error;
  }
}

export async function getSurveyAnalytics(surveyId) {
  try {
    const response = await apiClient.get(`/surveys/${surveyId}/responses/analytics`);
    return response.data;
  } catch (error) {
    console.error('Failed to get analytics:', error);
    throw error;
  }
}

// Health check
export async function checkHealth() {
  try {
    const response = await axios.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}

// Sync pending changes
export async function syncPendingChanges() {
  try {
    const db = await getDB();
    const pending = await db.getAll('pending-syncs');

    for (const item of pending) {
      try {
        if (item.type === 'create-survey') {
          await createSurvey(item.data);
        } else if (item.type === 'submit-response') {
          await submitResponse(item.surveyId, item.data);
        }
        
        await db.delete('pending-syncs', item.id);
      } catch (error) {
        console.error('Failed to sync pending change:', error);
      }
    }

    return { synced: pending.length };
  } catch (error) {
    console.error('Failed to sync pending changes:', error);
    throw error;
  }
}

export default apiClient;
