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
    { tabla: 'Becario',                subtipo: 'Becario'                },
    { tabla: 'Preparador',             subtipo: 'Preparador'             },
    { tabla: 'Estudiante',             subtipo: 'Estudiante'             },
    { tabla: 'Profesor',               subtipo: 'Profesor'               },
    { tabla: 'PersonalAdministrativo', subtipo: 'PersonalAdministrativo' },
    { tabla: 'Egresado',               subtipo: 'Egresado'               },
  ];

  for (const { tabla, subtipo } of tablas) {
    if (tabla === 'PersonalAdministrativo') {
      const q = await pool.query(
        `SELECT cargo, adscripcion_presupuestaria FROM PersonalAdministrativo WHERE CI = $1`, [CI]
      );
      if (q.rows.length > 0) {
        return { subtipo, cargo: q.rows[0].cargo, adscripcion: q.rows[0].adscripcion_presupuestaria };
      }
      continue;
    }
    const q = await pool.query(`SELECT 1 FROM ${tabla} WHERE CI = $1`, [CI]);
    if (q.rows.length > 0) return { subtipo, cargo: null, adscripcion: null };
  }
  return { subtipo: 'Miembro', cargo: null, adscripcion: null };
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
      return loginEntidadExterna(req, res, correo, contrasena);
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

    const { subtipo, cargo, adscripcion } = await detectarSubtipo(miembro.ci);

    let rol = 'miembro';
    if (subtipo === 'PersonalAdministrativo') {
      if (cargo && cargo.toLowerCase().includes('director')) rol = 'director';
      else rol = 'admin';
    }

    const token = jwt.sign(
      { CI: miembro.ci, rol, subtipo, cargo, adscripcion, estado: miembro.estado_de_cuenta },
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
        adscripcion,
        estado:  miembro.estado_de_cuenta
      }
    });

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/*
   Login de Entidad Externa (aliado comercial / concesionario).
   Se llama cuando el correo no matchea ningun Miembro. A diferencia del
   login de Miembro, no lleva Sesion/bloqueo por intentos fallidos: esa
   auditoria esta atada por FK a Miembro(CI) y una entidad externa no es
   un Miembro.
*/
async function loginEntidadExterna(req, res, correo, contrasena) {
  try {
    const result = await pool.query(
      `SELECT RIF, razon_social, tipo, correo FROM EntidadExterna WHERE correo = $1`,
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const entidad = result.rows[0];

    const clientDCL = new Client({
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     entidad.rif,
      password: contrasena
    });

    try {
      await clientDCL.connect();
      await clientDCL.end();
    } catch {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { RIF: entidad.rif, rol: 'aliado_externo', tipo: 'entidad_externa', razon_social: entidad.razon_social },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        RIF:          entidad.rif,
        nombre:       entidad.razon_social,
        correo:       entidad.correo,
        rol:          'aliado_externo',
        tipo:         'entidad_externa',
        tipo_entidad: entidad.tipo
      }
    });
  } catch (err) {
    console.error('Error en login de entidad externa:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

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

  // BEGIN/COMMIT/ROLLBACK en un client dedicado (no en el pool compartido):
  // si el CREATE USER falla, el ROLLBACK debe deshacer tambien el INSERT
  // en Miembro, o queda una ficha huerfana sin contrasena (como paso antes).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
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
    await client.query(`CREATE USER "${safeCI}" WITH PASSWORD '${safePassword}'`);
    await client.query(`GRANT rol_operador TO "${safeCI}"`);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Miembro registrado exitosamente',
      miembro: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'La cédula o correo ya está registrado' });
    }
    console.error('Error en register:', err);
    res.status(500).json({ error: err.detail || err.message || 'Error interno del servidor' });
  } finally {
    client.release();
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