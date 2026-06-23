/* ============================================================
   lista.js — Consola de Control de Usuarios (admin/director)
   HU-03: listar miembros
   HU-06: eliminar miembro
   HU-07: (enlace a edición futura)
   HU-09: cambiar estado de cuenta
   HU-10: ver historial de sesiones
   Incluye: búsqueda, filtro, ordenamiento y paginación.
============================================================ */

// ── Estado global ─────────────────────────────────────────
let todos       = [];     // todos los miembros cargados
let filtrados   = [];     // después de búsqueda y filtro
let paginaActual = 1;
const POR_PAGINA = 10;
let ordenCol    = 'primer_apellido';
let ordenAsc    = true;

// CI del miembro sobre el que se está actuando en el modal
let ciActivo    = null;

// ── Toast ─────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${tipo} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Modales ───────────────────────────────────────────────
function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }

// Cerrar al clickear el backdrop
document.querySelectorAll('.modal-backdrop').forEach(b => {
  b.addEventListener('click', e => { if (e.target === b) cerrarModal(b.id); });
});

// ── Cargar miembros ───────────────────────────────────────
async function cargarMiembros() {
  try {
    todos = await api.get('/miembros');
    aplicarFiltros();
  } catch (err) {
    document.getElementById('skeleton').style.display = 'none';
    document.getElementById('tbody').innerHTML =
      `<tr><td colspan="5" class="empty">Error al cargar: ${err.message}</td></tr>`;
  }
}

// ── Filtrar + ordenar ─────────────────────────────────────
function aplicarFiltros() {
  const busq   = document.getElementById('buscador').value.trim().toLowerCase();
  const estado = document.getElementById('filtro-estado').value;

  filtrados = todos.filter(m => {
    const nombre = `${m.primer_nombre} ${m.primer_apellido}`.toLowerCase();
    const matchBusq = !busq ||
      nombre.includes(busq) ||
      m.ci.toLowerCase().includes(busq) ||
      m.correo.toLowerCase().includes(busq);
    const matchEstado = !estado || m.estado_de_cuenta === estado;
    return matchBusq && matchEstado;
  });

  // Ordenar
  filtrados.sort((a, b) => {
    let va = a[ordenCol] || '';
    let vb = b[ordenCol] || '';
    if (ordenCol === 'nombre') {
      va = `${a.primer_apellido} ${a.primer_nombre}`;
      vb = `${b.primer_apellido} ${b.primer_nombre}`;
    }
    return ordenAsc
      ? va.localeCompare(vb)
      : vb.localeCompare(va);
  });

  paginaActual = 1;
  renderTabla();
}

// ── Renderizar tabla ──────────────────────────────────────
function renderTabla() {
  document.getElementById('skeleton').style.display = 'none';

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const pagina = filtrados.slice(inicio, inicio + POR_PAGINA);
  const tbody  = document.getElementById('tbody');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No se encontraron miembros.</td></tr>`;
    renderPaginacion();
    return;
  }

  tbody.innerHTML = pagina.map(m => {
    const nombre = `${m.primer_nombre} ${m.segundo_nombre || ''} ${m.primer_apellido} ${m.segundo_apellido || ''}`.trim();
    const estado = m.estado_de_cuenta?.toLowerCase();
    return `
      <tr>
        <td class="td-ci">${m.ci}</td>
        <td class="td-nombre">${nombre}</td>
        <td class="td-correo">${m.correo}</td>
        <td><span class="badge badge--${estado}">${m.estado_de_cuenta}</span></td>
        <td>
          <div class="acciones">
            <!-- Ver sesiones (HU-10) -->
            <button class="btn-icon" title="Ver sesiones" onclick="verSesiones('${m.ci}','${nombre}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </button>
            <!-- Cambiar estado (HU-09) -->
            <button class="btn-icon warning" title="Cambiar estado" onclick="abrirCambiarEstado('${m.ci}','${nombre}','${m.estado_de_cuenta}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            </button>
            <!-- Eliminar (HU-06) -->
            <button class="btn-icon danger" title="Eliminar miembro" onclick="abrirEliminar('${m.ci}','${nombre}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPaginacion();
}

