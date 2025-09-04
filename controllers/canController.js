// controllers/vehicleController.js

const VehicleData = require('../models/canDataModels');

/**
 * Salva um novo registro de dados do veículo
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
 * Retorna o último registro do veículo (mais recente)
 */
exports.getLatestVehicleData = async (req, res) => {
  try {
    const data = await VehicleData
      .findOne()
      .sort({ timestamp: -1 })
      .exec();

    if (!data) {
      return res.status(404).json({ error: 'Nenhum dado encontrado' });
    }

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar último dado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Retorna o histórico de dados (últimos N registros)
 * Query params: ?limit=50
 */
exports.getVehicleHistory = async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const deviceId = req.query.deviceId;

  try {
    let query = {};
    if (deviceId) {
      query.deviceId = deviceId;
    }

    const data = await VehicleData
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

/**
 * Retorna todos os registros de um dispositivo específico
 */
exports.getVehicleDataByDeviceId = async (req, res) => {
  const { id } = req.params;

  try {
    const data = await VehicleData
      .find({ deviceId: id })
      .sort({ timestamp: -1 })
      .exec();

    if (data.length === 0) {
      return res.status(404).json({ error: `Nenhum dado encontrado para o deviceId: ${id}` });
    }

    res.json(data);
  } catch (error) {
    console.error(`Erro ao buscar dados do dispositivo ${id}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};