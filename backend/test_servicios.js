const pool = require('./db');
async function test() {
  try {
    const { rows } = await pool.query(`
      SELECT s.nombre, s.numero_servicio, s.tipo, s.estado, s.cupo_disponible, s.descripcion, s.nombre_sede, s.imagen
      FROM Servicio s
      WHERE s.estado = 'Activo'
      ORDER BY s.nombre_sede, s.nombre
    `);
    console.log(rows);
  } catch (e) {
    console.error(e.message);
  }
  process.exit(0);
}
test();
