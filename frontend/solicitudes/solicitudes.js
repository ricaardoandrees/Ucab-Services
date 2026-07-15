// solicitudes.js

let token = localStorage.getItem('token');
let userRoles = [];
let uploadedDocs = []; // Simulación de base64/urls

let formState = {
  isPuesto: false,
  isEspacio: false
};
let selectedBlocks = [];
let bookedBlocks = [];
let detalleActual = null; // raw_fecha de la solicitud abierta en el modal de detalle

function badgeClassFor(estado) {
  if (estado === 'Completada') return 'success';
  if (estado === 'En Proceso') return 'warning';
  return 'primary'; // Cancelada
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndRouting();
  setupFileInput();
  setupDetalleModal();
  loadMyRequests();
  checkSecretariaPanel();
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
      document.getElementById('reserva-desc').textContent = `Puesto asignado: ${puesto} en ${est} (${sede}). Por favor selecciona la fecha y los bloques.`;
      document.getElementById('req_fecha').required = true;
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

        // El espacio ya viene fijo desde el catálogo (Servicio.numero_espacio),
        // el cliente no lo elige: solo selecciona fecha y bloques horarios.
        if (s.numero_espacio && !puesto) {
          document.getElementById('acompanantes-section').style.display = 'block';
          document.getElementById('reserva-section').style.display = 'block';
          document.getElementById('select-espacio-container').style.display = 'block';
          document.getElementById('req_fecha').required = true;

          document.getElementById('req_espacio').value = JSON.stringify({
            numero: s.numero_espacio,
            edificio: s.nombre_edif,
            direccion: s.direccion_exacta,
            sede: s.nombre_sede_espacio
          });
          document.getElementById('req_espacio_nombre').value = `${s.nombre_edif} — ${s.nombre_sede_espacio}`;
          document.getElementById('reserva-desc').textContent = `Espacio asignado: ${s.nombre_edif} (${s.nombre_sede_espacio}). Por favor selecciona la fecha y los bloques horarios.`;
        }
      } else {
        document.getElementById('req-service-name').textContent = 'Servicio no encontrado';
        document.getElementById('req-service-desc').textContent = 'Por favor, asegúrate de que exista un servicio de Reserva de Estacionamiento en el catálogo.';
      }
    }).catch(err => console.error(err));
  }

  // Listener de bloques horarios: una sola vez, no en cada submit
  document.getElementById('req_fecha').addEventListener('change', fetchAvailability);
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

  setupAcompanantes();

  document.getElementById('form-solicitud').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('req_nombre').value;
    const numero = document.getElementById('req_numero').value;
    
    const params = new URLSearchParams(window.location.search);
    let reservaPayload = null;
    
    if (params.get('puesto') || (document.getElementById('req_espacio') && document.getElementById('req_espacio').value)) {
      if (selectedBlocks.length === 0) {
        return alert("Debes seleccionar al menos un bloque horario.");
      }
      if (selectedBlocks.length > MAX_BLOQUES_HORARIO) {
        return alert(`Solo puedes seleccionar hasta ${MAX_BLOQUES_HORARIO} bloques horarios.`);
      }

      const dateVal = document.getElementById('req_fecha').value;
      const sortedBlocks = selectedBlocks.sort((a,b) => a - b);
      
      // Validar contiguos
      for (let i = 0; i < sortedBlocks.length - 1; i++) {
        if (sortedBlocks[i+1] !== sortedBlocks[i] + 1) {
          return alert("Los bloques seleccionados deben ser continuos.");
        }
      }

      const start = `${dateVal}T${String(sortedBlocks[0]).padStart(2, '0')}:00`;
      const end = `${dateVal}T${String(sortedBlocks[sortedBlocks.length - 1] + 1).padStart(2, '0')}:00`;

      if (params.get('puesto')) {
        reservaPayload = {
          fecha_llegada: start,
          fecha_salida: end,
          puesto: {
            numero: params.get('puesto'),
            estacionamiento: params.get('est'),
            sede: params.get('sede')
          }
        };
      } else {
        // El espacio ya lo determina el backend a partir del Servicio; aquí
        // solo se manda el horario pedido.
        reservaPayload = { fecha_llegada: start, fecha_salida: end };
      }
    }

    // Extraer acompañantes
    const acompanantes = [];
    document.querySelectorAll('.acomp-row').forEach(row => {
      const doc = row.querySelector('.acomp-doc').value.trim();
      const nom = row.querySelector('.acomp-name').value.trim();
      if (doc && nom) {
        acompanantes.push({ documento_identidad: doc, nombre: nom });
      }
    });

    try {
      await api.post(`/servicios/${encodeURIComponent(nombre)}/${numero}/solicitudes`, { 
        documentos: uploadedDocs,
        reserva: reservaPayload,
        acompanantes: acompanantes.length > 0 ? acompanantes : null
      });

      alert('¡Solicitud procesada con éxito!');
      cancelarSolicitud();
      loadMyRequests();

    } catch (err) {
      alert(err.message);
    }
  });
}

