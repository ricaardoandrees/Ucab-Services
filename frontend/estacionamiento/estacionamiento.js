// estacionamiento.js

const API = 'http://localhost:3000/api/estacionamiento';
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('usuario');
const rol = userStr ? JSON.parse(userStr).rol : null;
const esAdmin = ['admin', 'director'].includes(rol);

let estacionamientosData = [];
let currentFilter = 'Todos';

document.addEventListener('DOMContentLoaded', () => {
  if (esAdmin) {
    document.getElementById('btn-nuevo-estacionamiento').style.display = 'inline-block';
    document.getElementById('btn-add-puestos').style.display = 'inline-block';
  }

  loadEstacionamientos();

  // Listeners
  document.getElementById('filtro-sede').addEventListener('change', updateEstacionamientoDropdown);
  document.getElementById('btn-buscar').addEventListener('click', renderGrid);

  // Filtros de leyenda
  document.querySelectorAll('#filtros-leyenda span').forEach(span => {
    span.addEventListener('click', (e) => {
      currentFilter = e.target.getAttribute('data-filter');
      // Destacar filtro activo (opcional)
      document.querySelectorAll('#filtros-leyenda span').forEach(s => s.style.opacity = '0.5');
      e.target.style.opacity = '1';
      renderGrid();
    });
  });

  // Init UI filter state
  document.querySelectorAll('#filtros-leyenda span').forEach(s => {
    if (s.getAttribute('data-filter') !== 'Todos') s.style.opacity = '0.5';
  });

  // Modals
  const modalEst = document.getElementById('modal-est');
  const modalPuesto = document.getElementById('modal-puesto');

  document.getElementById('btn-nuevo-estacionamiento').addEventListener('click', () => modalEst.classList.add('show'));
  document.getElementById('btn-close-est').addEventListener('click', () => modalEst.classList.remove('show'));

  document.getElementById('btn-add-puestos').addEventListener('click', () => {
    if(!document.getElementById('filtro-estacionamiento').value) {
      return alert("Selecciona un estacionamiento primero.");
    }
    modalPuesto.classList.add('show');
  });
  document.getElementById('btn-close-puesto').addEventListener('click', () => modalPuesto.classList.remove('show'));

  // Forms
  document.getElementById('form-est').addEventListener('submit', createEstacionamiento);
  document.getElementById('form-puesto').addEventListener('submit', createPuesto);
});

async function apiFetch(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

async function loadEstacionamientos() {
  try {
    estacionamientosData = await apiFetch('GET', '');
    updateEstacionamientoDropdown();
  } catch (err) {
    console.error(err);
    alert('Error cargando estacionamientos: ' + err.message);
  }
}

function updateEstacionamientoDropdown() {
  const sede = document.getElementById('filtro-sede').value;
  const select = document.getElementById('filtro-estacionamiento');
  select.innerHTML = '';
  
  const filtrados = estacionamientosData.filter(e => e.nombre_sede.toLowerCase() === sede.toLowerCase());
  
  if (filtrados.length === 0) {
    select.innerHTML = '<option value="">No hay estacionamientos en esta sede</option>';
    return;
  }

  filtrados.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.nombre;
    opt.textContent = e.nombre;
    select.appendChild(opt);
  });
}

