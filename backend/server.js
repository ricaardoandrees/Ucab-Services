const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/miembros', require('./routes/miembros'));

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