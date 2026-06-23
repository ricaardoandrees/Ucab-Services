/* ============================================================
   infraestructura.js — HU-37 a HU-47
============================================================ */

const API    = 'http://localhost:3001/api/infraestructura';
const token  = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!token || !usuario) {
  window.location.href = '../login/login.html';
}

// Roles
const isDirector = usuario.rol === 'director';
const isAdmin    = usuario.rol === 'admin';
const isPrivileged = isDirector || isAdmin;

// Estado
let modoForm = 'crear';
let editSedeId = null;
let editEdifName = null;
let editEdifSede = null;
let editEspNum = null;
let editEspEdif = null;
let editEspSede = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  
  

  // Tabs logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      const targetId = e.target.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'tab-servicios') loadServicios();
      if (targetId === 'tab-espacios') loadEspacios();
      if (targetId === 'tab-edificaciones') loadEdificaciones();
      if (targetId === 'tab-sedes') loadSedes();
    });
  });

  // Mostrar tabs/botones según rol
  if (isAdmin) {
    document.getElementById('btn-tab-sedes').style.display = 'inline-block';
    document.getElementById('btn-add-sede').style.display = 'inline-flex';
  }
  if (isPrivileged) {
    document.getElementById('btn-add-edificacion').style.display = 'inline-flex';
    document.getElementById('btn-add-espacio').style.display = 'inline-flex';
  }

  // Event Listeners Botones Añadir
  document.getElementById('btn-add-sede')?.addEventListener('click', openModalSedeCrear);
  document.getElementById('btn-add-edificacion')?.addEventListener('click', openModalEdifCrear);
  document.getElementById('btn-add-espacio')?.addEventListener('click', openModalEspacioCrear);
  document.getElementById('btn-add-aliado')?.addEventListener('click', openModalAliado);

  // Cargar tab inicial
  loadServicios();
});

// ── Fetch Helper ─────────────────────────────────────────
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

// ── 1. SERVICIOS ──────────────────────────────────────────
async function loadServicios() {
  const grid = document.getElementById('grid-servicios');
  grid.innerHTML = `<div class="empty-state"><p class="empty-state__msg">Cargando...</p></div>`;
  try {
    const data = await apiFetch('GET', '/servicios');
    if (data.servicios.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p class="empty-state__msg">No hay servicios públicos disponibles.</p></div>`;
      return;
    }
    grid.innerHTML = data.servicios.map(s => `
      <div class="item-card">
        <div class="item-card__header">
          <span class="item-card__title">${esc(s.nombre)}</span>
          <span class="badge badge--green">Disponible</span>
        </div>
        <div class="item-card__body">
          <p class="item-card__desc">${esc(s.descripcion || 'Sin descripción')}</p>
          <div class="item-card__meta">
            <span class="item-card__meta-item">📍 Sede: ${esc(s.nombre_sede)}</span>
            <span class="item-card__meta-item">🔖 Categoría: ${esc(s.nombre_categoria)}</span>
            <span class="item-card__meta-item">🏢 Entidad: ${esc(s.entidad_nombre)}</span>
            <span class="item-card__meta-item">💲 Precio Base: $${s.precio_base}</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p class="empty-state__msg">${err.message}</p></div>`;
  }
}

// ── 2. ESPACIOS FÍSICOS ───────────────────────────────────
async function loadEspacios() {
  const tbody = document.getElementById('tbody-espacios');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Cargando...</td></tr>`;
  try {
    const data = await apiFetch('GET', '/espacios');
    if (data.espacios.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No hay espacios registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.espacios.map(e => `
      <tr>
        <td>${esc(e.nombre_sede)}</td>
        <td>${esc(e.nombre_edif)}</td>
        <td><b>${e.numero}</b></td>
        <td>${e.capacidad_max} personas</td>
        <td>
          <span class="badge ${e.disponibilidad === 'Disponible' ? 'badge--green' : 'badge--red'}">
            ${esc(e.disponibilidad)}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" style="margin-right: 4px;" onclick='openModalRecursos(${JSON.stringify(e).replace(/'/g, "&apos;")})'>📦 Recursos</button>
          ${isPrivileged ? `
            <button class="btn btn-outline btn-sm" onclick='openModalEspacioEditar(${JSON.stringify(e).replace(/'/g, "&apos;")})'>✏️ Editar</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">❌ ${err.message}</td></tr>`;
  }
}

// ── 3. EDIFICACIONES ──────────────────────────────────────
async function loadEdificaciones() {
  const tbody = document.getElementById('tbody-edificaciones');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Cargando...</td></tr>`;
  try {
    const data = await apiFetch('GET', '/edificaciones');
    if (data.edificaciones.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No hay edificaciones registradas.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.edificaciones.map(e => `
      <tr>
        <td>${esc(e.nombre_sede)}</td>
        <td><b>${esc(e.nombre)}</b></td>
        <td class="td-muted">${esc(e.direccion_exacta)}</td>
        <td>
          ${isPrivileged ? `
            <button class="btn btn-outline btn-sm" onclick='openModalEdifEditar(${JSON.stringify(e).replace(/'/g, "&apos;")})'>✏️ Editar</button>
          ` : '—'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">❌ ${err.message}</td></tr>`;
  }
}

// ── 4. SEDES (Solo Admin) ─────────────────────────────────
async function loadSedes() {
  if (!isAdmin) return;
  const tbody = document.getElementById('tbody-sedes');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="3">Cargando...</td></tr>`;
  try {
    const data = await apiFetch('GET', '/sedes');
    if (data.sedes.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No hay sedes registradas.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.sedes.map(s => `
      <tr>
        <td><b>${esc(s.nombre)}</b></td>
        <td class="td-muted">${esc(s.ubicacion)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='openModalSedeEditar(${JSON.stringify(s).replace(/'/g, "&apos;")})'>✏️ Editar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">❌ ${err.message}</td></tr>`;
  }
}


