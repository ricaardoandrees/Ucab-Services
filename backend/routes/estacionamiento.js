const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const autorizar = require('../middleware/roles');

// ── 1. Obtener todos los Estacionamientos y Puestos ──
router.get('/', auth, async (req, res) => {
  try {
    const estQuery = `SELECT * FROM Estacionamiento`;
    const ptoQuery = `SELECT * FROM Puesto_Estacionamiento ORDER BY numero ASC`;
    
    const estRes = await db.query(estQuery);
    const ptoRes = await db.query(ptoQuery);

    const estacionamientos = estRes.rows.map(e => {
      e.puestos = ptoRes.rows.filter(p => p.nombre_estacionamiento === e.nombre && p.nombre_sede === e.nombre_sede);
      return e;
    });

    res.json(estacionamientos);
  } catch (err) {
    console.error('Error GET /estacionamiento:', err);
    res.status(500).json({ error: 'Error al obtener estacionamientos' });
  }
});

// ── 2. Crear Estacionamiento ──
router.post('/', auth, autorizar('admin', 'director'), async (req, res) => {
  const { nombre, nombre_sede, capacidad_maxima, ubicacion } = req.body;
  try {
    const query = `
      INSERT INTO Estacionamiento (nombre, nombre_sede, capacidad_maxima, ubicacion)
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const result = await db.query(query, [nombre, nombre_sede, capacidad_maxima, ubicacion]);
    res.status(201).json({ mensaje: 'Estacionamiento creado', estacionamiento: result.rows[0] });
  } catch (err) {
    console.error('Error POST /estacionamiento:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── 3. Crear Puesto ──
router.post('/puestos', auth, autorizar('admin', 'director'), async (req, res) => {
  const { nombre_estacionamiento, nombre_sede, tipo_vehiculo } = req.body;
  try {
    const queryNum = `SELECT COALESCE(MAX(numero), 0) + 1 AS next_num FROM Puesto_Estacionamiento WHERE nombre_estacionamiento = $1 AND nombre_sede = $2`;
    const resNum = await db.query(queryNum, [nombre_estacionamiento, nombre_sede]);
    const numero = resNum.rows[0].next_num;

    const query = `
      INSERT INTO Puesto_Estacionamiento (numero, nombre_estacionamiento, nombre_sede, estado, tipo_vehiculo)
      VALUES ($1, $2, $3, 'Libre', $4) RETURNING *
    `;
    const result = await db.query(query, [numero, nombre_estacionamiento, nombre_sede, tipo_vehiculo]);
    res.status(201).json({ mensaje: 'Puesto creado', puesto: result.rows[0] });
  } catch (err) {
    console.error('Error POST /estacionamiento/puestos:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── 4. Actualizar Estado de Puesto (Mantenimiento, etc) ──
router.patch('/puestos', auth, autorizar('admin', 'director'), async (req, res) => {
  const { numero, nombre_estacionamiento, nombre_sede, estado } = req.body;
  try {
    const query = `
      UPDATE Puesto_Estacionamiento
      SET estado = $1
      WHERE numero = $2 AND nombre_estacionamiento = $3 AND nombre_sede = $4
      RETURNING *
    `;
    const result = await db.query(query, [estado, numero, nombre_estacionamiento, nombre_sede]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Puesto no encontrado' });
    res.json({ mensaje: 'Estado de puesto actualizado', puesto: result.rows[0] });
  } catch (err) {
    console.error('Error PATCH /estacionamiento/puestos:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
