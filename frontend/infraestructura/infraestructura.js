/* ============================================================
   infraestructura.js — HU-37 a HU-47
============================================================ */

const API = 'http://localhost:3000/api/infraestructura';
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


      if (targetId === 'tab-espacios') loadEspacios();
      if (targetId === 'tab-edificaciones') loadEdificaciones();
      if (targetId === 'tab-sedes') loadSedes();
      if (targetId === 'tab-aliados') loadAliados();
    });
  });

  // Mostrar tabs/botones según rol
  if (isPrivileged) {
    document.getElementById('btn-tab-sedes').style.display = 'inline-block';
    document.getElementById('btn-add-sede').style.display = 'inline-flex';
    document.getElementById('btn-tab-aliados').style.display = 'inline-block';
  } else {
    document.getElementById('btn-add-aliado').style.display = 'none';
  }
  if (isPrivileged) {
    document.getElementById('btn-add-edificacion').style.display = 'inline-flex';
    document.getElementById('btn-add-espacio').style.display = 'inline-flex';
  }

  // Event Listeners Botones Añadir
  document.getElementById('btn-add-sede')?.addEventListener('click', openModalSedeCrear);
  document.getElementById('btn-add-edificacion')?.addEventListener('click', openModalEdifCrear);
  document.getElementById('btn-add-espacio')?.addEventListener('click', openModalEspacioCrear);
  document.getElementById('btn-add-aliado')?.addEventListener('click', openModalAliadoCrear);

  // Cargar tab inicial
  loadEspacios();
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
        <td>${esc(e.nombre || 'General')}</td>
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

// ── 4. SEDES (Solo Admin/Director) ─────────────────────────────────
async function loadSedes() {
  if (!isPrivileged) return;
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

// ── 5. ALIADOS / ENTIDADES EXTERNAS (HU-44, HU-46) ─────────
async function loadAliados() {
  if (!isPrivileged) return;
  const tbody = document.getElementById('tbody-aliados');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Cargando...</td></tr>`;
  try {
    const data = await apiFetch('GET', '/entidades-externas');
    if (data.entidades.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No hay aliados registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.entidades.map(a => `
      <tr>
        <td><b>${esc(a.rif)}</b></td>
        <td>${esc(a.razon_social)}</td>
        <td class="td-muted">${new Date(a.fecha_vencimiento).toLocaleDateString()}</td>
        <td>${esc(a.tipo)}</td>
        <td>
          ${a.correo
            ? `<span class="badge badge--green">${esc(a.correo)}</span>`
            : `<span class="badge badge--red">Sin acceso</span>`}
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='openModalAliadoCredenciales(${JSON.stringify(a).replace(/'/g, "&apos;")})'>
            🔑 ${a.correo ? 'Resetear acceso' : 'Habilitar acceso'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">❌ ${err.message}</td></tr>`;
  }
}

let modoAliadoForm = 'crear';
let editAliadoRif = null;

function openModalAliadoCrear() {
  modoAliadoForm = 'crear';
  editAliadoRif = null;
  document.getElementById('title-aliado').textContent = 'Añadir Aliado Externo';
  document.getElementById('form-aliado').reset();
  document.getElementById('inp-aliado-rif').disabled = false;
  document.getElementById('inp-aliado-razon').disabled = false;
  document.getElementById('inp-aliado-vencimiento').disabled = false;
  document.getElementById('inp-aliado-tipo').disabled = false;
  document.getElementById('aliado-credenciales-hint').textContent =
    'Correo y contraseña para que el aliado pueda entrar a publicar servicios y ofertas laborales (opcional, se puede habilitar después).';
  showAlert('alert-aliado', '');
  abrirModal('modal-aliado');
}

function openModalAliadoCredenciales(a) {
  modoAliadoForm = 'credenciales';
  editAliadoRif = a.rif;
  document.getElementById('title-aliado').textContent = `Credenciales de acceso — ${a.razon_social}`;
  document.getElementById('form-aliado').reset();

  document.getElementById('inp-aliado-rif').value = a.rif;
  document.getElementById('inp-aliado-rif').disabled = true;
  document.getElementById('inp-aliado-razon').value = a.razon_social;
  document.getElementById('inp-aliado-razon').disabled = true;
  document.getElementById('inp-aliado-vencimiento').value = a.fecha_vencimiento.substring(0, 10);
  document.getElementById('inp-aliado-vencimiento').disabled = true;
  document.getElementById('inp-aliado-tipo').value = a.tipo;
  document.getElementById('inp-aliado-tipo').disabled = true;

  document.getElementById('inp-aliado-correo').value = a.correo || '';
  document.getElementById('aliado-credenciales-hint').textContent =
    a.correo
      ? 'Esta entidad ya tiene acceso. Completa correo y una contraseña nueva para resetearlo.'
      : 'Esta entidad todavía no puede entrar a la plataforma. Asígnale correo y contraseña para habilitarla.';

  showAlert('alert-aliado', '');
  abrirModal('modal-aliado');
}

async function submitAliado(e) {
  e.preventDefault();
  const correo = document.getElementById('inp-aliado-correo').value.trim();
  const contrasena = document.getElementById('inp-aliado-password').value;

  try {
    if (modoAliadoForm === 'crear') {
      const RIF = document.getElementById('inp-aliado-rif').value.trim();
      const razon_social = document.getElementById('inp-aliado-razon').value.trim();
      const fecha_vencimiento = document.getElementById('inp-aliado-vencimiento').value;
      const tipo = document.getElementById('inp-aliado-tipo').value;

      await apiFetch('POST', '/entidades-externas', {
        RIF, razon_social, fecha_vencimiento, tipo,
        correo: correo || null,
        contrasena: contrasena || null
      });
      toast('Aliado externo registrado.');
    } else {
      if (!correo || !contrasena) {
        return showAlert('alert-aliado', 'Correo y contraseña son obligatorios para habilitar el acceso.');
      }
      await apiFetch('PATCH', `/entidades-externas/${encodeURIComponent(editAliadoRif)}/credenciales`, { correo, contrasena });
      toast('Credenciales actualizadas.');
    }
    cerrarModal('modal-aliado');
    loadAliados();
  } catch (err) {
    showAlert('alert-aliado', err.message);
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
  document.getElementById('inp-esp-nombre').value = e.nombre || '';
  
  showAlert('alert-espacio', '');
  abrirModal('modal-espacio');
}
async function submitEspacio(e) {
  e.preventDefault();
  const capacidad_max = parseInt(document.getElementById('inp-esp-cap').value, 10);
  const disponibilidad = document.getElementById('inp-esp-disp').value;
  const nombre = document.getElementById('inp-esp-nombre').value;
  
  try {
    if (modoForm === 'crear') {
      const numero = parseInt(document.getElementById('inp-esp-numero').value, 10);
      const nombre_edif = document.getElementById('inp-esp-edif').value;
      const nombre_sede = document.getElementById('inp-esp-sede').value;
      
      await apiFetch('POST', '/espacios', { numero, nombre_edif, nombre_sede, capacidad_max, disponibilidad, nombre });
      toast('Espacio registrado.');
    } else {
      const numero = parseInt(document.getElementById('inp-esp-numero').value, 10);
      const nombre_edif = document.getElementById('inp-esp-edif').value;
      const nombre_sede = document.getElementById('inp-esp-sede').value;

      await apiFetch('PUT', `/espacios/${editEspNum}/${encodeURIComponent(editEspEdif)}/${encodeURIComponent(editEspSede)}`, { numero, nombre_edif, nombre_sede, capacidad_max, disponibilidad, nombre });
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


