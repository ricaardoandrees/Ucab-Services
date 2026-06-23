const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const autorizar = require('../middleware/roles');

/* ==========================================================
   MÓDULO DE INFRAESTRUCTURA (HU-37 a HU-47)
========================================================== */

// ─── RECURSOS DE ESPACIOS FÍSICOS (HU-44) ─────────────────

router.get('/espacios/:numero/:edif/:sede/recursos', auth, async (req, res) => {
  const { numero, edif, sede } = req.params;
  try {
    const edifCheck = await pool.query('SELECT direccion_exacta FROM Edificacion WHERE nombre = $1 AND nombre_sede = $2 LIMIT 1', [edif, sede]);
    if (edifCheck.rowCount === 0) return res.status(404).json({ error: 'La edificación no existe.' });
    
    const { rows } = await pool.query(
      'SELECT recurso FROM Recursos WHERE numero = $1 AND nombre_espacio_fisico = $2 AND nombre_sede = $3 ORDER BY recurso',
      [numero, edif, sede]
    );
    res.json({ recursos: rows.map(r => r.recurso) });
  } catch (err) {
    console.error('Error GET /recursos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.post('/espacios/:numero/:edif/:sede/recursos', auth, autorizar('director', 'admin'), async (req, res) => {
  const { numero, edif, sede } = req.params;
  const { recurso } = req.body;
  if (!recurso) return res.status(400).json({ error: 'Debe especificar el recurso.' });

  try {
    const edifCheck = await pool.query('SELECT direccion_exacta FROM Edificacion WHERE nombre = $1 AND nombre_sede = $2 LIMIT 1', [edif, sede]);
    if (edifCheck.rowCount === 0) return res.status(404).json({ error: 'La edificación no existe.' });
    const direccion_exacta = edifCheck.rows[0].direccion_exacta;

    await pool.query(
      'INSERT INTO Recursos (numero, nombre_espacio_fisico, direccion_exacta, nombre_sede, recurso) VALUES ($1, $2, $3, $4, $5)',
      [numero, edif, direccion_exacta, sede, recurso.trim()]
    );
    res.status(201).json({ message: 'Recurso añadido.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El espacio ya tiene este recurso.' });
    if (err.code === '23503') return res.status(404).json({ error: 'El espacio físico indicado no existe.' });
    console.error('Error POST /recursos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

router.delete('/espacios/:numero/:edif/:sede/recursos/:recurso', auth, autorizar('director', 'admin'), async (req, res) => {
  const { numero, edif, sede, recurso } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM Recursos WHERE numero = $1 AND nombre_espacio_fisico = $2 AND nombre_sede = $3 AND recurso = $4',
      [numero, edif, sede, recurso]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Recurso no encontrado en este espacio.' });
    res.json({ message: 'Recurso eliminado.' });
  } catch (err) {
    console.error('Error DELETE /recursos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ─── SEDES (HU-37, HU-47) ─────────────────────────────────

// GET /api/infraestructura/sedes
router.get('/sedes', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT nombre, ubicacion FROM Sede ORDER BY nombre`);
    res.json({ sedes: rows });
  } catch (err) {
    console.error('Error GET /sedes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/infraestructura/sedes (HU-47) - Solo admin
router.post('/sedes', auth, autorizar('admin'), async (req, res) => {
  const { nombre, ubicacion } = req.body;
  if (!nombre || !ubicacion) return res.status(400).json({ error: 'Faltan datos obligatorios.' });

  try {
    await pool.query('INSERT INTO Sede (nombre, ubicacion) VALUES ($1, $2)', [nombre, ubicacion]);
    res.status(201).json({ message: 'Sede creada exitosamente.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'La sede ya existe.' });
    console.error('Error POST /sedes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/infraestructura/sedes/:nombre (HU-37) - Solo admin
router.put('/sedes/:nombre', auth, autorizar('admin'), async (req, res) => {
  const { nombre: nombreViejo } = req.params;
  const { nombre: nombreNuevo, ubicacion } = req.body;
  if (!ubicacion || !nombreNuevo) return res.status(400).json({ error: 'Nombre y ubicación son obligatorios.' });

  try {
    const { rowCount } = await pool.query('UPDATE Sede SET nombre = $1, ubicacion = $2 WHERE nombre = $3', [nombreNuevo, ubicacion, nombreViejo]);
    if (rowCount === 0) return res.status(404).json({ error: 'Sede no encontrada.' });
    res.json({ message: 'Sede actualizada correctamente.' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'No se puede cambiar el nombre porque hay registros asociados en la BD.' });
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe otra sede con ese nombre.' });
    console.error('Error PUT /sedes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


// ─── EDIFICACIONES (HU-38, HU-39, HU-40, HU-45) ───────────

// GET /api/infraestructura/edificaciones
router.get('/edificaciones', auth, async (req, res) => {
  const { sede } = req.query;
  try {
    let query = 'SELECT nombre, direccion_exacta, nombre_sede FROM Edificacion';
    const params = [];
    if (sede) {
      query += ' WHERE nombre_sede = $1';
      params.push(sede);
    }
    query += ' ORDER BY nombre_sede, nombre';
    
    const { rows } = await pool.query(query, params);
    res.json({ edificaciones: rows });
  } catch (err) {
    console.error('Error GET /edificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/infraestructura/edificaciones (HU-38) - Director/Admin
router.post('/edificaciones', auth, autorizar('director', 'admin'), async (req, res) => {
  const { nombre, direccion_exacta, nombre_sede } = req.body;
  if (!nombre || !direccion_exacta || !nombre_sede) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    await pool.query(
      'INSERT INTO Edificacion (nombre, direccion_exacta, nombre_sede) VALUES ($1, $2, $3)',
      [nombre, direccion_exacta, nombre_sede]
    );
    res.status(201).json({ message: 'Edificación agregada exitosamente.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'La edificación ya existe en esta sede.' });
    if (err.code === '23503') return res.status(400).json({ error: 'La sede indicada no existe.' });
    console.error('Error POST /edificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/infraestructura/edificaciones/:nombre/:sede (HU-39, HU-45)
router.put('/edificaciones/:nombre/:sede', auth, autorizar('director', 'admin'), async (req, res) => {
  const { nombre: nombreViejo, sede: sedeVieja } = req.params;
  const { nombre: nombreNuevo, nombre_sede: sedeNueva, direccion_exacta } = req.body;
  if (!nombreNuevo || !sedeNueva || !direccion_exacta) return res.status(400).json({ error: 'Todos los campos son obligatorios.' });

  try {
    const { rowCount } = await pool.query(
      'UPDATE Edificacion SET nombre = $1, nombre_sede = $2, direccion_exacta = $3 WHERE nombre = $4 AND nombre_sede = $5',
      [nombreNuevo, sedeNueva, direccion_exacta, nombreViejo, sedeVieja]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Edificación no encontrada.' });
    res.json({ message: 'Edificación actualizada correctamente.' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'No se puede editar porque hay espacios físicos asociados (o la nueva sede no existe).' });
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una edificación con ese nombre en esa sede.' });
    console.error('Error PUT /edificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


// ─── SERVICIOS PÚBLICOS (HU-41) ───────────────────────────

// GET /api/infraestructura/servicios
router.get('/servicios', async (req, res) => {
  // Accesible sin auth (o con auth, pero la HU-41 dice Público externo, por lo que puede ser publico o para miembros)
  try {
    const { rows } = await pool.query(`
      SELECT s.nombre, s.numero_servicio, s.descripcion, s.precio_base, s.nombre_categoria, s.nombre_sede,
             COALESCE(ei.nombre, ee.razon_social, 'Entidad ' || s.ID_EP) AS entidad_nombre
      FROM Servicio s
      LEFT JOIN EntidadInterna ei ON ei.ID_EP = s.ID_EP
      LEFT JOIN EntidadExterna ee ON ee.ID_EP = s.ID_EP
      ORDER BY s.nombre_sede, s.nombre
    `);
    res.json({ servicios: rows });
  } catch (err) {
    console.error('Error GET /servicios:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


// ─── ESPACIOS FÍSICOS (HU-42, HU-43) ──────────────────────

// GET /api/infraestructura/espacios
router.get('/espacios', auth, async (req, res) => {
  const { sede, disponibilidad } = req.query;
  try {
    let query = 'SELECT numero, nombre_edif, direccion_exacta, nombre_sede, capacidad_max, disponibilidad FROM EspacioFisico WHERE 1=1';
    const params = [];
    if (sede) {
      params.push(sede);
      query += ` AND nombre_sede = $${params.length}`;
    }
    if (disponibilidad) {
      params.push(disponibilidad);
      query += ` AND disponibilidad = $${params.length}`;
    }
    query += ' ORDER BY nombre_sede, nombre_edif, numero';
    
    const { rows } = await pool.query(query, params);
    res.json({ espacios: rows });
  } catch (err) {
    console.error('Error GET /espacios:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/infraestructura/espacios (HU-42) - Director/Admin
router.post('/espacios', auth, autorizar('director', 'admin'), async (req, res) => {
  const { numero, nombre_edif, nombre_sede, capacidad_max, disponibilidad } = req.body;
  if (!numero || !nombre_edif || !nombre_sede || !capacidad_max || !disponibilidad) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  try {
    // Buscar la direccion_exacta de la edificación automáticamente
    const edif = await pool.query('SELECT direccion_exacta FROM Edificacion WHERE nombre = $1 AND nombre_sede = $2 LIMIT 1', [nombre_edif, nombre_sede]);
    if (edif.rowCount === 0) return res.status(400).json({ error: 'La edificación indicada no existe.' });
    
    const direccion_exacta = edif.rows[0].direccion_exacta;

    await pool.query(
      'INSERT INTO EspacioFisico (numero, nombre_edif, direccion_exacta, nombre_sede, capacidad_max, disponibilidad) VALUES ($1, $2, $3, $4, $5, $6)',
      [numero, nombre_edif, direccion_exacta, nombre_sede, capacidad_max, disponibilidad]
    );
    res.status(201).json({ message: 'Espacio físico agregado exitosamente.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El espacio ya existe.' });
    console.error('Error POST /espacios:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/infraestructura/espacios/:numero/:edif/:sede (HU-43) - Director/Admin
router.put('/espacios/:numero/:edif/:sede', auth, autorizar('director', 'admin'), async (req, res) => {
  const { numero: numViejo, edif: edifViejo, sede: sedeVieja } = req.params;
  const { numero: numNuevo, nombre_edif: edifNuevo, nombre_sede: sedeNueva, capacidad_max, disponibilidad } = req.body;

  if (!numNuevo || !edifNuevo || !sedeNueva || !capacidad_max || !disponibilidad) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para actualizar el espacio.' });
  }

  try {
    // Necesitamos la dirección exacta de la nueva edificación para mantener la PK válida
    const edifCheck = await pool.query('SELECT direccion_exacta FROM Edificacion WHERE nombre = $1 AND nombre_sede = $2 LIMIT 1', [edifNuevo, sedeNueva]);
    if (edifCheck.rowCount === 0) return res.status(400).json({ error: 'La nueva edificación indicada no existe.' });
    const direccion_exacta = edifCheck.rows[0].direccion_exacta;

    const { rowCount } = await pool.query(
      'UPDATE EspacioFisico SET numero = $1, nombre_edif = $2, direccion_exacta = $3, nombre_sede = $4, capacidad_max = $5, disponibilidad = $6 WHERE numero = $7 AND nombre_edif = $8 AND nombre_sede = $9',
      [numNuevo, edifNuevo, direccion_exacta, sedeNueva, capacidad_max, disponibilidad, numViejo, edifViejo, sedeVieja]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Espacio físico no encontrado.' });
    res.json({ message: 'Espacio físico actualizado correctamente.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe otro espacio con ese número en esa edificación.' });
    if (err.code === '23503') return res.status(409).json({ error: 'Error de integridad referencial al editar.' });
    console.error('Error PUT /espacios:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
