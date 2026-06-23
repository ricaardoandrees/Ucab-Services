/*  ============================================================
    vehiculos.js — Lógica HU-89 a HU-92
    Endpoints:
      POST   /api/vehiculos            → HU-89 Registrar
      GET    /api/vehiculos            → HU-90 Mis vehículos
      DELETE /api/vehiculos/:placa     → HU-91 Eliminar
      GET    /api/vehiculos/miembro/:ci→ HU-92 Admin consulta
    ============================================================ */

const API = 'http://localhost:3001/api';

// ── Sesión ───────────────────────────────────────────────
const token  = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!token || !usuario) {
  window.location.href = '../login/login.html';
}

// ── DOM refs ─────────────────────────────────────────────
const tbody         = document.getElementById('tbody-vehiculos');
const badgeTotal    = document.getElementById('badge-total');
const panelAdmin    = document.getElementById('panel-admin');
const modalRegistrar= document.getElementById('modal-registrar');
const modalConfirm  = document.getElementById('modal-confirm');
const formVehiculo  = document.getElementById('form-vehiculo');
const alertModal    = document.getElementById('alert-modal');
const btnGuardar    = document.getElementById('btn-guardar');
const btnGuardarTxt = document.getElementById('btn-guardar-text');

// ── Inicialización ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Rol admin/director → mostrar panel de búsqueda
  if (usuario.rol === 'admin' || usuario.rol === 'director') {
    panelAdmin.style.display = 'block';
    document.getElementById('btn-buscar-ci').addEventListener('click', buscarPorCI);
  }

  // Botones modal
  document.getElementById('btn-abrir-modal').addEventListener('click', abrirModal);
  document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);

  formVehiculo.addEventListener('submit', registrarVehiculo);

  cargarMisVehiculos();
});