// ── MODALES & FORMS ───────────────────────────────────────

// Sede
function openModalSedeCrear() {
  modoForm = 'crear';
  document.getElementById('title-sede').textContent = 'Añadir Sede';
  document.getElementById('form-sede').reset();
  document.getElementById('inp-sede-nombre').disabled = false;
  showAlert('alert-sede', '');
  abrirModal('modal-sede');
}
function openModalSedeEditar(s) {
  modoForm = 'editar';
  editSedeId = s.nombre;
  document.getElementById('title-sede').textContent = 'Editar Sede';
  document.getElementById('inp-sede-nombre').value = s.nombre;
  document.getElementById('inp-sede-nombre').disabled = false; // Permitir editar nombre
  document.getElementById('inp-sede-ubicacion').value = s.ubicacion;
  showAlert('alert-sede', '');
  abrirModal('modal-sede');
}
async function submitSede(e) {
  e.preventDefault();
  const nombre = document.getElementById('inp-sede-nombre').value.trim();
  const ubicacion = document.getElementById('inp-sede-ubicacion').value.trim();
  
  try {
    if (modoForm === 'crear') {
      await apiFetch('POST', '/sedes', { nombre, ubicacion });
      toast('Sede añadida exitosamente.');
    } else {
      await apiFetch('PUT', `/sedes/${encodeURIComponent(editSedeId)}`, { nombre, ubicacion });
      toast('Sede actualizada.');
    }
    cerrarModal('modal-sede');
    loadSedes();
  } catch (err) {
    showAlert('alert-sede', err.message);
  }
}

// Edificacion
async function populateSedesDropdown(selectId) {
  const sel = document.getElementById(selectId);
  try {
    const data = await apiFetch('GET', '/sedes');
    sel.innerHTML = '<option value="">Seleccionar Sede...</option>' + 
      data.sedes.map(s => `<option value="${esc(s.nombre)}">${esc(s.nombre)}</option>`).join('');
  } catch (err) {
    sel.innerHTML = '<option value="">Error al cargar sedes</option>';
  }
}

