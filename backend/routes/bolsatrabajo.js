/* ============================================================
   routes/bolsatrabajo.js
   HU-49: Aliado ve sus ofertas publicadas       GET    /api/bolsatrabajo?rif=X
   HU-50: Aliado crea oportunidad laboral        POST   /api/bolsatrabajo
   HU-51: Miembro consulta ofertas disponibles   GET    /api/bolsatrabajo
   HU-52: Miembro se postula                     POST   /api/bolsatrabajo/:fecha/:cargo/:rif/postular
   HU-53: Aliado modifica su oferta              PUT    /api/bolsatrabajo/:fecha/:cargo/:rif
   HU-54: Aliado cierra su oferta                PATCH  /api/bolsatrabajo/:fecha/:cargo/:rif/cerrar
   HU-55: Aliado consulta postulaciones          GET    /api/bolsatrabajo/:fecha/:cargo/:rif/postulaciones
   HU-56: Egresado ve vacantes sugeridas         GET    /api/bolsatrabajo/sugeridas
============================================================ */

const router    = require('express').Router();
const pool      = require('../db');
const auth      = require('../middleware/auth');
const autorizar = require('../middleware/roles');

/* ----------------------------------------------------------
   Una oferta es gestionable por el aliado externo dueño de su
   propio RIF, o por admin/director en su nombre (para entidades
   que todavia no tienen credenciales propias).
---------------------------------------------------------- */
function puedeGestionar(usuario, rif) {
  if (usuario.rol === 'admin' || usuario.rol === 'director') return true;
  return usuario.rol === 'aliado_externo' && usuario.RIF === rif;
}

/* ----------------------------------------------------------
   HU-51 / HU-49: Catálogo de ofertas
   GET /api/bolsatrabajo?rif=X&estatus=Disponible
   Sin filtros: catálogo público (solo Disponibles).
---------------------------------------------------------- */
router.get('/', auth, async (req, res) => {
  const { rif, estatus } = req.query;
  const CI = req.usuario.CI || null;
  try {
    let q = `
      SELECT o.Fecha_Oferta, o.cargo, o.RIF, o.responsabilidades, o.perfil_buscado,
             o.beneficios, o.estatus, e.razon_social,
             TO_CHAR(o.Fecha_Oferta, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_fecha,
             EXISTS(
               SELECT 1 FROM Postula p
               WHERE p.Fecha_Oferta = o.Fecha_Oferta AND p.cargo = o.cargo AND p.RIF = o.RIF AND p.CI = $1
             ) AS postulado
      FROM OfertaLaboral o
      JOIN EntidadExterna e ON e.RIF = o.RIF
      WHERE 1=1
    `;
    const params = [CI];

    if (rif) {
      params.push(rif);
      q += ` AND o.RIF = $${params.length}`;
    }
    if (estatus) {
      params.push(estatus);
      q += ` AND o.estatus = $${params.length}`;
    } else if (!rif || !puedeGestionar(req.usuario, rif)) {
      // Sin filtro explicito de estatus, y sin ser el dueño: solo lo publico
      q += ` AND o.estatus = 'Disponible'`;
    }

    q += ` ORDER BY o.Fecha_Oferta DESC`;

    const { rows } = await pool.query(q, params);

    // --- ALGORITMO DE MATCH ---
    let userRolStr = '';
    let userKeywords = [];
    if (CI && !rif) {
      userRolStr = (req.usuario.subtipo || '').toLowerCase();
      userKeywords.push(userRolStr);

      if (['estudiante', 'becario', 'preparador'].includes(userRolStr)) {
        const estQuery = await pool.query('SELECT "escuela" FROM Estudiante WHERE CI = $1', [CI]);
        if (estQuery.rows.length > 0) {
          userKeywords.push(estQuery.rows[0].escuela.toLowerCase());
          userKeywords.push('estudiante'); // también es estudiante
        }
      } else if (userRolStr === 'egresado') {
        const egrQuery = await pool.query('SELECT titulo FROM Egresado WHERE CI = $1', [CI]);
        if (egrQuery.rows.length > 0) userKeywords.push(egrQuery.rows[0].titulo.toLowerCase());
      }
    }

    // Calcular score para cada oferta
    const ofertasConMatch = rows.map(o => {
      let score = 0;
      if (CI && !rif) {
        const perfilTarget = (o.perfil_buscado || '').toLowerCase();
        const cargoTarget = (o.cargo || '').toLowerCase();
        
        // Match base (10%) para ofertas disponibles si el usuario busca trabajo
        score += 10;
        
        // 1. Match por Rol (30%)
        if (userRolStr && perfilTarget.includes(userRolStr)) {
          score += 30;
        }

        // 2. Match por Carrera/Titulo (60%)
        // Validamos todas las palabras clave extras (escuela, titulo)
        const hasKeywordMatch = userKeywords.some(kw => {
          if (kw === userRolStr) return false; // ya evaluado
          return perfilTarget.includes(kw) || cargoTarget.includes(kw) || kw.includes(cargoTarget) || kw.includes(perfilTarget);
        });

        if (hasKeywordMatch) {
          score += 60;
        }
      }
      return { ...o, match_porcentaje: Math.min(score, 100) };
    });

    // Ordenar: primero por match (descendente), luego por fecha (descendente)
    ofertasConMatch.sort((a, b) => {
      if (b.match_porcentaje !== a.match_porcentaje) {
        return b.match_porcentaje - a.match_porcentaje;
      }
      return new Date(b.Fecha_Oferta) - new Date(a.Fecha_Oferta);
    });

    res.json({ ofertas: ofertasConMatch });
  } catch (err) {
    console.error('Error GET /bolsatrabajo:', err);
    res.status(500).json({ error: 'Error al consultar la bolsa de trabajo' });
  }
});

