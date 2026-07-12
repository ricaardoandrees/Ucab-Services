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
   Consultar Disponibilidad (Bloques Horarios)
   GET /api/servicios/reservas/disponibilidad?fecha=YYYY-MM-DD&puesto=X&est=Y&sede_puesto=Z o espacio=X&edif=Y&sede_espacio=Z
---------------------------------------------------------- */
router.get('/reservas/disponibilidad', auth, async (req, res) => {
  const { fecha, puesto, est, sede_puesto, espacio, edif, sede_espacio } = req.query;
  try {
    let q = `
      SELECT fecha_hora, fecha_hora_fin 
      FROM Reserva 
      WHERE DATE(fecha_hora) = $1 
      AND estado IN ('Pendiente', 'Confirmada')
    `;
    let params = [fecha];

    if (puesto && est && sede_puesto) {
      q += ` AND numero_puesto = $2 AND nombre_estacionamiento = $3 AND nombre_sede_puesto = $4`;
      params.push(puesto, est, sede_puesto);
    } else if (espacio && edif && sede_espacio) {
      q += ` AND numero_espacio = $2 AND nombre_edif = $3 AND nombre_sede_espacio = $4`;
      params.push(espacio, edif, sede_espacio);
    } else {
      return res.status(400).json({ error: 'Faltan parámetros de puesto o espacio' });
    }

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /disponibilidad:', err);
    res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
});

/* ----------------------------------------------------------
   Crear Nuevo Servicio (Admin y Personal Administrativo)
   POST /api/servicios
   Body: { nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede, espacio }
   espacio (opcional): { numero, edificio, direccion, sede } — solo para servicios de alquiler de espacio
---------------------------------------------------------- */
router.post('/', auth, autorizar('admin', 'director'), async (req, res) => {
  const { nombre, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede, espacio } = req.body;

  try {
    const numRes = await pool.query(`SELECT COALESCE(MAX(numero_servicio), 0) + 1 AS next_num FROM Servicio WHERE nombre = $1`, [nombre]);
    const numero_servicio = numRes.rows[0].next_num;

    const query = `
      INSERT INTO Servicio (nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede, numero_espacio, nombre_edif, direccion_exacta, nombre_sede_espacio)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `;
    const result = await pool.query(query, [
      nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede,
      espacio ? espacio.numero : null,
      espacio ? espacio.edificio : null,
      espacio ? espacio.direccion : null,
      espacio ? espacio.sede : null
    ]);
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

    // 3. Crear Reserva si viene en el body (HU-97)
    if (req.body.reserva) {
      const { fecha_llegada, fecha_salida, puesto } = req.body.reserva;

      let q = `INSERT INTO Reserva (nombre_servicio, numero_servicio, fecha_hora, fecha_hora_fin, fecha_hora_creacion_solicitud`;
      let v = `VALUES ($1, $2, $3, $4, $5`;
      let params = [nombre, numero, fecha_llegada, fecha_salida, fechaHora];

      if (puesto) {
        q += `, numero_puesto, nombre_estacionamiento, nombre_sede_puesto)`;
        v += `, $6, $7, $8)`;
        params.push(puesto.numero, puesto.estacionamiento, puesto.sede);
      } else {
        // El espacio ya no lo elige el cliente: se toma del propio Servicio
        // (Servicio.numero_espacio), no de lo que mande el body.
        const espacioServicio = await pool.query(
          `SELECT numero_espacio, nombre_edif, direccion_exacta, nombre_sede_espacio
           FROM Servicio WHERE nombre = $1 AND numero_servicio = $2`,
          [nombre, numero]
        );
        const esp = espacioServicio.rows[0];

        if (!esp || esp.numero_espacio === null) {
          throw new Error('Este servicio no tiene un espacio físico asociado en el catálogo');
        }

        q += `, numero_espacio, nombre_edif, direccion_exacta, nombre_sede_espacio)`;
        v += `, $6, $7, $8, $9)`;
        params.push(esp.numero_espacio, esp.nombre_edif, esp.direccion_exacta, esp.nombre_sede_espacio);
      }

      await pool.query(q + " " + v, params);
    }
    // 4. Insertar Acompañantes si vienen en el body
    if (req.body.acompanantes && req.body.acompanantes.length > 0) {
      const queryAcomp = `
        INSERT INTO Acompanante (documento_identidad, nombre, fecha_hora_creacion)
        VALUES ($1, $2, $3)
      `;
      for (const ac of req.body.acompanantes) {
        await pool.query(queryAcomp, [ac.documento_identidad, ac.nombre, fechaHora]);
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
      `SELECT fecha_hora_creacion, estado, nombre_servicio, numero_servicio,
              TO_CHAR(fecha_hora_creacion, 'YYYY-MM-DD HH24:MI:SS.MS') as raw_fecha
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
   Helpers de acceso/edicion para el detalle de una Solicitud
   (HU-58/60/61: dueño de la solicitud o personal de Secretaria)
---------------------------------------------------------- */
async function esSecretaria(CI) {
  const r = await pool.query(
    `SELECT 1 FROM PersonalAdministrativo WHERE CI = $1 AND adscripcion_presupuestaria = 'Secretaria'`,
    [CI]
  );
  return r.rows.length > 0;
}

async function obtenerAccesoSolicitud(fecha, CI) {
  const solRes = await pool.query(`SELECT * FROM Solicitud WHERE fecha_hora_creacion = $1`, [fecha]);
  if (solRes.rows.length === 0) {
    return { error: { status: 404, mensaje: 'Solicitud no encontrada' } };
  }
  const solicitud = solRes.rows[0];

  if (solicitud.ci !== CI && !(await esSecretaria(CI))) {
    return { error: { status: 403, mensaje: 'No tienes acceso a esta solicitud' } };
  }

  return { solicitud };
}

function verificarEditable(solicitud) {
  if (solicitud.estado !== 'En Proceso') {
    return { status: 409, mensaje: 'Solo se pueden editar solicitudes En Proceso' };
  }
  return null;
}

/* ----------------------------------------------------------
   Consultar Todas las Solicitudes (Secretaria)
   GET /api/servicios/solicitudes?estado=En Proceso
---------------------------------------------------------- */
router.get('/solicitudes', auth, async (req, res) => {
  const CI = req.usuario.CI;
  try {
    if (!(await esSecretaria(CI))) {
      return res.status(403).json({ error: 'Solo personal de Secretaría puede ver todas las solicitudes' });
    }

    const { estado } = req.query;
    let q = `SELECT fecha_hora_creacion, ci, estado, nombre_servicio, numero_servicio,
                     TO_CHAR(fecha_hora_creacion, 'YYYY-MM-DD HH24:MI:SS.MS') as raw_fecha
              FROM Solicitud`;
    const params = [];
    if (estado) {
      q += ` WHERE estado = $1`;
      params.push(estado);
    }
    q += ` ORDER BY fecha_hora_creacion DESC`;

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET /solicitudes:', err);
    res.status(500).json({ error: 'Error al obtener las solicitudes' });
  }
});

/* ----------------------------------------------------------
   Detalle de una Solicitud (dueño o Secretaria)
   GET /api/servicios/solicitudes/:fecha
---------------------------------------------------------- */
router.get('/solicitudes/:fecha', auth, async (req, res) => {
  const { fecha } = req.params;
  const CI = req.usuario.CI;

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const [docs, acomp, reserva, pasos] = await Promise.all([
      pool.query(`SELECT id_documento, ruta_archivo FROM Documento_Solicitud WHERE fecha_hora_creacion_solicitud = $1`, [fecha]),
      pool.query(`SELECT documento_identidad, nombre FROM Acompanante WHERE fecha_hora_creacion = $1`, [fecha]),
      pool.query(`SELECT * FROM Reserva WHERE fecha_hora_creacion_solicitud = $1`, [fecha]),
      pool.query(`SELECT numero_paso, estado, descripcion, unidad_responsable, fecha_hora_finalizado
                  FROM Paso_Actividad WHERE fecha_hora_creacion_solicitud = $1 ORDER BY numero_paso`, [fecha])
    ]);

    res.json({
      solicitud,
      documentos: docs.rows,
      acompanantes: acomp.rows,
      reserva: reserva.rows[0] || null,
      pasos: pasos.rows
    });
  } catch (err) {
    console.error('Error GET /solicitudes/:fecha:', err);
    res.status(500).json({ error: 'Error al consultar la solicitud' });
  }
});

/* ----------------------------------------------------------
   Agregar Documentos a una Solicitud existente (HU-57)
   POST /api/servicios/solicitudes/:fecha/documentos
   Body: { documentos: ['url1', 'url2'] }
---------------------------------------------------------- */
router.post('/solicitudes/:fecha/documentos', auth, async (req, res) => {
  const { fecha } = req.params;
  const CI = req.usuario.CI;
  const { documentos } = req.body;

  if (!documentos || documentos.length === 0) {
    return res.status(400).json({ error: 'No se enviaron documentos' });
  }

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const editError = verificarEditable(solicitud);
    if (editError) return res.status(editError.status).json({ error: editError.mensaje });

    for (const url of documentos) {
      await pool.query(
        `INSERT INTO Documento_Solicitud (fecha_hora_creacion_solicitud, ruta_archivo) VALUES ($1, $2)`,
        [fecha, url]
      );
    }

    res.status(201).json({ mensaje: 'Documentos agregados correctamente' });
  } catch (err) {
    console.error('Error POST /solicitudes/:fecha/documentos:', err);
    res.status(500).json({ error: 'Error al agregar documentos' });
  }
});

/* ----------------------------------------------------------
   Eliminar un Documento de una Solicitud existente
   DELETE /api/servicios/solicitudes/:fecha/documentos/:id
---------------------------------------------------------- */
router.delete('/solicitudes/:fecha/documentos/:id', auth, async (req, res) => {
  const { fecha, id } = req.params;
  const CI = req.usuario.CI;

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const editError = verificarEditable(solicitud);
    if (editError) return res.status(editError.status).json({ error: editError.mensaje });

    const result = await pool.query(
      `DELETE FROM Documento_Solicitud WHERE id_documento = $1 AND fecha_hora_creacion_solicitud = $2`,
      [id, fecha]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ mensaje: 'Documento eliminado' });
  } catch (err) {
    console.error('Error DELETE /solicitudes/:fecha/documentos/:id:', err);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
});

/* ----------------------------------------------------------
   Agregar Acompañante a una Solicitud existente (HU-33)
   POST /api/servicios/solicitudes/:fecha/acompanantes
   Body: { documento_identidad, nombre }
---------------------------------------------------------- */
router.post('/solicitudes/:fecha/acompanantes', auth, async (req, res) => {
  const { fecha } = req.params;
  const CI = req.usuario.CI;
  const { documento_identidad, nombre } = req.body;

  if (!documento_identidad || !nombre) {
    return res.status(400).json({ error: 'Faltan documento_identidad o nombre' });
  }

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const editError = verificarEditable(solicitud);
    if (editError) return res.status(editError.status).json({ error: editError.mensaje });

    const result = await pool.query(
      `INSERT INTO Acompanante (documento_identidad, nombre, fecha_hora_creacion) VALUES ($1, $2, $3) RETURNING *`,
      [documento_identidad, nombre, fecha]
    );

    res.status(201).json({ mensaje: 'Acompañante agregado', acompanante: result.rows[0] });
  } catch (err) {
    console.error('Error POST /solicitudes/:fecha/acompanantes:', err);
    res.status(500).json({ error: 'Error al agregar el acompañante' });
  }
});

/* ----------------------------------------------------------
   Eliminar Acompañante de una Solicitud existente (HU-33)
   DELETE /api/servicios/solicitudes/:fecha/acompanantes/:documento_identidad
---------------------------------------------------------- */
router.delete('/solicitudes/:fecha/acompanantes/:documento_identidad', auth, async (req, res) => {
  const { fecha, documento_identidad } = req.params;
  const CI = req.usuario.CI;

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const editError = verificarEditable(solicitud);
    if (editError) return res.status(editError.status).json({ error: editError.mensaje });

    const result = await pool.query(
      `DELETE FROM Acompanante WHERE documento_identidad = $1 AND fecha_hora_creacion = $2`,
      [documento_identidad, fecha]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Acompañante no encontrado' });
    res.json({ mensaje: 'Acompañante eliminado' });
  } catch (err) {
    console.error('Error DELETE /solicitudes/:fecha/acompanantes/:documento_identidad:', err);
    res.status(500).json({ error: 'Error al eliminar el acompañante' });
  }
});

/* ----------------------------------------------------------
   Reprogramar la Reserva de una Solicitud (HU-60)
   PATCH /api/servicios/solicitudes/:fecha
   Body: { fecha_llegada, fecha_salida }
   Solo si la Reserva asociada sigue 'Pendiente'. Se borra e
   inserta de nuevo (en vez de UPDATE) porque fecha_hora es
   parte de la PK de Reserva, y porque el trigger de choque de
   horario compara contra las filas ya existentes: si hicieramos
   UPDATE, la propia fila vieja se contaria a si misma como un
   "choque" al solaparse con su nuevo horario.
---------------------------------------------------------- */
router.patch('/solicitudes/:fecha', auth, async (req, res) => {
  const { fecha } = req.params;
  const CI = req.usuario.CI;
  const { fecha_llegada, fecha_salida } = req.body;

  if (!fecha_llegada || !fecha_salida) {
    return res.status(400).json({ error: 'Faltan fecha_llegada o fecha_salida' });
  }

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const editError = verificarEditable(solicitud);
    if (editError) return res.status(editError.status).json({ error: editError.mensaje });

    const reservaRes = await pool.query(`SELECT * FROM Reserva WHERE fecha_hora_creacion_solicitud = $1`, [fecha]);
    if (reservaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Esta solicitud no tiene una reserva asociada' });
    }
    const r = reservaRes.rows[0];
    if (r.estado !== 'Pendiente') {
      return res.status(409).json({ error: 'Solo se puede reprogramar una reserva Pendiente' });
    }

    await pool.query('BEGIN');
    await pool.query(`DELETE FROM Reserva WHERE fecha_hora_creacion_solicitud = $1`, [fecha]);
    await pool.query(
      `INSERT INTO Reserva (nombre_servicio, numero_servicio, fecha_hora, fecha_hora_fin, fecha_hora_creacion_solicitud,
                             numero_espacio, nombre_edif, direccion_exacta, nombre_sede_espacio,
                             numero_puesto, nombre_estacionamiento, nombre_sede_puesto, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pendiente')`,
      [r.nombre_servicio, r.numero_servicio, fecha_llegada, fecha_salida, fecha,
       r.numero_espacio, r.nombre_edif, r.direccion_exacta, r.nombre_sede_espacio,
       r.numero_puesto, r.nombre_estacionamiento, r.nombre_sede_puesto]
    );
    await pool.query('COMMIT');

    res.json({ mensaje: 'Reserva reprogramada correctamente' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error PATCH /solicitudes/:fecha:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/* ----------------------------------------------------------
   Cancelar una Solicitud (HU-61)
   PATCH /api/servicios/solicitudes/:fecha/cancelar
---------------------------------------------------------- */
router.patch('/solicitudes/:fecha/cancelar', auth, async (req, res) => {
  const { fecha } = req.params;
  const CI = req.usuario.CI;

  try {
    const { solicitud, error } = await obtenerAccesoSolicitud(fecha, CI);
    if (error) return res.status(error.status).json({ error: error.mensaje });

    const editError = verificarEditable(solicitud);
    if (editError) return res.status(editError.status).json({ error: editError.mensaje });

    await pool.query('BEGIN');
    await pool.query(`UPDATE Solicitud SET estado = 'Cancelada' WHERE fecha_hora_creacion = $1`, [fecha]);
    await pool.query(
      `UPDATE Reserva SET estado = 'Cancelada' WHERE fecha_hora_creacion_solicitud = $1 AND estado <> 'Cancelada'`,
      [fecha]
    );
    await pool.query('COMMIT');

    res.json({ mensaje: 'Solicitud cancelada correctamente' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error PATCH /solicitudes/:fecha/cancelar:', err.message);
    res.status(400).json({ error: err.message });
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
