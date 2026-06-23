const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const pool   = require('../db');
// const bcrypt = require('bcryptjs'); // TODO: descomentar cuando Marlene confirme opcion B (columna contrasena)

/* ============================================================
   HELPER: detectar subtipo y cargo del miembro dado su CI.
   ORDEN CRITICO: Becario y Preparador ANTES de Estudiante porque
   ambos son subclases — un Becario aparece en Becario Y en
   Estudiante, así que si consultamos Estudiante primero obtenemos
   el subtipo equivocado.
============================================================ */
async function detectarSubtipo(CI) {
  const tablas = [
    { tabla: 'Becario',                subtipo: 'Becario',                campoExtra: null   },
    { tabla: 'Preparador',             subtipo: 'Preparador',             campoExtra: null   },
    { tabla: 'Estudiante',             subtipo: 'Estudiante',             campoExtra: null   },
    { tabla: 'Profesor',               subtipo: 'Profesor',               campoExtra: null   },
    { tabla: 'PersonalAdministrativo', subtipo: 'PersonalAdministrativo', campoExtra: 'cargo'},
    { tabla: 'Egresado',               subtipo: 'Egresado',               campoExtra: null   },
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

/* ============================================================
   POST /api/auth/login
   HU-12: el trigger RN-03 bloquea automaticamente al llegar a 3
   intentos fallidos (INSERT en Sesion lo dispara en la BD).
   TODO (pendiente Marlene):
     Opcion A — DCL:
       const client = new Client({...dbConfig, user: CI, password: contrasena});
       await client.connect(); // lanza error si credenciales incorrectas
       await client.end();
     Opcion B — columna contrasena:
       const ok = await bcrypt.compare(contrasena, miembro.contrasena);
       if (!ok) { registrar intento fallido; return 401; }
   Por ahora: cualquier correo que exista en la BD puede hacer login.
============================================================ */
router.post('/login', async (req, res) => {
  const { correo } = req.body;
  // TODO: agregar 'contrasena' al destructuring cuando Marlene confirme

  if (!correo) {
    return res.status(400).json({ error: 'El correo es requerido' });
  }

  try {
    const result = await pool.query(
      `SELECT ci, primer_nombre, primer_apellido, correo, estado_de_cuenta, saldo_virtual
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
      return res.status(403).json({ error: 'Cuenta suspendida. Contacta al administrador.' });
    }

    // TODO: verificar contrasena aqui (ver comentario de arriba)
    // const contrasenaValida = await bcrypt.compare(contrasena, miembro.contrasena);

    // Registrar sesion — el trigger RN-03 cuenta intentos_fallidos y bloquea al llegar a 3
    const uid = (req.headers['user-agent'] || 'unknown').substring(0, 40);
    await pool.query(
      `INSERT INTO Sesion (fecha_inicio, uid_dispositivo, CI, intentos_fallidos, MFA)
       VALUES (NOW(), $1, $2, $3, 'Inactivo')`,
      [uid, miembro.ci, 0]  // TODO: cambiar 0 por (contrasenaValida ? 0 : 1)
    );

    const { subtipo, cargo } = await detectarSubtipo(miembro.ci);

    // Determinar rol JWT segun subtipo y cargo
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

/* ============================================================
   POST /api/auth/register
   HU-01: registrar datos personales del miembro.
   Columnas reales de Miembro (NO tiene 'direccion' ni 'telefono'):
     direccion → calle1 + estado + residencia
     telefono  → num_personal
   TODO (pendiente Marlene):
     Opcion A — DCL: CREATE USER "$CI" WITH PASSWORD $1; GRANT rol_operador TO "$CI";
     Opcion B — columna contrasena: agregar hash al INSERT
============================================================ */
router.post('/register', async (req, res) => {
  const {
    CI, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    fecha_nacimiento, sexo,
    calle1, estado, residencia,  // direccion dividida en 3 campos
    num_personal,                // telefono
    correo
    // TODO: agregar 'contrasena' cuando Marlene confirme
  } = req.body;

  if (!CI || !primer_nombre || !primer_apellido || !correo ||
      !fecha_nacimiento || !sexo || !calle1 || !estado || !residencia || !num_personal) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // RN-02: correo institucional
  if (!correo.includes('@ucab')) {
    return res.status(400).json({ error: 'El correo debe pertenecer al dominio institucional @ucab' });
  }

  try {
    // TODO Opcion B: const hash = await bcrypt.hash(contrasena, 10);

    const result = await pool.query(
      `INSERT INTO Miembro
        (ci, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
         fecha_nacimiento, sexo, calle1, estado, residencia, num_personal,
         correo, estado_de_cuenta, saldo_virtual)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Activa',0)
       RETURNING ci, primer_nombre, primer_apellido, correo, estado_de_cuenta`,
      [CI, primer_nombre, segundo_nombre || null, primer_apellido,
       segundo_apellido || null, fecha_nacimiento, sexo,
       calle1, estado, residencia, num_personal, correo]
    );

    res.status(201).json({
      mensaje: 'Miembro registrado exitosamente',
      miembro: result.rows[0]
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'La cédula o correo ya está registrado' });
    }
    console.error('Error en register:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

module.exports = router;