/* ----------------------------------------------------------
   HU-56: Vacantes sugeridas para el egresado logueado
   GET /api/bolsatrabajo/sugeridas
   Compara Egresado.titulo contra cargo/perfil_buscado de las
   ofertas disponibles (coincidencia de texto, no hay estructura
   mas fina para "perfil" en el modelo).
---------------------------------------------------------- */
router.get('/sugeridas', auth, async (req, res) => {
  const CI = req.usuario.CI;
  if (!CI) return res.json({ ofertas: [] });

  try {
    const egresado = await pool.query('SELECT titulo FROM Egresado WHERE CI = $1', [CI]);
    if (egresado.rows.length === 0) {
      return res.json({ ofertas: [] });
    }
    const titulo = egresado.rows[0].titulo;

    const { rows } = await pool.query(
      `SELECT o.Fecha_Oferta, o.cargo, o.RIF, o.responsabilidades, o.perfil_buscado,
              o.beneficios, e.razon_social,
              TO_CHAR(o.Fecha_Oferta, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_fecha,
              EXISTS(
                SELECT 1 FROM Postula p
                WHERE p.Fecha_Oferta = o.Fecha_Oferta AND p.cargo = o.cargo AND p.RIF = o.RIF AND p.CI = $2
              ) AS postulado
       FROM OfertaLaboral o
       JOIN EntidadExterna e ON e.RIF = o.RIF
       WHERE o.estatus = 'Disponible'
         AND (o.cargo ILIKE '%' || $1 || '%' OR o.perfil_buscado ILIKE '%' || $1 || '%')
       ORDER BY o.Fecha_Oferta DESC`,
      [titulo, CI]
    );
    res.json({ ofertas: rows });
  } catch (err) {
    console.error('Error GET /bolsatrabajo/sugeridas:', err);
    res.status(500).json({ error: 'Error al consultar vacantes sugeridas' });
  }
});

/* ----------------------------------------------------------
   HU-50: Crear oportunidad laboral
   POST /api/bolsatrabajo
   Body: { cargo, responsabilidades, perfil_buscado, beneficios, RIF? }
   El aliado externo publica bajo su propio RIF (del token); un
   admin/director debe indicar el RIF en el body.
---------------------------------------------------------- */
router.post('/', auth, autorizar('aliado_externo', 'admin', 'director'), async (req, res) => {
  const { cargo, responsabilidades, perfil_buscado, beneficios } = req.body;
  const RIF = req.usuario.rol === 'aliado_externo' ? req.usuario.RIF : req.body.RIF;

  if (!RIF || !cargo || !responsabilidades || !perfil_buscado || !beneficios) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: RIF, cargo, responsabilidades, perfil_buscado, beneficios.' });
  }

  try {
    const fechaOferta = new Date();
    const result = await pool.query(
      `INSERT INTO OfertaLaboral (Fecha_Oferta, cargo, RIF, responsabilidades, perfil_buscado, beneficios, estatus)
       VALUES ($1, $2, $3, $4, $5, $6, 'Disponible')
       RETURNING *, TO_CHAR(Fecha_Oferta, 'YYYY-MM-DD HH24:MI:SS.MS') AS raw_fecha`,
      [fechaOferta, cargo, RIF, responsabilidades, perfil_buscado, beneficios]
    );
    res.status(201).json({ mensaje: 'Oferta laboral publicada exitosamente.', oferta: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'La entidad externa (RIF) indicada no existe.' });
    console.error('Error POST /bolsatrabajo:', err);
    res.status(500).json({ error: 'Error al publicar la oferta laboral' });
  }
});