async function openModalEdifCrear() {
  modoForm = 'crear';
  document.getElementById('title-edificacion').textContent = 'Añadir Edificación';
  document.getElementById('form-edificacion').reset();
  document.getElementById('inp-edif-nombre').disabled = false;
  document.getElementById('inp-edif-sede').disabled = false;
  showAlert('alert-edificacion', '');
  await populateSedesDropdown('inp-edif-sede');
  abrirModal('modal-edificacion');
}
async function openModalEdifEditar(e) {
  modoForm = 'editar';
  editEdifName = e.nombre;
  editEdifSede = e.nombre_sede;
  document.getElementById('title-edificacion').textContent = 'Editar Edificación';
  await populateSedesDropdown('inp-edif-sede');
  
  document.getElementById('inp-edif-sede').value = e.nombre_sede;
  document.getElementById('inp-edif-sede').disabled = false;
  document.getElementById('inp-edif-nombre').value = e.nombre;
  document.getElementById('inp-edif-nombre').disabled = false;
  document.getElementById('inp-edif-direccion').value = e.direccion_exacta;
  
  showAlert('alert-edificacion', '');
  abrirModal('modal-edificacion');
}
async function submitEdificacion(e) {
  e.preventDefault();
  const nombre = document.getElementById('inp-edif-nombre').value.trim();
  const nombre_sede = document.getElementById('inp-edif-sede').value;
  const direccion_exacta = document.getElementById('inp-edif-direccion').value.trim();
  
  try {
    if (modoForm === 'crear') {
      await apiFetch('POST', '/edificaciones', { nombre, direccion_exacta, nombre_sede });
      toast('Edificación agregada.');
    } else {
      await apiFetch('PUT', `/edificaciones/${encodeURIComponent(editEdifName)}/${encodeURIComponent(editEdifSede)}`, { nombre, nombre_sede, direccion_exacta });
      toast('Edificación actualizada.');
    }
    cerrarModal('modal-edificacion');
    loadEdificaciones();
  } catch (err) {
    showAlert('alert-edificacion', err.message);
  }
}

// Espacio Físico
async function loadEdificacionesDropdown() {
  const sede = document.getElementById('inp-esp-sede').value;
  const selEdif = document.getElementById('inp-esp-edif');
  selEdif.innerHTML = '<option value="">Cargando...</option>';
  if (!sede) {
    selEdif.innerHTML = '<option value="">Seleccione una sede primero</option>';
    return;
  }
  try {
    const data = await apiFetch('GET', `/edificaciones?sede=${encodeURIComponent(sede)}`);
    window.currentEdificaciones = data.edificaciones;
    selEdif.innerHTML = '<option value="">Seleccionar Edificación...</option>' + 
      data.edificaciones.map(e => `<option value="${esc(e.nombre)}">${esc(e.nombre)}</option>`).join('');
    document.getElementById('inp-esp-direccion').value = '';
  } catch {
    selEdif.innerHTML = '<option value="">Error al cargar</option>';
  }
}

function fillEspacioDireccion() {
  const nombreEdif = document.getElementById('inp-esp-edif').value;
  const edif = (window.currentEdificaciones || []).find(e => e.nombre === nombreEdif);
  document.getElementById('inp-esp-direccion').value = edif ? edif.direccion_exacta : '';
}

async function openModalEspacioCrear() {
  modoForm = 'crear';
  document.getElementById('title-espacio').textContent = 'Añadir Espacio Físico';
  document.getElementById('form-espacio').reset();
  document.getElementById('inp-esp-numero').disabled = false;
  document.getElementById('inp-esp-sede').disabled = false;
  document.getElementById('inp-esp-edif').disabled = false;
  document.getElementById('inp-esp-direccion').value = '';
  document.getElementById('inp-esp-direccion').disabled = true;
  showAlert('alert-espacio', '');
  await populateSedesDropdown('inp-esp-sede');
  document.getElementById('inp-esp-edif').innerHTML = '<option value="">Seleccione sede primero</option>';
  abrirModal('modal-espacio');
}
async function openModalEspacioEditar(e) {
  modoForm = 'editar';
  editEspNum = e.numero;
  editEspEdif = e.nombre_edif;
  editEspSede = e.nombre_sede;
  
  document.getElementById('title-espacio').textContent = 'Editar Espacio Físico';
  await populateSedesDropdown('inp-esp-sede');
  
  document.getElementById('inp-esp-sede').value = e.nombre_sede;
  document.getElementById('inp-esp-sede').disabled = false;
  await loadEdificacionesDropdown();
  
  document.getElementById('inp-esp-edif').value = e.nombre_edif;
  document.getElementById('inp-esp-edif').disabled = false;
  document.getElementById('inp-esp-direccion').value = e.direccion_exacta;
  document.getElementById('inp-esp-direccion').disabled = true;
  document.getElementById('inp-esp-numero').value = e.numero;
  document.getElementById('inp-esp-numero').disabled = false;
  
  document.getElementById('inp-esp-cap').value = e.capacidad_max;
  document.getElementById('inp-esp-disp').value = e.disponibilidad;
  
  showAlert('alert-espacio', '');
  abrirModal('modal-espacio');
}
async function submitEspacio(e) {
  e.preventDefault();
  const capacidad_max = parseInt(document.getElementById('inp-esp-cap').value, 10);
  const disponibilidad = document.getElementById('inp-esp-disp').value;
  
  try {
    if (modoForm === 'crear') {
      const numero = parseInt(document.getElementById('inp-esp-numero').value, 10);
      const nombre_edif = document.getElementById('inp-esp-edif').value;
      const nombre_sede = document.getElementById('inp-esp-sede').value;
      
      // La dirección exacta ya no hace falta mandarla porque el backend la busca solito
      await apiFetch('POST', '/espacios', { numero, nombre_edif, nombre_sede, capacidad_max, disponibilidad });
      toast('Espacio registrado.');
    } else {
      const numero = parseInt(document.getElementById('inp-esp-numero').value, 10);
      const nombre_edif = document.getElementById('inp-esp-edif').value;
      const nombre_sede = document.getElementById('inp-esp-sede').value;

      await apiFetch('PUT', `/espacios/${editEspNum}/${encodeURIComponent(editEspEdif)}/${encodeURIComponent(editEspSede)}`, { numero, nombre_edif, nombre_sede, capacidad_max, disponibilidad });
      toast('Espacio actualizado.');
    }
    cerrarModal('modal-espacio');
    loadEspacios();
  } catch (err) {
    showAlert('alert-espacio', err.message);
  }
}

