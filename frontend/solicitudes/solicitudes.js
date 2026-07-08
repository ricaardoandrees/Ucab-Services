// solicitudes.js

let token = localStorage.getItem('token');
let userRoles = [];
let uploadedDocs = []; // Simulación de base64/urls

document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndRouting();
  setupFileInput();
  loadMyRequests();
});

function checkAuthAndRouting() {
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.rol === 'admin' || payload.rol === 'director') {
        document.getElementById('panel-funcionario').style.display = 'block';
        loadInbox();
      }
    } catch (e) {
      console.warn("Error parsing token", e);
    }
  }

  // Revisar si venimos de servicios.html con intención de solicitar
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  
  if (action === 'new' || action === 'new_reserva') {
    let srvName = params.get('srv');
    let srvNum = params.get('num');
    
    document.getElementById('new-request-container').style.display = 'block';

    // Lógica de Reserva (Estacionamiento / Espacio)
    const puesto = params.get('puesto');
    const est = params.get('est');
    const sede = params.get('sede');
    
    if (puesto) {
      document.getElementById('reserva-section').style.display = 'block';
      document.getElementById('reserva-desc').textContent = `Puesto asignado: ${puesto} en ${est} (${sede}). Por favor indica la fecha y hora en la que llegarás.`;
      document.getElementById('req_fecha_llegada').required = true;
    }

    api.get('/servicios').then(servicios => {
      let s;
      if (action === 'new_reserva' && !srvName) {
        // Buscar el servicio de estacionamiento automáticamente
        s = servicios.find(srv => srv.nombre.toLowerCase().includes('estacionamiento'));
        if (s) {
          srvName = s.nombre;
          srvNum = s.numero_servicio;
        }
      } else {
        s = servicios.find(srv => srv.nombre === srvName && String(srv.numero_servicio) === String(srvNum));
      }

      if (s) {
        document.getElementById('req-service-name').textContent = srvName;
        document.getElementById('req_nombre').value = srvName;
        document.getElementById('req_numero').value = srvNum;
        document.getElementById('req-service-desc').textContent = s.descripcion;
        document.getElementById('req-service-reqs').textContent = s.requisitos;
      } else {
        document.getElementById('req-service-name').textContent = 'Servicio no encontrado';
        document.getElementById('req-service-desc').textContent = 'Por favor, asegúrate de que exista un servicio de Reserva de Estacionamiento en el catálogo.';
      }
    }).catch(err => console.error(err));
  }
}

function cancelarSolicitud() {
  document.getElementById('new-request-container').style.display = 'none';
  window.history.replaceState({}, document.title, window.location.pathname);
}

function setupFileInput() {
  const fileInput = document.getElementById('req_docs');
  const fileList = document.getElementById('file-list');

  fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
      // Simulamos la subida (en HU-57 real iría a AWS S3 o carpeta local /uploads)
      const mockUrl = `/uploads/${Date.now()}_${file.name}`;
      uploadedDocs.push(mockUrl);
      
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      
      const text = document.createElement('span');
      text.textContent = file.name;
      
      const btnRemove = document.createElement('button');
      btnRemove.type = 'button';
      btnRemove.textContent = '✖';
      btnRemove.style.background = 'transparent';
      btnRemove.style.border = 'none';
      btnRemove.style.color = 'var(--danger)';
      btnRemove.style.cursor = 'pointer';
      
      btnRemove.addEventListener('click', () => {
        const index = uploadedDocs.indexOf(mockUrl);
        if (index > -1) uploadedDocs.splice(index, 1);
        li.remove();
      });

      li.appendChild(text);
      li.appendChild(btnRemove);
      fileList.appendChild(li);
    });
  });

  document.getElementById('form-solicitud').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('req_nombre').value;
    const numero = document.getElementById('req_numero').value;
    
    const params = new URLSearchParams(window.location.search);
    let reservaPayload = null;
    
    if (params.get('puesto')) {
      reservaPayload = {
        fecha_llegada: document.getElementById('req_fecha_llegada').value,
        puesto: {
          numero: params.get('puesto'),
          estacionamiento: params.get('est'),
          sede: params.get('sede')
        }
      };
    }

    try {
      await api.post(`/servicios/${encodeURIComponent(nombre)}/${numero}/solicitudes`, { 
        documentos: uploadedDocs,
        reserva: reservaPayload
      });

      alert('¡Solicitud procesada con éxito!');
      cancelarSolicitud();
      // Recargar lista si la tuviéramos
    } catch (err) {
      alert(err.message);
    }
  });
}

// ==========================================
// BANDEJA DEL FUNCIONARIO (HU-68)
// ==========================================
async function loadInbox() {
  try {
    const pasos = await api.get('/servicios/pasos/pendientes');
    renderInbox(pasos);
  } catch (err) {
    if (err.message === 'Acceso denegado') return;
    console.error(err);
  }
}

function renderInbox(pasos) {
  const tbody = document.getElementById('inbox-tbody');
  tbody.innerHTML = '';

  if (pasos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center">No hay pasos pendientes para tu departamento.</td></tr>';
    return;
  }

  pasos.forEach(p => {
    const fecha = new Date(p.fecha_hora_creacion_solicitud).toLocaleString();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${p.nombre_servicio}</td>
      <td>${p.solicitante}</td>
      <td><strong>Paso ${p.numero_paso}:</strong> ${p.descripcion}</td>
      <td>
        <button class="btn btn-primary btn-sm" 
                onclick="completarPaso(${p.numero_paso}, '${p.raw_fecha}')">
          Completar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function completarPaso(numero_paso, fecha_solicitud) {
  if (!confirm(`¿Marcar Paso ${numero_paso} como Completado?`)) return;

  try {
    const data = await api.patch('/servicios/pasos', {
      numero_paso: numero_paso,
      fecha_hora_creacion_solicitud: fecha_solicitud
    });

    alert(data.mensaje);
    loadInbox(); // Refrescar bandeja
  } catch (err) {
    alert('No se pudo completar el paso: ' + err.message);
  }
}

async function loadMyRequests() {
  try {
    const misSolicitudes = await api.get('/servicios/mis-solicitudes');
    const container = document.getElementById('my-requests-list');
    
    if (misSolicitudes.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center; padding: 20px;">Aún no tienes solicitudes en curso.</p>';
      return;
    }
    
    let html = `
      <div class="table-wrap" style="padding:0;">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Servicio</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    misSolicitudes.forEach(s => {
      const fecha = new Date(s.fecha_hora_creacion).toLocaleString();
      let badgeClass = s.estado === 'Completada' ? 'success' : (s.estado === 'En Proceso' ? 'warning' : 'primary');
      html += `<tr>
                 <td>${fecha}</td>
                 <td>${s.nombre_servicio}</td>
                 <td><span class="badge badge--${badgeClass}">${s.estado}</span></td>
               </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    
  } catch (err) {
    console.error('Error cargando mis solicitudes', err);
  }
}
