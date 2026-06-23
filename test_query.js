const pool = require('./backend/db');
async function test() {
  const { rows } = await pool.query(`
      SELECT v.nombre, v.ID_EP, v.descripcion, v.fecha_inicio, v.fecha_fin, v.estado,
             COUNT(i.CI) AS total_inscritos,
             COALESCE(ei.nombre, ee.razon_social, 'Entidad ' || v.ID_EP) AS entidad_nombre,
             EXISTS(SELECT 1 FROM Inscribe i2 WHERE i2.nombre = v.nombre AND i2.CI = 'V-20111111') AS inscrito
      FROM Voluntariado v
      LEFT JOIN Inscribe i ON i.nombre = v.nombre
      LEFT JOIN EntidadInterna ei ON ei.ID_EP = v.ID_EP
      LEFT JOIN EntidadExterna ee ON ee.ID_EP = v.ID_EP
      WHERE v.estado = 'Abierto'
      GROUP BY v.nombre, v.ID_EP, v.descripcion, v.fecha_inicio, v.fecha_fin, v.estado, ei.nombre, ee.razon_social
  `);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
test();