function setupAcompanantes() {
  const btnAdd = document.getElementById('btn-add-acomp');
  const list = document.getElementById('acompanantes-list');
  if (!btnAdd || !list) return;

  btnAdd.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'acomp-row';
    row.style = 'display:flex; gap:10px; align-items:center;';
    
    row.innerHTML = `
      <input type="text" class="field__input acomp-doc" placeholder="Documento ID" style="flex:1" required>
      <input type="text" class="field__input acomp-name" placeholder="Nombre Completo" style="flex:2" required>
      <button type="button" class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="this.parentElement.remove()">✖</button>
    `;
    list.appendChild(row);
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
        <button class="btn btn-secondary btn-sm" onclick="abrirDetalle('${p.raw_fecha}')">
          Ver Solicitud
        </button>
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
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
    `;

    misSolicitudes.forEach(s => {
      const fecha = new Date(s.fecha_hora_creacion).toLocaleString();
      html += `<tr>
                 <td>${fecha}</td>
                 <td>${s.nombre_servicio}</td>
                 <td><span class="badge badge--${badgeClassFor(s.estado)}">${s.estado}</span></td>
                 <td><button class="btn btn-secondary btn-sm" onclick="abrirDetalle('${s.raw_fecha}')">Ver detalle</button></td>
               </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    
  } catch (err) {
    alert("Error cargando tus solicitudes: " + err.message);
  }
}

// ==========================================
// PANEL DE SECRETARÍA — TODAS LAS SOLICITUDES
// ==========================================
async function checkSecretariaPanel() {
  if (!token) return;
  let payload;
  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return;
  }
  // Solo el personal administrativo puede pertenecer a Secretaria; a los
  // demas roles ni les preguntamos para no gastar una llamada al backend.
  if (payload.rol !== 'admin' && payload.rol !== 'director') return;

  try {
    const todas = await api.get('/servicios/solicitudes');
    document.getElementById('panel-secretaria').style.display = 'block';
    renderTodasSolicitudes(todas);
  } catch (err) {
    // 403: este funcionario no es de Secretaria, el panel se queda oculto
  }
}

