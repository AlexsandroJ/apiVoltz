const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const canRoutes = require('./routes/canRoutes');
const swagger = require('./swagger/swagger');
require('dotenv').config();
const bodyParser = require('body-parser');

// Inicializa o app
const app = express();

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://seu-dominio.com', 'https://outra-url.com'] // domínios permitidos em produção
    : ['http://localhost:3000'], // só permite o frontend do React
  credentials: true, // se usar cookies/sessões
  optionsSuccessStatus: 200
};


// Configura middlewares
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors(corsOptions));

// Rotas
app.use('/api', canRoutes);

// Servir arquivos estáticos da pasta 'public'
//app.use(express.static(path.join(__dirname, 'public')));

/**/
// Rota para acessar o dashboard
app.get('/dashboard', (req, res) => {
  //res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'API CAN está funcionando!' });
});

// Swagger
swagger(app);

module.exports = { app };