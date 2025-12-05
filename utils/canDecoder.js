// utils/canDecoder.js

// IDs base
const BASE_BATTERY_ID = 0x120;
const BASE_CONTROLLER_ID = 0x300;

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
    current: (data[2] * 256 + data[3]) * 0.1,
    voltage: (data[0] * 256 + data[1]) * 0.1,
    soc: data[6],
    soh: data[7],
    temperature: data[4]
  };
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
    motorSpeedRpm: data[0] * 256 + data[1],
    motorTorque: (data[2] * 256 + data[3]) * 0.1,
    motorTemperature: data[7] - 40,
    controllerTemperature: data[6] - 40
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
      data: decodeBatteryData(data)
    };
  }

  if (canId === BASE_CONTROLLER_ID) {
    return {
      type: 'motorController',
      data: decodeMotorControllerData(data)
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