function renderTodasSolicitudes(rows) {
  const tbody = document.getElementById('todas-solicitudes-tbody');
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay solicitudes registradas.</td></tr>';
    return;
  }

  rows.forEach(s => {
    const fecha = new Date(s.fecha_hora_creacion).toLocaleString();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${s.nombre_servicio}</td>
      <td>${s.ci}</td>
      <td><span class="badge badge--${badgeClassFor(s.estado)}">${s.estado}</span></td>
      <td><button class="btn btn-primary btn-sm" onclick="abrirDetalle('${s.raw_fecha}')">Ver detalle</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// MODAL DE DETALLE DE SOLICITUD (HU-57/60/61/62)
// ==========================================
function setupDetalleModal() {
  document.getElementById('btn-close-detalle').addEventListener('click', cerrarDetalle);
  document.getElementById('btn-cerrar-detalle').addEventListener('click', cerrarDetalle);

  document.getElementById('det-docs-input').addEventListener('change', async (e) => {
    const urls = Array.from(e.target.files).map(f => `/uploads/${Date.now()}_${f.name}`);
    if (urls.length === 0) return;
    try {
      await api.post(`/servicios/solicitudes/${encodeURIComponent(detalleActual)}/documentos`, { documentos: urls });
      abrirDetalle(detalleActual);
    } catch (err) {
      alert('No se pudo agregar el documento: ' + err.message);
    }
  });

  document.getElementById('btn-add-acomp-detalle').addEventListener('click', async () => {
    const doc = document.getElementById('det-acomp-doc').value.trim();
    const nombre = document.getElementById('det-acomp-nombre').value.trim();
    if (!doc || !nombre) return alert('Completa documento y nombre del acompañante.');
    try {
      await api.post(`/servicios/solicitudes/${encodeURIComponent(detalleActual)}/acompanantes`, { documento_identidad: doc, nombre });
      document.getElementById('det-acomp-doc').value = '';
      document.getElementById('det-acomp-nombre').value = '';
      abrirDetalle(detalleActual);
    } catch (err) {
      alert('No se pudo agregar el acompañante: ' + err.message);
    }
  });

  document.getElementById('btn-reprogramar').addEventListener('click', async () => {
    const inicio = document.getElementById('det-reprog-inicio').value;
    const fin = document.getElementById('det-reprog-fin').value;
    if (!inicio || !fin) return alert('Completa la nueva llegada y salida.');
    try {
      await api.patch(`/servicios/solicitudes/${encodeURIComponent(detalleActual)}`, { fecha_llegada: inicio, fecha_salida: fin });
      alert('Reserva reprogramada.');
      abrirDetalle(detalleActual);
    } catch (err) {
      alert('No se pudo reprogramar: ' + err.message);
    }
  });

  document.getElementById('btn-cancelar-solicitud').addEventListener('click', async () => {
    if (!confirm('¿Cancelar esta solicitud? Esta acción no se puede deshacer.')) return;
    try {
      await api.patch(`/servicios/solicitudes/${encodeURIComponent(detalleActual)}/cancelar`);
      alert('Solicitud cancelada.');
      cerrarDetalle();
      loadMyRequests();
      checkSecretariaPanel();
    } catch (err) {
      alert('No se pudo cancelar: ' + err.message);
    }
  });
}

async function abrirDetalle(rawFecha) {
  detalleActual = rawFecha;
  try {
    const data = await api.get(`/servicios/solicitudes/${encodeURIComponent(rawFecha)}`);
    renderDetalle(data);
    document.getElementById('modal-detalle-solicitud').classList.add('open');
  } catch (err) {
    alert('No se pudo cargar el detalle: ' + err.message);
  }
}

function cerrarDetalle() {
  document.getElementById('modal-detalle-solicitud').classList.remove('open');
  detalleActual = null;
}

function renderDetalle(data) {
  const { solicitud, documentos, acompanantes, reserva, pasos } = data;
  // El backend ya decide si este usuario puede editar (dueño o Secretaria);
  // aparte de eso, igual solo tiene sentido mientras siga En Proceso.
  const editable = data.puedeEditar && solicitud.estado === 'En Proceso';

  document.getElementById('det-servicio-nombre').textContent = `${solicitud.nombre_servicio} (#${solicitud.numero_servicio})`;
  const estadoBadge = document.getElementById('det-estado');
  estadoBadge.textContent = solicitud.estado;
  estadoBadge.className = 'badge badge--' + badgeClassFor(solicitud.estado);
  document.getElementById('det-fecha').textContent = 'Creada: ' + new Date(solicitud.fecha_hora_creacion).toLocaleString();
  if (solicitud.tiempo_resolucion_dias != null) {
    document.getElementById('det-fecha').textContent += ` · Resuelta en ${solicitud.tiempo_resolucion_dias} día(s) hábil(es)`;
  }

  // Reserva
  const reservaSection = document.getElementById('det-reserva-section');
  if (reserva) {
    reservaSection.style.display = 'block';
    document.getElementById('det-reserva-info').textContent =
      `${new Date(reserva.fecha_hora).toLocaleString()} — ${new Date(reserva.fecha_hora_fin).toLocaleString()} (${reserva.estado})`;
    document.getElementById('det-reprogramar-form').style.display = (editable && reserva.estado === 'Pendiente') ? 'flex' : 'none';
  } else {
    reservaSection.style.display = 'none';
  }

  // Documentos
  const docsList = document.getElementById('det-docs-list');
  docsList.innerHTML = '';
  if (documentos.length === 0) {
    docsList.innerHTML = '<li style="color:var(--text-muted); font-size:13px;">Sin documentos cargados.</li>';
  }
  documentos.forEach(d => {
    const nombreArchivo = d.ruta_archivo.split('/').pop();
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.innerHTML = `<span>${nombreArchivo}</span>`;
    if (editable) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '✖';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.color = 'var(--danger)';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => eliminarDocumento(d.id_documento));
      li.appendChild(btn);
    }
    docsList.appendChild(li);
  });
  document.getElementById('det-docs-upload-area').style.display = editable ? 'block' : 'none';

  // Acompañantes
  const acompList = document.getElementById('det-acomp-list');
  acompList.innerHTML = '';
  if (acompanantes.length === 0) {
    acompList.innerHTML = '<li style="color:var(--text-muted); font-size:13px;">Sin acompañantes registrados.</li>';
  }
  acompanantes.forEach(a => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.padding = '4px 0';
    li.innerHTML = `<span>${a.nombre} (${a.documento_identidad})</span>`;
    if (editable) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '✖';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.color = 'var(--danger)';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => eliminarAcompanante(a.documento_identidad));
      li.appendChild(btn);
    }
    acompList.appendChild(li);
  });
  document.getElementById('det-acomp-form').style.display = editable ? 'flex' : 'none';

  // Pasos del tramite
  const pasosList = document.getElementById('det-pasos-list');
  pasosList.innerHTML = '';
  if (pasos.length === 0) {
    pasosList.innerHTML = '<li style="color:var(--text-muted);">Aún no se han generado pasos para esta solicitud.</li>';
  }
  pasos.forEach(p => {
    const li = document.createElement('li');
    const fin = p.fecha_hora_finalizado ? ` — Finalizado: ${new Date(p.fecha_hora_finalizado).toLocaleString()}` : '';
    li.textContent = `${p.descripcion} (${p.unidad_responsable}) — ${p.estado}${fin}`;
    pasosList.appendChild(li);
  });

  document.getElementById('btn-cancelar-solicitud').style.display = editable ? 'inline-flex' : 'none';
}