/* ----------------------------------------------------------
   HU-53: Modificar oferta
   PUT /api/bolsatrabajo/:fecha/:cargo/:rif
   Body: { responsabilidades, perfil_buscado, beneficios }
---------------------------------------------------------- */
router.put('/:fecha/:cargo/:rif', auth, autorizar('aliado_externo', 'admin', 'director'), async (req, res) => {
  const { fecha, cargo, rif } = req.params;
  const { responsabilidades, perfil_buscado, beneficios } = req.body;

  if (!puedeGestionar(req.usuario, rif)) {
    return res.status(403).json({ error: 'No tienes acceso a esta oferta laboral.' });
  }
  if (!responsabilidades || !perfil_buscado || !beneficios) {
    return res.status(400).json({ error: 'Faltan campos: responsabilidades, perfil_buscado, beneficios.' });
  }

  try {
    const result = await pool.query(
      `UPDATE OfertaLaboral SET responsabilidades = $1, perfil_buscado = $2, beneficios = $3
       WHERE Fecha_Oferta = $4 AND cargo = $5 AND RIF = $6
       RETURNING *`,
      [responsabilidades, perfil_buscado, beneficios, fecha, cargo, rif]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Oferta laboral no encontrada.' });
    res.json({ mensaje: 'Oferta laboral actualizada.', oferta: result.rows[0] });
  } catch (err) {
    console.error('Error PUT /bolsatrabajo:', err);
    res.status(500).json({ error: 'Error al actualizar la oferta laboral' });
  }
});

/* ----------------------------------------------------------
   HU-54: Cerrar oferta ("eliminar" sin romper Postula, que no
   tiene ON DELETE CASCADE hacia OfertaLaboral)
   PATCH /api/bolsatrabajo/:fecha/:cargo/:rif/cerrar
---------------------------------------------------------- */
router.patch('/:fecha/:cargo/:rif/cerrar', auth, autorizar('aliado_externo', 'admin', 'director'), async (req, res) => {
  const { fecha, cargo, rif } = req.params;

  if (!puedeGestionar(req.usuario, rif)) {
    return res.status(403).json({ error: 'No tienes acceso a esta oferta laboral.' });
  }

  try {
    const result = await pool.query(
      `UPDATE OfertaLaboral SET estatus = 'Finalizada'
       WHERE Fecha_Oferta = $1 AND cargo = $2 AND RIF = $3
       RETURNING *`,
      [fecha, cargo, rif]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Oferta laboral no encontrada.' });
    res.json({ mensaje: 'Oferta laboral cerrada.', oferta: result.rows[0] });
  } catch (err) {
    console.error('Error PATCH /bolsatrabajo/cerrar:', err);
    res.status(500).json({ error: 'Error al cerrar la oferta laboral' });
  }
});

/* ----------------------------------------------------------
   HU-52: Postularse a una oferta
   POST /api/bolsatrabajo/:fecha/:cargo/:rif/postular
---------------------------------------------------------- */
router.post('/:fecha/:cargo/:rif/postular', auth, async (req, res) => {
  const { fecha, cargo, rif } = req.params;
  const CI = req.usuario.CI;

  if (!CI) return res.status(403).json({ error: 'Solo un miembro puede postularse a una vacante.' });

  try {
    const oferta = await pool.query(
      `SELECT estatus FROM OfertaLaboral WHERE Fecha_Oferta = $1 AND cargo = $2 AND RIF = $3`,
      [fecha, cargo, rif]
    );
    if (oferta.rows.length === 0) return res.status(404).json({ error: 'Oferta laboral no encontrada.' });
    if (oferta.rows[0].estatus !== 'Disponible') {
      return res.status(409).json({ error: 'Esta vacante ya no está disponible.' });
    }

    await pool.query(
      `INSERT INTO Postula (CI, Fecha_Oferta, cargo, RIF) VALUES ($1, $2, $3, $4)`,
      [CI, fecha, cargo, rif]
    );
    res.status(201).json({ mensaje: 'Postulación registrada exitosamente.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya te habías postulado a esta vacante.' });
    console.error('Error POST /bolsatrabajo/postular:', err);
    res.status(500).json({ error: 'Error al registrar la postulación' });
  }
});

/* ----------------------------------------------------------
   HU-55: Consultar postulaciones recibidas
   GET /api/bolsatrabajo/:fecha/:cargo/:rif/postulaciones
---------------------------------------------------------- */
router.get('/:fecha/:cargo/:rif/postulaciones', auth, autorizar('aliado_externo', 'admin', 'director'), async (req, res) => {
  const { fecha, cargo, rif } = req.params;

  if (!puedeGestionar(req.usuario, rif)) {
    return res.status(403).json({ error: 'No tienes acceso a esta oferta laboral.' });
  }

  try {
    const oferta = await pool.query(
      `SELECT cargo FROM OfertaLaboral WHERE Fecha_Oferta = $1 AND cargo = $2 AND RIF = $3`,
      [fecha, cargo, rif]
    );
    if (oferta.rows.length === 0) return res.status(404).json({ error: 'Oferta laboral no encontrada.' });

    const { rows } = await pool.query(
      `SELECT m.CI, m.primer_nombre, m.primer_apellido, m.correo,
              eg.titulo, eg.indice_final, eg.ano_graduacion
       FROM Postula p
       JOIN Miembro m ON m.CI = p.CI
       LEFT JOIN Egresado eg ON eg.CI = m.CI
       WHERE p.Fecha_Oferta = $1 AND p.cargo = $2 AND p.RIF = $3
       ORDER BY m.primer_apellido, m.primer_nombre`,
      [fecha, cargo, rif]
    );
    res.json({ cargo: oferta.rows[0].cargo, total: rows.length, postulantes: rows });
  } catch (err) {
    console.error('Error GET /bolsatrabajo/postulaciones:', err);
    res.status(500).json({ error: 'Error al consultar las postulaciones' });
  }
});

module.exports = router;
