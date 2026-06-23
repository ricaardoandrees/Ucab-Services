/* ============================================================
   routes/vehiculos.js
   HU-89: Miembro registra su vehículo            POST   /api/vehiculos
   HU-90: Miembro consulta sus vehículos          GET    /api/vehiculos
   HU-91: Miembro elimina un vehículo             DELETE /api/vehiculos/:placa
   HU-92: Admin consulta vehículos de un miembro  GET    /api/vehiculos/miembro/:ci
============================================================ */

const router      = require('express').Router();
const pool        = require('../db');
const auth        = require('../middleware/auth');
const autorizar   = require('../middleware/roles');

/* ----------------------------------------------------------
   HU-89: Registrar vehículo
   Body: { placa, modelo, color, tipo, ano }
   Requiere: token de miembro
---------------------------------------------------------- */
router.post('/', auth, async (req, res) => {
  const { placa, modelo, color, tipo, ano } = req.body;
  const CI = req.usuario.CI;

  if (!placa || !modelo || !color || !tipo || !ano) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios: placa, modelo, color, tipo, ano.' });
  }

  if (!['Moto', 'Carro'].includes(tipo)) {
    return res.status(400).json({ error: 'El tipo debe ser "Moto" o "Carro".' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Vehiculo (Placa, Modelo, Color, Tipo, Ano, CI)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [placa.toUpperCase(), modelo, color, tipo, parseInt(ano), CI]
    );

    res.status(201).json({
      mensaje: 'Vehículo registrado exitosamente.',
      vehiculo: result.rows[0]
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un vehículo con esa placa.' });
    }
    console.error('Error POST /vehiculos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-90: Consultar mis vehículos
   Requiere: token de miembro
---------------------------------------------------------- */
router.get('/', auth, async (req, res) => {
  const CI = req.usuario.CI;

  try {
    const { rows } = await pool.query(
      `SELECT Placa, Modelo, Color, Tipo, Ano
       FROM Vehiculo
       WHERE CI = $1
       ORDER BY Placa`,
      [CI]
    );

    res.json({ total: rows.length, vehiculos: rows });

  } catch (err) {
    console.error('Error GET /vehiculos:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-91: Eliminar un vehículo
   Requiere: token — solo puede eliminar los suyos
---------------------------------------------------------- */
router.delete('/:placa', auth, async (req, res) => {
  const placa = req.params.placa.toUpperCase();
  const CI    = req.usuario.CI;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM Vehiculo WHERE Placa = $1 AND CI = $2`,
      [placa, CI]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado o no te pertenece.' });
    }

    res.json({ mensaje: `Vehículo ${placa} eliminado correctamente.` });

  } catch (err) {
    console.error('Error DELETE /vehiculos/:placa:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ----------------------------------------------------------
   HU-92: Admin consulta los vehículos de un miembro
   Requiere: token de admin o director
---------------------------------------------------------- */
router.get('/miembro/:ci', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;

  try {
    // Verificar que el miembro existe
    const miembro = await pool.query(
      `SELECT CI, primer_nombre, primer_apellido FROM Miembro WHERE CI = $1`,
      [ci]
    );

    if (miembro.rowCount === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado.' });
    }

    const { rows } = await pool.query(
      `SELECT Placa, Modelo, Color, Tipo, Ano
       FROM Vehiculo WHERE CI = $1 ORDER BY Placa`,
      [ci]
    );

    res.json({
      miembro: {
        CI: miembro.rows[0].ci,
        nombre: `${miembro.rows[0].primer_nombre} ${miembro.rows[0].primer_apellido}`
      },
      total: rows.length,
      vehiculos: rows
    });

  } catch (err) {
    console.error('Error GET /vehiculos/miembro/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