async function eliminarDocumento(id) {
  if (!confirm('¿Eliminar este documento?')) return;
  try {
    await api.delete(`/servicios/solicitudes/${encodeURIComponent(detalleActual)}/documentos/${id}`);
    abrirDetalle(detalleActual);
  } catch (err) {
    alert('No se pudo eliminar el documento: ' + err.message);
  }
}

async function eliminarAcompanante(documentoIdentidad) {
  if (!confirm('¿Quitar a este acompañante?')) return;
  try {
    await api.delete(`/servicios/solicitudes/${encodeURIComponent(detalleActual)}/acompanantes/${encodeURIComponent(documentoIdentidad)}`);
    abrirDetalle(detalleActual);
  } catch (err) {
    alert('No se pudo eliminar el acompañante: ' + err.message);
  }
}

// ── LÓGICA DE BLOQUES HORARIOS ──
async function fetchAvailability() {
  const fecha = document.getElementById('req_fecha').value;
  const params = new URLSearchParams(window.location.search);
  const espacioRaw = document.getElementById('req_espacio') ? document.getElementById('req_espacio').value : null;

  if (!fecha) {
    document.getElementById('time-blocks-container').style.display = 'none';
    return;
  }

  // Verificar que al menos tenga el puesto o el espacio seleccionado
  if (!params.get('puesto') && !espacioRaw) {
    document.getElementById('time-blocks-container').style.display = 'none';
    return;
  }

  let url = `/servicios/reservas/disponibilidad?fecha=${encodeURIComponent(fecha)}`;
  if (params.get('puesto')) {
    url += `&puesto=${encodeURIComponent(params.get('puesto'))}&est=${encodeURIComponent(params.get('est'))}&sede_puesto=${encodeURIComponent(params.get('sede'))}`;
  } else if (espacioRaw) {
    const esp = JSON.parse(espacioRaw);
    url += `&espacio=${encodeURIComponent(esp.numero)}&edif=${encodeURIComponent(esp.edificio)}&sede_espacio=${encodeURIComponent(esp.sede)}`;
  }

  try {
    const reservas = await api.get(url);
    bookedBlocks = [];

    // Parsear bloques ocupados
    reservas.forEach(r => {
      const startH = new Date(r.fecha_hora).getHours();
      const endH = new Date(r.fecha_hora_fin).getHours();
      for (let h = startH; h < endH; h++) {
        bookedBlocks.push(h);
      }
    });

    selectedBlocks = [];
    renderTimeBlocks();
  } catch (err) {
    console.error("Error obteniendo disponibilidad", err);
    document.getElementById('time-blocks-container').style.display = 'block';
    document.getElementById('time-blocks-grid').innerHTML = '';
    document.getElementById('time-blocks-msg').textContent = 'No se pudo cargar la disponibilidad: ' + err.message;
  }
}

const MAX_BLOQUES_HORARIO = 3;

function renderTimeBlocks() {
  document.getElementById('time-blocks-container').style.display = 'block';
  const grid = document.getElementById('time-blocks-grid');
  grid.innerHTML = '';

  for (let i = 8; i < 18; i++) {
    const isBooked = bookedBlocks.includes(i);
    const isSelected = selectedBlocks.includes(i);
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${i}:00 - ${i+1}:00`;
    btn.style.padding = '10px';
    btn.style.border = '1px solid #ccc';
    btn.style.borderRadius = '4px';
    btn.style.cursor = isBooked ? 'not-allowed' : 'pointer';
    btn.style.fontWeight = 'bold';
    btn.style.fontSize = '12px';

    if (isBooked) {
      btn.style.background = '#e9ecef';
      btn.style.color = '#adb5bd';
    } else if (isSelected) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--primary)';
    } else {
      btn.style.background = '#fff';
      btn.style.color = 'var(--text-primary)';
    }

    if (!isBooked) {
      btn.addEventListener('click', () => {
        const msg = document.getElementById('time-blocks-msg');
        if (selectedBlocks.includes(i)) {
          selectedBlocks = selectedBlocks.filter(b => b !== i);
          msg.textContent = '';
        } else if (selectedBlocks.length >= MAX_BLOQUES_HORARIO) {
          msg.textContent = `Solo puedes seleccionar hasta ${MAX_BLOQUES_HORARIO} bloques horarios.`;
          return;
        } else {
          selectedBlocks.push(i);
          msg.textContent = '';
        }
        renderTimeBlocks();
      });
    }

    grid.appendChild(btn);
  }
}
