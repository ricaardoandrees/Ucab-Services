// servicios.js

// Estado global
let servicios = [];
let userRoles = [];
let token = localStorage.getItem('token'); // Simulando que el JWT se guarda en localStorage
let esAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndRoles();
  loadServicios();
  setupEventListeners();
  setupSuplementos();
});

function checkAuthAndRoles() {
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.rol === 'admin' || payload.rol === 'director') {
      esAdmin = true;
      const btn = document.getElementById('btn-nuevo-servicio');
      if (btn) btn.style.display = 'inline-flex';
    }
  } catch (e) {
    console.warn("No se pudo parsear el token", e);
  }
}

async function loadServicios() {
  const grid = document.getElementById('services-grid');
  try {
    servicios = await api.get('/servicios');
    renderServicios(servicios);
  } catch (err) {
    grid.innerHTML = '<div class="glass-panel" style="grid-column: 1/-1; text-align: center; color: var(--danger);">Error cargando catálogo. Intenta más tarde.</div>';
    console.error(err);
  }
}

function renderServicios(data) {
  const grid = document.getElementById('services-grid');
  grid.innerHTML = '';

  if (data.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">No hay servicios disponibles con este filtro.</div>';
    return;
  }

  data.forEach(s => {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
      <div class="service-card__header">
        <span class="service-card__badge">${s.nombre_categoria}</span>
        <span class="service-card__price">$${s.precio_base}</span>
      </div>
      <h3 class="service-card__title">${s.nombre}</h3>
      <p class="service-card__desc">${s.descripcion}</p>
      <div class="service-card__meta">
        <div>📍 Sede: <strong>${s.nombre_sede}</strong></div>
        <div style="margin-top:4px">📝 Req: <strong>${s.requisitos || 'Ninguno'}</strong></div>
      </div>
      <button class="btn btn-primary w-full" onclick="solicitarServicio('${s.nombre}', ${s.numero_servicio})">Solicitar Trámite</button>
      ${esAdmin ? `<button class="btn btn-secondary w-full" style="margin-top:6px;" onclick="abrirModalSuplementos('${s.nombre.replace(/'/g, "\\'")}', ${s.numero_servicio})">🎁 Suplementos</button>` : ''}
    `;
    grid.appendChild(card);
  });
}

function solicitarServicio(nombre, numero) {
  // Redirige al formulario de solicitud (mis trámites) pasando los parámetros
  window.location.href = `../solicitudes/solicitudes.html?srv=${encodeURIComponent(nombre)}&num=${numero}&action=new`;
}

// ==========================================
// LÓGICA DEL MODAL Y FORMULARIO (ADMIN)
// ==========================================
function setupEventListeners() {
  const modal = document.getElementById('modal-servicio');
  const btnNuevo = document.getElementById('btn-nuevo-servicio');
  const btnClose = document.getElementById('btn-close-modal');
  const btnAddStep = document.getElementById('btn-add-step');
  const form = document.getElementById('form-servicio');

  if(btnNuevo) {
    btnNuevo.addEventListener('click', () => modal.classList.add('open'));
  }
  btnClose.addEventListener('click', () => modal.classList.remove('open'));

  // Espacio físico asociado (opcional)
  const chkTieneEspacio = document.getElementById('s_tiene_espacio');
  const espacioContainer = document.getElementById('s_espacio_container');
  const selectEspacio = document.getElementById('s_espacio');
  let espaciosCargados = false;

  chkTieneEspacio.addEventListener('change', () => {
    espacioContainer.style.display = chkTieneEspacio.checked ? 'block' : 'none';
    if (chkTieneEspacio.checked && !espaciosCargados) {
      espaciosCargados = true;
      api.get('/infraestructura/espacios').then(data => {
        selectEspacio.innerHTML = '<option value="">Seleccione un espacio</option>';
        data.espacios.forEach(e => {
          const opt = document.createElement('option');
          opt.value = JSON.stringify({ numero: e.numero, edificio: e.nombre_edif, direccion: e.direccion_exacta, sede: e.nombre_sede });
          opt.textContent = `${e.nombre} — ${e.nombre_edif} (${e.nombre_sede})`;
          selectEspacio.appendChild(opt);
        });
      }).catch(() => {
        selectEspacio.innerHTML = '<option value="">Error al cargar espacios</option>';
      });
    }
  });

  // Filtros
  document.getElementById('filter-category').addEventListener('change', filterServices);
  document.getElementById('search-service').addEventListener('input', filterServices);

  // Agregar paso dinámico
  btnAddStep.addEventListener('click', () => {
    const container = document.getElementById('steps-container');
    const stepCount = container.children.length + 1;
    
    const row = document.createElement('div');
    row.className = 'step-row';
    row.innerHTML = `
      <span class="step-number">${stepCount}</span>
      <input type="text" class="field__input step-desc" style="flex:2" placeholder="Descripción del paso" required>
      <select class="field__select step-unidad" style="flex:1" required>
        <option value="Caja">Caja</option>
        <option value="Secretaria">Secretaría</option>
        <option value="Seguridad">Seguridad</option>
        <option value="Oficina">Oficina General</option>
      </select>
    `;
    container.appendChild(row);
  });

  // Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      nombre: document.getElementById('s_nombre').value,
      categoria: document.getElementById('s_categoria').value,
      precio_base: document.getElementById('s_precio').value,
      sede: document.getElementById('s_sede').value,
      ep: document.getElementById('s_ep').value,
      requisitos: document.getElementById('s_requisitos').value,
      descripcion: document.getElementById('s_descripcion').value
    };

    const tieneEspacio = document.getElementById('s_tiene_espacio').checked;
    const espacioValue = document.getElementById('s_espacio').value;
    if (tieneEspacio && !espacioValue) {
      return alert('Selecciona el espacio físico correspondiente a este servicio.');
    }
    const espacio = tieneEspacio ? JSON.parse(espacioValue) : null;

    try {
      // 1. Crear el servicio
      const resServicio = await api.post('/servicios', {
        nombre: data.nombre,
        requisitos: data.requisitos,
        descripcion: data.descripcion,
        precio_base: data.precio_base,
        nombre_categoria: data.categoria,
        ID_EP: data.ep,
        nombre_sede: data.sede,
        espacio
      });
      
      const nuevoNumero = resServicio.servicio.numero_servicio;

      // 2. Crear las plantillas (pasos)
      const rows = document.querySelectorAll('.step-row');
      for (let i = 0; i < rows.length; i++) {
        const desc = rows[i].querySelector('.step-desc').value;
        const unidad = rows[i].querySelector('.step-unidad').value;

        await api.post(`/servicios/${encodeURIComponent(data.nombre)}/${nuevoNumero}/plantillas`, {
          numero_paso: i + 1,
          descripcion: desc,
          unidad_responsable: unidad
        });
      }

      alert('Servicio y Pasos creados exitosamente');
      modal.classList.remove('open');
      form.reset();
      espacioContainer.style.display = 'none';
      loadServicios(); // Recargar catálogo

    } catch (err) {
      alert(err.message);
    }
  });
}

function filterServices() {
  const cat = document.getElementById('filter-category').value;
  const term = document.getElementById('search-service').value.toLowerCase();

  const filtered = servicios.filter(s => {
    const matchCat = cat === 'todas' || s.nombre_categoria === cat;
    const matchTerm = s.nombre.toLowerCase().includes(term) || s.descripcion.toLowerCase().includes(term);
    return matchCat && matchTerm;
  });

  renderServicios(filtered);
}

// ==========================================
// SUPLEMENTOS (HU-63 a HU-66)
// ==========================================
let suplementoServicioActual = null; // { nombre, numero }

function setupSuplementos() {
  document.getElementById('btn-close-suplementos').addEventListener('click', cerrarModalSuplementos);
  document.getElementById('btn-cerrar-suplementos').addEventListener('click', cerrarModalSuplementos);
  document.getElementById('form-suplemento-nuevo').addEventListener('submit', submitSuplementoNuevo);
}

function cerrarModalSuplementos() {
  document.getElementById('modal-suplementos').classList.remove('open');
}

async function abrirModalSuplementos(nombre, numero) {
  suplementoServicioActual = { nombre, numero };
  document.getElementById('sup-servicio-nombre').textContent = nombre;
  document.getElementById('form-suplemento-nuevo').reset();
  await loadSuplementosList();
  document.getElementById('modal-suplementos').classList.add('open');
}

async function loadSuplementosList() {
  const ul = document.getElementById('list-suplementos');
  ul.innerHTML = '<li>Cargando...</li>';
  const { nombre, numero } = suplementoServicioActual;

  try {
    const suplementos = await api.get(`/servicios/${encodeURIComponent(nombre)}/${numero}/suplementos`);
    if (suplementos.length === 0) {
      ul.innerHTML = '<li style="color: var(--text-muted, #666);">Este servicio no tiene suplementos registrados.</li>';
      return;
    }
    ul.innerHTML = suplementos.map(s => `
      <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
        <span>${s.concepto} — <strong>$${Number(s.precio_unitario).toFixed(2)}</strong></span>
        <span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="editarSuplemento('${s.concepto.replace(/'/g, "\\'")}', ${s.precio_unitario})">✏️</button>
          <button type="button" class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="eliminarSuplemento('${s.concepto.replace(/'/g, "\\'")}')">✖</button>
        </span>
      </li>
    `).join('');
  } catch (err) {
    ul.innerHTML = `<li style="color: red;">Error: ${err.message}</li>`;
  }
}

async function submitSuplementoNuevo(e) {
  e.preventDefault();
  const concepto = document.getElementById('sup_concepto').value.trim();
  const precio_unitario = parseFloat(document.getElementById('sup_precio').value);
  const { nombre, numero } = suplementoServicioActual;

  try {
    await api.post(`/servicios/${encodeURIComponent(nombre)}/${numero}/suplementos`, { concepto, precio_unitario });
    document.getElementById('form-suplemento-nuevo').reset();
    loadSuplementosList();
  } catch (err) {
    alert(err.message);
  }
}

async function editarSuplemento(concepto, precioActual) {
  const nuevoPrecio = prompt(`Nuevo precio unitario para "${concepto}":`, precioActual);
  if (nuevoPrecio === null) return;
  const precio_unitario = parseFloat(nuevoPrecio);
  if (isNaN(precio_unitario) || precio_unitario <= 0) {
    return alert('El precio debe ser un número mayor a cero.');
  }

  const { nombre, numero } = suplementoServicioActual;
  try {
    await api.put(`/servicios/${encodeURIComponent(nombre)}/${numero}/suplementos/${encodeURIComponent(concepto)}`, { precio_unitario });
    loadSuplementosList();
  } catch (err) {
    alert(err.message);
  }
}

async function eliminarSuplemento(concepto) {
  if (!confirm(`¿Eliminar el suplemento "${concepto}"?`)) return;
  const { nombre, numero } = suplementoServicioActual;
  try {
    await api.delete(`/servicios/${encodeURIComponent(nombre)}/${numero}/suplementos/${encodeURIComponent(concepto)}`);
    loadSuplementosList();
  } catch (err) {
    alert(err.message);
  }
}
