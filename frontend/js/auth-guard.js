(function () {
  const token   = localStorage.getItem('token');
  const usuario = (() => {
    try { return JSON.parse(localStorage.getItem('usuario')); }
    catch { return null; }
  })();

  if (!token || !usuario) {
    window.location.href = '/frontend/login/login.html';
    return;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/frontend/login/login.html';
      return;
    }
  } catch {
    localStorage.removeItem('token');
    window.location.href = '/frontend/login/login.html';
    return;
  }

  if (typeof ROLES_PERMITIDOS !== 'undefined' && ROLES_PERMITIDOS.length > 0) {
    if (!ROLES_PERMITIDOS.includes(usuario.rol)) {
      window.location.href = '/frontend/login/login.html';
      return;
    }
  }

  window.usuarioActual = usuario;
})();
