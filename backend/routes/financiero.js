/* ============================================================
   routes/financiero.js
   HU-71/72/73/75: Ver folio de consumo y sus ítems
   HU-74:          Eliminar ítem del folio (antes del cierre)
   HU-76:          Cerrar folio -> generar factura
   HU-77/78:       Ver mis facturas (miembro o entidad externa)
   HU-79-84:       Registrar pago (Zelle/Crypto/Tarjeta/Móvil/Efectivo/TAI)
   HU-85/86:       Abonos parciales y saldo restante
   HU-99:          Pago de una reserva de estacionamiento (mismo flujo)
============================================================ */

const router    = require('express').Router();
const pool      = require('../db');
const auth      = require('../middleware/auth');
const autorizar = require('../middleware/roles');

async function esPersonalDe(CI, departamentos) {
  if (!CI) return false;
  const r = await pool.query(
    `SELECT 1 FROM PersonalAdministrativo WHERE CI = $1 AND adscripcion_presupuestaria = ANY($2::varchar[])`,
    [CI, departamentos]
  );
  return r.rows.length > 0;
}
async function esCaja(CI) { return esPersonalDe(CI, ['Caja']); }

async function esEgresado(CI) {
  const r = await pool.query('SELECT 1 FROM Egresado WHERE CI = $1', [CI]);
  return r.rows.length > 0;
}

/* ----------------------------------------------------------
   Buscar las solicitudes/folios de un miembro por CI (para que
   Caja encuentre a quién facturar/cobrar — HU-75)
   GET /api/financiero/buscar?ci=X
---------------------------------------------------------- */
router.get('/buscar', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.query;
  if (!ci) return res.status(400).json({ error: 'Debes indicar un CI' });

  try {
    const result = await pool.query(
      `SELECT s.fecha_hora_creacion, s.nombre_servicio, s.numero_servicio, s.estado AS estado_solicitud,
              TO_CHAR(s.fecha_hora_creacion, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_fecha,
              f.estado AS estado_folio
       FROM Solicitud s
       LEFT JOIN Folio_Consumo f ON f.fecha_hora_creacion_solicitud = s.fecha_hora_creacion
       WHERE s.CI = $1
       ORDER BY s.fecha_hora_creacion DESC`,
      [ci]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /financiero/buscar:', err);
    res.status(500).json({ error: 'Error al buscar solicitudes' });
  }
});

