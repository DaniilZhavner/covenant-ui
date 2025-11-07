const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function buildHeaders(token, extra = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', ...extra });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function apiRequest(token, path, options = {}) {
  const { method = 'GET', body, headers } = options;
  const init = {
    method,
    headers: buildHeaders(token, headers),
    credentials: 'include',
  };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    let detail;
    try {
      detail = await response.json();
    } catch (error) {
      detail = null;
    }
    const message = detail?.error || detail?.message || response.statusText;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export { API_BASE };
