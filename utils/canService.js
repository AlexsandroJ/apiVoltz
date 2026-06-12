// backend/services/canService.js
const CanData = require('../models/canDataModels'); // Seu model do MongoDB

/**
 * Salva mensagens CAN diretamente no banco (SEM HTTP)
 * @param {Object|Object[]} canMessages 
 */
async function saveCanMessage(canMessages) {
  try {
    // Se for array, salva múltiplos
    if (Array.isArray(canMessages)) {
      return await CanData.insertMany(canMessages);
    }
    // Se for objeto único, salva um
    return await CanData.create(canMessages);
  } catch (error) {
    console.error('❌ Erro ao salvar mensagem CAN:', error);
    throw error;
  }
}

/**
 * Busca dados CAN decodificados (mesma lógica da rota da API)
 * @param {number} limit 
 */
async function getDecodedCanData(limit = 50) {
  try {
    return await CanData.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('❌ Erro ao buscar dados CAN decodificados:', error);
    throw error;
  }
}

module.exports = { saveCanMessage, getDecodedCanData };
