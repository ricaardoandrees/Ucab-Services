const router    = require('express').Router();
const jwt       = require('jsonwebtoken');
const pool      = require('../db');
const { Client } = require('pg');
const auth = require('../middleware/auth');
require('dotenv').config();

/* 
   HELPER: detectar subtipo y cargo del miembro dado su CI.
   ORDEN CRITICO: Becario y Preparador ANTES de Estudiante.
 */
async function detectarSubtipo(CI) {
  const tablas = [
    { tabla: 'Becario',                subtipo: 'Becario',                campoExtra: null    },
    { tabla: 'Preparador',             subtipo: 'Preparador',             campoExtra: null    },
    { tabla: 'Estudiante',             subtipo: 'Estudiante',             campoExtra: null    },
    { tabla: 'Profesor',               subtipo: 'Profesor',               campoExtra: null    },
    { tabla: 'PersonalAdministrativo', subtipo: 'PersonalAdministrativo', campoExtra: 'cargo' },
    { tabla: 'Egresado',               subtipo: 'Egresado',               campoExtra: null    },
  ];

  for (const { tabla, subtipo, campoExtra } of tablas) {
    const campo = campoExtra ? campoExtra : '1';
    const q = await pool.query(
      `SELECT ${campo} FROM ${tabla} WHERE CI = $1`, [CI]
    );
    if (q.rows.length > 0) {
      return {
        subtipo,
        cargo: campoExtra ? q.rows[0][campoExtra] : null
      };
    }
  }
  return { subtipo: 'Miembro', cargo: null };
}

router.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      `SELECT ci, primer_nombre, primer_apellido, correo, estado_de_cuenta
       FROM Miembro WHERE correo = $1`,
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const miembro = result.rows[0];

    if (miembro.estado_de_cuenta === 'Bloqueada') {
      return res.status(403).json({ error: 'Cuenta bloqueada por demasiados intentos fallidos. Contacta al administrador.' });
    }
    if (miembro.estado_de_cuenta === 'Suspendida') {
      return res.status(403).json({ error: 'Cuenta suspendida o pendiente de confirmacion. Contacta al administrador.' });
    }

    const clientDCL = new Client({
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     miembro.ci,
      password: contrasena
    });

    let contrasenaValida = false;
    try {
      await clientDCL.connect();
      await clientDCL.end();
      contrasenaValida = true;
    } catch {
      contrasenaValida = false;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM Sesion
       WHERE CI = $1
       AND intentos_fallidos > 0
       AND fecha_inicio > COALESCE(
         (SELECT MAX(fecha_inicio) FROM Sesion
          WHERE CI = $1 AND intentos_fallidos = 0),
         '1900-01-01'
       )`,
      [miembro.ci]
    );
    const intentosPrevios = parseInt(countResult.rows[0].total);
    const intentoActual   = contrasenaValida ? 0 : intentosPrevios + 1;

    const uid = (req.headers['user-agent'] || 'unknown').substring(0, 40);
    await pool.query(
      `INSERT INTO Sesion (fecha_inicio, uid_dispositivo, CI, intentos_fallidos, MFA)
       VALUES (NOW(), $1, $2, $3, 'Inactivo')`,
      [uid, miembro.ci, intentoActual]
    );

    if (!contrasenaValida) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const { subtipo, cargo } = await detectarSubtipo(miembro.ci);

    let rol = 'miembro';
    if (subtipo === 'PersonalAdministrativo') {
      if (cargo && cargo.toLowerCase().includes('director')) rol = 'director';
      else rol = 'admin';
    }

    const token = jwt.sign(
      { CI: miembro.ci, rol, subtipo, cargo, estado: miembro.estado_de_cuenta },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        CI:      miembro.ci,
        nombre:  `${miembro.primer_nombre} ${miembro.primer_apellido}`,
        correo:  miembro.correo,
        rol,
        subtipo,
        cargo,
        estado:  miembro.estado_de_cuenta
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/register', async (req, res) => {
  const {
    CI, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    fecha_nacimiento, sexo,
    calle1, estado, residencia,
    num_personal,
    correo,
    contrasena
  } = req.body;

  if (!CI || !primer_nombre || !primer_apellido || !correo || !contrasena ||
      !fecha_nacimiento || !sexo || !calle1 || !estado || !residencia || !num_personal) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!correo.includes('@ucab')) {
    return res.status(400).json({ error: 'El correo debe pertenecer al dominio institucional @ucab' });
  }

  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Miembro
        (ci, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
         fecha_nacimiento, sexo, calle1, estado, residencia, num_personal,
         correo, estado_de_cuenta, saldo_virtual)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Suspendida',0)
       RETURNING ci, primer_nombre, primer_apellido, correo, estado_de_cuenta`,
      [CI, primer_nombre, segundo_nombre || null, primer_apellido,
       segundo_apellido || null, fecha_nacimiento, sexo,
       calle1, estado, residencia, num_personal, correo]
    );

    const safeCI       = CI.replace(/"/g, '');
    const safePassword = contrasena.replace(/'/g, "''");
    await pool.query(`CREATE USER "${safeCI}" WITH PASSWORD '${safePassword}'`);
    await pool.query(`GRANT rol_operador TO "${safeCI}"`);

    res.status(201).json({
      mensaje: 'Miembro registrado exitosamente',
      miembro: result.rows[0]
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'La cédula o correo ya está registrado' });
    }
    console.error('Error en register:', err);
    res.status(500).json({ error: err.detail || err.message || 'Error interno del servidor' });
  }
});

router.patch('/cambiar-password', auth, async (req, res) => {
  const { contrasena_actual, contrasena_nueva } = req.body;
  const ci = req.usuario.CI;

  if (!contrasena_actual || !contrasena_nueva) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  if (contrasena_nueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  const clientDCL = new Client({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     ci,
    password: contrasena_actual
  });

  try {
    await clientDCL.connect();
    await clientDCL.end();
  } catch {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
  }

  try {
    const safeCI       = ci.replace(/"/g, '');
    const safePassword = contrasena_nueva.replace(/'/g, "''");
    await pool.query(`ALTER USER "${safeCI}" WITH PASSWORD '${safePassword}'`);
    await pool.query(`UPDATE Miembro SET ult_fecha_cambio = NOW() WHERE ci = $1`, [ci]);
    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Error cambiar-password:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;