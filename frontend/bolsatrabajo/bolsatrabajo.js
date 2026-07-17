/* ============================================================
   bolsatrabajo.js — Lógica HU-49 a HU-56
   HU-49/53/54/55: Aliado ve/edita/cierra sus ofertas, ve postulantes
   HU-50: Aliado crea oportunidad laboral
   HU-51: Miembro consulta catálogo de vacantes disponibles
   HU-52: Miembro se postula
   HU-56: Egresado ve vacantes sugeridas
============================================================ */

const API = 'http://localhost:3000/api';
const token   = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!token || !usuario) {
  window.location.href = '../login/login.html';
}

const esAliado = usuario.rol === 'aliado_externo';

// Modo del formulario: 'crear' | 'editar'
let modoForm = 'crear';
let ofertaEditando = null; // { fecha_oferta, raw_fecha, cargo, rif }

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-oferta').addEventListener('submit', submitForm);

  if (esAliado) {
    document.getElementById('btn-publicar').style.display = 'inline-flex';
    document.getElementById('btn-publicar').addEventListener('click', abrirModalCrear);
    document.getElementById('titulo-catalogo').textContent = 'Mis Ofertas Publicadas';
    document.getElementById('page-sub').textContent = `Gestiona las vacantes publicadas por ${usuario.nombre}.`;
    cargarMisOfertas();
  } else {
    cargarCatalogo();
    cargarSugeridas();
  }
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

// ── HU-51: Catálogo público (Disponibles) ────────────────
async function cargarCatalogo() {
  const grid = document.getElementById('ofertas-grid');
  grid.innerHTML = loadingHtml();
  try {
    const data = await apiFetch('GET', '/bolsatrabajo');
    renderOfertas(data.ofertas, grid, false, false);
  } catch (err) {
    grid.innerHTML = errorHtml(err.message);
  }
}

// ── HU-49: Mis ofertas (aliado externo) ──────────────────
async function cargarMisOfertas() {
  const grid = document.getElementById('ofertas-grid');
  grid.innerHTML = loadingHtml();
  try {
    const data = await apiFetch('GET', `/bolsatrabajo?rif=${encodeURIComponent(usuario.RIF)}`);
    renderOfertas(data.ofertas, grid, true, false);
  } catch (err) {
    grid.innerHTML = errorHtml(err.message);
  }
}

// ── HU-56: Vacantes sugeridas (solo egresados) ───────────
async function cargarSugeridas() {
  try {
    const data = await apiFetch('GET', '/bolsatrabajo/sugeridas');
    if (data.ofertas && data.ofertas.length > 0) {
      document.getElementById('sugeridas-section').style.display = 'block';
      renderOfertas(data.ofertas, document.getElementById('sugeridas-grid'), false, true);
    }
  } catch {
    // Silencioso: si falla, simplemente no se muestra la seccion
  }
}

