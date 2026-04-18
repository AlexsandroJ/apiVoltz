// utils/canDecoder.js

const { BASE_BATTERY_ID, BASE_CONTROLLER_ID } = require('../config/constants');
/**
 * Decodifica dados da bateria a partir de um frame CAN
 * @param {number[]} data - Array de 8 bytes do frame CAN
 * @returns {object} - Dados decodificados da bateria
 */
function decodeBatteryData(data) {
  if (!Array.isArray(data) || data.length < 8) {
    throw new Error('Dados da bateria inválidos: array deve ter pelo menos 8 bytes');
  }

  return {
    current: ((data[2] * 256 + data[3]) * 0.1).toFixed(2),
    voltage: ((data[0] * 256 + data[1]) * 0.1).toFixed(2),
    soc: (data[6]).toFixed(2),
    soh: (data[7]).toFixed(2),
    temperature: (data[4]).toFixed(2)
  };
}
function modo(params) {
  if (params == 0x45) return "ECO";
  else if (params == 0x4D) return "STD";
  else if (params == 0x55) return "TURBO";
  else return "UNKNOWN";
}


/**
 * Decodifica dados do controlador de motor a partir de um frame CAN
 * @param {number[]} data - Array de 8 bytes do frame CAN
 * @returns {object} - Dados decodificados do motor
 */
function decodeMotorControllerData(data) {

  if (!Array.isArray(data) || data.length < 8) {
    throw new Error('Dados do motor inválidos: array deve ter pelo menos 8 bytes');
  }

  return {
    rpm: (data[0] * 256 + data[1]).toFixed(2),
    torque: ((data[2] * 256 + data[3]) * 0.1).toFixed(2),
    motorTemp: (data[7] - 40).toFixed(2),
    controlTemp: (data[6] - 40).toFixed(2),
    modo: modo(data[5])
  };
}

/**
 * Função principal para decodificar qualquer frame CAN
 * @param {object} canFrame - Frame CAN com id e data
 * @returns {object|null} - Dados decodificados ou null se não for um ID conhecido
 */
function decodeCanFrame(canFrame) {
  const { canId, data } = canFrame;


  if (canId === BASE_BATTERY_ID) {
    return {
      type: 'battery',
      battery: decodeBatteryData(data)
    };
  }

  if (canId === BASE_CONTROLLER_ID) {
    return {
      type: 'motor',
      motor: decodeMotorControllerData(data)
    };
  }

  return null; // Não é um ID conhecido
}

module.exports = {
  decodeBatteryData,
  decodeMotorControllerData,
  decodeCanFrame,
  BASE_BATTERY_ID,
  BASE_CONTROLLER_ID
};
