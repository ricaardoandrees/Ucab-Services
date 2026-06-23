/* ============================================================
   aliados.js — HU-46
============================================================ */

const API    = 'http://localhost:3001/api/aliados';
const token  = localStorage.getItem('token');
let usuario  = null;

// Parse JWT
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    usuario = payload;
  } catch (e) {
    console.error('Token inválido', e);
  }
}

if (!token || !usuario) {
  window.location.href = '../login/login.html';
}

const isAdmin = usuario.rol === 'admin';

if (!isAdmin) {
  // Solo los admin pueden gestionar aliados
  window.location.href = '../miembros/miembros.html';
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAliados();
});



async function apiFetch(method, endpoint, body = null) {
  const headers = { 'Authorization': `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  
  const res = await fetch(API + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la petición');
  return data;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── 1. ALIADOS ──────────────────────────────────────────────
let modoForm = 'crear';
let editAliadoRif = null;

async function loadAliados() {
  const tbody = document.getElementById('tbody-aliados');
  tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Cargando...</td></tr>`;
  try {
    const data = await apiFetch('GET', '');
    if (data.aliados.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No hay aliados registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.aliados.map(a => {
      const contactosStr = a.contactos && a.contactos.length > 0 
        ? a.contactos.map(c => `${esc(c.nombre)} (${esc(c.telefono)})`).join('<br>')
        : '—';
      return `
      <tr>
        <td>${esc(a.rif)}</td>
        <td><b>${esc(a.razon_social)}</b></td>
        <td>${new Date(a.fecha_vencimiento).toLocaleDateString()}</td>
        <td><span class="badge badge--gray">${esc(a.tipo)}</span></td>
        <td class="td-muted" style="font-size:12px;">${contactosStr}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick='openModalAliadoEditar(${JSON.stringify(a).replace(/'/g, "&apos;")})'>✏️ Editar</button>
        </td>
      </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">❌ ${err.message}</td></tr>`;
  }
}

function openModalAliadoCrear() {
  modoForm = 'crear';
  document.getElementById('form-aliado').reset();
  document.getElementById('inp-al-rif').disabled = false;
  showAlert('alert-aliado', '');
  abrirModal('modal-aliado');
}

function openModalAliadoEditar(a) {
  modoForm = 'editar';
  editAliadoRif = a.rif;
  document.getElementById('inp-al-rif').value = a.rif;
  document.getElementById('inp-al-rif').disabled = true; // RIF es PK, no se puede editar
  document.getElementById('inp-al-razon').value = a.razon_social;
  document.getElementById('inp-al-tipo').value = a.tipo;
  
  // Format Date for input type="date" (YYYY-MM-DD)
  const d = new Date(a.fecha_vencimiento);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  document.getElementById('inp-al-vence').value = `${year}-${month}-${day}`;
  
  showAlert('alert-aliado', '');
  abrirModal('modal-aliado');
}

async function submitAliado(e) {
  e.preventDefault();
  const RIF = document.getElementById('inp-al-rif').value.trim();
  const razon_social = document.getElementById('inp-al-razon').value.trim();
  const tipo = document.getElementById('inp-al-tipo').value;
  const fecha_vencimiento = document.getElementById('inp-al-vence').value;
  
  try {
    if (modoForm === 'crear') {
      await apiFetch('POST', '', { RIF, razon_social, fecha_vencimiento, tipo, contactos: [] });
      toast('Aliado registrado con éxito.');
    } else {
      await apiFetch('PUT', `/${encodeURIComponent(editAliadoRif)}`, { razon_social, fecha_vencimiento, tipo });
      toast('Aliado actualizado con éxito.');
    }
    cerrarModal('modal-aliado');
    loadAliados();
  } catch (err) {
    showAlert('alert-aliado', err.message);
  }
}

// ── Modales ───────────────────────────────────────────────
function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = msg;
  el.style.display = 'block';
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
