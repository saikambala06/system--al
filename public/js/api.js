const API_BASE = '/api'; // same-origin: website and API are one Vercel deployment

function getToken() {
  return localStorage.getItem('skvk_token');
}

function setToken(token) {
  localStorage.setItem('skvk_token', token);
}

function clearToken() {
  localStorage.removeItem('skvk_token');
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

window.SKVK = { apiRequest, getToken, setToken, clearToken };
