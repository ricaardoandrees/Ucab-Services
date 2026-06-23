/* ============================================================
   voluntariado.js — Lógica HU-100 a HU-106
   HU-100: Publicar       POST   /api/voluntariado
   HU-101: Modificar      PUT    /api/voluntariado/:nombre
   HU-102: Cerrar         PATCH  /api/voluntariado/:nombre/cerrar
   HU-103: Consultar      GET    /api/voluntariado?estado=X
   HU-104: Inscribirse    POST   /api/voluntariado/:nombre/inscribir
   HU-105: Cancelar insc. DELETE /api/voluntariado/:nombre/inscribir
   HU-106: Participantes  GET    /api/voluntariado/:nombre/participantes
============================================================ */

const API    = 'http://localhost:3001/api';
const token  = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!token || !usuario) {
  window.location.href = '../login/login.html';
}

// Roles con permisos especiales
const esDirectorOAdmin = usuario.rol === 'director' || usuario.rol === 'admin';
const esMiembro = !esDirectorOAdmin;

// Estado activo del filtro
let estadoActual = 'Abierto';
// Modo del formulario: 'crear' | 'editar'
let modoForm     = 'crear';
let nombreEditar = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  
    `Hola, ${usuario.nombre || usuario.correo}`;

  

  if (esDirectorOAdmin) {
    document.getElementById('btn-publicar').style.display = 'inline-flex';
    document.getElementById('btn-publicar').addEventListener('click', abrirModalCrear);
    cargarEntidades(); // pre-cargar dropdown
  }

  document.getElementById('form-voluntariado').addEventListener('submit', submitForm);

  cargarVoluntariados('Abierto');
});

