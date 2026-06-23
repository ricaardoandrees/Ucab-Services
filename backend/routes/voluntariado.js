/* ============================================================
   routes/voluntariado.js
   HU-100: Director publica voluntariado          POST   /api/voluntariado
   HU-101: Director modifica voluntariado         PUT    /api/voluntariado/:nombre
   HU-102: Director cierra voluntariado           PATCH  /api/voluntariado/:nombre/cerrar
   HU-103: Consultar voluntariados por estado     GET    /api/voluntariado?estado=Abierto
   HU-104: Miembro se inscribe                    POST   /api/voluntariado/:nombre/inscribir
   HU-105: Miembro cancela inscripción            DELETE /api/voluntariado/:nombre/inscribir
   HU-106: Admin/Director consulta participantes  GET    /api/voluntariado/:nombre/participantes
============================================================ */

const router    = require('express').Router();
const pool      = require('../db');
const auth      = require('../middleware/auth');
const autorizar = require('../middleware/roles');

/* ----------------------------------------------------------
   GET /api/voluntariado/entidades
   Lista todas las entidades prestadoras con su nombre
   (internas o externas) para poblar el dropdown del formulario
---------------------------------------------------------- */
router.get('/entidades', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ep.ID_EP,
             COALESCE(ei.nombre, ee.razon_social, 'Entidad ' || ep.ID_EP) AS nombre,
             CASE WHEN ei.ID_EP IS NOT NULL THEN 'Interna' ELSE 'Externa' END AS tipo
      FROM EntidadPrestadora ep
      LEFT JOIN EntidadInterna  ei ON ei.ID_EP = ep.ID_EP
      LEFT JOIN EntidadExterna  ee ON ee.ID_EP = ep.ID_EP
      ORDER BY ep.ID_EP
    `);
    res.json({ entidades: rows });
  } catch (err) {
    console.error('Error GET /voluntariado/entidades:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-100: Publicar voluntariado
   Body: { nombre, ID_EP, descripcion, fecha_inicio, fecha_fin }
   Requiere: director
---------------------------------------------------------- */
router.post('/', auth, autorizar('director', 'admin'), async (req, res) => {
  const { nombre, ID_EP, descripcion, fecha_inicio, fecha_fin } = req.body;

  if (!nombre || !ID_EP || !descripcion || !fecha_inicio) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, ID_EP, descripcion, fecha_inicio.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Voluntariado (nombre, ID_EP, descripcion, fecha_inicio, fecha_fin, estado)
       VALUES ($1, $2, $3, $4, $5, 'Abierto')
       RETURNING *`,
      [nombre, ID_EP, descripcion, fecha_inicio, fecha_fin || null]
    );

    res.status(201).json({
      mensaje: 'Voluntariado publicado exitosamente.',
      voluntariado: result.rows[0]
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un voluntariado con ese nombre.' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'La entidad prestadora indicada no existe.' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
    }
    console.error('Error POST /voluntariado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-103: Consultar voluntariados (filtro por estado)
   GET /api/voluntariado?estado=Abierto
   Accesible para todos los autenticados
---------------------------------------------------------- */
router.get('/', auth, async (req, res) => {
  const { estado } = req.query;
  const ESTADOS = ['Abierto', 'Cerrado', 'Finalizado'];

  try {
    const params = [req.usuario.CI];

    let query = `
      SELECT v.nombre, v.ID_EP, v.descripcion, v.fecha_inicio, v.fecha_fin, v.estado,
             COUNT(i.CI) AS total_inscritos,
             COALESCE(ei.nombre, ee.razon_social, 'Entidad ' || v.ID_EP) AS entidad_nombre,
             EXISTS(SELECT 1 FROM Inscribe i2 WHERE i2.nombre = v.nombre AND i2.CI = $1) AS inscrito
      FROM Voluntariado v
      LEFT JOIN Inscribe i ON i.nombre = v.nombre
      LEFT JOIN EntidadInterna ei ON ei.ID_EP = v.ID_EP
      LEFT JOIN EntidadExterna ee ON ee.ID_EP = v.ID_EP
    `;

    if (estado && ESTADOS.includes(estado)) {
      query += ` WHERE v.estado = $2`;
      params.push(estado);
    }

    query += ` GROUP BY v.nombre, v.ID_EP, v.descripcion, v.fecha_inicio, v.fecha_fin, v.estado, ei.nombre, ee.razon_social
               ORDER BY v.fecha_inicio DESC`;

    const { rows } = await pool.query(query, params);
    res.json({ total: rows.length, voluntariados: rows });

  } catch (err) {
    console.error('Error GET /voluntariado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-101: Modificar voluntariado
   Body: { ID_EP, descripcion, fecha_inicio, fecha_fin }
   Requiere: director o admin
   Solo si estado es 'Abierto'
---------------------------------------------------------- */
router.put('/:nombre', auth, autorizar('director', 'admin'), async (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);
  const { ID_EP, descripcion, fecha_inicio, fecha_fin } = req.body;

  if (!ID_EP || !descripcion || !fecha_inicio) {
    return res.status(400).json({ error: 'Faltan campos: ID_EP, descripcion, fecha_inicio.' });
  }

  try {
    // Solo se puede modificar si está Abierto
    const check = await pool.query(
      `SELECT estado FROM Voluntariado WHERE nombre = $1`, [nombre]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Voluntariado no encontrado.' });
    }
    if (check.rows[0].estado !== 'Abierto') {
      return res.status(409).json({ error: 'Solo se pueden modificar voluntariados con estado "Abierto".' });
    }

    const { rowCount } = await pool.query(
      `UPDATE Voluntariado
       SET ID_EP = $1, descripcion = $2, fecha_inicio = $3, fecha_fin = $4
       WHERE nombre = $5`,
      [ID_EP, descripcion, fecha_inicio, fecha_fin || null, nombre]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Voluntariado no encontrado.' });

    res.json({ mensaje: 'Voluntariado actualizado correctamente.' });

  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
    }
    console.error('Error PUT /voluntariado/:nombre:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-102: Cerrar voluntariado
   PATCH /api/voluntariado/:nombre/cerrar
   Requiere: director o admin
---------------------------------------------------------- */
router.patch('/:nombre/cerrar', auth, autorizar('director', 'admin'), async (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);

  try {
    const check = await pool.query(
      `SELECT estado FROM Voluntariado WHERE nombre = $1`, [nombre]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Voluntariado no encontrado.' });
    }
    if (check.rows[0].estado === 'Cerrado') {
      return res.status(409).json({ error: 'El voluntariado ya está cerrado.' });
    }
    if (check.rows[0].estado === 'Finalizado') {
      return res.status(409).json({ error: 'No se puede cerrar un voluntariado Finalizado.' });
    }

    await pool.query(
      `UPDATE Voluntariado SET estado = 'Cerrado' WHERE nombre = $1`, [nombre]
    );

    res.json({ mensaje: `Voluntariado "${nombre}" cerrado correctamente.` });

  } catch (err) {
    console.error('Error PATCH /voluntariado/:nombre/cerrar:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-104: Inscribirse en un voluntariado
   POST /api/voluntariado/:nombre/inscribir
   Requiere: miembro autenticado
---------------------------------------------------------- */
router.post('/:nombre/inscribir', auth, async (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);
  const CI     = req.usuario.CI;

  try {
    // Verificar que el voluntariado existe y está Abierto
    const vol = await pool.query(
      `SELECT estado FROM Voluntariado WHERE nombre = $1`, [nombre]
    );

    if (vol.rowCount === 0) {
      return res.status(404).json({ error: 'Voluntariado no encontrado.' });
    }
    if (vol.rows[0].estado !== 'Abierto') {
      return res.status(409).json({ error: 'Solo puedes inscribirte en voluntariados con estado "Abierto".' });
    }

    await pool.query(
      `INSERT INTO Inscribe (CI, nombre) VALUES ($1, $2)`, [CI, nombre]
    );

    res.status(201).json({ mensaje: `Inscripción en "${nombre}" confirmada.` });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya estás inscrito en este voluntariado.' });
    }
    console.error('Error POST /voluntariado/:nombre/inscribir:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-105: Cancelar inscripción
   DELETE /api/voluntariado/:nombre/inscribir
   Requiere: miembro autenticado
---------------------------------------------------------- */
router.delete('/:nombre/inscribir', auth, async (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);
  const CI     = req.usuario.CI;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM Inscribe WHERE CI = $1 AND nombre = $2`, [CI, nombre]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'No tienes inscripción activa en este voluntariado.' });
    }

    res.json({ mensaje: `Inscripción en "${nombre}" cancelada correctamente.` });

  } catch (err) {
    console.error('Error DELETE /voluntariado/:nombre/inscribir:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-106: Consultar participantes de un voluntariado
   GET /api/voluntariado/:nombre/participantes
   Requiere: admin o director
---------------------------------------------------------- */
router.get('/:nombre/participantes', auth, autorizar('admin', 'director'), async (req, res) => {
  const nombre = decodeURIComponent(req.params.nombre);

  try {
    const vol = await pool.query(
      `SELECT nombre, estado FROM Voluntariado WHERE nombre = $1`, [nombre]
    );

    if (vol.rowCount === 0) {
      return res.status(404).json({ error: 'Voluntariado no encontrado.' });
    }

    const { rows } = await pool.query(
      `SELECT m.ci, m.primer_nombre, m.segundo_nombre,
              m.primer_apellido, m.segundo_apellido,
              m.correo, m.num_personal
       FROM Inscribe i
       JOIN Miembro m ON m.ci = i.CI
       WHERE i.nombre = $1
       ORDER BY m.primer_apellido, m.primer_nombre`,
      [nombre]
    );

    res.json({
      voluntariado: vol.rows[0].nombre,
      estado:       vol.rows[0].estado,
      total:        rows.length,
      participantes: rows
    });

  } catch (err) {
    console.error('Error GET /voluntariado/:nombre/participantes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
