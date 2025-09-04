const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const VehicleData = require('../models/canDataModels');
// Opções do Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Veicular',
            version: '1.0.0',
            description: 'Documentação da API de telemetria de veículos elétricos',
        },
        servers: [
            {
                url: 'http://localhost:3000/api', // Ajuste sua porta
            },
        ],
        
    },
    apis: ['./routes/*.js'], // Caminho para seus arquivos de rotas com anotações @swagger
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};
