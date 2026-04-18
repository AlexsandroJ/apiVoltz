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
exports.getVehicleData = async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  //const { deviceId } = req.params;

  try {
    const data = await VehicleData
      .find({})
      .sort({ timestamp: -1 })
      .lean() // reduzir o uso de memória
      .limit(limit)
      .exec();

    if (data.length === 0) {
      return res.status(404).json({ error: `Nenhum dado encontrado para o` });
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
    //const { deviceId } = req.params;
    const canMessages = Array.isArray(req.body) ? req.body : [req.body];

    // Validação básica
    for (const msg of canMessages) {
      if (!msg || !msg.canId || !msg.data) {
        return res.status(400).json({
          error: 'Dados incompletos',
          message: 'Cada frame CAN deve conter canId e data'
        });
      }

      const hexArray = msg.data.split(' '); // Transforma em ["09", "D8", ...]
      const numericData = hexArray.map(hex => parseInt(hex, 16)); // Converte para [9, 216, 14, ...]
      msg.data = numericData; // Adiciona o array numérico para facilitar consultas futuras
    }


    const framesToInsert = canMessages.map(msg => ({
      
      canId: msg.canId,
      data: msg.data,
      dlc: msg.dlc,
      ide: msg.ide || false,
      timestamp: new Date(msg.ts)
    }));

    framesToInsert.forEach(element => {
      const decodedFrame = decodeCanFrame(element);

      if (decodedFrame) {

        processDecodedFrame(decodedFrame, element.timestamp);
      }

    });

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
  // Define o limite com trava de segurança
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);

  try {
    // 1. Defina a query (vazia {} busca todos os registros)
    const query = {};

    // 2. Busca no banco
    const frames = await CanFrame
      .find(query)             // Agora a variável existe
      .sort({ timestamp: -1 }) // Garante que os mais novos venham primeiro
      .limit(limit)
      .lean();                 // Melhora performance (retorna objeto puro JS)

    res.json(frames);
  } catch (error) {
    console.error('Erro ao buscar frames:', error);
    res.status(500).json({ error: 'Erro interno ao buscar dados CAN' });
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

/**
 * Exporta todos os dados de VehicleData como CSV (com streaming)
 */
exports.exportVehicleDataAsCsv = async (req, res) => {
  const { deviceId } = req.query;
  const query = deviceId ? { deviceId } : {};

  // Define cabeçalho do CSV
  const headers = [
    'timestamp',
    'deviceId',
    'speed',
    'battery.soc',
    'battery.soh',
    'battery.voltage',
    'battery.current',
    'battery.temperature',
    'motor.modo',
    'motor.rpm',
    'motor.torque',
    'motor.motorTemp',
    'motor.controlTemp',
    'gpsAccuracy',
    'location.coordinates'
  ];

  // Configura resposta CSV
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=vehicle-data-${Date.now()}.csv`);
  res.write(headers.join(',') + '\n');

  // Usa cursor para streaming eficiente
  const cursor = VehicleData
    .find(query)
    .sort({ timestamp: 1 })
    .cursor();

  for await (const doc of cursor) {
    const row = [
      `"${doc.timestamp?.toISOString() || ''}"`,
      `"${doc.deviceId || ''}"`,
      doc.speed ?? '',
      doc.battery?.soc ?? '',
      doc.battery?.soh ?? '',
      doc.battery?.voltage ?? '',
      doc.battery?.current ?? '',
      doc.battery?.temperature ?? '',
      doc.motor?.modo ?? '',
      doc.motor?.rpm ?? '',
      doc.motor?.torque ?? '',
      doc.motor?.motorTemp ?? '',
      doc.motor?.controlTemp ?? '',
      doc.gpsAccuracy ?? '',
      doc.location?.coordinates ? `"${doc.location.coordinates.join(',')}"` : ''
    ].map(field => {
      // Escapa aspas dentro dos campos (boa prática)
      if (typeof field === 'string') {
        return field.replace(/"/g, '""');
      }
      return field;
    });

    res.write(row.join(',') + '\n');
  }

  res.end();
};

exports.addLocationToLatestVehicleData = async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;

  // Validação básica
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'latitude e longitude são obrigatórios e devem ser números' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Coordenadas fora do intervalo válido' });
  }

  try {
    // 1. Busca o último registro de VehicleData
    const lastRecord = await VehicleData.findOne().sort({ timestamp: -1 });

    if (!lastRecord) {
      return res.status(404).json({ error: 'Nenhum dado de veículo encontrado para atualizar' });
    }

    // 2. Cria um novo documento com base no último, adicionando localização
    const newRecord = new VehicleData({
      ...lastRecord.toObject(), // copia todos os campos
      _id: undefined,          // força novo ID
      createdAt: undefined,    // força novo createdAt
      updatedAt: undefined,    // força novo updatedAt
      location: {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON: [lon, lat]
      },
      gpsAccuracy: accuracy
    });

    // 3. Salva novo registro
    const saved = await newRecord.save();

    res.status(201).json(saved);

  } catch (error) {
    console.error('Erro ao adicionar localização:', error);
    res.status(500).json({ error: 'Falha ao salvar localização' });
  }
};

async function processDecodedFrame(decodedFrame, timestamp) {
  try {

    const lastValidLocation = await VehicleData.findOne({
      'location.coordinates': { $exists: true, $ne: [], $size: 2 }
    }).sort({ timestamp: -1 }).select('location').lean();

    // 1. Busca o último registro completo
    const lastRecord = await VehicleData.findOne({}).sort({ timestamp: -1 }).lean();

    // 2. Define base: usa último registro ou objeto vazio
    const base = lastRecord || {};

    // 3. Mescla campos de forma segura
    const newRecord = {
      // Campos simples: só atualiza se vierem no frame

      ...(decodedFrame.speed !== undefined && { speed: decodedFrame.speed }),
      ...(decodedFrame.gpsAccuracy !== undefined && { gpsAccuracy: decodedFrame.gpsAccuracy }),

      // Subdocumentos: mescla com o anterior
      battery: {
        ...(base.battery || {}),
        ...(decodedFrame.battery || {})
      },
      motor: {
        ...(base.motor || {}),
        ...(decodedFrame.motor || {})
      },

      // ✅ Localização: só define se tiver nova OU herdar válida
      ...(decodedFrame.location?.coordinates?.length === 2
        ? {
          location: {
            type: 'Point',
            coordinates: decodedFrame.location.coordinates
          }
        }
        : lastValidLocation?.location
          ? { location: lastValidLocation.location }
          : {}),

      timestamp: timestamp
    };

    // 4. Salva novo estado completo
    const doc = new VehicleData(newRecord);
    await doc.save();
    //console.log('🆕 Novo registro salvo:', doc);

  } catch (error) {
    console.error('❌ Erro ao processar frame:', error);
  }
}

// Busca o último registro com localização válida
async function getLastValidLocation() {
  return await VehicleData.findOne({
    'location.coordinates': { $exists: true, $ne: [], $size: 2 },
    'location.coordinates.0': { $type: 'number' },
    'location.coordinates.1': { $type: 'number' }
  })
    .sort({ timestamp: -1 }) // mais recente primeiro
    .select('location') // só os campos necessários
    .lean();
}
