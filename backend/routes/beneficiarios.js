/* ============================================================
   routes/beneficiarios.js
   HU-24: Docente/PersonalAdm registra beneficiario
   HU-25: Admin valida y aprueba beneficiario
   HU-26: Miembro consulta sus beneficiarios
   HU-27: Admin consulta historial de coberturas
   HU-28: Admin actualiza constancias de CargaMayor
   HU-29: Admin registra ruptura/vencimiento de vínculo
   HU-30: Miembro registra acompañante en solicitud
   HU-31: Miembro visualiza acompañantes de solicitud
   HU-32: Admin/seguridad consulta acompañantes
   HU-33: Miembro modifica/elimina acompañante
============================================================ */

const router    = require('express').Router();
const pool      = require('../db');
const auth      = require('../middleware/auth');
const autorizar = require('../middleware/roles');

/* ── GET /api/beneficiarios
   Admin ve todos los beneficiarios del sistema (HU-25/27) */
router.get('/', auth, autorizar('admin', 'director'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*,
              m.primer_nombre || ' ' || m.primer_apellido as nombre_miembro,
              cm.centro_educacion_inicial, cm.esquema_vacunacion,
              cma.constancia_estudios_uni, cma.certificado_solteria,
              CASE WHEN cm.CI IS NOT NULL THEN 'menor'
                   WHEN cma.CI IS NOT NULL THEN 'mayor'
                   ELSE 'desconocido' END as tipo_carga
       FROM Beneficiario b
       JOIN Miembro m ON m.CI = b.CI_miembro
       LEFT JOIN CargaMenor cm ON cm.CI = b.CI
       LEFT JOIN CargaMayor cma ON cma.CI = b.CI
       ORDER BY b.estatus_cobertura ASC, b.fecha_inicio DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error GET /beneficiarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/beneficiarios/:ci_miembro
   Lista los beneficiarios de un miembro (HU-26) */
router.get('/:ci_miembro', auth, async (req, res) => {
  const { ci_miembro } = req.params;
  const usuario = req.usuario;

  if (usuario.rol === 'miembro' && usuario.CI !== ci_miembro) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT b.ci, b.nombre, b.parentesco, b.fecha_nacimiento,
              b.estatus_cobertura, b.fecha_inicio, b.fecha_fin, b.ci_miembro,
              cm.centro_educacion_inicial, cm.esquema_vacunacion,
              cma.constancia_estudios_uni, cma.certificado_solteria,
              CASE WHEN cm.CI IS NOT NULL THEN 'menor'
                   WHEN cma.CI IS NOT NULL THEN 'mayor'
                   ELSE 'desconocido' END as tipo_carga
       FROM Beneficiario b
       LEFT JOIN CargaMenor cm ON cm.CI = b.CI
       LEFT JOIN CargaMayor cma ON cma.CI = b.CI
       WHERE b.CI_miembro = $1
       ORDER BY b.fecha_inicio DESC`,
      [ci_miembro]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error GET /beneficiarios/:ci_miembro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/beneficiarios/:ci_miembro/:ci_beneficiario
   Obtiene un beneficiario específico */
router.get('/:ci_miembro/:ci_beneficiario', auth, async (req, res) => {
  const { ci_miembro, ci_beneficiario } = req.params;
  const usuario = req.usuario;

  if (usuario.rol === 'miembro' && usuario.CI !== ci_miembro) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT b.ci, b.nombre, b.parentesco, b.fecha_nacimiento,
              b.estatus_cobertura, b.fecha_inicio, b.fecha_fin, b.ci_miembro,
              cm.centro_educacion_inicial, cm.esquema_vacunacion,
              cma.constancia_estudios_uni, cma.certificado_solteria,
              CASE WHEN cm.CI IS NOT NULL THEN 'menor'
                   WHEN cma.CI IS NOT NULL THEN 'mayor'
                   ELSE 'desconocido' END as tipo_carga
       FROM Beneficiario b
       LEFT JOIN CargaMenor cm ON cm.CI = b.CI
       LEFT JOIN CargaMayor cma ON cma.CI = b.CI
       WHERE b.CI = $1 AND b.CI_miembro = $2`,
      [ci_beneficiario, ci_miembro]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Beneficiario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error GET /beneficiarios/:ci_miembro/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── POST /api/beneficiarios/:ci_miembro
   Registra un nuevo beneficiario (HU-24)
   Solo Profesor o PersonalAdministrativo (RN-16 lo valida en BD también) */
router.post('/:ci_miembro', auth, async (req, res) => {
  const { ci_miembro } = req.params;
  const usuario = req.usuario;

  // RN-16: solo Profesor o PersonalAdministrativo puede registrar beneficiarios
  if (!['admin', 'director'].includes(usuario.rol) &&
      !['Profesor', 'PersonalAdministrativo'].includes(usuario.subtipo)) {
    return res.status(403).json({ error: 'Solo Docentes y Personal Administrativo pueden registrar beneficiarios.' });
  }

  const {
    CI, Nombre, Parentesco, fecha_nacimiento,
    tipo_carga, // 'menor' o 'mayor'
    // CargaMenor
    centro_educacion_inicial, esquema_vacunacion,
    // CargaMayor
    constancia_estudios_uni, certificado_solteria
  } = req.body;

  if (!CI || !Nombre || !Parentesco || !fecha_nacimiento || !tipo_carga) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  if (!['menor', 'mayor'].includes(tipo_carga)) {
    return res.status(400).json({ error: 'tipo_carga debe ser "menor" o "mayor".' });
  }

  try {
    await pool.query(
      `INSERT INTO Beneficiario (CI, Nombre, Parentesco, fecha_nacimiento, estatus_cobertura, fecha_inicio, CI_miembro)
       VALUES ($1, $2, $3, $4, 'Inhabilitado', NOW(), $5)`,
      [CI, Nombre, Parentesco, fecha_nacimiento, ci_miembro]
    );

    if (tipo_carga === 'menor') {
      await pool.query(
        `INSERT INTO CargaMenor (CI, centro_educacion_inicial, esquema_vacunacion)
         VALUES ($1, $2, $3)`,
        [CI, centro_educacion_inicial || null, esquema_vacunacion || null]
      );
    } else {
      await pool.query(
        `INSERT INTO CargaMayor (CI, constancia_estudios_uni, certificado_solteria)
         VALUES ($1, $2, $3)`,
        [CI, constancia_estudios_uni || null, certificado_solteria || null]
      );
    }

    res.status(201).json({ mensaje: 'Beneficiario registrado. Pendiente de aprobación.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un beneficiario con esa cédula.' });
    console.error('Error POST /beneficiarios:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── PATCH /api/beneficiarios/:ci_miembro/:ci_beneficiario/aprobar
   Admin valida y aprueba el beneficiario (HU-25) */
router.patch('/:ci_miembro/:ci_beneficiario/aprobar', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci_beneficiario } = req.params;

  try {
    const { rowCount } = await pool.query(
      `UPDATE Beneficiario SET estatus_cobertura = 'Habilitado'
       WHERE CI = $1`,
      [ci_beneficiario]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Beneficiario no encontrado.' });
    res.json({ mensaje: 'Beneficiario aprobado y habilitado.' });
  } catch (err) {
    console.error('Error PATCH /aprobar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PATCH /api/beneficiarios/:ci_miembro/:ci_beneficiario/inhabilitar
   Admin registra ruptura o vencimiento de vínculo (HU-29) */
router.patch('/:ci_miembro/:ci_beneficiario/inhabilitar', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci_beneficiario } = req.params;
  const { fecha_fin } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE Beneficiario SET estatus_cobertura = 'Inhabilitado', fecha_fin = $1
       WHERE CI = $2`,
      [fecha_fin || new Date().toISOString().split('T')[0], ci_beneficiario]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Beneficiario no encontrado.' });
    res.json({ mensaje: 'Vínculo inhabilitado correctamente.' });
  } catch (err) {
    console.error('Error PATCH /inhabilitar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PUT /api/beneficiarios/:ci_miembro/:ci_beneficiario/constancias
   Admin actualiza constancias de CargaMayor (HU-28) */
router.put('/:ci_miembro/:ci_beneficiario/constancias', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci_beneficiario } = req.params;
  const { constancia_estudios_uni, certificado_solteria } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE CargaMayor SET constancia_estudios_uni = $1, certificado_solteria = $2
       WHERE CI = $3`,
      [constancia_estudios_uni || null, certificado_solteria || null, ci_beneficiario]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'CargaMayor no encontrada.' });
    res.json({ mensaje: 'Constancias actualizadas.' });
  } catch (err) {
    console.error('Error PUT /constancias:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/beneficiarios/admin/:ci_miembro
   Admin consulta historial de coberturas de un empleado (HU-27) */
router.get('/admin/:ci_miembro', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci_miembro } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT b.*,
              cm.centro_educacion_inicial, cm.esquema_vacunacion,
              cma.constancia_estudios_uni, cma.certificado_solteria,
              CASE WHEN cm.CI IS NOT NULL THEN 'menor'
                   WHEN cma.CI IS NOT NULL THEN 'mayor'
                   ELSE 'desconocido' END as tipo_carga
       FROM Beneficiario b
       LEFT JOIN CargaMenor cm ON cm.CI = b.CI
       LEFT JOIN CargaMayor cma ON cma.CI = b.CI
       WHERE b.CI_miembro = $1
       ORDER BY b.fecha_inicio DESC`,
      [ci_miembro]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error GET /beneficiarios/admin:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PUT /api/beneficiarios/:ci_miembro/:ci_beneficiario/cargamenor
   Admin actualiza datos de CargaMenor */
router.put('/:ci_miembro/:ci_beneficiario/cargamenor', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci_beneficiario } = req.params;
  const { centro_educacion_inicial, esquema_vacunacion } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE CargaMenor SET centro_educacion_inicial = $1, esquema_vacunacion = $2
       WHERE CI = $3`,
      [centro_educacion_inicial || null, esquema_vacunacion || null, ci_beneficiario]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'CargaMenor no encontrada.' });
    res.json({ mensaje: 'Datos de carga menor actualizados.' });
  } catch (err) {
    console.error('Error PUT /cargamenor:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── POST /api/beneficiarios/:ci_miembro/:ci_beneficiario/promover
   Promueve un Beneficiario de CargaMenor a CargaMayor */
router.post('/:ci_miembro/:ci_beneficiario/promover', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci_miembro, ci_beneficiario } = req.params;

  try {
    const checkMenor = await pool.query(
      `SELECT 1 FROM CargaMenor WHERE CI = $1`, [ci_beneficiario]
    );
    if (checkMenor.rowCount === 0) {
      return res.status(400).json({ error: 'El beneficiario no es una Carga Menor o no existe.' });
    }

    await pool.query('BEGIN');
    
    await pool.query(`DELETE FROM CargaMenor WHERE CI = $1`, [ci_beneficiario]);
    
    await pool.query(
      `INSERT INTO CargaMayor (CI, constancia_estudios_uni, certificado_solteria) VALUES ($1, NULL, NULL)`,
      [ci_beneficiario]
    );

    await pool.query(
      `UPDATE Beneficiario SET estatus_cobertura = 'Inhabilitado' WHERE CI = $1 AND CI_miembro = $2`,
      [ci_beneficiario, ci_miembro]
    );

    await pool.query('COMMIT');
    res.json({ mensaje: 'Promovido a Carga Mayor. El estado pasó a Pendiente.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error POST /promover:', err);
    res.status(500).json({ error: 'Error interno del servidor al promover.' });
  }
});

module.exports = router;