const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const autorizar = require('../middleware/roles');

// GET /api/aliados (HU-46) - Admin
router.get('/', auth, autorizar('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT RIF AS rif, razon_social, fecha_vencimiento, tipo, ID_EP FROM EntidadExterna ORDER BY razon_social');
    
    // Anexar contactos para cada aliado
    for (let a of rows) {
      const { rows: contactos } = await pool.query('SELECT Nombre AS nombre, numero_tlf AS telefono FROM Contactos WHERE RIF = $1', [a.rif]);
      a.contactos = contactos;
    }
    
    res.json({ aliados: rows });
  } catch (err) {
    console.error('Error GET /aliados:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/aliados (HU-46) - Admin
router.post('/', auth, autorizar('admin'), async (req, res) => {
  const { RIF, razon_social, fecha_vencimiento, tipo, contactos } = req.body;
  if (!RIF || !razon_social || !fecha_vencimiento || !tipo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener nuevo ID_EP
    const { rows: epRows } = await client.query('SELECT COALESCE(MAX(ID_EP), 0) + 1 AS new_id FROM EntidadPrestadora');
    const newIdEp = epRows[0].new_id;

    // 2. Insertar EntidadPrestadora
    await client.query('INSERT INTO EntidadPrestadora (ID_EP) VALUES ($1)', [newIdEp]);

    // 3. Insertar EntidadExterna
    await client.query(
      'INSERT INTO EntidadExterna (RIF, razon_social, fecha_vencimiento, tipo, ID_EP) VALUES ($1, $2, $3, $4, $5)',
      [RIF, razon_social, fecha_vencimiento, tipo, newIdEp]
    );

    // 4. Insertar Contactos si los hay
    if (contactos && Array.isArray(contactos)) {
      for (const c of contactos) {
        if (c.nombre && c.telefono) {
          await client.query(
            'INSERT INTO Contactos (Nombre, numero_tlf, RIF) VALUES ($1, $2, $3)',
            [c.nombre, c.telefono, RIF]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Aliado registrado exitosamente.', ID_EP: newIdEp });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un aliado con este RIF.' });
    console.error('Error POST /aliados:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
});

// PUT /api/aliados/:rif (HU-46) - Admin
router.put('/:rif', auth, autorizar('admin'), async (req, res) => {
  const { rif } = req.params;
  const { razon_social, fecha_vencimiento, tipo } = req.body;

  if (!razon_social || !fecha_vencimiento || !tipo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para actualizar el aliado.' });
  }

  try {
    const { rowCount } = await pool.query(
      'UPDATE EntidadExterna SET razon_social = $1, fecha_vencimiento = $2, tipo = $3 WHERE RIF = $4',
      [razon_social, fecha_vencimiento, tipo, rif]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Aliado no encontrado.' });
    res.json({ message: 'Aliado actualizado correctamente.' });
  } catch (err) {
    console.error('Error PUT /aliados:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
