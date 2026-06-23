/* ============================================================
   register.js — lógica del formulario de registro
   Endpoint: POST /api/auth/register
   Campos que envía al backend (nombres de columna reales de Miembro):
     CI, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
     fecha_nacimiento, sexo, correo, num_personal, calle1, estado, residencia
============================================================ */

const API_URL = 'http://localhost:3000/api/auth/register';

// ── Referencias al DOM ────────────────────────────────────────
const form          = document.getElementById('register-form');
const btnSubmit     = document.getElementById('btn-submit');
const alertGeneral  = document.getElementById('alert-general');
const alertSuccess  = document.getElementById('alert-success');

// Campos obligatorios con su mensaje de error
const CAMPOS_REQUERIDOS = [
  { id: 'CI',               label: 'La cédula es obligatoria.'              },
  { id: 'fecha_nacimiento', label: 'La fecha de nacimiento es obligatoria.' },
  { id: 'sexo',             label: 'El sexo es obligatorio.'                },
  { id: 'primer_nombre',    label: 'El primer nombre es obligatorio.'       },
  { id: 'primer_apellido',  label: 'El primer apellido es obligatorio.'     },
  { id: 'correo',           label: 'El correo es obligatorio.'              },
  { id: 'num_personal',     label: 'El teléfono es obligatorio.'            },
  { id: 'calle1',           label: 'La calle/avenida es obligatoria.'       },
  { id: 'residencia',       label: 'La ciudad es obligatoria.'              },
  { id: 'estado',           label: 'El estado es obligatorio.'              },
];

// ── Limpiar error al escribir ─────────────────────────────────
CAMPOS_REQUERIDOS.forEach(({ id }) => {
  const input = document.getElementById(id);
  if (input) input.addEventListener('input', () => limpiarError(input, `error-${id}`));
});

// ── Validación ────────────────────────────────────────────────
function validar() {
  let ok = true;

  CAMPOS_REQUERIDOS.forEach(({ id, label }) => {
    const input = document.getElementById(id);
    if (!input) return;
    if (!input.value.trim()) {
      mostrarError(input, `error-${id}`, label);
      ok = false;
    }
  });

  // Validación específica del correo
  const correoInput = document.getElementById('correo');
  if (correoInput.value && !correoInput.value.includes('@ucab')) {
    mostrarError(correoInput, 'error-correo', 'El correo debe ser institucional (@ucab.edu.ve).');
    ok = false;
  }

  // Validación del formato de CI
  const ciInput = document.getElementById('CI');
  if (ciInput.value && !/^[VvEe]-?\d{6,9}$/.test(ciInput.value.trim())) {
    mostrarError(ciInput, 'error-CI', 'Formato inválido. Ejemplo: V-12345678');
    ok = false;
  }

  return ok;
}

// ── Submit ────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarAlertas();

  if (!validar()) return;

  // Construir el body con los nombres exactos de columnas de la BD
  const body = {
    CI:               document.getElementById('CI').value.trim(),
    primer_nombre:    document.getElementById('primer_nombre').value.trim(),
    segundo_nombre:   document.getElementById('segundo_nombre').value.trim() || null,
    primer_apellido:  document.getElementById('primer_apellido').value.trim(),
    segundo_apellido: document.getElementById('segundo_apellido').value.trim() || null,
    fecha_nacimiento: document.getElementById('fecha_nacimiento').value,
    sexo:             document.getElementById('sexo').value,
    correo:           document.getElementById('correo').value.trim(),
    num_personal:     document.getElementById('num_personal').value.trim(),
    calle1:           document.getElementById('calle1').value.trim(),
    residencia:       document.getElementById('residencia').value.trim(),
    estado:           document.getElementById('estado').value,
    // TODO: agregar contrasena cuando Marlene confirme
  };

  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarAlertaError(data.error || 'Error al registrar. Intenta de nuevo.');
      return;
    }

    // ── Registro exitoso ──────────────────────────────────────
    mostrarAlertaExito(`Cuenta creada exitosamente. Redirigiendo al login...`);
    form.reset();

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);

  } catch (err) {
    mostrarAlertaError('No se pudo conectar con el servidor. Intenta de nuevo.');
    console.error('Error en register:', err);
  } finally {
    setLoading(false);
  }
});

// ── Helpers ───────────────────────────────────────────────────
function mostrarError(input, spanId, mensaje) {
  input.classList.add('is-error');
  const span = document.getElementById(spanId);
  if (span) span.textContent = mensaje;
}

function limpiarError(input, spanId) {
  input.classList.remove('is-error');
  const span = document.getElementById(spanId);
  if (span) span.textContent = '';
}

function mostrarAlertaError(mensaje) {
  alertGeneral.textContent = mensaje;
  alertGeneral.classList.add('visible');
}

function mostrarAlertaExito(mensaje) {
  alertSuccess.textContent = mensaje;
  alertSuccess.classList.add('visible');
}

function ocultarAlertas() {
  alertGeneral.textContent = '';
  alertGeneral.classList.remove('visible');
  alertSuccess.textContent = '';
  alertSuccess.classList.remove('visible');
}

function setLoading(estado) {
  btnSubmit.disabled = estado;
  btnSubmit.classList.toggle('loading', estado);
}
