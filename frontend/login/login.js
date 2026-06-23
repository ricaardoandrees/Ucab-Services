/*
   login.js — lógica del formulario de inicio de sesión
   Endpoint: POST /api/auth/login
   Conecta directamente con el auth.js del backend Express.
*/

const API_URL = 'http://localhost:3001/api/auth/login';

// ── Referencias al DOM 
const form          = document.getElementById('login-form');
const inputCorreo   = document.getElementById('correo');
const inputPass     = document.getElementById('contrasena');
const errorCorreo   = document.getElementById('error-correo');
const errorPass     = document.getElementById('error-contrasena');
const alertGeneral  = document.getElementById('alert-general');
const btnSubmit     = document.getElementById('btn-submit');
const togglePass    = document.getElementById('toggle-pass');

// Mostrar/ocultar contraseña 
togglePass.addEventListener('click', () => {
  const esPassword = inputPass.type === 'password';
  inputPass.type = esPassword ? 'text' : 'password';
  togglePass.setAttribute('aria-label', esPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

//  Limpia errores al empezar a escribir
inputCorreo.addEventListener('input', () => limpiarError(inputCorreo, errorCorreo));
inputPass.addEventListener('input',   () => limpiarError(inputPass,   errorPass));

// Validación local correo y contrasena
function validar() {
  let ok = true;

  const correo = inputCorreo.value.trim();
  if (!correo) {
    mostrarError(inputCorreo, errorCorreo, 'El correo es obligatorio.');
    ok = false;
  } else if (!correo.includes('@ucab')) {
    mostrarError(inputCorreo, errorCorreo, 'Debes usar tu correo institucional (@ucab.edu.ve).');
    ok = false;
  }

  const pass = inputPass.value;
  if (!pass) {
    mostrarError(inputPass, errorPass, 'La contraseña es obligatoria.');
    ok = false;
  }

  return ok;
}


form.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarAlertaGeneral();

  if (!validar()) return;

  // Captura de valores — listos para enviar al backend
  const correo    = inputCorreo.value.trim();
  const contrasena = inputPass.value;

  // Estado de carga
  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ correo, contrasena })
      // PENDIENTE DE CONFIRMACIONNN la opción de contraseña,
      // este objeto ya está listo 
    });

    const data = await response.json();

    if (!response.ok) {
      // El backend devuelve { error: 'mensaje' }
      mostrarAlertaGeneral(data.error || 'Error al iniciar sesión.');
      return;
    }

    // ── Login exitoso ──────────────────────────────────────────
    // Guardar el JWT en localStorage para usarlo en las demás rutas
    localStorage.setItem('token',   data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));

    // Redirigir al dashboard
    window.location.href = '../miembros/miembros.html'; // ajusta la ruta si es necesario

  } catch (err) {
    // Error de red (servidor caído, sin conexión, etc.)
    mostrarAlertaGeneral('No se pudo conectar con el servidor. Intenta de nuevo.');
    console.error('Error de red en login:', err);
  } finally {
    setLoading(false);
  }
});


function mostrarError(input, span, mensaje) {
  input.classList.add('is-error');
  span.textContent = mensaje;
}

function limpiarError(input, span) {
  input.classList.remove('is-error');
  span.textContent = '';
}

function mostrarAlertaGeneral(mensaje) {
  alertGeneral.textContent = mensaje;
  alertGeneral.classList.add('visible');
}

function ocultarAlertaGeneral() {
  alertGeneral.textContent = '';
  alertGeneral.classList.remove('visible');
}

function setLoading(estado) {
  btnSubmit.disabled = estado;
  btnSubmit.classList.toggle('loading', estado);
}