// ── API helper ───────────────────────────────────────────
async function apiFetch(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── HU-90: Cargar mis vehículos ──────────────────────────
async function cargarMisVehiculos() {
  tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Cargando...</td></tr>';
  try {
    const data = await apiFetch('GET', '/vehiculos');
    renderTabla(data.vehiculos, tbody, true);
    badgeTotal.textContent = `${data.total} vehículo${data.total !== 1 ? 's' : ''}`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">❌ ${err.message}</td></tr>`;
  }
}

// ── Render tabla ─────────────────────────────────────────
function renderTabla(vehiculos, tbodyEl, mostrarAcciones) {
  if (!vehiculos || vehiculos.length === 0) {
    tbodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">No hay vehículos registrados.</td></tr>';
    return;
  }

  tbodyEl.innerHTML = vehiculos.map(v => `
    <tr>
      <td><strong>${esc(v.placa)}</strong></td>
      <td>${esc(v.modelo)}</td>
      <td>${esc(v.color)}</td>
      <td><span class="td-badge">${esc(v.tipo)}</span></td>
      <td class="td-muted">${esc(v.ano)}</td>
      <td>
        ${mostrarAcciones
          ? `<button class="btn btn-danger-outline"
               onclick="confirmarEliminar('${esc(v.placa)}')">
               🗑 Eliminar
             </button>`
          : '—'}
      </td>
    </tr>
  `).join('');
}

// ── HU-91: Confirmar y eliminar ──────────────────────────
let placaPendiente = null;

function confirmarEliminar(placa) {
  placaPendiente = placa;
  document.getElementById('confirm-msg').textContent =
    `¿Seguro que deseas eliminar el vehículo con placa ${placa}? Esta acción no se puede deshacer.`;
  modalConfirm.classList.add('open');

  document.getElementById('btn-confirm-si').onclick = async () => {
    modalConfirm.classList.remove('open');
    await eliminarVehiculo(placaPendiente);
  };
  document.getElementById('btn-confirm-no').onclick = () => {
    modalConfirm.classList.remove('open');
  };
}

async function eliminarVehiculo(placa) {
  try {
    await apiFetch('DELETE', `/vehiculos/${encodeURIComponent(placa)}`);
    toast('Vehículo eliminado correctamente.', 'success');
    cargarMisVehiculos();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── HU-89: Registrar vehículo ────────────────────────────
function abrirModal() {
  formVehiculo.reset();
  limpiarErrores();
  alertModal.classList.remove('visible');
  modalRegistrar.classList.add('open');
  document.getElementById('inp-placa').focus();
}

function cerrarModal() {
  modalRegistrar.classList.remove('open');
}

async function registrarVehiculo(e) {
  e.preventDefault();
  if (!validarForm()) return;

  const placa  = document.getElementById('inp-placa').value.trim().toUpperCase();
  const tipo   = document.getElementById('inp-tipo').value;
  const modelo = document.getElementById('inp-modelo').value.trim();
  const color  = document.getElementById('inp-color').value.trim();
  const ano    = parseInt(document.getElementById('inp-ano').value);

  btnGuardar.disabled  = true;
  btnGuardarTxt.textContent = 'Guardando...';
  alertModal.classList.remove('visible');

  try {
    await apiFetch('POST', '/vehiculos', { placa, tipo, modelo, color, ano });
    cerrarModal();
    toast('Vehículo registrado exitosamente.', 'success');
    cargarMisVehiculos();
  } catch (err) {
    alertModal.textContent = err.message;
    alertModal.classList.add('visible');
  } finally {
    btnGuardar.disabled = false;
    btnGuardarTxt.textContent = 'Guardar';
  }
}

function validarForm() {
  let ok = true;
  const campos = [
    { id: 'inp-placa',  err: 'err-placa',  msg: 'La placa es obligatoria.'  },
    { id: 'inp-tipo',   err: 'err-tipo',   msg: 'Selecciona el tipo.'        },
    { id: 'inp-modelo', err: 'err-modelo', msg: 'El modelo es obligatorio.'  },
    { id: 'inp-color',  err: 'err-color',  msg: 'El color es obligatorio.'   },
    { id: 'inp-ano',    err: 'err-ano',    msg: 'El año es obligatorio.'      },
  ];

  limpiarErrores();
  campos.forEach(({ id, err, msg }) => {
    const val = document.getElementById(id).value.trim();
    if (!val) {
      document.getElementById(err).textContent = msg;
      document.getElementById(id).classList.add('is-error');
      ok = false;
    }
  });

  const ano = parseInt(document.getElementById('inp-ano').value);
  if (ano && (ano < 1970 || ano > 2030)) {
    document.getElementById('err-ano').textContent = 'Año inválido (1970-2030).';
    ok = false;
  }

  return ok;
}

function limpiarErrores() {
  ['err-placa','err-tipo','err-modelo','err-color','err-ano'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['inp-placa','inp-tipo','inp-modelo','inp-color','inp-ano'].forEach(id => {
    document.getElementById(id).classList.remove('is-error');
  });
}

// ── HU-92: Admin busca vehículos por CI ──────────────────
async function buscarPorCI() {
  const ci = document.getElementById('inp-ci-buscar').value.trim();
  const contenedor = document.getElementById('resultado-admin');

  if (!ci) {
    contenedor.innerHTML = '<p style="color:var(--error);font-size:13px">Ingresa una cédula.</p>';
    return;
  }

  contenedor.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Buscando...</p>';

  try {
    const data = await apiFetch('GET', `/vehiculos/miembro/${encodeURIComponent(ci)}`);

    const tbodyId = 'tbody-admin-result';
    contenedor.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px">
        Vehículos de <strong>${esc(data.miembro.nombre)}</strong>
        (CI: ${esc(data.miembro.CI)}) — ${data.total} registrado${data.total !== 1 ? 's' : ''}
      </p>
      <div class="table-wrap" style="border:1px solid var(--border);border-radius:var(--radius-input)">
        <table>
          <thead>
            <tr>
              <th>Placa</th><th>Modelo</th><th>Color</th><th>Tipo</th><th>Año</th>
            </tr>
          </thead>
          <tbody id="${tbodyId}"></tbody>
        </table>
      </div>
    `;

    renderTabla(data.vehiculos, document.getElementById(tbodyId), false);

  } catch (err) {
    contenedor.innerHTML = `<p style="color:var(--error);font-size:13px">❌ ${err.message}</p>`;
  }
}

// ── Logout ────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, tipo = 'success') {
  const wrap  = document.getElementById('toast-wrap');
  const el    = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span>${tipo === 'success' ? '✅' : '❌'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