function renderGrid() {
  const sede = document.getElementById('filtro-sede').value;
  const nombreEst = document.getElementById('filtro-estacionamiento').value;
  const grid = document.getElementById('grid-puestos');
  
  const est = estacionamientosData.find(e => e.nombre === nombreEst && e.nombre_sede.toLowerCase() === sede.toLowerCase());

  if (!est || !est.puestos || est.puestos.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p class="empty-state__msg">Este estacionamiento no tiene puestos registrados aún.</p></div>';
    return;
  }

  const puestosFiltrados = currentFilter === 'Todos' 
    ? est.puestos 
    : est.puestos.filter(p => {
        if (currentFilter === 'Ocupado') return ['Ocupado', 'Reservado'].includes(p.estado);
        if (currentFilter === 'Mantenimiento') return p.estado === 'En Mantenimiento';
        return p.estado === currentFilter;
      });

  if (puestosFiltrados.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p class="empty-state__msg">No hay puestos con el estado: ${currentFilter}</p></div>`;
    return;
  }

  grid.innerHTML = puestosFiltrados.map(p => {
    let icon = p.tipo_vehiculo.toLowerCase() === 'moto' ? '🏍️' : '🚗';
    return `
      <div class="parking-spot status-${p.estado.toLowerCase().replace(' ', '')}" 
           onclick="handleSpotClick('${p.numero}', '${p.estado}', '${p.tipo_vehiculo}')" style="position:relative;">
        ${esAdmin ? `<button title="Editar Estado" style="position:absolute; top:2px; right:2px; background:none; border:none; cursor:pointer; font-size:12px;" onclick="event.stopPropagation(); changeStatus('${p.numero}', '${p.estado}')">✏️</button>` : ''}
        <span class="spot-number">${p.numero}</span>
        <span class="spot-type">${icon} ${p.tipo_vehiculo}</span>
        <small style="margin-top:5px; font-size:10px; font-weight:bold;">${p.estado}</small>
      </div>
    `;
  }).join('');
}

function handleSpotClick(numero, estadoActual, tipoPuesto) {
  const sede = document.getElementById('filtro-sede').value;
  const nombreEst = document.getElementById('filtro-estacionamiento').value;

  if (estadoActual.toLowerCase() === 'libre') {
    // 1. Validar si tiene vehículo
    fetch('http://localhost:3000/api/vehiculos', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.total === 0) {
        return alert("No puedes reservar un puesto de estacionamiento porque no tienes ningún vehículo registrado en el sistema. Por favor, registra tu vehículo primero en el módulo de Vehículos.");
      }
      
      // 2. Validar que tenga el tipo de vehículo correcto (Moto o Carro)
      const tieneTipoCorrecto = data.vehiculos.some(v => v.tipo.toLowerCase() === tipoPuesto.toLowerCase());
      
      if (!tieneTipoCorrecto) {
        return alert(`No puedes reservar este puesto porque es exclusivo para ${tipoPuesto}, y no tienes ningún vehículo de este tipo registrado.`);
      }

      // 3. Si tiene vehículo correcto, procedemos con la confirmación
      const confirmacion = confirm(`¿Deseas reservar el puesto ${numero} en ${nombreEst}? Serás redirigido al formulario de solicitud.`);
      if (confirmacion) {
        window.location.href = `../solicitudes/solicitudes.html?action=new_reserva&puesto=${numero}&est=${nombreEst}&sede=${sede}`;
      }
    }).catch(err => alert("Error verificando vehículos: " + err.message));
  } else {
    alert("Este puesto no está libre.");
  }
}

function changeStatus(numero, estadoActual) {
  const sede = document.getElementById('filtro-sede').value;
  const nombreEst = document.getElementById('filtro-estacionamiento').value;

  const nuevoEstado = prompt(`Cambiar estado del puesto ${numero} (Libre, Ocupado, Reservado, En Mantenimiento):`, estadoActual);
  
  if (nuevoEstado && nuevoEstado !== estadoActual) {
    const permitidos = ['Libre', 'Ocupado', 'Reservado', 'En Mantenimiento'];
    if (!permitidos.includes(nuevoEstado)) {
      return alert("Estado inválido. Usa uno de: Libre, Ocupado, Reservado, En Mantenimiento.");
    }

    apiFetch('PATCH', '/puestos', {
      numero, nombre_estacionamiento: nombreEst, nombre_sede: sede, estado: nuevoEstado
    }).then(() => {
      alert("Estado actualizado.");
      loadEstacionamientos();
      setTimeout(renderGrid, 500);
    }).catch(err => alert("Error: " + err.message));
  }
}

async function createEstacionamiento(e) {
  e.preventDefault();
  const nombre = document.getElementById('est_nombre').value;
  const sede = document.getElementById('est_sede').value;
  const ubic = document.getElementById('est_ubic').value;
  const cap = document.getElementById('est_capacidad').value;

  try {
    await apiFetch('POST', '', { nombre, nombre_sede: sede, ubicacion: ubic, capacidad_maxima: cap });
    alert("Estacionamiento creado");
    document.getElementById('modal-est').classList.remove('show');
    loadEstacionamientos();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

async function createPuesto(e) {
  e.preventDefault();
  const sede = document.getElementById('filtro-sede').value;
  const est = document.getElementById('filtro-estacionamiento').value;
  const tipo = document.getElementById('puesto_tipo').value;

  try {
    await apiFetch('POST', '/puestos', { nombre_estacionamiento: est, nombre_sede: sede, tipo_vehiculo: tipo });
    alert("Puesto creado");
    document.getElementById('modal-puesto').classList.remove('show');
    loadEstacionamientos();
  } catch (err) {
    alert("Error: " + err.message);
  }
}
