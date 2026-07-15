/* ============================================================
   financiero.js — HU-71 a HU-86, HU-99
============================================================ */

const API = 'http://localhost:3000/api';
const token   = localStorage.getItem('token');
const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!token || !usuario) {
  window.location.href = '../login/login.html';
}

const esStaff = usuario.rol === 'admin' || usuario.rol === 'director';
const esAliadoExterno = usuario.rol === 'aliado_externo';

let folioActual = null; // raw_fecha de la solicitud cuyo folio esta abierto en el modal

document.addEventListener('DOMContentLoaded', () => {
  if (esStaff) {
    document.getElementById('card-buscar').style.display = 'block';
    document.getElementById('btn-buscar-ci').addEventListener('click', buscarPorCI);
  }
  document.getElementById('btn-close-folio').addEventListener('click', cerrarModalFolio);
  document.getElementById('btn-cerrar-modal-folio').addEventListener('click', cerrarModalFolio);
  document.getElementById('btn-add-item').addEventListener('click', agregarItem);
  document.getElementById('btn-cerrar-folio').addEventListener('click', cerrarFolio);

  if (esAliadoExterno) {
    document.getElementById('page-sub').textContent = 'Facturas corporativas de tu organización.';
    document.querySelector('.stats-row').parentElement; // no-op, deja el layout igual
  }

  cargarMisSolicitudes();
  cargarFacturas();
});

