// servicios.js

// Estado global
let servicios = [];
let userRoles = [];
let token = localStorage.getItem('token'); // Simulando que el JWT se guarda en localStorage

document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndRoles();
  loadServicios();
  setupEventListeners();
});

function checkAuthAndRoles() {
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.rol === 'admin' || payload.rol === 'director') {
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
