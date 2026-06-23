/* ============================================================
   routes/miembros.js
   HU-03: Admin consulta ficha de un miembro
   HU-04: Miembro consulta su propia ficha
   HU-05: Miembro actualiza sus datos de contacto
   HU-06: Admin elimina un miembro
   HU-07: Admin modifica datos personales de un miembro
   HU-08: Miembro consulta ultima fecha de cambio de contraseña
   HU-09: Admin actualiza estado de cuenta
   HU-10: Admin audita historial de sesiones
============================================================ */

const router   = require('express').Router();
const pool     = require('../db');
const auth     = require('../middleware/auth');
const  autorizar  = require('../middleware/roles');

/*
   GET /api/miembros
   Lista todos los miembros. Solo admin y director.
   HU-03 (vista admin)
 */
router.get('/', auth, autorizar('admin', 'director'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ci, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              correo, num_personal, fecha_nacimiento, sexo,
              calle1, estado, residencia, estado_de_cuenta, saldo_virtual
       FROM Miembro
       ORDER BY primer_apellido, primer_nombre`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error GET /miembros:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* 
   GET /api/miembros/:ci
   Obtiene la ficha de un miembro.
   - El propio miembro puede ver su ficha (HU-04)
   - Admin/director puede ver cualquiera   (HU-03)
 */
router.get('/:ci', auth, async (req, res) => {
  const { ci } = req.params;
  const usuario = req.usuario;

  // Un miembro solo puede ver su propia ficha
  if (usuario.rol === 'miembro' && usuario.CI !== ci) {
    return res.status(403).json({ error: 'No tienes permiso para ver esta ficha.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ci, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              correo, num_personal, fecha_nacimiento, sexo,
              calle1, estado, residencia, estado_de_cuenta, saldo_virtual, ult_fecha_cambio
       FROM Miembro WHERE ci = $1`,
      [ci]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Miembro no encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error GET /miembros/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/*
   PUT /api/miembros/:ci
   Admin modifica los datos personales de un miembro. (HU-07)
   No permite cambiar CI, correo ni estado_de_cuenta
   (esos tienen sus propios endpoints).
 */
router.put('/:ci', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const {
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    fecha_nacimiento, sexo, num_personal, calle1, estado, residencia
  } = req.body;

  if (!primer_nombre || !primer_apellido || !fecha_nacimiento ||
      !sexo || !calle1 || !estado || !residencia || !num_personal) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE Miembro SET
         primer_nombre   = $1,  segundo_nombre  = $2,
         primer_apellido = $3,  segundo_apellido = $4,
         fecha_nacimiento= $5,  sexo            = $6,
         num_personal    = $7,  calle1          = $8,
         estado          = $9,  residencia      = $10
       WHERE ci = $11`,
      [primer_nombre, segundo_nombre || null, primer_apellido, segundo_apellido || null,
       fecha_nacimiento, sexo, num_personal, calle1, estado, residencia, ci]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Miembro no encontrado.' });

    res.json({ mensaje: 'Datos actualizados correctamente.' });
  } catch (err) {
    console.error('Error PUT /miembros/:ci:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* 
   PATCH /api/miembros/:ci/contacto
   El propio miembro actualiza su dirección y teléfono. (HU-05)
*/
router.patch('/:ci/contacto', auth, async (req, res) => {
  const { ci } = req.params;
  const usuario = req.usuario;

  // Solo el propio miembro puede editar su contacto
  if (usuario.CI !== ci) {
    return res.status(403).json({ error: 'Solo puedes editar tu propio contacto.' });
  }

  const { num_personal, calle1, estado, residencia } = req.body;

  if (!num_personal || !calle1 || !estado || !residencia) {
    return res.status(400).json({ error: 'Faltan campos: num_personal, calle1, estado, residencia.' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE Miembro SET
         num_personal = $1, calle1 = $2, estado = $3, residencia = $4
       WHERE ci = $5`,
      [num_personal, calle1, estado, residencia, ci]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Miembro no encontrado.' });

    res.json({ mensaje: 'Datos de contacto actualizados.' });
  } catch (err) {
    console.error('Error PATCH /miembros/:ci/contacto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/*
   PATCH /api/miembros/:ci/estado
   Admin cambia el estado de cuenta de un miembro. (HU-09)
 */
router.patch('/:ci/estado', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { estado_de_cuenta } = req.body;

  const ESTADOS_VALIDOS = ['Activa', 'Suspendida', 'Bloqueada'];
  if (!ESTADOS_VALIDOS.includes(estado_de_cuenta)) {
    return res.status(400).json({ error: `Estado inválido. Valores válidos: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE Miembro SET estado_de_cuenta = $1 WHERE ci = $2`,
      [estado_de_cuenta, ci]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Miembro no encontrado.' });

    res.json({ mensaje: `Estado actualizado a "${estado_de_cuenta}".` });
  } catch (err) {
    console.error('Error PATCH /miembros/:ci/estado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* 
   DELETE /api/miembros/:ci
   Admin elimina un miembro registrado por error. (HU-06)
   ON DELETE CASCADE en la BD elimina registros dependientes.
 */
router.delete('/:ci', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM Miembro WHERE ci = $1`, [ci]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Miembro no encontrado.' });

    res.json({ mensaje: 'Miembro eliminado correctamente.' });
  } catch (err) {
    console.error('Error DELETE /miembros/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* 
   GET /api/miembros/:ci/ult-cambio
   Consulta la última fecha de cambio de contraseña. (HU-08)
 */
router.get('/:ci/ult-cambio', auth, async (req, res) => {
  const { ci } = req.params;
  const usuario = req.usuario;

  if (usuario.rol === 'miembro' && usuario.CI !== ci) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ult_fecha_cambio FROM Miembro WHERE ci = $1`, [ci]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Miembro no encontrado.' });

    res.json({ ult_fecha_cambio: rows[0].ult_fecha_cambio });
  } catch (err) {
    console.error('Error GET /miembros/:ci/ult-cambio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* 
   GET /api/miembros/:ci/sesiones
   Admin audita el historial de sesiones de un miembro. (HU-10)
 */
router.get('/:ci/sesiones', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT fecha_inicio, uid_dispositivo, geolocalizacion, intentos_fallidos, MFA
       FROM Sesion WHERE CI = $1
       ORDER BY fecha_inicio DESC`,
      [ci]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error GET /miembros/:ci/sesiones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;