// ── API helper ───────────────────────────────────────────
async function apiFetch(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── HU-71/72: Mis solicitudes y sus folios ───────────────
async function cargarMisSolicitudes() {
  const tbody = document.getElementById('tbody-mis-solicitudes');
  try {
    const rows = await apiFetch('GET', '/servicios/mis-solicitudes');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Aún no tienes solicitudes.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(s => `
      <tr>
        <td class="td-muted">${new Date(s.fecha_hora_creacion).toLocaleString()}</td>
        <td>${esc(s.nombre_servicio)}</td>
        <td><span class="badge ${badgeSolicitud(s.estado)}">${esc(s.estado)}</span></td>
        <td><button class="btn btn-outline btn-sm" onclick="abrirFolio('${s.raw_fecha}', '${esc(s.nombre_servicio)}')">Ver Folio</button></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">❌ ${esc(err.message)}</td></tr>`;
  }
}

// ── HU-75: Buscar solicitudes de un miembro (Caja) ───────
async function buscarPorCI() {
  const ci = document.getElementById('buscar-ci').value.trim();
  const tbody = document.getElementById('tbody-buscar');
  if (!ci) return;

  tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Buscando...</td></tr>';
  try {
    const rows = await apiFetch('GET', `/financiero/buscar?ci=${encodeURIComponent(ci)}`);
    if (rows.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Este miembro no tiene solicitudes.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(s => `
      <tr>
        <td class="td-muted">${new Date(s.fecha_hora_creacion).toLocaleString()}</td>
        <td>${esc(s.nombre_servicio)}</td>
        <td><span class="badge ${badgeSolicitud(s.estado_solicitud)}">${esc(s.estado_solicitud)}</span></td>
        <td>${s.estado_folio ? `<span class="badge ${s.estado_folio === 'Abierto' ? 'badge--green' : 'badge--gray'}">${esc(s.estado_folio)}</span>` : '—'}</td>
        <td><button class="btn btn-outline btn-sm" onclick="abrirFolio('${s.raw_fecha}', '${esc(s.nombre_servicio)}')">Ver Folio</button></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">❌ ${esc(err.message)}</td></tr>`;
  }
}

// ── HU-77/78: Mis Facturas ────────────────────────────────
async function cargarFacturas() {
  const tbody = document.getElementById('tbody-facturas');
  try {
    const rows = await apiFetch('GET', '/financiero/facturas');

    const pendientes = rows.filter(f => f.estado !== 'Pagada');
    const totalPendiente = pendientes.reduce((acc, f) => acc + Number(f.monto_total), 0);
    document.getElementById('stat-pendiente').textContent = '$' + totalPendiente.toFixed(2);
    document.getElementById('stat-count').textContent = pendientes.length;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No tienes facturas generadas.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(f => `
      <tr>
        <td>#${f.numero_de_control}</td>
        <td class="td-muted">${new Date(f.fecha_de_emision).toLocaleDateString()}</td>
        <td>$${Number(f.monto_total).toFixed(2)}</td>
        <td><span class="badge ${badgeFactura(f.estado)}">${esc(f.estado)}</span></td>
        <td><button class="btn btn-outline btn-sm" onclick="abrirFolio('${f.raw_fecha_solicitud}', '${esc(f.nombre_servicio)}')">Ver / Pagar</button></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">❌ ${esc(err.message)}</td></tr>`;
  }
}

// ── Modal de Folio (HU-71/72/73/74/75/76 + pagos) ────────
async function abrirFolio(rawFecha, nombreServicio) {
  folioActual = rawFecha;
  document.getElementById('folio-titulo').textContent = `Folio — ${nombreServicio}`;
  document.getElementById('modal-folio').classList.add('open');
  await cargarFolio();
}

function cerrarModalFolio() {
  document.getElementById('modal-folio').classList.remove('open');
  folioActual = null;
}

async function cargarFolio() {
  try {
    const data = await apiFetch('GET', `/financiero/folio/${encodeURIComponent(folioActual)}`);
    renderFolio(data);
  } catch (err) {
    alert('No se pudo cargar el folio: ' + err.message);
    cerrarModalFolio();
  }
}

function renderFolio(data) {
  const { folio, items, total, factura, puedeGestionar } = data;

  const badge = document.getElementById('folio-estado-badge');
  badge.textContent = folio.estado;
  badge.className = 'badge ' + (folio.estado === 'Abierto' ? 'badge--green' : 'badge--gray');

  // Items
  const tbody = document.getElementById('tbody-items');
  if (items.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Sin ítems cargados.</td></tr>';
  } else {
    tbody.innerHTML = items.map(i => `
      <tr>
        <td>${esc(i.concepto)}</td>
        <td>${i.cantidad}</td>
        <td>$${Number(i.precio_unitario).toFixed(2)}</td>
        <td>$${Number(i.impuestos).toFixed(2)}</td>
        <td>$${Number(i.subtotal).toFixed(2)}</td>
        <td>${(puedeGestionar && folio.estado === 'Abierto')
          ? `<button type="button" class="btn btn-danger-outline btn-sm" onclick="eliminarItem('${esc(i.concepto)}', '${i.raw_fecha_item}')">✖</button>`
          : ''}</td>
      </tr>
    `).join('');
  }
  document.getElementById('folio-total').textContent = Number(total).toFixed(2);

  // Agregar item / cerrar folio: solo Caja, solo si Abierto
  const puedeCajaGestionar = puedeGestionar; // el backend re-valida si de verdad es Caja
  document.getElementById('folio-agregar-item').style.display = (puedeCajaGestionar && folio.estado === 'Abierto') ? 'block' : 'none';
  document.getElementById('folio-cerrar-container').style.display = (puedeCajaGestionar && folio.estado === 'Abierto' && items.length > 0) ? 'block' : 'none';

  // Factura
  const facturaSection = document.getElementById('folio-factura-section');
  if (factura) {
    facturaSection.style.display = 'block';
    document.getElementById('factura-numero').textContent = `#${factura.numero_de_control}`;
    const fBadge = document.getElementById('factura-estado-badge');
    fBadge.textContent = factura.estado;
    fBadge.className = 'badge ' + badgeFactura(factura.estado);
    document.getElementById('factura-saldo').textContent = Number(factura.saldo).toFixed(2);

    const tbodyPagos = document.getElementById('tbody-pagos');
    tbodyPagos.innerHTML = factura.pagos.length === 0
      ? '<tr class="empty-row"><td colspan="2">Sin pagos registrados.</td></tr>'
      : factura.pagos.map(p => `<tr><td class="td-muted">${new Date(p.fecha_hora_pago).toLocaleString()}</td><td>$${Number(p.monto).toFixed(2)}</td></tr>`).join('');

    renderFormularioPago(factura);
  } else {
    facturaSection.style.display = 'none';
  }
}

// ── HU-71 (pieza necesaria): agregar item ────────────────
async function agregarItem() {
  const concepto = document.getElementById('item-concepto').value.trim();
  const cantidad = parseInt(document.getElementById('item-cantidad').value, 10);
  const impuestos = parseFloat(document.getElementById('item-impuestos').value) || 0;

  if (!concepto || !cantidad || cantidad <= 0) return alert('Completa el concepto y una cantidad válida.');

  try {
    await apiFetch('POST', `/financiero/folio/${encodeURIComponent(folioActual)}/items`, { concepto, cantidad, impuestos });
    document.getElementById('item-concepto').value = '';
    document.getElementById('item-cantidad').value = 1;
    document.getElementById('item-impuestos').value = 0;
    toast('Ítem agregado.');
    cargarFolio();
  } catch (err) {
    alert(err.message);
  }
}

// ── HU-74: eliminar item ──────────────────────────────────
async function eliminarItem(concepto, rawFechaItem) {
  if (!confirm(`¿Eliminar el ítem "${concepto}"?`)) return;
  try {
    await apiFetch('DELETE', `/financiero/folio/${encodeURIComponent(folioActual)}/items/${encodeURIComponent(concepto)}/${encodeURIComponent(rawFechaItem)}`);
    toast('Ítem eliminado.');
    cargarFolio();
  } catch (err) {
    alert(err.message);
  }
}

// ── HU-76: cerrar folio y generar factura ────────────────
async function cerrarFolio() {
  const rif = document.getElementById('folio-rif').value.trim();
  if (!confirm('¿Cerrar el folio y generar la factura? Ya no se podrán agregar más ítems.')) return;
  try {
    await apiFetch('PATCH', `/financiero/folio/${encodeURIComponent(folioActual)}/cerrar`, rif ? { rif } : {});
    toast('Folio cerrado y factura generada.');
    cargarFolio();
    cargarFacturas();
  } catch (err) {
    alert(err.message);
  }
}

// ── HU-79 a HU-85: formulario de pago ────────────────────
function renderFormularioPago(factura) {
  const container = document.getElementById('factura-pagar-container');
  container.innerHTML = '';

  if (Number(factura.saldo) <= 0) {
    container.innerHTML = '<p style="color:var(--green); font-weight:600;">✔ Factura pagada en su totalidad.</p>';
    return;
  }

  const esDuenoFactura = factura.ci === usuario.CI || factura.rif === usuario.RIF;
  const metodos = [];
  if (esDuenoFactura || esStaff) metodos.push('tai');
  if (esStaff) metodos.push('zelle', 'crypto', 'tarjeta', 'movil', 'efectivo');

  if (metodos.length === 0) return;

  container.innerHTML = `
    <div class="field">
      <label class="field__label">Método de pago</label>
      <select class="field__select" id="pago-metodo">
        ${metodos.map(m => `<option value="${m}">${labelMetodo(m)}</option>`).join('')}
      </select>
    </div>
    <div id="pago-campos-extra"></div>
    <div class="field">
      <label class="field__label">Monto ($)</label>
      <input type="number" class="field__input" id="pago-monto" min="0.01" step="0.01" max="${factura.saldo}" value="${factura.saldo}">
    </div>
    <button type="button" class="btn btn-amber" id="btn-registrar-pago">Registrar Pago</button>
  `;

  document.getElementById('pago-metodo').addEventListener('change', renderCamposExtraPago);
  document.getElementById('btn-registrar-pago').addEventListener('click', () => registrarPago(factura.numero_de_control));
  renderCamposExtraPago();
}

function renderCamposExtraPago() {
  const metodo = document.getElementById('pago-metodo').value;
  const el = document.getElementById('pago-campos-extra');

  const campos = {
    tai: `<div class="field"><label class="field__label">UID del carnet (NFC)</label><input type="text" class="field__input" id="c-uid" value="TAG-${Date.now()}"></div>
          <div class="field"><label class="field__label">Terminal (POS)</label><input type="text" class="field__input" id="c-pos" value="POS-CAJA-1"></div>`,
    zelle: `<div class="field"><label class="field__label">Correo de origen</label><input type="email" class="field__input" id="c-correo"></div>
            <div class="field"><label class="field__label">Nombre del titular</label><input type="text" class="field__input" id="c-nombre-titular"></div>
            <div class="field"><label class="field__label">Código de confirmación</label><input type="text" class="field__input" id="c-codigo"></div>
            ${camposTasa()}`,
    crypto: `<div class="field"><label class="field__label">Red</label><select class="field__select" id="c-red-cripto"><option value="TRC20">TRC20</option><option value="ERC20">ERC20</option></select></div>
             <div class="field"><label class="field__label">Dirección de billetera</label><input type="text" class="field__input" id="c-billetera"></div>
             <div class="field"><label class="field__label">TXID</label><input type="text" class="field__input" id="c-txid"></div>
             ${camposTasa()}`,
    tarjeta: `<div class="form-grid">
                <div class="field"><label class="field__label">Tipo</label><select class="field__select" id="c-tipo-tarjeta"><option value="Debito">Débito</option><option value="Credito">Crédito</option></select></div>
                <div class="field"><label class="field__label">Red</label><select class="field__select" id="c-red-tarjeta"><option value="Nacional">Nacional</option><option value="Internacional">Internacional</option></select></div>
              </div>
              <div class="field"><label class="field__label">Número de tarjeta</label><input type="text" class="field__input" id="c-num-tarjeta"></div>
              <div class="form-grid">
                <div class="field"><label class="field__label">Vencimiento</label><input type="date" class="field__input" id="c-vencimiento"></div>
                <div class="field"><label class="field__label">Compañía</label><input type="text" class="field__input" id="c-compania"></div>
              </div>`,
    movil: `<div class="field"><label class="field__label">Teléfono emisor</label><input type="text" class="field__input" id="c-telefono"></div>
            <div class="field"><label class="field__label">Banco emisor</label><input type="text" class="field__input" id="c-banco"></div>
            <div class="field"><label class="field__label">N° de referencia</label><input type="text" class="field__input" id="c-referencia"></div>`,
    efectivo: `<div class="field"><label class="field__label">Moneda</label><select class="field__select" id="c-moneda-efectivo" onchange="document.getElementById('tasa-efectivo-container').style.display = this.value==='Bolivares' ? 'none' : 'block'">
                <option value="Bolivares">Bolívares</option><option value="Dolares">Dólares</option><option value="Euros">Euros</option>
              </select></div>
              <div class="field"><label class="field__label">Monto recibido</label><input type="number" class="field__input" id="c-monto-recibido" step="0.01"></div>
              <div id="tasa-efectivo-container" style="display:none;">${camposTasa()}</div>`
  };

  el.innerHTML = campos[metodo] || '';
}

function camposTasa() {
  return `<div class="form-grid">
    <div class="field"><label class="field__label">Moneda de la tasa</label><input type="text" class="field__input" id="c-moneda-tasa" placeholder="USD, USDT..."></div>
    <div class="field"><label class="field__label">Tasa BCV</label><input type="number" class="field__input" id="c-tasa" step="0.01"></div>
  </div>`;
}

function labelMetodo(m) {
  return { tai: '📱 TAI (NFC)', zelle: '💵 Zelle', crypto: '₿ Criptomoneda', tarjeta: '💳 Tarjeta', movil: '📲 Pago Móvil', efectivo: '💰 Efectivo' }[m] || m;
}

function val(id) { const el = document.getElementById(id); return el ? el.value : null; }

async function registrarPago(numeroControl) {
  const metodo = document.getElementById('pago-metodo').value;
  const monto = parseFloat(document.getElementById('pago-monto').value);
  if (!monto || monto <= 0) return alert('Monto inválido.');

  let body = { monto };
  if (metodo === 'tai') {
    body = { ...body, uid: val('c-uid'), pos: val('c-pos') };
  } else if (metodo === 'zelle') {
    body = { ...body, correo: val('c-correo'), nombre_titular: val('c-nombre-titular'), codigo_confirmacion: val('c-codigo'), moneda_tasa: val('c-moneda-tasa'), tasa: parseFloat(val('c-tasa')) };
  } else if (metodo === 'crypto') {
    body = { ...body, red: val('c-red-cripto'), direccion_billetera: val('c-billetera'), txid: val('c-txid'), moneda_tasa: val('c-moneda-tasa'), tasa: parseFloat(val('c-tasa')) };
  } else if (metodo === 'tarjeta') {
    body = { ...body, tipo: val('c-tipo-tarjeta'), red: val('c-red-tarjeta'), num_tarjeta: val('c-num-tarjeta'), fecha_vencimiento: val('c-vencimiento'), compania: val('c-compania') };
  } else if (metodo === 'movil') {
    body = { ...body, telefono: val('c-telefono'), banco_emisor: val('c-banco'), numero_referencia: val('c-referencia') };
  } else if (metodo === 'efectivo') {
    const moneda = val('c-moneda-efectivo');
    body = { ...body, moneda_efectivo: moneda, monto_recibido: parseFloat(val('c-monto-recibido')) };
    if (moneda !== 'Bolivares') {
      body.moneda_tasa = val('c-moneda-tasa');
      body.tasa = parseFloat(val('c-tasa'));
    }
  }

  try {
    const resultado = await apiFetch('POST', `/financiero/facturas/${numeroControl}/pagos/${metodo}`, body);
    toast(`Pago registrado. Saldo restante: $${Number(resultado.saldo_restante).toFixed(2)}`);
    cargarFolio();
    cargarFacturas();
  } catch (err) {
    alert(err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────
function badgeSolicitud(estado) {
  return { 'Completada': 'badge--green', 'En Proceso': 'badge--amber', 'Cancelada': 'badge--red' }[estado] || 'badge--gray';
}
function badgeFactura(estado) {
  return { 'Pagada': 'badge--green', 'Parcialmente Pagada': 'badge--amber', 'Pendiente': 'badge--red' }[estado] || 'badge--gray';
}
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toast(msg, tipo = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `<span>${tipo === 'success' ? '✅' : '❌'}</span> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
