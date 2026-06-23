/* ============================================================
   miembros.js — lógica de la pantalla Mi Perfil y Seguridad
   Endpoints usados:
     GET   /api/miembros/:ci          → cargar ficha (HU-04)
     PATCH /api/miembros/:ci/contacto → guardar cambios (HU-05)
     GET   /api/miembros/:ci/ult-cambio → fecha cambio contraseña (HU-08)
     GET   /api/vinculaciones/:ci     → historial (HU-15) — pendiente backend
============================================================ */

const usuario = window.usuarioActual;
const CI      = usuario?.CI;


/* ── Helpers ─────────────────────────────────────────────────*/
function mostrarToast(mensaje, tipo = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.className = `toast toast--${tipo} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatearFecha(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function iniciales(nombre) {
  const partes = (nombre || '').trim().split(' ');
  return partes.length >= 2
    ? (partes[0][0] + partes[1][0]).toUpperCase()
    : (partes[0]?.[0] || 'U').toUpperCase();
}

function setLoading(estado) {
  const btn = document.getElementById('btn-guardar');
  btn.disabled = estado;
  btn.classList.toggle('loading', estado);
}

/* ── Cargar perfil ──────────────────────────────────────────*/
async function cargarPerfil() {
  try {
    console.log('CI del usuario:', CI);              // ← agrega esta
    const m = await api.get(`/miembros/${CI}`);
    console.log('Datos recibidos:', m);              // ← y esta

    // Campos de solo lectura
    document.getElementById('ci').value              = m.ci;
    document.getElementById('fecha_nacimiento').value = formatearFecha(m.fecha_nacimiento);
    document.getElementById('correo').value           = m.correo;

    const nombreCompleto = [m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido]
      .filter(Boolean).join(' ');
    document.getElementById('nombre').value       = nombreCompleto;
    document.getElementById('nombre-completo').textContent = nombreCompleto;
    document.getElementById('avatar').textContent = iniciales(nombreCompleto);

    // Subtipo desde el JWT
    document.getElementById('subtipo-label').textContent = usuario.subtipo || '';

    // Campos editables
    document.getElementById('num_personal').value     = m.num_personal || '';
    document.getElementById('calle1').value            = m.calle1       || '';
    document.getElementById('residencia').value        = m.residencia   || '';
    document.getElementById('estado_residencia').value = m.estado       || '';

  } catch (err) {
    mostrarToast('Error al cargar el perfil.', 'error');
    console.error(err);
  }
}

/* ── Cargar última fecha cambio de contraseña ───────────────*/
async function cargarUltCambio() {
  try {
    const data = await api.get(`/miembros/${CI}/ult-cambio`);
    const el   = document.getElementById('ult-cambio');
    el.textContent = data.ult_fecha_cambio
      ? formatearFecha(data.ult_fecha_cambio)
      : 'Sin registro';
  } catch {
    document.getElementById('ult-cambio').textContent = 'Sin registro';
  }
}

/* ── Cargar historial de vinculaciones ──────────────────────*/
async function cargarVinculaciones() {
  const contenedor = document.getElementById('vinculaciones-list');
  try {
    const lista = await api.get(`/vinculaciones/${CI}`);

    if (!lista || lista.length === 0) {
      contenedor.innerHTML = '<p style="color:var(--muted);font-size:13px;">Sin vinculaciones registradas.</p>';
      return;
    }

    contenedor.innerHTML = lista.map(v => {
      const activo  = !v.fecha_fin;
      const badge   = activo
        ? '<span class="badge badge--activo">Activo</span>'
        : '<span class="badge badge--inactivo">Inactivo</span>';
      const fecha   = formatearFecha(v.fecha_inicio);
      return `
        <div class="vinc-item">
          <div>
            <p class="vinc-subtipo">${v.subtipo || 'Miembro'}</p>
            <p class="vinc-fecha">${fecha}</p>
          </div>
          ${badge}
        </div>`;
    }).join('');

  } catch {
    // El endpoint de vinculaciones aún no está listo — mostrar placeholder
    contenedor.innerHTML = `
      <div class="vinc-item">
        <div><p class="vinc-subtipo">${usuario.subtipo || 'Miembro'}</p><p class="vinc-fecha">Período actual</p></div>
        <span class="badge badge--activo">Activo</span>
      </div>`;
  }
}

/* ── Guardar cambios (contacto) ─────────────────────────────*/
document.getElementById('form-perfil').addEventListener('submit', async (e) => {
  e.preventDefault();

  const alertEl = document.getElementById('alert-error');
  alertEl.classList.remove('visible');

  const num_personal = document.getElementById('num_personal').value.trim();
  const calle1       = document.getElementById('calle1').value.trim();
  const residencia   = document.getElementById('residencia').value.trim();
  const estado       = document.getElementById('estado_residencia').value.trim();

  if (!num_personal || !calle1 || !residencia || !estado) {
    alertEl.textContent = 'Completa todos los campos editables.';
    alertEl.classList.add('visible');
    return;
  }

  setLoading(true);
  try {
    await api.patch(`/miembros/${CI}/contacto`, { num_personal, calle1, residencia, estado });
    mostrarToast('Cambios guardados correctamente.', 'success');
  } catch (err) {
    mostrarToast(err.message || 'Error al guardar.', 'error');
  } finally {
    setLoading(false);
  }
});

/* ── Inicializar ────────────────────────────────────────────*/
cargarPerfil();
cargarUltCambio();
cargarVinculaciones();