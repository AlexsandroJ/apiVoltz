const express = require('express');
const cors = require('cors');
const path = require('path');
const canRoutes = require('./routes/canRoutes');
const swagger = require('./swagger/swagger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ extended: false })); // Para parsear JSON

// Rotas
app.use('/api', canRoutes);

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota para acessar o dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'API CAN está funcionando!' });
});

// Swagger
swagger(app);

module.exports = app;