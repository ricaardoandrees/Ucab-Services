const usuario = window.usuarioActual;
const CI      = usuario?.CI;

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

async function cargarPerfil() {
  try {
    const m = await api.get(`/miembros/${CI}`);

    document.getElementById('ci').value              = m.ci;
    document.getElementById('fecha_nacimiento').value = formatearFecha(m.fecha_nacimiento);
    document.getElementById('correo').value           = m.correo;

    const nombreCompleto = [m.primer_nombre, m.segundo_nombre, m.primer_apellido, m.segundo_apellido]
      .filter(Boolean).join(' ');
    document.getElementById('nombre').value                = nombreCompleto;
    document.getElementById('nombre-completo').textContent = nombreCompleto;
    document.getElementById('avatar').textContent          = iniciales(nombreCompleto);
    document.getElementById('subtipo-label').textContent   = usuario.subtipo || '';

    document.getElementById('num_personal').value     = m.num_personal || '';
    document.getElementById('calle1').value           = m.calle1       || '';
    document.getElementById('residencia').value       = m.residencia   || '';
    document.getElementById('estado_residencia').value = m.estado      || '';

  } catch (err) {
    mostrarToast('Error al cargar el perfil.', 'error');
    console.error(err);
  }
}

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

async function cargarVinculaciones() {
  const contenedor = document.getElementById('vinculaciones-list');
  try {
    const data = await api.get(`/vinculaciones/${CI}`);
    const { periodos, especializaciones } = data;

    if ((!periodos || periodos.length === 0) && (!especializaciones || especializaciones.length === 0)) {
      contenedor.innerHTML = '<p style="color:var(--muted);font-size:13px;">Sin vinculaciones registradas.</p>';
      return;
    }

    function detalleSubtipo(subtipo, d) {
      if (!d) return '';
      const fila = (label, val) => val != null && val !== ''
        ? `<div class="vinc-attr"><span class="vinc-attr__label">${label}</span><span class="vinc-attr__val">${val}</span></div>`
        : '';

      if (subtipo === 'Estudiante') return [
        fila('Escuela',   d.escuela),
        fila('Facultad',  d.facultad),
        fila('Semestre',  d.semestre_actual),
        fila('UC aprobadas', d.uc_aprobadas),
        fila('Promedio',  d.promedio_ponderado),
      ].join('');

      if (subtipo === 'Becario') return [
        fila('Escuela',   d.escuela),
        fila('Facultad',  d.facultad),
        fila('Semestre',  d.semestre_actual),
        fila('UC aprobadas', d.uc_aprobadas),
        fila('Promedio',  d.promedio_ponderado),
        fila('Tipo de beca', d.tipo_beca),
        fila('Estatus beca', d.estatus_beneficio),
        fila('Cumplimiento índice', d.cumplimiento_indice ? 'Sí' : 'No'),
      ].join('');

      if (subtipo === 'Preparador') return [
        fila('Escuela',    d.escuela),
        fila('Semestre',   d.semestre_actual),
        fila('Promedio',   d.promedio_ponderado),
        fila('Asignatura', d.asignatura),
        fila('Horas ayudantía', d.horas),
      ].join('');

      if (subtipo === 'Profesor') return [
        fila('Escalafón',       d.escalafon),
        fila('Carga horaria',   d.carga_horaria ? `${d.carga_horaria} hrs` : null),
        fila('Cód. investigador', d.cod_investigador),
      ].join('');

      if (subtipo === 'PersonalAdministrativo') return [
        fila('Cargo',         d.cargo),
        fila('Adscripción',   d.adscripcion_presupuestaria),
        fila('Carga semanal', d.carga_semanal ? `${d.carga_semanal} hrs` : null),
      ].join('');

      if (subtipo === 'Egresado') return [
        fila('Título',          d.titulo),
        fila('Año graduación',  d.ano_graduacion),
        fila('Índice final',    d.indice_final),
      ].join('');

      return '';
    }

    let rolesHTML = '';
    if (especializaciones && especializaciones.length > 0) {
      rolesHTML = `<p style="font-size:11px;font-weight:600;color:var(--label);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Roles actuales</p>`;
      rolesHTML += especializaciones.map(e => {
        const detalle = detalleSubtipo(e.subtipo, e.datos);
        return `
          <div class="vinc-item" style="align-items:flex-start">
            <div style="flex:1;min-width:0">
              <p class="vinc-subtipo">${e.subtipo}</p>
              ${detalle ? `<div class="vinc-attrs">${detalle}</div>` : ''}
            </div>
            <span class="badge badge--activo" style="flex-shrink:0;margin-top:2px">Activo</span>
          </div>`;
      }).join('');
    }

    let periodosHTML = '';
    const periodosCerrados = periodos ? periodos.filter(v => v.fecha_fin) : [];
    if (periodosCerrados.length > 0) {
      periodosHTML = `<p style="font-size:11px;font-weight:600;color:var(--label);text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 8px">Períodos anteriores</p>`;
      periodosHTML += periodosCerrados.map(v => {
        const fechaInicio = formatearFecha(v.fecha_inicio);
        const fechaFin    = formatearFecha(v.fecha_fin);
        const rolLabel    = v.rol ? `<p class="vinc-subtipo" style="font-size:13px">${v.rol}</p>` : '';
        return `
          <div class="vinc-item">
            <div>
              ${rolLabel}
              <p class="vinc-fecha">${fechaInicio} → ${fechaFin}</p>
            </div>
            <span class="badge badge--inactivo">Cerrado</span>
          </div>`;
      }).join('');
    }

    contenedor.innerHTML = rolesHTML + periodosHTML;

  } catch {
    contenedor.innerHTML = `
      <div class="vinc-item">
        <div><p class="vinc-subtipo">${usuario.subtipo || 'Miembro'}</p><p class="vinc-fecha">Período actual</p></div>
        <span class="badge badge--activo">Activo</span>
      </div>`;
  }
}

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

