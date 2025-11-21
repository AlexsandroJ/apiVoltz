const express = require('express');
const router = express.Router();

const {
  createVehicleData,
  getVehicleDataByDeviceId,
  addCanMessage,
  getRecentCanData,
  exportAllCanDataAsCsv
} = require('../controllers/canController');

/**
 * @swagger
 * tags:
 *   name: Vehicle Data
 *   description: Gerenciamento de dados do veículo
 */

/**
 * @swagger
 * /device:
 *   post:
 *     summary: Cria um novo registro de dados do veículo
 *     tags: [Vehicle Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleData'
 *     responses:
 *       201:
 *         description: Dados do veículo criados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleData'
 *       400:
 *         description: Erro ao salvar dados
 */
router.post('/device', createVehicleData); // ✅ Atualizado

/**
 * @swagger
 * /device/{deviceId}:
 *   get:
 *     summary: Retorna todos os registros de um dispositivo específico
 *     tags: [Vehicle Data]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do dispositivo
 *     responses:
 *       200:
 *         description: Lista de dados do dispositivo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleData'
 *       404:
 *         description: Nenhum dado encontrado para o deviceId
 */
router.get('/device/:deviceId', getVehicleDataByDeviceId);

/**
 * @swagger
 * /can/{deviceId}:
 *   post:
 *     summary: Adiciona um novo frame CAN a um registro existente
 *     tags: [Vehicle Data]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do dispositivo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CanMessage'
 *     responses:
 *       201:
 *         description: Frame CAN adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 savedData:
 *                   $ref: '#/components/schemas/VehicleData'
 *       400:
 *         description: Dados incompletos
 */
router.post('/can/:deviceId', addCanMessage);

/**
 * @swagger
 * /can-data:
 *   get:
 *     summary: Retorna os últimos N frames CAN
 *     tags: [Vehicle Data]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de frames a retornar
 *     responses:
 *       200:
 *         description: Lista de frames CAN
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CanMessage'
 */
router.get('/can-data', getRecentCanData);

/**
 * @swagger
 * /export-can-data-csv:
 *   get:
 *     summary: Exporta todos os dados CAN como CSV
 *     tags: [Vehicle Data]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *         description: Filtrar por deviceId específico (opcional)
 *     responses:
 *       200:
 *         description: Arquivo CSV com dados CAN
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export-can-data-csv', exportAllCanDataAsCsv);

module.exports = router;