// ── API helper ───────────────────────────────────────────
async function apiFetch(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── Cargar entidades prestadoras (dropdown) ────────────────
async function cargarEntidades() {
  const sel = document.getElementById('inp-idep');
  try {
    const data = await apiFetch('GET', '/voluntariado/entidades');
    sel.innerHTML = '<option value="">Seleccionar entidad...</option>' +
      data.entidades.map(e =>
        `<option value="${e.id_ep}">[${e.tipo}] ${esc(e.nombre)}</option>`
      ).join('');
  } catch {
    sel.innerHTML = '<option value="">Error al cargar entidades</option>';
  }
}

// ── HU-103: Cargar voluntariados ─────────────────────────
async function cargarVoluntariados(estado) {
  estadoActual = estado;
  const grid   = document.getElementById('vol-grid');
  grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__msg">Cargando...</p></div>`;

  try {
    const data = await apiFetch('GET', `/voluntariado?estado=${encodeURIComponent(estado)}`);
    renderGrid(data.voluntariados);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state__icon">❌</div><p class="empty-state__msg">${err.message}</p></div>`;
  }
}

function filtrar(estado, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarVoluntariados(estado);
}

// ── Render cards ─────────────────────────────────────────
function renderGrid(voluntariados) {
  const grid = document.getElementById('vol-grid');

  if (!voluntariados || voluntariados.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <p class="empty-state__msg">No hay voluntariados en este estado.</p>
      </div>`;
    return;
  }

  grid.innerHTML = voluntariados.map(v => {
    const badgeCls = { Abierto: 'badge--green', Cerrado: 'badge--red', Finalizado: 'badge--gray' }[v.estado] || 'badge--gray';
    const badgeIcon = { Abierto: '🟢', Cerrado: '🔴', Finalizado: '⚫' }[v.estado] || '';

    const inicio = fmtFecha(v.fecha_inicio);
    const fin    = v.fecha_fin ? fmtFecha(v.fecha_fin) : 'Sin fecha definida';

    // Botones según rol
    let acciones = '';

    if (esDirectorOAdmin) {
      acciones += `
        <button class="btn btn-outline btn-sm"
          onclick="verParticipantes('${esc(v.nombre)}')">👥 Participantes</button>`;

      if (v.estado === 'Abierto') {
        acciones += `
          <button class="btn btn-primary btn-sm"
            onclick="abrirModalEditar(${JSON.stringify(v).replace(/"/g,"&quot;")})">✏️ Editar</button>
          <button class="btn btn-danger-outline btn-sm"
            onclick="confirmarCerrar('${esc(v.nombre)}')">🔒 Cerrar</button>`;
      }
    } else {
      // Miembro — solo si abierto
      if (v.estado === 'Abierto') {
        if (v.inscrito) {
          acciones += `
            <button class="btn btn-danger-outline btn-sm"
              onclick="cancelarInscripcion('${esc(v.nombre)}')">✖ Cancelar inscripción</button>`;
        } else {
          acciones += `
            <button class="btn btn-green btn-sm"
              onclick="inscribirse('${esc(v.nombre)}', this)">✋ Inscribirme</button>`;
        }
      }
    }

    return `
      <div class="vol-card">
        <div class="vol-card__header">
          <span class="vol-card__title">${esc(v.nombre)}</span>
          <span class="badge ${badgeCls}">${badgeIcon} ${esc(v.estado)}</span>
        </div>
        <div class="vol-card__body">
          <p class="vol-card__desc">${esc(v.descripcion)}</p>
          <div class="vol-card__meta">
            <span class="vol-card__meta-item">🏢 Entidad: ${esc(v.entidad_nombre)}</span>
            <span class="vol-card__meta-item">📅 Inicio: ${inicio}</span>
            <span class="vol-card__meta-item">🏁 Fin: ${fin}</span>
            <span class="vol-card__meta-item">👥 Inscritos: ${v.total_inscritos || 0}</span>
          </div>
        </div>
        ${acciones ? `<div class="vol-card__footer">${acciones}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ── HU-100: Crear modal ──────────────────────────────────
async function abrirModalCrear() {
  modoForm     = 'crear';
  nombreEditar = null;
  document.getElementById('modal-form-title').textContent = 'Publicar Voluntariado';
  document.getElementById('btn-form-submit').textContent  = 'Publicar';
  document.getElementById('form-voluntariado').reset();
  document.getElementById('inp-nombre').disabled = false;

  // Solo permitir fechas futuras
  const ahora = toDatetimeLocal(new Date().toISOString());
  document.getElementById('inp-fecha-inicio').min = ahora;
  document.getElementById('inp-fecha-fin').min    = ahora;

  limpiarErroresForm();
  document.getElementById('alert-form').classList.remove('visible');
  await cargarEntidades();
  abrirModal('modal-form');
}

// ── HU-101: Editar modal ─────────────────────────────────
async function abrirModalEditar(v) {
  modoForm     = 'editar';
  nombreEditar = v.nombre;
  document.getElementById('modal-form-title').textContent = 'Editar Voluntariado';
  document.getElementById('btn-form-submit').textContent  = 'Guardar cambios';

  // Pre-llenar campos (nombre no editable)
  document.getElementById('inp-nombre').value        = v.nombre;
  document.getElementById('inp-nombre').disabled     = true;
  await cargarEntidades();
  document.getElementById('inp-idep').value          = v.id_ep;
  document.getElementById('inp-descripcion').value   = v.descripcion;
  document.getElementById('inp-fecha-inicio').value  = toDatetimeLocal(v.fecha_inicio);
  document.getElementById('inp-fecha-fin').value     = v.fecha_fin ? toDatetimeLocal(v.fecha_fin) : '';

  limpiarErroresForm();
  document.getElementById('alert-form').classList.remove('visible');
  abrirModal('modal-form');
}

// ── Submit crear/editar ──────────────────────────────────
async function submitForm(e) {
  e.preventDefault();
  if (!validarForm()) return;

  const idep        = parseInt(document.getElementById('inp-idep').value, 10);
  const descripcion = document.getElementById('inp-descripcion').value.trim();
  const fecha_inicio= document.getElementById('inp-fecha-inicio').value;
  const fecha_fin   = document.getElementById('inp-fecha-fin').value || null;

  const btn = document.getElementById('btn-form-submit');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  document.getElementById('alert-form').classList.remove('visible');

  try {
    if (modoForm === 'crear') {
      const nombre = document.getElementById('inp-nombre').value.trim();
      await apiFetch('POST', '/voluntariado', { nombre, ID_EP: idep, descripcion, fecha_inicio, fecha_fin });
      toast('Voluntariado publicado exitosamente.', 'success');
    } else {
      await apiFetch('PUT', `/voluntariado/${encodeURIComponent(nombreEditar)}`,
        { ID_EP: idep, descripcion, fecha_inicio, fecha_fin });
      toast('Voluntariado actualizado correctamente.', 'success');
    }
    cerrarModal('modal-form');
    cargarVoluntariados(estadoActual);
  } catch (err) {
    const alertEl = document.getElementById('alert-form');
    alertEl.textContent = err.message;
    alertEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = modoForm === 'crear' ? 'Publicar' : 'Guardar cambios';
  }
}

// ── HU-102: Cerrar voluntariado ──────────────────────────
function confirmarCerrar(nombre) {
  document.getElementById('confirm-icon').textContent  = '🔒';
  document.getElementById('confirm-title').textContent = '¿Cerrar voluntariado?';
  document.getElementById('confirm-msg').textContent   =
    `El voluntariado "${nombre}" pasará a estado Cerrado y los miembros no podrán inscribirse.`;
  document.getElementById('btn-confirm-si').textContent = 'Sí, cerrar';
  document.getElementById('btn-confirm-si').className  = 'btn btn-danger';

  abrirModal('modal-confirm');

  document.getElementById('btn-confirm-si').onclick = async () => {
    cerrarModal('modal-confirm');
    try {
      await apiFetch('PATCH', `/voluntariado/${encodeURIComponent(nombre)}/cerrar`);
      toast(`Voluntariado "${nombre}" cerrado.`, 'success');
      cargarVoluntariados(estadoActual);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  document.getElementById('btn-confirm-no').onclick = () => cerrarModal('modal-confirm');
}

// ── HU-104: Inscribirse ──────────────────────────────────
async function inscribirse(nombre, btn) {
  btn.disabled = true;
  try {
    await apiFetch('POST', `/voluntariado/${encodeURIComponent(nombre)}/inscribir`);
    toast(`Inscripción en "${nombre}" confirmada. ✅`, 'success');
    cargarVoluntariados(estadoActual);
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
}

// ── HU-105: Cancelar inscripción ─────────────────────────
function cancelarInscripcion(nombre) {
  document.getElementById('confirm-icon').textContent  = '⚠️';
  document.getElementById('confirm-title').textContent = '¿Cancelar inscripción?';
  document.getElementById('confirm-msg').textContent   =
    `¿Seguro que deseas cancelar tu inscripción en "${nombre}"?`;
  document.getElementById('btn-confirm-si').textContent = 'Sí, cancelar';
  document.getElementById('btn-confirm-si').className  = 'btn btn-danger';

  abrirModal('modal-confirm');

  document.getElementById('btn-confirm-si').onclick = async () => {
    cerrarModal('modal-confirm');
    try {
      await apiFetch('DELETE', `/voluntariado/${encodeURIComponent(nombre)}/inscribir`);
      toast(`Inscripción en "${nombre}" cancelada.`, 'success');
      cargarVoluntariados(estadoActual);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  document.getElementById('btn-confirm-no').onclick = () => cerrarModal('modal-confirm');
}

// ── HU-106: Ver participantes ────────────────────────────
async function verParticipantes(nombre) {
  document.getElementById('modal-part-title').textContent = `Participantes — ${nombre}`;
  const tbody = document.getElementById('tbody-participantes');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Cargando...</td></tr>';
  abrirModal('modal-participantes');

  try {
    const data = await apiFetch('GET', `/voluntariado/${encodeURIComponent(nombre)}/participantes`);

    if (!data.participantes || data.participantes.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay participantes inscritos.</td></tr>';
      return;
    }

    tbody.innerHTML = data.participantes.map(p => `
      <tr>
        <td class="td-muted">${esc(p.ci)}</td>
        <td>${esc(p.primer_nombre)} ${esc(p.segundo_nombre || '')}</td>
        <td>${esc(p.primer_apellido)} ${esc(p.segundo_apellido || '')}</td>
        <td class="td-muted">${esc(p.correo)}</td>
        <td class="td-muted">${esc(p.num_personal || '—')}</td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">❌ ${err.message}</td></tr>`;
  }
}

