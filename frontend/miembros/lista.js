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
            <!-- Editar (HU-07) -->
            <button class="btn-icon" title="Editar miembro" onclick="abrirEditar('${m.ci}','${nombre}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
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

// ── HU-07: Editar miembro completo ───────────────────────
let ciEditActivo   = null;
let subtipoEditActivo = null;

async function abrirEditar(ci, nombre) {
  ciEditActivo = ci;
  document.getElementById('modal-editar-nombre').textContent = nombre;
  document.getElementById('alert-editar').style.display = 'none';

  try {
    // Cargar datos básicos
    const m = await api.get(`/miembros/${ci}`);
    document.getElementById('e-primer_nombre').value   = m.primer_nombre   || '';
    document.getElementById('e-segundo_nombre').value  = m.segundo_nombre  || '';
    document.getElementById('e-primer_apellido').value = m.primer_apellido  || '';
    document.getElementById('e-segundo_apellido').value= m.segundo_apellido || '';
    document.getElementById('e-fecha_nacimiento').value= m.fecha_nacimiento ? m.fecha_nacimiento.split('T')[0] : '';
    document.getElementById('e-sexo').value            = m.sexo            || 'M';
    document.getElementById('e-num_personal').value    = m.num_personal    || '';
    document.getElementById('e-calle1').value          = m.calle1          || '';
    document.getElementById('e-residencia').value      = m.residencia      || '';
    document.getElementById('e-estado').value          = m.estado          || '';

    // Cargar datos del rol
    const vinc = await api.get(`/vinculaciones/${ci}`);
    const { especializaciones } = vinc;
    const rolContainer = document.getElementById('editar-rol-contenido');

    if (!especializaciones || especializaciones.length === 0) {
      rolContainer.innerHTML = '<p style="color:var(--muted);font-size:13px">Sin rol asignado.</p>';
      subtipoEditActivo = null;
    } else {
      const e = especializaciones[0];
      subtipoEditActivo = e.subtipo;
      const d = e.datos || {};
      rolContainer.innerHTML = generarCamposRol(e.subtipo, d);
    }

    abrirModal('modal-editar');
  } catch (err) {
    toast('Error al cargar datos: ' + err.message, 'error');
  }
}

function generarCamposRol(subtipo, d) {
  const f = (label, id, val, type='text') =>
    `<div class="rol-field"><label>${label}</label><input class="field__input" id="er-${id}" type="${type}" value="${val || ''}" /></div>`;

  if (subtipo === 'Estudiante') return `<div class="rol-grid">
    ${f('Escuela', 'escuela', d.escuela)} ${f('Facultad', 'facultad', d.facultad)}
    ${f('Semestre', 'semestre', d.semestre_actual, 'number')} ${f('UC aprobadas', 'uc', d.uc_aprobadas, 'number')}
    ${f('Promedio (máx 20)', 'promedio', d.promedio_ponderado, 'number')}</div>`;

  if (subtipo === 'Becario') return `<div class="rol-grid">
    <div class="rol-field"><label>Tipo de beca</label><select class="field__input" id="er-tipo_beca">
      <option ${d.tipo_beca==='Comedor'?'selected':''}>Comedor</option>
      <option ${d.tipo_beca==='Excelencia'?'selected':''}>Excelencia</option>
      <option ${d.tipo_beca==='Ayuda Economica'?'selected':''}>Ayuda Economica</option>
    </select></div>
    <div class="rol-field"><label>Estatus</label><select class="field__input" id="er-estatus">
      <option ${d.estatus_beneficio==='Activo'?'selected':''}>Activo</option>
      <option ${d.estatus_beneficio==='Inactivo'?'selected':''}>Inactivo</option>
    </select></div></div>`;

  if (subtipo === 'Preparador') return `<div class="rol-grid">
    ${f('Asignatura', 'asignatura', d.asignatura)} ${f('Horas', 'horas', d.horas, 'number')}</div>`;

  if (subtipo === 'Profesor') return `<div class="rol-grid">
    ${f('Escalafón', 'escalafon', d.escalafon)} ${f('Carga horaria', 'carga_horaria', d.carga_horaria, 'number')}
    ${f('Cód. investigador', 'cod_investigador', d.cod_investigador, 'number')}</div>`;

  if (subtipo === 'PersonalAdministrativo') return `<div class="rol-grid">
    <div class="rol-field">
      <label>Cargo</label>
      <select class="field__input" id="er-cargo">
        <option value="Funcionario" ${d.cargo==='Funcionario'?'selected':''}>Funcionario</option>
        <option value="Administrador" ${d.cargo==='Administrador'?'selected':''}>Administrador</option>
        <option value="Director" ${d.cargo==='Director'?'selected':''}>Director</option>
      </select>
    </div>
    ${f('Carga semanal', 'carga_semanal', d.carga_semanal, 'number')}
    <div class="rol-field">
      <label>Adscripción presupuestaria</label>
      <select class="field__input" id="er-adscripcion">
        <option value="Oficina" ${d.adscripcion_presupuestaria==='Oficina'?'selected':''}>Oficina</option>
        <option value="Secretaria" ${d.adscripcion_presupuestaria==='Secretaria'?'selected':''}>Secretaría</option>
        <option value="Caja" ${d.adscripcion_presupuestaria==='Caja'?'selected':''}>Caja</option>
        <option value="Seguridad" ${d.adscripcion_presupuestaria==='Seguridad'?'selected':''}>Seguridad</option>
      </select>
    </div>
  </div>`;

  if (subtipo === 'Egresado') return `<div class="rol-grid">
    ${f('Título', 'titulo', d.titulo)} ${f('Año graduación', 'ano_graduacion', d.ano_graduacion, 'number')}
    ${f('Índice final (máx 20)', 'indice_final', d.indice_final, 'number')}</div>`;

  return '<p style="color:var(--muted);font-size:13px">Sin datos de rol.</p>';
}

