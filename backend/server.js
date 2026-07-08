const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/miembros',      require('./routes/miembros'));
app.use('/api/vinculaciones', require('./routes/vinculaciones'));
app.use('/api/beneficiarios', require('./routes/beneficiarios'));
app.use('/api/infraestructura', require('./routes/infraestructura'));
app.use('/api/vehiculos', require('./routes/vehiculos'));
app.use('/api/voluntariado', require('./routes/voluntariado'));
app.use('/api/servicios', require('./routes/servicios'));
// app.use('/api/solicitudes',   require('./routes/solicitudes'));
// app.use('/api/financiero',    require('./routes/financiero'));
// app.use('/api/vehiculos',     require('./routes/vehiculos'));
// app.use('/api/estacionamiento',require('./routes/estacionamiento'));
// app.use('/api/voluntariado',  require('./routes/voluntariado'));
// app.use('/api/bolsatrabajo',  require('./routes/bolsatrabajo'));
// app.use('/api/reportes',      require('./routes/reportes'));

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