// ── Validación formulario ────────────────────────────────
function validarForm() {
  limpiarErroresForm();
  let ok = true;

  if (modoForm === 'crear') {
    const nombre = document.getElementById('inp-nombre').value.trim();
    if (!nombre) { setErr('err-nombre', 'El nombre es obligatorio.'); ok = false; }
  }

  const idep = document.getElementById('inp-idep').value;
  if (!idep || parseInt(idep) < 1) { setErr('err-idep', 'ID de entidad obligatorio.'); ok = false; }

  const desc = document.getElementById('inp-descripcion').value.trim();
  if (!desc) { setErr('err-desc', 'La descripción es obligatoria.'); ok = false; }

  const inicio = document.getElementById('inp-fecha-inicio').value;
  if (!inicio) { setErr('err-inicio', 'La fecha de inicio es obligatoria.'); ok = false; }

  const fin = document.getElementById('inp-fecha-fin').value;
  if (fin && inicio && fin <= inicio) {
    setErr('err-inicio', 'La fecha de fin debe ser posterior al inicio.');
    ok = false;
  }

  return ok;
}

function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function limpiarErroresForm() {
  ['err-nombre','err-idep','err-desc','err-inicio'].forEach(id => setErr(id, ''));
}

// ── Modal helpers ─────────────────────────────────────────
function abrirModal(id)  { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Helpers ───────────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-VE', {
    year:'numeric', month:'short', day:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toast(msg, tipo = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el   = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span>${tipo === 'success' ? '✅' : '❌'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
