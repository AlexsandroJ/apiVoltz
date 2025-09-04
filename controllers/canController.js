const CanData = require('../models/canDataModels');

// Criar novo dado CAN
exports.createCanData = async (req, res) => {
  try {
    const { deviceId, canId, data, rtr, dlc } = req.body;

    const newData = new CanData({
      deviceId,
      canId,
      data,
      rtr: rtr || false,
      dlc
    });

    const savedData = await newData.save();
    res.status(201).json(savedData);
  } catch (error) {
    res.status(400).json({ message: 'Erro ao salvar dados CAN', error: error.message });
  }
};

// Listar todos os dados CAN
exports.getAllCanData = async (req, res) => {
  try {
    const data = await CanData.find().sort({ timestamp: -1 });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar dados', error: error.message });
  }
};

// Buscar dado CAN por ID
exports.getCanDataById = async (req, res) => {
  try {
    const data = await CanData.findById(req.params.id);
    if (!data) {
      return res.status(404).json({ message: 'Dado CAN não encontrado' });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar dado', error: error.message });
  }
};

// Deletar dado CAN por ID
exports.deleteCanData = async (req, res) => {
  try {
    const data = await CanData.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({ message: 'Dado CAN não encontrado' });
    }
    res.status(200).json({ message: 'Dado CAN deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar dado', error: error.message });
  }
};