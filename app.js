const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const canRoutes = require('./routes/canRoutes');
const swagger = require('./swagger/swagger');
require('dotenv').config(); // Lê o .env
const bodyParser = require('body-parser');

// Inicializa o app
const app = express();

// Configura middlewares
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: '*', // Permite todas as origens
}));

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
app.get('/api/dashboard-data', async (req, res) => {
    try {
        // As variáveis de ambiente são acessadas somente no servidor
        const apiUrl = process.env.API_URL;

        if (!apiUrl) {
            return res.status(500).send('URL da API não configurada.');
        }
        // Faz a requisição para a API externa. Você pode usar 'fetch' ou 'axios'.
        const apiResponse = await fetch(apiUrl);

        if (!apiResponse.ok) {
            throw new Error(`Erro na API externa: ${apiResponse.statusText}`);
        }

        const data = await apiResponse.json();

        // Envia os dados da API de volta para o cliente (dashboard)
        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados da API:', error);
        res.status(500).json({ error: 'Falha ao buscar dados para o dashboard.' });
    }
});
// Swagger
swagger(app);

module.exports = app;