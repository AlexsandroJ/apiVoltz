/**
 * @fileoverview Controller para gerenciamento de dados de veículo e frames CAN.
 * 
 * Este módulo contém funções para:
 * - Salvar dados do veículo.
 * - Buscar dados históricos e recentes.
 * - Filtrar por deviceId.
 * - Adicionar frames CAN a documentos existentes.
 * - Exportar dados em formatos CSV e JSON.
 * 
 * @module VehicleController
 * @author Alexsandro J Silva
 * @version 1.0.0
 * @since 2025-11-21
 */

const VehicleData = require('../models/canDataModels');
const CanFrame = require('../models/canFrameModels');
// controllers/canController.js
const { decodeCanFrame } = require('../utils/canDecoder');
const useInMemoryDB = process.env.DEV;


/**
 * Salva um novo registro de dados do veículo.
 * 
 * @async
 * @function createVehicleData
 * @param {object} req - Objeto de requisição Express.
 * @param {object} req.body - Dados do veículo a serem salvos.
 * @param {object} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 * @throws {Error} Se ocorrer erro ao salvar no banco de dados.
 * 
 * @example
 * POST /api/device
 * Body: {
 *   "deviceId": "voltz-20250121-143022",
 *   "speed": 45,
 *   "battery": { "soc": 85, "voltage": 350.5 },
 *   "canMessages": [...]
 * }
 */
exports.createVehicleData = async (req, res) => {
  try {
    const data = new VehicleData(req.body);
    const savedData = await data.save();
    res.status(201).json(savedData);
  } catch (error) {
    console.error('Erro ao salvar dados do veículo:', error);
    res.status(400).json({
      error: 'Falha ao salvar dados',
      message: error.message
    });
  }
};

/**
 * Retorna todos os registros de um dispositivo específico.
 * 
 * @async
 * @function getVehicleDataByDeviceId
 * @param {object} req - Objeto de requisição Express.
 * @param {object} req.params - Parâmetros da URL.
 * @param {string} req.params.deviceId - ID do dispositivo.
 * @param {object} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 * @throws {Error} Se ocorrer erro ao buscar no banco de dados.
 * 
 * @example
 * GET /api/device/voltz-20250121-143022
 * Response: [{ "_id": "...", "timestamp": "...", ... }]
 */
exports.getVehicleDataByDeviceId = async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const { deviceId } = req.params;

  try {
    const data = await VehicleData
      .find({ deviceId: deviceId })
      .sort({ timestamp: -1 })
      .lean() // reduzir o uso de memória
      .limit(limit)
      .exec();

    if (data.length === 0) {
      return res.status(404).json({ error: `Nenhum dado encontrado para o deviceId: ${deviceId}` });
    }

    res.json(data);
  } catch (error) {
    console.error(`Erro ao buscar dados do dispositivo ${deviceId}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Adiciona um ou vários frames CAN diretamente na coleção CanFrame
 * 
 * @async
 * @function addCanMessage
 * @param {object} req - Objeto de requisição Express.
 * @param {object} req.params - Parâmetros da URL.
 * @param {string} req.params.deviceId - ID do dispositivo.
 * @param {object|object[]} req.body - Frame CAN ou array de frames.
 * @param {object} res - Objeto de resposta Express.
 * 
 * @example
 * POST /api/can/voltz-20250121-143022
 * Body: [
 *   { "canId": 288, "data": [166, 121, 24, 236], "dlc": 4, "rtr": false },
 *   { "canId": 768, "data": [25, 28, 54, 48], "dlc": 4, "rtr": false }
 * ]
 */
exports.addCanMessage = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const canMessages = Array.isArray(req.body) ? req.body : [req.body];

    // Validação básica
    for (const msg of canMessages) {
      if (!msg || !msg.canId || !msg.data) {
        return res.status(400).json({
          error: 'Dados incompletos',
          message: 'Cada frame CAN deve conter canId e data'
        });
      }
    }

    // Prepara os documentos para inserção
    const framesToInsert = canMessages.map(msg => ({
      deviceId,
      canId: msg.canId,
      data: msg.data,
      dlc: msg.dlc,
      rtr: msg.rtr || false,
      timestamp: new Date()
    }));
    // Insere todos os frames de uma só vez
    const result = await CanFrame.insertMany(framesToInsert);

    res.status(201).json({
      message: `Adicionados ${result.length} frames com sucesso`,
      insertedCount: result.length
    });
  } catch (error) {
    console.error('Erro ao adicionar mensagens CAN:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao adicionar mensagens CAN',
      message: error.message
    });
  }
};

/**
 * Retorna os últimos N frames CAN (padrão: 20).
 * 
 * @async
 * @function getRecentCanData
 * @param {object} req - Objeto de requisição Express.
 * @param {object} req.query - Parâmetros da query string.
 * @param {number} [req.query.limit=20] - Número máximo de frames a retornar.
 * @param {object} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 * @throws {Error} Se ocorrer erro ao buscar no banco de dados.
 * 
 * @example
 * GET /api/can-data?limit=20
 * Response: [
 *   { "canId": 288, "data": [166, 121, 24, 236], "timestamp": "..." },
 *   ...
 * ]
 */
exports.getRecentCanData = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
  const { deviceId } = req.query;

  try {
    const query = deviceId ? { deviceId } : {};
    const frames = await CanFrame
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json(frames);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
};


/**
 * Retorna os últimos N frames CAN decodificados
 */
exports.getDecodedCanData = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    //const { deviceId } = req.params;

    // Busca os frames mais recentes
    //const query = deviceId ? { deviceId } : {};
    const frames = await CanFrame
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Decodifica cada frame
    const decodedFrames = frames.map(frame => {
      const decoded = decodeCanFrame(frame);
      return {
        ...frame,
        decoded: decoded ? decoded.data : null,
        source: decoded ? decoded.type : 'unknown'
      };
    });

    res.json(decodedFrames);
  } catch (error) {
    console.error('Erro ao buscar frames decodificados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
/**
 * Exporta todos os dados CAN do banco como CSV (com streaming para evitar memory leak).
 * 
 * @async
 * @function exportAllCanDataAsCsv
 * @param {object} req - Objeto de requisição Express.
 * @param {string} [req.query.deviceId] - Filtrar por deviceId específico (opcional).
 * @param {object} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 * @throws {Error} Se ocorrer erro ao buscar ou formatar os dados.
 * 
 * @example
 * GET /api/export-can-data-csv
 * Download: can-data-1234567890.csv
 */
exports.exportAllCanDataAsCsv = async (req, res) => {
  const { deviceId } = req.query;
  const query = deviceId ? { deviceId } : {};

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=can-data-${Date.now()}.csv`);
  res.write('timestamp,canId,data,dlc,rtr\n');

  // Usa streaming com cursor
  const cursor = CanFrame.find(query).sort({ timestamp: 1 }).cursor();
  for await (const frame of cursor) {
    const row = [
      `"${frame.timestamp.toISOString()}"`,
      `"0x${frame.canId.toString(16).toUpperCase()}"`,
      `"${frame.data.join(' ')}"`,
      frame.dlc,
      frame.rtr ? 'true' : 'false'
    ];
    res.write(row.join(',') + '\n');
  }
  res.end();
};