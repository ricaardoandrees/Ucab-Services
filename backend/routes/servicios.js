const router      = require('express').Router();
const pool        = require('../db');
const auth        = require('../middleware/auth');
const autorizar   = require('../middleware/roles');

/* ----------------------------------------------------------
   Catálogo de Servicios
   GET /api/servicios
---------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const query = 'SELECT * FROM Servicio ORDER BY nombre_categoria, nombre';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /servicios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ----------------------------------------------------------
   Crear Nuevo Servicio (Admin y Personal Administrativo)
   POST /api/servicios
   Body: { nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede }
---------------------------------------------------------- */
router.post('/', auth, autorizar('admin', 'director'), async (req, res) => {
  const { nombre, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede } = req.body;

  try {
    const numRes = await pool.query(`SELECT COALESCE(MAX(numero_servicio), 0) + 1 AS next_num FROM Servicio WHERE nombre = $1`, [nombre]);
    const numero_servicio = numRes.rows[0].next_num;

    const query = `
      INSERT INTO Servicio (nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `;
    const result = await pool.query(query, [nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede]);
    res.status(201).json({ mensaje: 'Servicio creado exitosamente', servicio: result.rows[0] });
  } catch (err) {
    console.error('Error POST /servicios:', err);
    res.status(500).json({ error: 'Error al crear el servicio' });
  }
});

/* ----------------------------------------------------------
   Configuración de Plantilla (Admin y Personal)
   POST /api/servicios/:nombre/:numero/plantillas
   Body: { numero_paso, descripcion, unidad_responsable }
---------------------------------------------------------- */
router.post('/:nombre/:numero/plantillas', auth, autorizar('admin', 'director'), async (req, res) => {
  const { nombre, numero } = req.params;
  const { numero_paso, descripcion, unidad_responsable } = req.body;

  try {
    const query = `
      INSERT INTO PlantillaPaso (nombre_servicio, numero_servicio, numero_paso, descripcion, unidad_responsable)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await pool.query(query, [nombre, numero, numero_paso, descripcion, unidad_responsable]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error POST /plantillas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ----------------------------------------------------------
   Crear Solicitud (HU-57)
   POST /api/servicios/:nombre/:numero/solicitudes
   Body: { documentos: ['url1', 'url2'] }
---------------------------------------------------------- */
router.post('/:nombre/:numero/solicitudes', auth, async (req, res) => {
  const { nombre, numero } = req.params;
  const { documentos } = req.body; // Array de URLs (HU-57 simulada)
  const CI = req.usuario.CI;

  try {
    await pool.query('BEGIN'); // Transacción manual para los documentos

    // 1. Insertar la solicitud (Esto dispara trg_generar_pasos_solicitud)
    const fechaHora = new Date();
    const querySolicitud = `
      INSERT INTO Solicitud (fecha_hora_creacion, CI, nombre_servicio, numero_servicio, estado)
      VALUES ($1, $2, $3, $4, 'En Proceso') RETURNING *
    `;
    const resultSolicitud = await pool.query(querySolicitud, [fechaHora, CI, nombre, numero]);

    // 2. Insertar los documentos asociados (HU-57)
    if (documentos && documentos.length > 0) {
      const queryDoc = `
        INSERT INTO Documento_Solicitud (fecha_hora_creacion_solicitud, ruta_archivo)
        VALUES ($1, $2)
      `;
      for (const url of documentos) {
        await pool.query(queryDoc, [fechaHora, url]);
      }
    }

    await pool.query('COMMIT');
    res.status(201).json({ 
      mensaje: 'Solicitud creada con éxito. Los pasos se generaron automáticamente.',
      solicitud: resultSolicitud.rows[0]
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error POST /solicitudes:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

/* ----------------------------------------------------------
   Consultar Mis Solicitudes
   GET /api/servicios/mis-solicitudes
---------------------------------------------------------- */
router.get('/mis-solicitudes', auth, async (req, res) => {
  const CI = req.usuario.CI;
  try {
    const result = await pool.query(
      `SELECT fecha_hora_creacion, estado, nombre_servicio, numero_servicio 
       FROM Solicitud 
       WHERE ci = $1 
       ORDER BY fecha_hora_creacion DESC`,
      [CI]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /mis-solicitudes:', err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

/* ----------------------------------------------------------
   Consultar Pasos Pendientes (HU-68, para el funcionario)
   GET /api/servicios/pasos/pendientes
---------------------------------------------------------- */
router.get('/pasos/pendientes', auth, autorizar('admin', 'director'), async (req, res) => {
  const CI = req.usuario.CI;

  try {
    // 1. Buscar a qué unidad pertenece el empleado
    const queryAdmin = 'SELECT adscripcion_presupuestaria FROM PersonalAdministrativo WHERE CI = $1';
    const resultAdmin = await pool.query(queryAdmin, [CI]);
    
    if (resultAdmin.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes un rol administrativo activo' });
    }

    const unidad = resultAdmin.rows[0].adscripcion_presupuestaria;

    // 2. Buscar pasos pendientes para esa unidad
    const queryPasos = `
      SELECT p.*, s.nombre_servicio, s.CI as solicitante,
             TO_CHAR(p.fecha_hora_creacion_solicitud, 'YYYY-MM-DD HH24:MI:SS.MS') as raw_fecha
      FROM Paso_Actividad p
      JOIN Solicitud s ON p.fecha_hora_creacion_solicitud = s.fecha_hora_creacion
      WHERE p.estado = 'Pendiente' AND p.unidad_responsable = $1
      ORDER BY p.fecha_hora_creacion_solicitud ASC, p.numero_paso ASC
    `;
    const resultPasos = await pool.query(queryPasos, [unidad]);
    res.json(resultPasos.rows);
  } catch (err) {
    console.error('Error GET /pasos/pendientes:', err);
    res.status(500).json({ error: 'Error al consultar pasos pendientes' });
  }
});

/* ----------------------------------------------------------
   Completar Paso (HU-68)
   PATCH /api/servicios/pasos
   Body: { numero_paso, fecha_hora_creacion_solicitud }
---------------------------------------------------------- */
router.patch('/pasos', auth, autorizar('admin', 'director'), async (req, res) => {
  const CI = req.usuario.CI;
  const { numero_paso, fecha_hora_creacion_solicitud } = req.body;

  try {
    const fechaHoraFin = new Date();
    const query = `
      UPDATE Paso_Actividad 
      SET estado = 'Completado', CI = $1, fecha_hora_finalizado = $2
      WHERE numero_paso = $3 AND fecha_hora_creacion_solicitud = $4
      RETURNING *
    `;
    const result = await pool.query(query, [CI, fechaHoraFin, numero_paso, fecha_hora_creacion_solicitud]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paso no encontrado' });
    }

    res.json({ mensaje: 'Paso completado', paso: result.rows[0] });
  } catch (err) {
    // Si el trigger trg_validar_secuencia_pasos salta, caerá aquí
    console.error('Error PATCH /pasos:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
