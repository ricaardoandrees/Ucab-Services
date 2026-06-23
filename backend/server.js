const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const miembrosRoutes = require('./routes/miembros');
const vehiculosRoutes = require('./routes/vehiculos');
const voluntariadoRoutes = require('./routes/voluntariado');
const infraestructuraRoutes = require('./routes/infraestructura');
const aliadosRoutes = require('./routes/aliados');

app.use('/api/auth', authRoutes);
app.use('/api/miembros', miembrosRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/voluntariado', voluntariadoRoutes);
app.use('/api/infraestructura', infraestructuraRoutes);
app.use('/api/aliados', aliadosRoutes);

// ── Manejador de errores global ───────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// ── Iniciar servidor ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCAB-Services corriendo en http://localhost:${PORT}`);
});

// ── Job programado: finalizar voluntariados vencidos ──────────
// Se ejecuta al arrancar y luego cada hora mientras el servidor esté activo.
const pool = require('./db');

async function finalizarVencidos() {
  try {
    await pool.query('CALL finalizar_voluntariados_vencidos()');
    console.log(`[${new Date().toLocaleString('es-VE')}] ✔ Voluntariados vencidos actualizados.`);
  } catch (err) {
    console.error('Error en job finalizar_voluntariados_vencidos:', err.message);
  }
}

finalizarVencidos();                           // ejecutar al arrancar
setInterval(finalizarVencidos, 60 * 60 * 1000); // repetir cada 1 hora