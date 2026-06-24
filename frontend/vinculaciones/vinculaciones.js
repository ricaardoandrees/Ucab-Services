let todos        = [];
let filtrados    = [];
let paginaActual = 1;
const POR_PAGINA = 10;
let ciActivo     = null;
let nombreActivo = null;

function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${tipo} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

async function cargarDatos() {
  try {
    const miembros = await api.get('/miembros');
    todos = await Promise.all(miembros.map(async (m) => {
      try {
        const data = await api.get(`/vinculaciones/${m.ci}`);
        const { periodos, especializaciones } = data;
        const activa   = periodos?.find(v => !v.fecha_fin);
        const subtipos = especializaciones?.map(e => e.subtipo).join(', ') || 'Sin rol';
        return { ...m, subtipos, especializaciones: especializaciones || [], periodoActivo: !!activa };
      } catch {
        return { ...m, subtipos: 'Sin rol', especializaciones: [], periodoActivo: false };
      }
    }));
    aplicarFiltros();
  } catch (err) {
    document.getElementById('skeleton').style.display = 'none';
    document.getElementById('tbody').innerHTML =
      `<tr><td colspan="5" class="empty">Error al cargar: ${err.message}</td></tr>`;
  }
}

function aplicarFiltros() {
  const busq    = document.getElementById('buscador').value.trim().toLowerCase();
  const subtipo = document.getElementById('filtro-subtipo').value;
  filtrados = todos.filter(m => {
    const nombre       = `${m.primer_nombre} ${m.primer_apellido}`.toLowerCase();
    const matchBusq    = !busq    || nombre.includes(busq) || m.ci.toLowerCase().includes(busq);
    const matchSubtipo = !subtipo || m.subtipos.includes(subtipo);
    return matchBusq && matchSubtipo;
  });
  paginaActual = 1;
  renderTabla();
}

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
    const nombre  = `${m.primer_nombre} ${m.primer_apellido}`;
    const periodo = m.periodoActivo
      ? `<span class="badge badge--activo">Activo</span>`
      : `<span class="badge badge--inactivo">Sin período</span>`;

    return `
      <tr>
        <td class="td-ci">${m.ci}</td>
        <td class="td-nombre">${nombre}</td>
        <td><span class="badge badge--subtipo">${m.subtipos}</span></td>
        <td>${periodo}</td>
        <td>
          <div class="acciones">
            <button class="btn-icon success" title="Añadir rol" data-ci="${m.ci}" data-nombre="${nombre}" data-action="anadir">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="btn-icon danger" title="Gestionar roles" data-ci="${m.ci}" data-nombre="${nombre}" data-action="gestionar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPaginacion();
}

function renderPaginacion() {
  const total  = Math.ceil(filtrados.length / POR_PAGINA);
  const inicio = (paginaActual - 1) * POR_PAGINA + 1;
  const fin    = Math.min(paginaActual * POR_PAGINA, filtrados.length);
  const pag    = document.getElementById('paginacion');
  if (filtrados.length === 0) { pag.innerHTML = ''; return; }
  let btns = '';
  for (let i = 1; i <= total; i++) {
    btns += `<button class="pag-btn ${i === paginaActual ? 'active' : ''}" data-pag="${i}">${i}</button>`;
  }
  pag.innerHTML = `
    <span>Mostrando ${inicio}–${fin} de ${filtrados.length} miembros</span>
    <div class="pag-btns">
      <button class="pag-btn" data-pag="${paginaActual - 1}" ${paginaActual === 1 ? 'disabled' : ''}>‹</button>
      ${btns}
      <button class="pag-btn" data-pag="${paginaActual + 1}" ${paginaActual === total ? 'disabled' : ''}>›</button>
    </div>`;
}

// Campos dinámicos
const CAMPOS = {
  estudiante: `
    <div class="grid-2">
      <div class="field"><label class="field__label">Promedio ponderado</label><input class="field__input" id="f-promedio" type="number" step="0.01" min="0" max="20" /></div>
      <div class="field"><label class="field__label">Semestre actual</label><input class="field__input" id="f-semestre" type="number" /></div>
      <div class="field"><label class="field__label">UC aprobadas</label><input class="field__input" id="f-uc" type="number" /></div>
      <div class="field"><label class="field__label">Escuela</label><input class="field__input" id="f-escuela" type="text" /></div>
    </div>
    <div class="field"><label class="field__label">Facultad</label><input class="field__input" id="f-facultad" type="text" /></div>`,
  becario: `
    <div class="grid-2">
      <div class="field"><label class="field__label">Tipo de beca</label>
        <select class="field__input" id="f-tipo-beca">
          <option value="Comedor">Comedor</option>
          <option value="Excelencia">Excelencia</option>
          <option value="Ayuda Economica">Ayuda Económica</option>
        </select>
      </div>
      <div class="field"><label class="field__label">Estatus</label>
        <select class="field__input" id="f-estatus">
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </div>
    </div>`,
  preparador: `
    <div class="grid-2">
      <div class="field"><label class="field__label">Asignatura</label><input class="field__input" id="f-asignatura" type="text" /></div>
      <div class="field"><label class="field__label">Horas de ayudantía</label><input class="field__input" id="f-horas" type="number" /></div>
    </div>`,
  profesor: `
    <div class="grid-2">
      <div class="field"><label class="field__label">Carga horaria</label><input class="field__input" id="f-carga" type="number" /></div>
      <div class="field"><label class="field__label">Escalafón</label><input class="field__input" id="f-escalafon" type="text" /></div>
      <div class="field"><label class="field__label">Cód. investigador</label><input class="field__input" id="f-codinv" type="number" placeholder="Opcional" /></div>
    </div>`,
  personaladmin: `
    <div class="grid-2">
      <div class="field"><label class="field__label">Cargo</label><input class="field__input" id="f-cargo" type="text" placeholder="Director, Cajero..." /></div>
      <div class="field"><label class="field__label">Carga semanal (hrs)</label><input class="field__input" id="f-carga-semanal" type="number" /></div>
    </div>
    <div class="field"><label class="field__label">Adscripción presupuestaria</label><input class="field__input" id="f-adscripcion" type="text" /></div>`,
  egresado: `
    <div class="grid-2">
      <div class="field"><label class="field__label">Título</label><input class="field__input" id="f-titulo" type="text" /></div>
      <div class="field"><label class="field__label">Año de graduación</label><input class="field__input" id="f-ano" type="number" /></div>
      <div class="field"><label class="field__label">Índice final</label><input class="field__input" id="f-indice" type="number" step="0.01" /></div>
    </div>`,
};

// Delegación de eventos tabla
document.getElementById('tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { ci, action, nombre } = btn.dataset;
  ciActivo     = ci;
  nombreActivo = nombre;

  if (action === 'anadir') {
    document.getElementById('modal-anadir-nombre').textContent = nombre;
    document.getElementById('select-subtipo').value = '';
    document.getElementById('campos-subtipo').innerHTML = '';
    document.getElementById('modal-anadir').style.display = 'flex';
  }

  if (action === 'gestionar') {
    document.getElementById('modal-roles-nombre').textContent = nombre;
    const miembro = todos.find(m => m.ci === ci);
    const lista   = document.getElementById('lista-roles-actuales');

    if (!miembro.especializaciones || miembro.especializaciones.length === 0) {
      lista.innerHTML = '<p style="color:var(--muted);font-size:13px">Este miembro no tiene roles asignados.</p>';
    } else {
      lista.innerHTML = miembro.especializaciones.map(e => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:0.5px solid var(--border)">
          <span style="font-weight:500;color:var(--text)">${e.subtipo}</span>
          <button class="btn-icon danger" data-quitar="${e.subtipo.toLowerCase().replace('personaladministrativo','personaladmin')}" title="Quitar rol">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>`).join('');
    }

    // También mostrar opción de cerrar período si está activo
    if (miembro.periodoActivo) {
      lista.innerHTML += `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
          <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Período de vinculación</p>
          <button class="btn-primary" style="width:100%;background:#D93025" id="btn-cerrar-periodo">Cerrar período activo</button>
        </div>`;
    }

    document.getElementById('modal-roles').style.display = 'flex';
  }
});