/* ----------------------------------------------------------
   Detalle del Folio de Consumo de una Solicitud (HU-71/72/73/75)
   GET /api/financiero/folio/:fecha
   Acceso: dueño de la solicitud, o cualquier admin/director.
---------------------------------------------------------- */
router.get('/folio/:fecha', auth, async (req, res) => {
  const { fecha } = req.params;
  const usuario = req.usuario;

  try {
    const solRes = await pool.query('SELECT CI FROM Solicitud WHERE fecha_hora_creacion = $1', [fecha]);
    if (solRes.rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const esDueno = solRes.rows[0].ci === usuario.CI;
    const esStaff = usuario.rol === 'admin' || usuario.rol === 'director';
    if (!esDueno && !esStaff) return res.status(403).json({ error: 'No tienes acceso a este folio' });

    const folioRes = await pool.query(
      `SELECT *, TO_CHAR(fecha_hora_apertura, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_apertura
       FROM Folio_Consumo WHERE fecha_hora_creacion_solicitud = $1`,
      [fecha]
    );
    if (folioRes.rows.length === 0) return res.status(404).json({ error: 'Esta solicitud aún no tiene folio de consumo' });
    const folio = folioRes.rows[0];

    const itemsRes = await pool.query(
      `SELECT concepto, fecha_hora_item, cantidad, precio_unitario, impuestos,
              TO_CHAR(fecha_hora_item, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_fecha_item,
              (cantidad * precio_unitario + impuestos) AS subtotal
       FROM Item_Consumo
       WHERE fecha_hora_apertura = $1 AND fecha_hora_creacion_solicitud = $2
       ORDER BY fecha_hora_item`,
      [folio.fecha_hora_apertura, fecha]
    );

    const total = itemsRes.rows.reduce((acc, i) => acc + Number(i.subtotal), 0);

    let factura = null;
    if (folio.estado === 'Cerrado') {
      const facturaRes = await pool.query(
        `SELECT * FROM Factura WHERE fecha_hora_apertura = $1 AND fecha_hora_creacion_solicitud = $2`,
        [folio.fecha_hora_apertura, fecha]
      );
      if (facturaRes.rows.length > 0) {
        const [pagosRes, saldoRes] = await Promise.all([
          pool.query('SELECT * FROM Pagos WHERE numero_de_control = $1 ORDER BY fecha_hora_pago', [facturaRes.rows[0].numero_de_control]),
          pool.query('SELECT calcular_saldo_factura($1) AS saldo', [facturaRes.rows[0].numero_de_control])
        ]);
        factura = { ...facturaRes.rows[0], pagos: pagosRes.rows, saldo: saldoRes.rows[0].saldo };
      }
    }

    res.json({ folio, items: itemsRes.rows, total, factura, puedeGestionar: esStaff });
  } catch (err) {
    console.error('Error GET /financiero/folio/:fecha:', err);
    res.status(500).json({ error: 'Error al consultar el folio' });
  }
});

/* ----------------------------------------------------------
   Agregar Ítem de Consumo al Folio (pieza necesaria para
   HU-71/72/73, no numerada aparte en el backlog)
   POST /api/financiero/folio/:fecha/items
   Body: { concepto, cantidad, impuestos? }
   Solo personal de Caja. El precio_unitario se toma de la
   tarifa vigente en Historial_Tarifas — no lo inventa el cajero
   (fn_validar_precio_item lo exige igual).
---------------------------------------------------------- */
router.post('/folio/:fecha/items', auth, autorizar('admin', 'director'), async (req, res) => {
  const { fecha } = req.params;
  const { concepto, cantidad, impuestos } = req.body || {};

  if (!(await esCaja(req.usuario.CI))) {
    return res.status(403).json({ error: 'Solo personal de Caja puede cargar ítems al folio' });
  }
  if (!concepto || !cantidad || cantidad <= 0) {
    return res.status(400).json({ error: 'Faltan concepto o cantidad válida' });
  }

  try {
    const folioRes = await pool.query(
      `SELECT f.fecha_hora_apertura, f.estado, s.CI, s.nombre_servicio, s.numero_servicio
       FROM Folio_Consumo f JOIN Solicitud s ON s.fecha_hora_creacion = f.fecha_hora_creacion_solicitud
       WHERE f.fecha_hora_creacion_solicitud = $1`,
      [fecha]
    );
    if (folioRes.rows.length === 0) return res.status(404).json({ error: 'Folio no encontrado' });
    const folio = folioRes.rows[0];
    if (folio.estado !== 'Abierto') {
      return res.status(409).json({ error: 'El folio ya está cerrado' });
    }

    const perfil = (await esEgresado(folio.ci)) ? 'Egresado' : 'Miembro Activo';

    const tarifaRes = await pool.query(
      `SELECT fecha_hora_vigencia, precio_final FROM Historial_Tarifas
       WHERE nombre_servicio = $1 AND numero_servicio = $2 AND perfil_solicitante = $3
         AND fecha_hora_vigencia <= NOW()
       ORDER BY fecha_hora_vigencia DESC LIMIT 1`,
      [folio.nombre_servicio, folio.numero_servicio, perfil]
    );
    if (tarifaRes.rows.length === 0) {
      return res.status(400).json({ error: `No hay tarifa vigente para este servicio (perfil ${perfil})` });
    }
    const tarifa = tarifaRes.rows[0];

    const fechaItem = new Date();
    const result = await pool.query(
      `INSERT INTO Item_Consumo (concepto, fecha_hora_item, fecha_hora_apertura, fecha_hora_creacion_solicitud,
                                  fecha_hora_vigencia, nombre_servicio, numero_servicio, perfil_solicitante,
                                  cantidad, precio_unitario, impuestos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [concepto, fechaItem, folio.fecha_hora_apertura, fecha, tarifa.fecha_hora_vigencia,
       folio.nombre_servicio, folio.numero_servicio, perfil, cantidad, tarifa.precio_final, impuestos || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error POST /financiero/folio/:fecha/items:', err);
    res.status(400).json({ error: err.message || 'Error al agregar el ítem' });
  }
});

/* ----------------------------------------------------------
   Eliminar Ítem de Consumo (HU-74)
   DELETE /api/financiero/folio/:fecha/items/:concepto/:fechaItem
---------------------------------------------------------- */
router.delete('/folio/:fecha/items/:concepto/:fechaItem', auth, autorizar('admin', 'director'), async (req, res) => {
  const { fecha, concepto, fechaItem } = req.params;

  if (!(await esCaja(req.usuario.CI))) {
    return res.status(403).json({ error: 'Solo personal de Caja puede eliminar ítems del folio' });
  }

  try {
    const folioRes = await pool.query(
      `SELECT estado FROM Folio_Consumo WHERE fecha_hora_creacion_solicitud = $1`, [fecha]
    );
    if (folioRes.rows.length === 0) return res.status(404).json({ error: 'Folio no encontrado' });
    if (folioRes.rows[0].estado !== 'Abierto') {
      return res.status(409).json({ error: 'El folio ya está cerrado' });
    }

    const result = await pool.query(
      `DELETE FROM Item_Consumo WHERE concepto = $1 AND fecha_hora_item = $2 AND fecha_hora_creacion_solicitud = $3`,
      [concepto, fechaItem, fecha]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Ítem no encontrado' });
    res.json({ mensaje: 'Ítem eliminado' });
  } catch (err) {
    console.error('Error DELETE /financiero/folio/:fecha/items:', err);
    res.status(500).json({ error: 'Error al eliminar el ítem' });
  }
});

/* ----------------------------------------------------------
   Cerrar Folio y Generar Factura (HU-76)
   PATCH /api/financiero/folio/:fecha/cerrar
   Body: { rif? } — si se manda, la factura es corporativa (RIF);
   si no, se factura al CI dueño de la solicitud.
---------------------------------------------------------- */
router.patch('/folio/:fecha/cerrar', auth, autorizar('admin', 'director'), async (req, res) => {
  const { fecha } = req.params;
  const { rif } = req.body || {};

  if (!(await esCaja(req.usuario.CI))) {
    return res.status(403).json({ error: 'Solo personal de Caja puede cerrar el folio' });
  }

  try {
    const folioRes = await pool.query(
      `SELECT f.fecha_hora_apertura, f.estado, s.CI
       FROM Folio_Consumo f JOIN Solicitud s ON s.fecha_hora_creacion = f.fecha_hora_creacion_solicitud
       WHERE f.fecha_hora_creacion_solicitud = $1`,
      [fecha]
    );
    if (folioRes.rows.length === 0) return res.status(404).json({ error: 'Folio no encontrado' });
    const folio = folioRes.rows[0];
    if (folio.estado !== 'Abierto') return res.status(409).json({ error: 'El folio ya está cerrado' });

    const ci = rif ? null : folio.ci;
    await pool.query('CALL generar_factura($1,$2,$3,$4)', [folio.fecha_hora_apertura, fecha, rif || null, ci]);

    const facturaRes = await pool.query(
      `SELECT * FROM Factura WHERE fecha_hora_apertura = $1 AND fecha_hora_creacion_solicitud = $2`,
      [folio.fecha_hora_apertura, fecha]
    );
    res.status(201).json({ mensaje: 'Folio cerrado y factura generada', factura: facturaRes.rows[0] });
  } catch (err) {
    console.error('Error PATCH /financiero/folio/:fecha/cerrar:', err);
    res.status(400).json({ error: err.message || 'Error al cerrar el folio' });
  }
});

/* ----------------------------------------------------------
   Mis Facturas / Facturas de una entidad (HU-77/78)
   GET /api/financiero/facturas?ci=&rif=  (ci/rif solo para staff)
---------------------------------------------------------- */
router.get('/facturas', auth, async (req, res) => {
  const usuario = req.usuario;
  try {
    let q = `SELECT f.numero_de_control, f.estado, f.monto_total, f.fecha_de_emision, f.RIF, f.CI,
                     s.nombre_servicio, s.numero_servicio,
                     TO_CHAR(f.fecha_hora_creacion_solicitud, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_fecha_solicitud
              FROM Factura f
              JOIN Solicitud s ON s.fecha_hora_creacion = f.fecha_hora_creacion_solicitud
              WHERE 1=1`;
    const params = [];

    if (usuario.rol === 'aliado_externo') {
      params.push(usuario.RIF);
      q += ` AND f.RIF = $${params.length}`;
    } else if (usuario.rol === 'admin' || usuario.rol === 'director') {
      if (req.query.ci) { params.push(req.query.ci); q += ` AND f.CI = $${params.length}`; }
      if (req.query.rif) { params.push(req.query.rif); q += ` AND f.RIF = $${params.length}`; }
    } else {
      params.push(usuario.CI);
      q += ` AND f.CI = $${params.length}`;
    }

    q += ` ORDER BY fecha_de_emision DESC`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /financiero/facturas:', err);
    res.status(500).json({ error: 'Error al consultar las facturas' });
  }
});

/* ----------------------------------------------------------
   Detalle de una Factura: pagos y saldo restante (HU-85/86)
   GET /api/financiero/facturas/:numero
---------------------------------------------------------- */
router.get('/facturas/:numero', auth, async (req, res) => {
  const { numero } = req.params;
  const usuario = req.usuario;

  try {
    const facturaRes = await pool.query('SELECT * FROM Factura WHERE numero_de_control = $1', [numero]);
    if (facturaRes.rows.length === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    const factura = facturaRes.rows[0];

    const esDueno = (factura.ci && factura.ci === usuario.CI) || (factura.rif && factura.rif === usuario.rif) || (factura.rif && factura.rif === usuario.RIF);
    const esStaff = usuario.rol === 'admin' || usuario.rol === 'director';
    if (!esDueno && !esStaff) return res.status(403).json({ error: 'No tienes acceso a esta factura' });

    const [pagosRes, saldoRes] = await Promise.all([
      pool.query('SELECT * FROM Pagos WHERE numero_de_control = $1 ORDER BY fecha_hora_pago', [numero]),
      pool.query('SELECT calcular_saldo_factura($1) AS saldo', [numero])
    ]);

    res.json({ factura, pagos: pagosRes.rows, saldo: saldoRes.rows[0].saldo });
  } catch (err) {
    console.error('Error GET /financiero/facturas/:numero:', err);
    res.status(500).json({ error: 'Error al consultar la factura' });
  }
});

/* ----------------------------------------------------------
   Registrar Pago (HU-79 a HU-85, HU-99)
   POST /api/financiero/facturas/:numero/pagos/:metodo
   :metodo ∈ zelle | crypto | efectivo | tarjeta | movil | tai
   TAI: puede iniciarlo el propio dueño de la factura (HU-84).
   El resto: solo personal de Caja.
---------------------------------------------------------- */
router.post('/facturas/:numero/pagos/:metodo', auth, async (req, res) => {
  const { numero, metodo } = req.params;
  const usuario = req.usuario;
  const body = req.body || {};
  const { monto } = body;

  if (!monto || monto <= 0) return res.status(400).json({ error: 'Monto inválido' });

  try {
    const facturaRes = await pool.query('SELECT * FROM Factura WHERE numero_de_control = $1', [numero]);
    if (facturaRes.rows.length === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    const factura = facturaRes.rows[0];

    if (metodo === 'tai') {
      const esDueno = factura.ci === usuario.CI;
      const autorizado = esDueno || (await esCaja(usuario.CI));
      if (!autorizado) return res.status(403).json({ error: 'No autorizado para pagar esta factura' });
    } else {
      if (!(await esCaja(usuario.CI))) {
        return res.status(403).json({ error: 'Solo personal de Caja puede registrar este tipo de pago' });
      }
    }

    switch (metodo) {
      case 'zelle': {
        const { moneda_tasa, tasa, correo, codigo_confirmacion, nombre_titular } = body;
        await pool.query('CALL registrar_pago_zelle($1,$2,$3,$4,$5,$6,$7)',
          [numero, monto, moneda_tasa, tasa, correo, codigo_confirmacion, nombre_titular]);
        break;
      }
      case 'crypto': {
        const { moneda_tasa, tasa, direccion_billetera, txid, red } = body;
        await pool.query('CALL registrar_pago_crypto($1,$2,$3,$4,$5,$6,$7)',
          [numero, monto, moneda_tasa, tasa, direccion_billetera, txid, red]);
        break;
      }
      case 'efectivo': {
        const { moneda_efectivo, monto_recibido, moneda_tasa, tasa } = body;
        await pool.query('CALL registrar_pago_efectivo($1,$2,$3,$4,$5,$6)',
          [numero, monto, moneda_efectivo, monto_recibido, moneda_tasa || null, tasa || null]);
        break;
      }
      case 'tarjeta': {
        const { tipo, red, num_tarjeta, fecha_vencimiento, compania } = body;
        await pool.query('CALL registrar_pago_tarjeta($1,$2,$3,$4,$5,$6,$7)',
          [numero, monto, tipo, red, num_tarjeta, fecha_vencimiento, compania]);
        break;
      }
      case 'movil': {
        const { telefono, numero_referencia, banco_emisor } = body;
        await pool.query('CALL registrar_pago_movil($1,$2,$3,$4,$5)',
          [numero, monto, telefono, numero_referencia, banco_emisor]);
        break;
      }
      case 'tai': {
        const { uid, pos } = body;
        await pool.query('CALL registrar_pago_tai($1,$2,$3,$4)', [numero, monto, uid, pos]);
        break;
      }
      default:
        return res.status(400).json({ error: 'Método de pago no reconocido' });
    }

    const saldoRes = await pool.query('SELECT calcular_saldo_factura($1) AS saldo', [numero]);
    res.status(201).json({ mensaje: 'Pago registrado exitosamente', saldo_restante: saldoRes.rows[0].saldo });
  } catch (err) {
    console.error(`Error POST /financiero/facturas/:numero/pagos/${metodo}:`, err);
    res.status(400).json({ error: err.message || 'Error al registrar el pago' });
  }
});

module.exports = router;
