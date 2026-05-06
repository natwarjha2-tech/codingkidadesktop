// ─── API Service Layer ───────────────────────────────────────────────────────
// Connects Electron renderer to the existing Next.js backend at localhost:3000
// DO NOT add any backend logic here — only HTTP calls.

const BASE_URL = CONFIG.API_BASE_URL;

/**
 * Core fetch wrapper — attaches JSON headers + auth token automatically.
 * Throws a structured error on non-2xx responses.
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('ck_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        data.message || data.error || `Request failed (${res.status})`;
      if (res.status === 401) {
        localStorage.removeItem('ck_token');
        localStorage.removeItem('ck_user');
        navigate('login');
      }
      throw new Error(message);
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    throw err;
  }
}

// ─── Auth APIs ───────────────────────────────────────────────────────────────

const AuthAPI = {
  login: (email, password) =>
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (name, email, password) =>
    apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
};

// ─── Student API ─────────────────────────────────────────────────────────────

const StudentAPI = {
  getProfile: () => apiRequest('/api/student'),
};

// ─── Survey APIs ─────────────────────────────────────────────────────────────

const SurveyAPI = {
  submitLead: (data) =>
    apiRequest('/api/survey/lead', { method: 'POST', body: JSON.stringify(data) }),

  submit: (data) =>
    apiRequest('/api/survey/submit', { method: 'POST', body: JSON.stringify(data) }),
};