// Quitar rol desde modal de gestión
document.getElementById('lista-roles-actuales').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-quitar]');
  if (btn) {
    const tipo = btn.dataset.quitar;
    if (!confirm(`¿Quitar el rol ${tipo} de este miembro?`)) return;
    try {
      await api.delete(`/vinculaciones/${ciActivo}/rol/${tipo}`);
      toast('Rol eliminado correctamente.');
      document.getElementById('modal-roles').style.display = 'none';
      await cargarDatos();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (e.target.id === 'btn-cerrar-periodo') {
    if (!confirm('¿Cerrar el período activo?')) return;
    try {
      await api.patch(`/vinculaciones/${ciActivo}/cerrar`, {});
      toast('Período cerrado.');
      document.getElementById('modal-roles').style.display = 'none';
      await cargarDatos();
    } catch (err) { toast(err.message, 'error'); }
  }
});

// Campos dinámicos al cambiar subtipo
document.getElementById('select-subtipo').addEventListener('change', (e) => {
  document.getElementById('campos-subtipo').innerHTML = CAMPOS[e.target.value] || '';
});

// Confirmar añadir rol
document.getElementById('btn-confirmar-anadir').addEventListener('click', async () => {
  const tipo = document.getElementById('select-subtipo').value;
  if (!tipo) { toast('Selecciona un tipo de rol.', 'error'); return; }

  let body = {};
  if (tipo === 'estudiante') {
    body = { promedio_ponderado: parseFloat(document.getElementById('f-promedio').value), semestre_actual: parseInt(document.getElementById('f-semestre').value), uc_aprobadas: parseInt(document.getElementById('f-uc').value), escuela: document.getElementById('f-escuela').value, facultad: document.getElementById('f-facultad').value };
  } else if (tipo === 'becario') {
    body = { tipo_beca: document.getElementById('f-tipo-beca').value, estatus_beneficio: document.getElementById('f-estatus').value };
  } else if (tipo === 'preparador') {
    body = { asignatura: document.getElementById('f-asignatura').value, horas: parseInt(document.getElementById('f-horas').value) };
  } else if (tipo === 'profesor') {
    body = { carga_horaria: parseInt(document.getElementById('f-carga').value), escalafon: document.getElementById('f-escalafon').value, cod_investigador: document.getElementById('f-codinv').value || null };
  } else if (tipo === 'personaladmin') {
    body = { cargo: document.getElementById('f-cargo').value, carga_semanal: parseInt(document.getElementById('f-carga-semanal').value), adscripcion_presupuestaria: document.getElementById('f-adscripcion').value };
  } else if (tipo === 'egresado') {
    body = { titulo: document.getElementById('f-titulo').value, ano_graduacion: parseInt(document.getElementById('f-ano').value), indice_final: parseFloat(document.getElementById('f-indice').value) };
  }

  try {
    // Guardar datos del rol
    await api.put(`/vinculaciones/${ciActivo}/${tipo}`, body);
    // Abrir período con el rol si no tiene uno activo
    const miembro = todos.find(m => m.ci === ciActivo);
    if (!miembro.periodoActivo) {
      const rolLabel = {
        estudiante:    'Estudiante',
        becario:       'Becario',
        preparador:    'Preparador',
        profesor:      'Profesor',
        personaladmin: 'PersonalAdministrativo',
        egresado:      'Egresado',
      }[tipo];
      await api.post(`/vinculaciones/${ciActivo}`, { rol: rolLabel });
    }
    document.getElementById('modal-anadir').style.display = 'none';
    toast('Rol añadido correctamente.');
    await cargarDatos();
  } catch (err) { toast(err.message || 'Error al guardar.', 'error'); }
});

// Cerrar modales
document.getElementById('btn-cerrar-anadir').addEventListener('click',   () => document.getElementById('modal-anadir').style.display = 'none');
document.getElementById('btn-cancelar-anadir').addEventListener('click',  () => document.getElementById('modal-anadir').style.display = 'none');
document.getElementById('btn-cerrar-roles').addEventListener('click',    () => document.getElementById('modal-roles').style.display = 'none');
document.getElementById('btn-cancelar-roles').addEventListener('click',  () => document.getElementById('modal-roles').style.display = 'none');

// Paginación
document.getElementById('paginacion').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pag]');
  if (!btn || btn.disabled) return;
  const n = parseInt(btn.dataset.pag);
  const total = Math.ceil(filtrados.length / POR_PAGINA);
  if (n < 1 || n > total) return;
  paginaActual = n;
  renderTabla();
});

document.getElementById('buscador').addEventListener('input', aplicarFiltros);
document.getElementById('filtro-subtipo').addEventListener('change', aplicarFiltros);

cargarDatos();
