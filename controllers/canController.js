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
  const limit = parseInt(req.query.limit) || 50;
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
 * Adiciona um novo frame CAN a um registro existente (ou cria um novo).
 * 
 * @async
 * @function addCanMessage
 * @param {object} req - Objeto de requisição Express.
 * @param {object} req.params - Parâmetros da URL.
 * @param {string} req.params.deviceId - ID do dispositivo.
 * @param {object} req.body - Frame CAN a ser adicionado.
 * @param {number} req.body.canId - ID do frame CAN.
 * @param {number[]} req.body.data - Array de bytes do frame.
 * @param {number} req.body.dlc - Data Length Code.
 * @param {boolean} [req.body.rtr=false] - Remote Transmission Request.
 * @param {object} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 * @throws {Error} Se os dados forem inválidos ou ocorrer erro de banco de dados.
 * 
 * @example
 * POST /api/can/voltz-20250121-143022
 * Body: {
 *   "canId": 288,
 *   "data": [166, 121, 24, 236],
 *   "dlc": 4,
 *   "rtr": false
 * }
 */
exports.addCanMessage = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const canMessage = req.body;

    // Validação básica
    if (!canMessage || !canMessage.canId || !canMessage.data) {
      return res.status(400).json({
        error: 'Dados incompletos',
        message: 'canMessage deve conter canId, data '
      });
    }

    // Procura um documento existente com o deviceId (ou cria um novo)
    let vehicleData = await VehicleData
    .findOne({ deviceId })
    .sort({ timestamp: -1 })
    .lean() // reduzir o uso de memória

    if (vehicleData) {
      // Adiciona o novo CAN message ao array existente
      vehicleData.canMessages.push(canMessage);
      // Atualiza o timestamp
      vehicleData.timestamp = new Date();
    } else {
      // Cria um novo documento com o deviceId (ou deixa o modelo gerar automaticamente)
      vehicleData = new VehicleData({
        deviceId: deviceId || undefined, // Deixa o modelo gerar se não for enviado
        canMessages: [canMessage]
      });
    }

    const savedData = await vehicleData.save();

    res.status(201).json({
      savedData
    });
  } catch (error) {
    console.error('Erro ao adicionar mensagem CAN:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao adicionar mensagem CAN',
      message: error.message
    });
  }
};

/**
 * Retorna os últimos N frames CAN (padrão: 50).
 * 
 * @async
 * @function getRecentCanData
 * @param {object} req - Objeto de requisição Express.
 * @param {object} req.query - Parâmetros da query string.
 * @param {number} [req.query.limit=50] - Número máximo de frames a retornar.
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
  const limit = parseInt(req.query.limit) || 50;

  try {
    // Busca os últimos documentos que contêm canMessages
    const data = await VehicleData
      .find({ canMessages: { $exists: true, $ne: [] } })
      .sort({ timestamp: -1 })
      .lean() // reduzir o uso de memória
      .limit(limit)
      .select('deviceId timestamp canMessages') // Apenas campos relevantes
      .exec();

    // Achata os arrays de canMessages para uma lista única
    const flattenedCanMessages = [];
    for (const doc of data) {
      for (const msg of doc.canMessages) {
        flattenedCanMessages.push({
          ...msg,
          deviceId: doc.deviceId,
          timestamp: doc.timestamp
        });
      }
    }

    // Retorna os últimos N frames CAN
    res.json(flattenedCanMessages.slice(0, limit));
  } catch (error) {
    console.error('Erro ao buscar dados CAN:', error);
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
  try {
    const { deviceId } = req.query;

    // Configura cabeçalhos da resposta
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=can-data-${Date.now()}.csv`);

    // Escreve cabeçalhos do CSV
    const headers = ['timestamp', 'canId', 'data', 'dlc', 'rtr'];
    res.write(headers.join(',') + '\n');

    // Cria query com filtro opcional
    const query = { canMessages: { $exists: true, $ne: [] } };
    if (deviceId) query.deviceId = deviceId;

    // Usa cursor para processar documentos um por um (streaming)
    const cursor = VehicleData.find(query).sort({ timestamp: 1 }).cursor();

    for await (const doc of cursor) {
      for (const msg of doc.canMessages) {
        const row = [
          `"${msg.timestamp?.toISOString() || new Date(doc.timestamp).toISOString()}"`,
          `"0x${msg.canId.toString(16).toUpperCase()}"`,
          `"${Array.isArray(msg.data) ? msg.data.join(' ') : msg.data}"`,
          msg.dlc || 0,
          msg.rtr ? 'true' : 'false'
        ];
        res.write(row.join(',') + '\n');
      }
    }

    res.end(); // Finaliza a resposta
  } catch (error) {
    console.error('Erro ao exportar dados CAN em CSV:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};