// ── Paginación ────────────────────────────────────────────
function renderPaginacion() {
  const total  = Math.ceil(filtrados.length / POR_PAGINA);
  const inicio = (paginaActual - 1) * POR_PAGINA + 1;
  const fin    = Math.min(paginaActual * POR_PAGINA, filtrados.length);
  const pag    = document.getElementById('paginacion');

  if (filtrados.length === 0) { pag.innerHTML = ''; return; }

  let btns = '';
  for (let i = 1; i <= total; i++) {
    btns += `<button class="pag-btn ${i === paginaActual ? 'active' : ''}" onclick="irPagina(${i})">${i}</button>`;
  }

  pag.innerHTML = `
    <span>Mostrando ${inicio}–${fin} de ${filtrados.length} miembros</span>
    <div class="pag-btns">
      <button class="pag-btn" onclick="irPagina(${paginaActual - 1})" ${paginaActual === 1 ? 'disabled' : ''}>‹</button>
      ${btns}
      <button class="pag-btn" onclick="irPagina(${paginaActual + 1})" ${paginaActual === total ? 'disabled' : ''}>›</button>
    </div>`;
}

function irPagina(n) {
  const total = Math.ceil(filtrados.length / POR_PAGINA);
  if (n < 1 || n > total) return;
  paginaActual = n;
  renderTabla();
}

// ── Ordenamiento por columna ──────────────────────────────
document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (ordenCol === col) {
      ordenAsc = !ordenAsc;
    } else {
      ordenCol = col;
      ordenAsc = true;
    }
    document.querySelectorAll('th.sortable').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    th.querySelector('.sort-icon').textContent = ordenAsc ? '↑' : '↓';
    aplicarFiltros();
  });
});

// ── Búsqueda y filtro en tiempo real ──────────────────────
document.getElementById('buscador').addEventListener('input', aplicarFiltros);
document.getElementById('filtro-estado').addEventListener('change', aplicarFiltros);

// ── HU-09: Cambiar estado ─────────────────────────────────
function abrirCambiarEstado(ci, nombre, estadoActual) {
  ciActivo = ci;
  document.getElementById('modal-estado-nombre').textContent = nombre;
  document.getElementById('select-estado').value = estadoActual;
  abrirModal('modal-estado');
}

document.getElementById('btn-confirmar-estado').addEventListener('click', async () => {
  const nuevoEstado = document.getElementById('select-estado').value;
  try {
    await api.patch(`/miembros/${ciActivo}/estado`, { estado_de_cuenta: nuevoEstado });
    // Actualizar localmente sin recargar todo
    const m = todos.find(x => x.ci === ciActivo);
    if (m) m.estado_de_cuenta = nuevoEstado;
    aplicarFiltros();
    cerrarModal('modal-estado');
    toast(`Estado actualizado a "${nuevoEstado}".`);
  } catch (err) {
    toast(err.message || 'Error al actualizar estado.', 'error');
  }
});

// ── HU-06: Eliminar ───────────────────────────────────────
function abrirEliminar(ci, nombre) {
  ciActivo = ci;
  document.getElementById('modal-eliminar-nombre').textContent = nombre;
  abrirModal('modal-eliminar');
}

document.getElementById('btn-confirmar-eliminar').addEventListener('click', async () => {
  try {
    await api.delete(`/miembros/${ciActivo}`);
    todos = todos.filter(m => m.ci !== ciActivo);
    aplicarFiltros();
    cerrarModal('modal-eliminar');
    toast('Miembro eliminado correctamente.');
  } catch (err) {
    toast(err.message || 'Error al eliminar.', 'error');
  }
});

// ── HU-10: Ver sesiones ───────────────────────────────────
async function verSesiones(ci, nombre) {
  document.getElementById('modal-sesiones-nombre').textContent = nombre;
  document.getElementById('sesiones-contenido').innerHTML =
    '<div class="skeleton-row"></div><div class="skeleton-row"></div>';
  abrirModal('modal-sesiones');

  try {
    const sesiones = await api.get(`/miembros/${ci}/sesiones`);

    if (!sesiones || sesiones.length === 0) {
      document.getElementById('sesiones-contenido').innerHTML =
        '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Sin sesiones registradas.</p>';
      return;
    }

    document.getElementById('sesiones-contenido').innerHTML = `
      <table class="sesiones-tabla">
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Dispositivo (UID)</th>
            <th>Geolocalización</th>
            <th>Intentos fallidos</th>
            <th>MFA</th>
          </tr>
        </thead>
        <tbody>
          ${sesiones.map(s => `
            <tr>
              <td>${new Date(s.fecha_inicio).toLocaleString('es-VE')}</td>
              <td style="font-family:monospace;font-size:12px">${s.uid_dispositivo}</td>
              <td>${s.geolocalizacion || '—'}</td>
              <td class="${s.intentos_fallidos > 0 ? 'intentos-n' : 'intentos-0'}">${s.intentos_fallidos ?? 0}</td>
              <td>${s.mfa || 'Inactivo'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    document.getElementById('sesiones-contenido').innerHTML =
      `<p style="color:var(--error);font-size:13px">Error: ${err.message}</p>`;
  }
}

// ── Inicializar ───────────────────────────────────────────
cargarMiembros();
