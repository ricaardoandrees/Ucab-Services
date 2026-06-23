const BASE_URL = 'http://localhost:3000/api';

const api = {

  async _request(method, endpoint, body = null) {
    const token = localStorage.getItem('token');

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${BASE_URL}${endpoint}`, options);

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/frontend/login/login.html';
      return;
    }

    const contentType = response.headers.get('Content-Type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const mensaje = data?.error || data || `Error ${response.status}`;
      throw new Error(mensaje);
    }

    return data;
  },

  get(endpoint)         { return this._request('GET',    endpoint);       },
  post(endpoint, body)  { return this._request('POST',   endpoint, body); },
  put(endpoint, body)   { return this._request('PUT',    endpoint, body); },
  patch(endpoint, body) { return this._request('PATCH',  endpoint, body); },
  delete(endpoint)      { return this._request('DELETE', endpoint);       },

  getUsuario() {
    try { return JSON.parse(localStorage.getItem('usuario')); }
    catch { return null; }
  },

  cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/frontend/login/login.html';
  }
};

window.api = api;