document.getElementById('btn-confirmar-editar').addEventListener('click', async () => {
  const alertEl = document.getElementById('alert-editar');
  alertEl.style.display = 'none';

  const bodyBasico = {
    primer_nombre:   document.getElementById('e-primer_nombre').value.trim(),
    segundo_nombre:  document.getElementById('e-segundo_nombre').value.trim() || null,
    primer_apellido: document.getElementById('e-primer_apellido').value.trim(),
    segundo_apellido:document.getElementById('e-segundo_apellido').value.trim() || null,
    fecha_nacimiento:document.getElementById('e-fecha_nacimiento').value,
    sexo:            document.getElementById('e-sexo').value,
    num_personal:    document.getElementById('e-num_personal').value.trim(),
    calle1:          document.getElementById('e-calle1').value.trim(),
    residencia:      document.getElementById('e-residencia').value.trim(),
    estado:          document.getElementById('e-estado').value.trim(),
  };

  try {
    await api.put(`/miembros/${ciEditActivo}`, bodyBasico);

    // Guardar datos del rol si tiene uno
    if (subtipoEditActivo) {
      const tipoMap = {
        'Estudiante':'estudiante','Becario':'becario','Preparador':'preparador',
        'Profesor':'profesor','PersonalAdministrativo':'personaladmin','Egresado':'egresado'
      };
      const tipo = tipoMap[subtipoEditActivo];
      let bodyRol = {};

      if (tipo==='estudiante') bodyRol = { escuela:document.getElementById('er-escuela').value, facultad:document.getElementById('er-facultad').value, semestre_actual:parseInt(document.getElementById('er-semestre').value), uc_aprobadas:parseInt(document.getElementById('er-uc').value), promedio_ponderado:parseFloat(document.getElementById('er-promedio').value) };
      else if (tipo==='becario') bodyRol = { tipo_beca:document.getElementById('er-tipo_beca').value, estatus_beneficio:document.getElementById('er-estatus').value };
      else if (tipo==='preparador') bodyRol = { asignatura:document.getElementById('er-asignatura').value, horas:parseInt(document.getElementById('er-horas').value) };
      else if (tipo==='profesor') bodyRol = { escalafon:document.getElementById('er-escalafon').value, carga_horaria:parseInt(document.getElementById('er-carga_horaria').value), cod_investigador:document.getElementById('er-cod_investigador').value||null };
      else if (tipo==='personaladmin') bodyRol = { cargo:document.getElementById('er-cargo').value, carga_semanal:parseInt(document.getElementById('er-carga_semanal').value), adscripcion_presupuestaria:document.getElementById('er-adscripcion').value };
      else if (tipo==='egresado') bodyRol = { titulo:document.getElementById('er-titulo').value, ano_graduacion:parseInt(document.getElementById('er-ano_graduacion').value), indice_final:parseFloat(document.getElementById('er-indice_final').value) };

      await api.put(`/vinculaciones/${ciEditActivo}/${tipo}`, bodyRol);
    }

    cerrarModal('modal-editar');
    toast('Miembro actualizado correctamente.');
    await cargarMiembros();
  } catch (err) {
    alertEl.textContent = err.message || 'Error al guardar.';
    alertEl.style.display = 'block';
  }
});

// ── Inicializar ───────────────────────────────────────────
cargarMiembros();