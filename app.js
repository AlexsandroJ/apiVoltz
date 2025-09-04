const express = require('express');
const cors = require('cors');

const canRoutes = require('./routes/canRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ extended: false })); // Para parsear JSON

// Rotas
app.use('/api/can', canRoutes);

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'API CAN está funcionando!' });
});

module.exports = app;