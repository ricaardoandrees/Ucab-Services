/* ============================================================
   routes/vinculaciones.js
   HU-13: Admin abre un período de vinculación
   HU-14: Admin cierra un período de vinculación
   HU-15: Miembro visualiza su historial de vinculaciones
   HU-16: Admin actualiza ficha de estudiante
   HU-17: Admin gestiona beneficios de becario
   HU-18: Admin gestiona registro de preparador
   HU-19: Admin actualiza ficha de profesor
   HU-20: Admin actualiza ficha de personal administrativo
   HU-21: Funcionario registra datos de egresado
   HU-22: Miembro visualiza períodos activos
   HU-23: Admin elimina un período de vinculación
============================================================ */

const router    = require('express').Router();
const pool      = require('../db');
const auth      = require('../middleware/auth');
const autorizar = require('../middleware/roles');

// Helper DCL: garantiza rol_operador al asignar cualquier especialización
async function grantOperador(ci) {
  const safeCI = ci.replace(/"/g, '');
  try { await pool.query(`GRANT rol_operador TO "${safeCI}"`); } catch { /* ya lo tiene */ }
}

// Helper: Verifica la RN de "Un solo rol principal a la vez"
async function validarUnSoloRolPrincipal(ci, nuevoRol) {
  const rolesPrincipales = ['Estudiante', 'Profesor', 'PersonalAdministrativo', 'Egresado'];
  for (let r of rolesPrincipales) {
    if (r.toLowerCase() === nuevoRol.toLowerCase()) continue;
    const res = await pool.query(`SELECT 1 FROM ${r} WHERE CI = $1`, [ci]);
    if (res.rowCount > 0) {
      return `El miembro tiene actualmente el rol principal de ${r}. Debes quitarle ese rol antes de poder asignarle el rol de ${nuevoRol}.`;
    }
  }
  return null; // Todo en orden
}

// Helper: Automatiza la actualización del historial de vinculación basado en roles exactos (principales y subtipos)
async function actualizarHistorial(ci) {
  let roles = [];
  if ((await pool.query('SELECT 1 FROM Profesor WHERE CI=$1', [ci])).rowCount > 0) roles.push('Profesor');
  if ((await pool.query('SELECT 1 FROM PersonalAdministrativo WHERE CI=$1', [ci])).rowCount > 0) roles.push('PersonalAdministrativo');
  if ((await pool.query('SELECT 1 FROM Estudiante WHERE CI=$1', [ci])).rowCount > 0) {
    if ((await pool.query('SELECT 1 FROM Becario WHERE CI=$1', [ci])).rowCount > 0) roles.push('Becario');
    if ((await pool.query('SELECT 1 FROM Preparador WHERE CI=$1', [ci])).rowCount > 0) roles.push('Preparador');
    roles.push('Estudiante');
  }
  if ((await pool.query('SELECT 1 FROM Egresado WHERE CI=$1', [ci])).rowCount > 0) roles.push('Egresado');
  
  const rolesString = roles.join(', ');

  const activo = await pool.query('SELECT rol FROM PeriodoVinculacion WHERE CI = $1 AND Fecha_Fin IS NULL', [ci]);
  const rolActivo = activo.rowCount > 0 ? activo.rows[0].rol : null;

  if (rolesString !== (rolActivo || '')) {
    if (rolActivo) {
      await pool.query(`UPDATE PeriodoVinculacion SET Fecha_Fin = NOW() WHERE CI = $1 AND Fecha_Fin IS NULL`, [ci]);
    }
    if (rolesString) {
      await pool.query(`INSERT INTO PeriodoVinculacion (Fecha_Inicio, CI, rol) VALUES (NOW(), $1, $2)`, [ci, rolesString]);
      await pool.query(`UPDATE Miembro SET estado_de_cuenta = 'Activa' WHERE ci = $1 AND estado_de_cuenta = 'Suspendida'`, [ci]);
    }
  }
}

/* ── GET /api/vinculaciones/:ci
   Historial de vinculaciones de un miembro (HU-15/22)
   Detecta el subtipo consultando las tablas de especialización */
router.get('/:ci', auth, async (req, res) => {
  const { ci } = req.params;
  const usuario = req.usuario;

  if (usuario.rol === 'miembro' && usuario.CI !== ci) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT fecha_inicio, fecha_fin, CI, rol FROM PeriodoVinculacion
       WHERE CI = $1 ORDER BY fecha_inicio DESC`,
      [ci]
    );

    // Recopilar TODOS los subtipos actuales del miembro
    const especializaciones = [];

    const b = await pool.query(`SELECT * FROM Becario WHERE CI = $1`, [ci]);
    if (b.rowCount > 0) {
      const est = await pool.query(`SELECT * FROM Estudiante WHERE CI = $1`, [ci]);
      especializaciones.push({ subtipo: 'Becario', datos: { ...(est.rows[0] || {}), ...b.rows[0] } });
    }

    const p = await pool.query(`SELECT * FROM Preparador WHERE CI = $1`, [ci]);
    if (p.rowCount > 0) {
      const est = await pool.query(`SELECT * FROM Estudiante WHERE CI = $1`, [ci]);
      especializaciones.push({ subtipo: 'Preparador', datos: { ...(est.rows[0] || {}), ...p.rows[0] } });
    }

    const est = await pool.query(`SELECT * FROM Estudiante WHERE CI = $1`, [ci]);
    if (est.rowCount > 0) especializaciones.push({ subtipo: 'Estudiante', datos: est.rows[0] });

    const prof = await pool.query(`SELECT * FROM Profesor WHERE CI = $1`, [ci]);
    if (prof.rowCount > 0) especializaciones.push({ subtipo: 'Profesor', datos: prof.rows[0] });

    const adm = await pool.query(`SELECT * FROM PersonalAdministrativo WHERE CI = $1`, [ci]);
    if (adm.rowCount > 0) especializaciones.push({ subtipo: 'PersonalAdministrativo', datos: adm.rows[0] });

    const egr = await pool.query(`SELECT * FROM Egresado WHERE CI = $1`, [ci]);
    if (egr.rowCount > 0) especializaciones.push({ subtipo: 'Egresado', datos: egr.rows[0] });

    res.json({ periodos: rows, especializaciones });
  } catch (err) {
    console.error('Error GET /vinculaciones/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── POST /api/vinculaciones/:ci
   Admin abre un nuevo período de vinculación (HU-13) */
router.post('/:ci', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { rol } = req.body;

  try {
    const activo = await pool.query(
      `SELECT 1 FROM PeriodoVinculacion WHERE CI = $1 AND Fecha_Fin IS NULL`,
      [ci]
    );
    if (activo.rowCount > 0) {
      return res.status(409).json({ error: 'El miembro ya tiene un período activo.' });
    }

    await pool.query(
      `INSERT INTO PeriodoVinculacion (Fecha_Inicio, CI, rol) VALUES (NOW(), $1, $2)`,
      [ci, rol || null]
    );

    // Garantizar rol_operador en PostgreSQL
    await grantOperador(ci);

    // Reactivar cuenta si estaba suspendida por cierre de período anterior
    await pool.query(
      `UPDATE Miembro SET estado_de_cuenta = 'Activa'
       WHERE ci = $1 AND estado_de_cuenta = 'Suspendida'`,
      [ci]
    );

    res.status(201).json({ mensaje: 'Período de vinculación abierto.' });
  } catch (err) {
    console.error('Error POST /vinculaciones/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PATCH /api/vinculaciones/:ci/cerrar
   Admin cierra el período activo de un miembro (HU-14) */
router.patch('/:ci/cerrar', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;

  try {
    const { rowCount } = await pool.query(
      `UPDATE PeriodoVinculacion SET Fecha_Fin = NOW()
       WHERE CI = $1 AND Fecha_Fin IS NULL`,
      [ci]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'No hay período activo para este miembro.' });
    }

    res.json({ mensaje: 'Período de vinculación cerrado.' });
  } catch (err) {
    console.error('Error PATCH /vinculaciones/:ci/cerrar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── DELETE /api/vinculaciones/:ci
   Admin elimina el período de vinculación (HU-23) */
router.delete('/:ci', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { fecha_inicio } = req.body;

  if (!fecha_inicio) {
    return res.status(400).json({ error: 'Se requiere fecha_inicio del período a eliminar.' });
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM PeriodoVinculacion WHERE CI = $1 AND Fecha_Inicio = $2`,
      [ci, fecha_inicio]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Período no encontrado.' });

    res.json({ mensaje: 'Período eliminado correctamente.' });
  } catch (err) {
    console.error('Error DELETE /vinculaciones/:ci:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── GET /api/vinculaciones/:ci/subtipo
   Obtiene los datos de especialización del miembro */
router.get('/:ci/subtipo', auth, async (req, res) => {
  const { ci } = req.params;
  const usuario = req.usuario;

  if (usuario.rol === 'miembro' && usuario.CI !== ci) {
    return res.status(403).json({ error: 'No tienes permiso.' });
  }

  try {
    // Estudiante
    let r = await pool.query(`SELECT * FROM Estudiante WHERE CI = $1`, [ci]);
    if (r.rowCount > 0) {
      // Verificar si es Becario o Preparador
      const b = await pool.query(`SELECT * FROM Becario WHERE CI = $1`, [ci]);
      if (b.rowCount > 0) return res.json({ subtipo: 'Becario', datos: { ...r.rows[0], ...b.rows[0] } });
      const p = await pool.query(`SELECT * FROM Preparador WHERE CI = $1`, [ci]);
      if (p.rowCount > 0) return res.json({ subtipo: 'Preparador', datos: { ...r.rows[0], ...p.rows[0] } });
      return res.json({ subtipo: 'Estudiante', datos: r.rows[0] });
    }

    r = await pool.query(`SELECT * FROM Profesor WHERE CI = $1`, [ci]);
    if (r.rowCount > 0) return res.json({ subtipo: 'Profesor', datos: r.rows[0] });

    r = await pool.query(`SELECT * FROM PersonalAdministrativo WHERE CI = $1`, [ci]);
    if (r.rowCount > 0) return res.json({ subtipo: 'PersonalAdministrativo', datos: r.rows[0] });

    r = await pool.query(`SELECT * FROM Egresado WHERE CI = $1`, [ci]);
    if (r.rowCount > 0) return res.json({ subtipo: 'Egresado', datos: r.rows[0] });

    res.json({ subtipo: 'Miembro', datos: null });
  } catch (err) {
    console.error('Error GET /vinculaciones/:ci/subtipo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ── PUT /api/vinculaciones/:ci/estudiante   (HU-16) */
router.put('/:ci/estudiante', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { promedio_ponderado, escuela, semestre_actual, uc_aprobadas, facultad } = req.body;

  const errRN = await validarUnSoloRolPrincipal(ci, 'Estudiante');
  if (errRN) return res.status(400).json({ error: errRN });

  try {
    const existe = await pool.query(`SELECT 1 FROM Estudiante WHERE CI = $1`, [ci]);
    if (existe.rowCount === 0) {
      await pool.query(
        `INSERT INTO Estudiante (CI, promedio_ponderado, Escuela, semestre_actual, UC_aprobadas, Facultad)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ci, promedio_ponderado, escuela, semestre_actual, uc_aprobadas, facultad]
      );
    } else {
      await pool.query(
        `UPDATE Estudiante SET promedio_ponderado=$1, Escuela=$2, semestre_actual=$3,
         UC_aprobadas=$4, Facultad=$5 WHERE CI=$6`,
        [promedio_ponderado, escuela, semestre_actual, uc_aprobadas, facultad, ci]
      );
    }
    await actualizarHistorial(ci);
    res.json({ mensaje: 'Ficha de estudiante actualizada.' });
  } catch (err) {
    console.error('Error PUT /vinculaciones/:ci/estudiante:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── PUT /api/vinculaciones/:ci/becario   (HU-17) */
router.put('/:ci/becario', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { tipo_beca, estatus_beneficio } = req.body;

    const esEstudianteBecario = await pool.query(`SELECT promedio_ponderado FROM Estudiante WHERE CI = $1`, [ci]);
    if (esEstudianteBecario.rowCount === 0) {
      return res.status(400).json({ error: 'El miembro debe ser Estudiante antes de ser Becario.' });
    }
    const cumple = esEstudianteBecario.rows[0].promedio_ponderado >= 16;

  try {
    const existe = await pool.query(`SELECT 1 FROM Becario WHERE CI = $1`, [ci]);
    if (existe.rowCount === 0) {
      await pool.query(
        `INSERT INTO Becario (CI, tipo_beca, estatus_beneficio, cumplimiento_indice)
         VALUES ($1,$2,$3, $4)`,
        [ci, tipo_beca, estatus_beneficio, cumple]
      );
    } else {
      await pool.query(
        `UPDATE Becario SET tipo_beca=$1, estatus_beneficio=$2, cumplimiento_indice=$3 WHERE CI=$4`,
        [tipo_beca, estatus_beneficio, cumple, ci]
      );
    }
    await actualizarHistorial(ci);
    res.json({ mensaje: 'Ficha de becario actualizada.' });
  } catch (err) {
    console.error('Error PUT /vinculaciones/:ci/becario:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── PUT /api/vinculaciones/:ci/preparador   (HU-18) */
router.put('/:ci/preparador', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { asignatura, horas } = req.body;

    const esEstudiantePrep = await pool.query(`SELECT 1 FROM Estudiante WHERE CI = $1`, [ci]);
    if (esEstudiantePrep.rowCount === 0) {
      return res.status(400).json({ error: 'El miembro debe ser Estudiante antes de ser Preparador.' });
    }

  try {
    const existe = await pool.query(`SELECT 1 FROM Preparador WHERE CI = $1`, [ci]);
    if (existe.rowCount === 0) {
      await pool.query(`INSERT INTO Preparador (CI, asignatura, horas) VALUES ($1,$2,$3)`, [ci, asignatura, horas]);
    } else {
      await pool.query(`UPDATE Preparador SET asignatura=$1, horas=$2 WHERE CI=$3`, [asignatura, horas, ci]);
    }
    await actualizarHistorial(ci);
    res.json({ mensaje: 'Ficha de preparador actualizada.' });
  } catch (err) {
    console.error('Error PUT /vinculaciones/:ci/preparador:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── PUT /api/vinculaciones/:ci/profesor   (HU-19) */
router.put('/:ci/profesor', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { carga_horaria, escalafon, cod_investigador } = req.body;

  const errRN = await validarUnSoloRolPrincipal(ci, 'Profesor');
  if (errRN) return res.status(400).json({ error: errRN });

  try {
    const existe = await pool.query(`SELECT 1 FROM Profesor WHERE CI = $1`, [ci]);
    if (existe.rowCount === 0) {
      await pool.query(
        `INSERT INTO Profesor (CI, carga_horaria, escalafon, cod_investigador) VALUES ($1,$2,$3,$4)`,
        [ci, carga_horaria, escalafon, cod_investigador || null]
      );
    } else {
      await pool.query(
        `UPDATE Profesor SET carga_horaria=$1, escalafon=$2, cod_investigador=$3 WHERE CI=$4`,
        [carga_horaria, escalafon, cod_investigador || null, ci]
      );
    }
    await actualizarHistorial(ci);
    res.json({ mensaje: 'Ficha de profesor actualizada.' });
  } catch (err) {
    console.error('Error PUT /vinculaciones/:ci/profesor:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── PUT /api/vinculaciones/:ci/personaladmin   (HU-20) */
router.put('/:ci/personaladmin', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { adscripcion_presupuestaria, cargo, carga_semanal } = req.body;

  const errRN = await validarUnSoloRolPrincipal(ci, 'PersonalAdministrativo');
  if (errRN) return res.status(400).json({ error: errRN });

  try {
    const existe = await pool.query(`SELECT 1 FROM PersonalAdministrativo WHERE CI = $1`, [ci]);
    if (existe.rowCount === 0) {
      await pool.query(
        `INSERT INTO PersonalAdministrativo (CI, adscripcion_presupuestaria, cargo, carga_semanal)
         VALUES ($1,$2,$3,$4)`,
        [ci, adscripcion_presupuestaria, cargo, carga_semanal || null]
      );
      // Otorgar nuevos roles administrativos basados en el cargo
      const safeCI = ci.replace(/"/g, '');
      const c = cargo.toLowerCase();
      const roles = [];
      if (c.includes('finanzas') || c.includes('cajero') || c.includes('pago') || c.includes('director')) roles.push('rol_finanzas');
      if (c.includes('infraestructura') || c.includes('sede') || c.includes('servicio') || c.includes('director')) roles.push('rol_infraestructura');
      if (c.includes('rrhh') || c.includes('secretaria') || c.includes('recurso') || c.includes('director')) roles.push('rol_rrhh');
      if (roles.length === 0) roles.push('rol_rrhh'); // fallback

      for (const r of roles) {
        await pool.query(`GRANT ${r} TO "${safeCI}"`).catch(() => {});
      }
    } else {
      await pool.query(
        `UPDATE PersonalAdministrativo SET adscripcion_presupuestaria=$1, cargo=$2, carga_semanal=$3 WHERE CI=$4`,
        [adscripcion_presupuestaria, cargo, carga_semanal || null, ci]
      );
    }
    await actualizarHistorial(ci);
    res.json({ mensaje: 'Ficha de personal administrativo actualizada.' });
  } catch (err) {
    console.error('Error PUT /vinculaciones/:ci/personaladmin:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── PUT /api/vinculaciones/:ci/egresado   (HU-21) */
router.put('/:ci/egresado', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci } = req.params;
  const { titulo, indice_final, ano_graduacion } = req.body;

  const errRN = await validarUnSoloRolPrincipal(ci, 'Egresado');
  if (errRN) return res.status(400).json({ error: errRN });

  try {
    const existe = await pool.query(`SELECT 1 FROM Egresado WHERE CI = $1`, [ci]);
    if (existe.rowCount === 0) {
      await pool.query(
        `INSERT INTO Egresado (CI, titulo, indice_final, ano_graduacion) VALUES ($1,$2,$3,$4)`,
        [ci, titulo, indice_final, ano_graduacion]
      );
    } else {
      await pool.query(
        `UPDATE Egresado SET titulo=$1, indice_final=$2, ano_graduacion=$3 WHERE CI=$4`,
        [titulo, indice_final, ano_graduacion, ci]
      );
    }
    await actualizarHistorial(ci);
    res.json({ mensaje: 'Ficha de egresado actualizada.' });
  } catch (err) {
    console.error('Error PUT /vinculaciones/:ci/egresado:', err);
    res.status(500).json({ error: err.detail || 'Error interno del servidor' });
  }
});

/* ── DELETE /api/vinculaciones/:ci/rol/:tipo
   Quita un rol específico del miembro eliminando su entrada
   en la tabla de especialización correspondiente */
router.delete('/:ci/rol/:tipo', auth, autorizar('admin', 'director'), async (req, res) => {
  const { ci, tipo } = req.params;

  const tablaMap = {
    becario:        'Becario',
    preparador:     'Preparador',
    estudiante:     'Estudiante',
    profesor:       'Profesor',
    personaladmin:  'PersonalAdministrativo',
    egresado:       'Egresado',
  };

  const tabla = tablaMap[tipo.toLowerCase()];
  if (!tabla) return res.status(400).json({ error: 'Tipo de rol inválido.' });

  try {
    const { rowCount } = await pool.query(`DELETE FROM ${tabla} WHERE CI = $1`, [ci]);
    if (rowCount === 0) return res.status(404).json({ error: 'El miembro no tiene ese rol.' });

    // Si era PersonalAdministrativo → revocar roles administrativos de PostgreSQL
    if (tipo.toLowerCase() === 'personaladmin') {
      const safeCI = ci.replace(/"/g, '');
      await pool.query(`REVOKE rol_rrhh FROM "${safeCI}"`).catch(() => {});
      await pool.query(`REVOKE rol_finanzas FROM "${safeCI}"`).catch(() => {});
      await pool.query(`REVOKE rol_infraestructura FROM "${safeCI}"`).catch(() => {});
    }

    await actualizarHistorial(ci);

    res.json({ mensaje: `Rol ${tipo} eliminado correctamente. Historial actualizado.` });
  } catch (err) {
    console.error('Error DELETE /vinculaciones/:ci/rol/:tipo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;