// Modal contraseña — event listeners en vez de onclick
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.link-cambiar-pass').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('pass-actual').value   = '';
    document.getElementById('pass-nueva').value    = '';
    document.getElementById('pass-confirmar').value = '';
    document.getElementById('alert-pass').style.display = 'none';
    document.getElementById('modal-password').style.display = 'flex';
  });

  document.getElementById('btn-cerrar-modal').addEventListener('click', () => {
    document.getElementById('modal-password').style.display = 'none';
  });

  document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
    document.getElementById('modal-password').style.display = 'none';
  });

  document.getElementById('btn-guardar-pass').addEventListener('click', async () => {
    const actual    = document.getElementById('pass-actual').value;
    const nueva     = document.getElementById('pass-nueva').value;
    const confirmar = document.getElementById('pass-confirmar').value;
    const alertEl   = document.getElementById('alert-pass');

    alertEl.style.display = 'none';

    if (!actual || !nueva || !confirmar) {
      alertEl.textContent = 'Completa todos los campos.';
      alertEl.style.display = 'block';
      return;
    }
    if (nueva.length < 6) {
      alertEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
      alertEl.style.display = 'block';
      return;
    }
    if (nueva !== confirmar) {
      alertEl.textContent = 'Las contraseñas no coinciden.';
      alertEl.style.display = 'block';
      return;
    }

    const token    = localStorage.getItem('token');
    const response = await fetch('http://localhost:3000/api/auth/cambiar-password', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ contrasena_actual: actual, contrasena_nueva: nueva })
    });

    const data = await response.json();

    if (!response.ok) {
      alertEl.textContent = data.error || 'Error al cambiar contraseña.';
      alertEl.style.display = 'block';
      return;
    }

    document.getElementById('modal-password').style.display = 'none';
    mostrarToast('Contraseña actualizada. Vuelve a iniciar sesión.', 'success');
    setTimeout(() => {
      localStorage.clear();
      window.location.href = '../login/login.html';
    }, 2000);
  });
});

cargarPerfil();
cargarUltCambio();
cargarVinculaciones();