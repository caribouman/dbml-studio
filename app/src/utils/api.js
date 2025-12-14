const API_BASE = '';

// Get auth token from localStorage
function getToken() {
  return localStorage.getItem('auth-token');
}

// Set auth token in localStorage
function setToken(token) {
  localStorage.setItem('auth-token', token);
}

// Remove auth token from localStorage
function removeToken() {
  localStorage.removeItem('auth-token');
}

// API request helper
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Important: send cookies for session-based auth
  });

  // Check status BEFORE parsing JSON to avoid parsing HTML error pages
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    // Try to parse JSON error message
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch (e) {
      // If response is not JSON (e.g., HTML 404 page)
      const text = await response.text();
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        errorMessage = `API endpoint not found: ${endpoint}`;
      } else {
        errorMessage = text || errorMessage;
      }
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
}

// Auth API
export const authAPI = {
  register: async (email, username, password) => {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  login: async (email, password) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  logout: async () => {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
    });
    removeToken();
  },

  getCurrentUser: async () => {
    try {
      return await apiRequest('/api/auth/me');
    } catch (err) {
      removeToken();
      throw err;
    }
  },

  loginWithGoogle: () => {
    window.location.href = '/api/auth/google';
  },

  loginWithGitHub: () => {
    window.location.href = '/api/auth/github';
  },

  electronAutoLogin: async () => {
    const data = await apiRequest('/api/auth/electron-auto-login', {
      method: 'POST',
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },
};

// Diagrams API
export const diagramsAPI = {
  create: async (title, description, dbmlCode, positions, isPublic = false) => {
    return apiRequest('/api/diagrams', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        dbml_code: dbmlCode,
        positions,
        is_public: isPublic,
      }),
    });
  },

  getAll: async () => {
    return apiRequest('/api/diagrams');
  },

  getById: async (id) => {
    return apiRequest(`/api/diagrams/${id}`);
  },

  update: async (id, title, description, dbmlCode, positions, isPublic = false) => {
    return apiRequest(`/api/diagrams/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        description,
        dbml_code: dbmlCode,
        positions,
        is_public: isPublic,
      }),
    });
  },

  delete: async (id) => {
    return apiRequest(`/api/diagrams/${id}`, {
      method: 'DELETE',
    });
  },

  getPublic: async (limit = 50) => {
    return apiRequest(`/api/public/diagrams?limit=${limit}`);
  },
};

export { getToken, setToken, removeToken, apiRequest };