// ── Render de tarjetas ────────────────────────────────────
function renderOfertas(ofertas, container, esDueno, esSugerida) {
  if (!ofertas || ofertas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <p class="empty-state__msg">${esDueno ? 'Aún no has publicado ninguna vacante.' : 'No hay vacantes disponibles por ahora.'}</p>
      </div>`;
    return;
  }

  container.innerHTML = ofertas.map(o => {
    let acciones = '';

    if (esDueno) {
      acciones += `<button class="btn btn-outline btn-sm" onclick='verPostulantes(${jsonAttr(o)})'>👥 Postulantes</button>`;
      if (o.estatus === 'Disponible') {
        acciones += `
          <button class="btn btn-primary btn-sm" onclick='abrirModalEditar(${jsonAttr(o)})'>✏️ Editar</button>
          <button class="btn btn-danger-outline btn-sm" onclick='confirmarCerrar(${jsonAttr(o)})'>🔒 Cerrar</button>`;
      }
    } else if (o.postulado) {
      acciones += `<span class="badge badge--green">✔ Ya postulado</span>`;
    } else {
      acciones += `<button class="btn btn-green btn-sm" onclick='postularse(${jsonAttr(o)}, this)'>✋ Postularme</button>`;
    }

    let matchBadge = '';
    if (o.match_porcentaje !== undefined && !esDueno) {
      const level = o.match_porcentaje >= 70 ? 'high' : o.match_porcentaje >= 40 ? 'medium' : 'low';
      const icon = o.match_porcentaje >= 70 ? '🔥' : o.match_porcentaje >= 40 ? '👍' : '👀';
      matchBadge = `<span class="match-badge match-badge--${level}">${icon} ${o.match_porcentaje}% Match</span>`;
    }

    return `
      <div class="oferta-card ${esSugerida ? 'oferta-card--sugerida' : ''}">
        <div class="oferta-card__header">
          <span class="oferta-card__title">${esc(o.cargo)}</span>
          ${esDueno ? `<span class="badge ${o.estatus === 'Disponible' ? 'badge--green' : 'badge--gray'}">${esc(o.estatus)}</span>` : matchBadge}
        </div>
        <div class="oferta-card__body">
          <p class="oferta-card__desc"><b>Perfil buscado:</b> ${esc(o.perfil_buscado)}</p>
          <div class="oferta-card__meta">
            <span class="oferta-card__meta-item">🏢 ${esc(o.razon_social)}</span>
            <span class="oferta-card__meta-item">📋 ${esc(o.responsabilidades)}</span>
            <span class="oferta-card__meta-item">🎁 ${esc(o.beneficios)}</span>
            <span class="oferta-card__meta-item">📅 ${fmtFecha(o.fecha_oferta)}</span>
          </div>
        </div>
        <div class="oferta-card__footer">${acciones}</div>
      </div>
    `;
  }).join('');
}

// ── HU-50: Publicar vacante ───────────────────────────────
function abrirModalCrear() {
  modoForm = 'crear';
  ofertaEditando = null;
  document.getElementById('modal-form-title').textContent = 'Publicar Vacante';
  document.getElementById('btn-form-submit').textContent  = 'Publicar';
  document.getElementById('form-oferta').reset();
  document.getElementById('inp-cargo').disabled = false;
  document.getElementById('alert-form').classList.remove('visible');
  abrirModal('modal-form');
}

// ── HU-53: Editar vacante ─────────────────────────────────
function abrirModalEditar(o) {
  modoForm = 'editar';
  ofertaEditando = o;
  document.getElementById('modal-form-title').textContent = 'Editar Vacante';
  document.getElementById('btn-form-submit').textContent  = 'Guardar cambios';

  document.getElementById('inp-cargo').value = o.cargo;
  document.getElementById('inp-cargo').disabled = true;
  document.getElementById('inp-perfil').value = o.perfil_buscado;
  document.getElementById('inp-resp').value = o.responsabilidades;
  document.getElementById('inp-beneficios').value = o.beneficios;

  document.getElementById('alert-form').classList.remove('visible');
  abrirModal('modal-form');
}

async function submitForm(e) {
  e.preventDefault();
  const perfil_buscado  = document.getElementById('inp-perfil').value.trim();
  const responsabilidades = document.getElementById('inp-resp').value.trim();
  const beneficios      = document.getElementById('inp-beneficios').value.trim();

  const btn = document.getElementById('btn-form-submit');
  btn.disabled = true;
  document.getElementById('alert-form').classList.remove('visible');

  try {
    if (modoForm === 'crear') {
      const cargo = document.getElementById('inp-cargo').value.trim();
      await apiFetch('POST', '/bolsatrabajo', { cargo, responsabilidades, perfil_buscado, beneficios });
      toast('Vacante publicada exitosamente.', 'success');
    } else {
      const { raw_fecha, cargo, rif } = ofertaEditando;
      await apiFetch(
        'PUT',
        `/bolsatrabajo/${encodeURIComponent(raw_fecha)}/${encodeURIComponent(cargo)}/${encodeURIComponent(rif)}`,
        { responsabilidades, perfil_buscado, beneficios }
      );
      toast('Vacante actualizada.', 'success');
    }
    cerrarModal('modal-form');
    cargarMisOfertas();
  } catch (err) {
    const alertEl = document.getElementById('alert-form');
    alertEl.textContent = err.message;
    alertEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = modoForm === 'crear' ? 'Publicar' : 'Guardar cambios';
  }
}

// ── HU-54: Cerrar vacante ──────────────────────────────────
function confirmarCerrar(o) {
  document.getElementById('confirm-icon').textContent  = '🔒';
  document.getElementById('confirm-title').textContent = '¿Cerrar vacante?';
  document.getElementById('confirm-msg').textContent   =
    `La vacante "${o.cargo}" pasará a estado Finalizada y ya no aparecerá en el catálogo público.`;
  document.getElementById('btn-confirm-si').textContent = 'Sí, cerrar';
  document.getElementById('btn-confirm-si').className  = 'btn btn-danger';

  abrirModal('modal-confirm');

  document.getElementById('btn-confirm-si').onclick = async () => {
    cerrarModal('modal-confirm');
    try {
      await apiFetch(
        'PATCH',
        `/bolsatrabajo/${encodeURIComponent(o.raw_fecha)}/${encodeURIComponent(o.cargo)}/${encodeURIComponent(o.rif)}/cerrar`
      );
      toast(`Vacante "${o.cargo}" cerrada.`, 'success');
      cargarMisOfertas();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  document.getElementById('btn-confirm-no').onclick = () => cerrarModal('modal-confirm');
}

// ── HU-52: Postularse ──────────────────────────────────────
async function postularse(o, btn) {
  btn.disabled = true;
  try {
    await apiFetch(
      'POST',
      `/bolsatrabajo/${encodeURIComponent(o.raw_fecha)}/${encodeURIComponent(o.cargo)}/${encodeURIComponent(o.rif)}/postular`
    );
    toast(`Postulación a "${o.cargo}" registrada. ✅`, 'success');
    cargarCatalogo();
    cargarSugeridas();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
}

// ── HU-55: Ver postulantes ─────────────────────────────────
async function verPostulantes(o) {
  document.getElementById('modal-post-title').textContent = `Postulantes — ${o.cargo}`;
  const tbody = document.getElementById('tbody-postulantes');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Cargando...</td></tr>';
  abrirModal('modal-postulantes');

  try {
    const data = await apiFetch(
      'GET',
      `/bolsatrabajo/${encodeURIComponent(o.raw_fecha)}/${encodeURIComponent(o.cargo)}/${encodeURIComponent(o.rif)}/postulaciones`
    );

    if (!data.postulantes || data.postulantes.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Aún no hay postulantes para esta vacante.</td></tr>';
      return;
    }

    tbody.innerHTML = data.postulantes.map(p => `
      <tr>
        <td class="td-muted">${esc(p.ci)}</td>
        <td>${esc(p.primer_nombre)} ${esc(p.primer_apellido)}</td>
        <td class="td-muted">${esc(p.correo)}</td>
        <td class="td-muted">${esc(p.titulo || '—')}</td>
        <td class="td-muted">${p.indice_final ?? '—'}</td>
        <td class="td-muted">${p.ano_graduacion ?? '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">❌ ${esc(err.message)}</td></tr>`;
  }
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

function jsonAttr(o) {
  return JSON.stringify(o).replace(/'/g, '&apos;');
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-VE', {
    year:'numeric', month:'short', day:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

function loadingHtml() {
  return `<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__msg">Cargando...</p></div>`;
}

function errorHtml(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">❌</div><p class="empty-state__msg">${esc(msg)}</p></div>`;
}

function toast(msg, tipo = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el   = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span>${tipo === 'success' ? '✅' : '❌'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