// --- LÓGICA DE RECURSOS ---
let currentRecursosEspacio = null;

async function openModalRecursos(e) {
  currentRecursosEspacio = e;
  document.getElementById('title-recursos-num').textContent = e.numero;
  document.getElementById('inp-recurso-nuevo').value = '';
  showAlert('alert-recursos', '');
  
  if (!isPrivileged) {
    document.getElementById('form-recursos-add').style.display = 'none';
  } else {
    document.getElementById('form-recursos-add').style.display = 'flex';
  }

  await loadRecursosList();
  abrirModal('modal-recursos');
}

async function loadRecursosList() {
  const ul = document.getElementById('list-recursos');
  ul.innerHTML = '<li>Cargando...</li>';
  try {
    const { numero, nombre_edif, nombre_sede } = currentRecursosEspacio;
    const data = await apiFetch('GET', `/espacios/${numero}/${encodeURIComponent(nombre_edif)}/${encodeURIComponent(nombre_sede)}/recursos`);
    if (data.recursos.length === 0) {
      ul.innerHTML = '<li style="color: #666;">No hay recursos registrados.</li>';
      return;
    }
    ul.innerHTML = data.recursos.map(r => `
      <li style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #eee;">
        <span>${esc(r)}</span>
        ${isPrivileged ? `<button class="btn btn-sm" style="color: #e53935; background: transparent; border: none; cursor: pointer; font-weight: bold;" onclick="deleteRecurso('${esc(r)}')">✕</button>` : ''}
      </li>
    `).join('');
  } catch (err) {
    ul.innerHTML = `<li style="color: red;">Error: ${esc(err.message)}</li>`;
  }
}

async function submitRecurso(e) {
  e.preventDefault();
  const recurso = document.getElementById('inp-recurso-nuevo').value.trim();
  if (!recurso) return;
  try {
    const { numero, nombre_edif, nombre_sede } = currentRecursosEspacio;
    await apiFetch('POST', `/espacios/${numero}/${encodeURIComponent(nombre_edif)}/${encodeURIComponent(nombre_sede)}/recursos`, { recurso });
    document.getElementById('inp-recurso-nuevo').value = '';
    toast('Recurso añadido.');
    loadRecursosList();
  } catch (err) {
    showAlert('alert-recursos', err.message);
  }
}

async function deleteRecurso(recurso) {
  if (!confirm(`¿Eliminar el recurso "${recurso}"?`)) return;
  try {
    const { numero, nombre_edif, nombre_sede } = currentRecursosEspacio;
    await apiFetch('DELETE', `/espacios/${numero}/${encodeURIComponent(nombre_edif)}/${encodeURIComponent(nombre_sede)}/recursos/${encodeURIComponent(recurso)}`);
    toast('Recurso eliminado.');
    loadRecursosList();
  } catch (err) {
    showAlert('alert-recursos', err.message);
  }
}

// ── 3. ALIADOS ─────────────────────────────────────────────────
function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (msg) { el.textContent = msg; el.classList.add('visible'); }
  else { el.classList.remove('visible'); el.textContent = ''; }
}
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg, tipo = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span>${tipo === 'success' ? '✅' : '❌'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
