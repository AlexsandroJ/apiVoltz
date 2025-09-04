const express = require('express');
const router = express.Router();

const {
  createVehicleData,
  getLatestVehicleData,
  getVehicleHistory,
  getVehicleDataByDeviceId
} = require('../controllers/canController');

/**
 * @swagger
 * tags:
 *   name: VehicleData
 *   description: Gerenciamento dos dados veiculares recebidos via CAN e telemetria
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     VehicleData:
 *       type: object
 *       required:
 *         - deviceId
 *         - timestamp
 *       properties:
 *         _id:
 *           type: string
 *           description: ID do documento gerado pelo MongoDB
 *           example: 666cbf2f9e8d2c001a8f9e23
 *         deviceId:
 *           type: string
 *           description: Identificador único do dispositivo (moto)
 *           example: voltz-20250405-102030
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp do evento
 *         canMessages:
 *           type: array
 *           description: Mensagens brutas da rede CAN
 *           items:
 *             type: object
 *             properties:
 *               canId:
 *                 type: string
 *                 description: Identificador da mensagem CAN
 *                 example: 0x181
 *               data:
 *                 type: string
 *                 description: Dados em hexadecimal
 *                 example: AABBCCDDEEFF0011
 *               dlc:
 *                 type: number
 *                 description: Data Length Code (tamanho dos dados)
 *                 example: 8
 *               rtr:
 *                 type: boolean
 *                 description: Remote Transmission Request
 *                 example: false
 *             required:
 *               - data
 *               - dlc
 *         speed:
 *           type: number
 *           description: Velocidade atual em km/h
 *           minimum: 0
 *           maximum: 200
 *           example: 45
 *         battery:
 *           type: object
 *           description: Informações da bateria
 *           properties:
 *             soc:
 *               type: number
 *               description: State of Charge (%)
 *               minimum: 0
 *               maximum: 100
 *               example: 85
 *             soh:
 *               type: number
 *               description: State of Health (%)
 *               minimum: 0
 *               maximum: 100
 *               example: 92
 *             voltage:
 *               type: number
 *               description: Tensão da bateria em volts
 *               example: 72.4
 *             current:
 *               type: number
 *               description: Corrente em Amperes (negativo = descarregando)
 *               example: -2.1
 *             temperature:
 *               type: number
 *               description: Temperatura da bateria em °C
 *               example: 28.5
 *         motor:
 *           type: object
 *           description: Dados do motor elétrico
 *           properties:
 *             rpm:
 *               type: number
 *               example: 3200
 *             power:
 *               type: number
 *               description: Potência em kW
 *               example: 8.5
 *             regenLevel:
 *               type: number
 *               description: Nível de frenagem regenerativa (%)
 *               minimum: 0
 *               maximum: 100
 *               example: 30
 *             motorTemp:
 *               type: number
 *               description: Temperatura do motor em °C
 *               example: 65
 *             inverterTemp:
 *               type: number
 *               description: Temperatura do inversor em °C
 *               example: 58
 *         location:
 *           type: object
 *           description: Localização geográfica (GeoJSON Point)
 *           properties:
 *             type:
 *               type: string
 *               enum: [Point]
 *               example: Point
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               description: [longitude, latitude]
 *               example: [-46.5755, -23.6789]
 *         driveMode:
 *           type: string
 *           enum: [eco, norm, sport]
 *           description: Modo de condução atual
 *           example: sport
 *         range:
 *           type: number
 *           description: Autonomia estimada em km
 *           minimum: 0
 *           example: 85
 *         vehicleStatus:
 *           type: string
 *           enum: [ligado, desligado, carregando, pronto]
 *           description: Status atual do veículo
 *           example: ligado
 *         odometer:
 *           type: number
 *           description: Odômetro em km
 *           minimum: 0
 *           example: 1234.5
 *         alerts:
 *           type: array
 *           description: Lista de alertas ou erros
 *           items:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: BATT_TEMP_HIGH
 *               message:
 *                 type: string
 *                 example: Temperatura da bateria elevada
 *               severity:
 *                 type: string
 *                 enum: [info, warning, error]
 *                 example: warning
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-04-05T10:24:50.000Z
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Data de criação do registro
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *         gpsLocation:
 *           type: object
 *           description: Virtual: latitude e longitude formatadas (frontend)
 *           properties:
 *             lat:
 *               type: number
 *               example: -23.6789
 *             lon:
 *               type: number
 *               example: -46.5755
 *           nullable: true
 *       example:
 *         _id: 666cbf2f9e8d2c001a8f9e23
 *         deviceId: voltz-20250405-102030
 *         timestamp: '2025-04-05T10:25:00.000Z'
 *         speed: 45
 *         battery:
 *           soc: 85
 *           soh: 92
 *           voltage: 72.4
 *           current: -2.1
 *           temperature: 28.5
 *         motor:
 *           rpm: 3200
 *           power: 8.5
 *           regenLevel: 30
 *           motorTemp: 65
 *           inverterTemp: 58
 *         location:
 *           type: Point
 *           coordinates: [-46.5755, -23.6789]
 *         driveMode: sport
 *         range: 85
 *         vehicleStatus: ligado
 *         odometer: 1234.5
 *         alerts:
 *           - code: BATT_TEMP_HIGH
 *             message: Temperatura da bateria elevada
 *             severity: warning
 *             timestamp: '2025-04-05T10:24:50.000Z'
 *         canMessages:
 *           - canId: 0x181
 *             data: AABBCCDDEEFF0011
 *             dlc: 8
 *             rtr: false
 *         createdAt: '2025-04-05T10:25:00.000Z'
 *         updatedAt: '2025-04-05T10:26:00.000Z'
 *         gpsLocation:
 *           lat: -23.6789
 *           lon: -46.5755
 */

/**
 * @swagger
 * /api/vehicle:
 *   post:
 *     summary: Salva um novo registro de dados do veículo
 *     tags: [VehicleData]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VehicleData'
 *     responses:
 *       201:
 *         description: Dados do veículo salvos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleData'
 *       400:
 *         description: Falha na validação ou dados inválidos
 */
router.post('/', createVehicleData);

/**
 * @swagger
 * /api/vehicle/latest:
 *   get:
 *     summary: Retorna o último registro de dados do veículo (mais recente)
 *     tags: [VehicleData]
 *     responses:
 *       200:
 *         description: Último estado do veículo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VehicleData'
 *       404:
 *         description: Nenhum dado encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/latest', getLatestVehicleData);

/**
 * @swagger
 * /api/vehicle/history:
 *   get:
 *     summary: Retorna o histórico de dados do veículo (últimos N registros)
 *     tags: [VehicleData]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 50
 *         description: Número máximo de registros retornados (padrão: 50)
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *         description: Filtra por ID do dispositivo
 *     responses:
 *       200:
 *         description: Lista de registros ordenados por timestamp (desc)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleData'
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/history', getVehicleHistory);

/**
 * @swagger
 * /api/vehicle/device/{id}:
 *   get:
 *     summary: Retorna todos os registros de um dispositivo específico
 *     tags: [VehicleData]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do dispositivo (deviceId)
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
 *         description: Nenhum dado encontrado para o deviceId fornecido
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/device/:id', getVehicleDataByDeviceId);

module.exports = router;