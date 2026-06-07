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
  return "DESCONHECIDO";
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
    motorTemp: (data[7] * 2).toFixed(2),
    controlTemp: (data[6] - 40).toFixed(2),
    modo: modo(data[5])
  };
}

/**
 * Extrai campos extras do frame para passthrough
 * @param {object} canFrame - Frame CAN original
 * @param {string[]} exclude - Campos a excluir do resultado
 * @returns {object} - Campos extras
 */
function extractPassthroughFields(canFrame, exclude = ['canId', 'data']) {
  const result = {};
  for (const [key, value] of Object.entries(canFrame)) {
    if (!exclude.includes(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Transforma dados do MPU-6050 do formato ESP32 → formato do schema MongoDB
 * 
 * Formato ESP32 (entrada):
 * { mpu: { ax_g: 0.02, gx_dps: 1.2, ts_mpu: 123456 } }
 * 
 * Formato Schema (saída):
 * { 
 *   accelerometer: { ax_g: 0.02, ay_g: ..., az_g: ... },
 *   gyroscope: { gx_dps: 1.2, gy_dps: ..., gz_dps: ... },
 *   ts_mpu: 123456
 * }
 * 
 * @param {Object} mpuData - Dados brutos do MPU vindos do ESP32
 * @returns {Object|null} Dados transformados ou null se inválido
 */
function transformMpuData(mpuData) {
  // Se não houver dados válidos, retorna null
  if (!mpuData || typeof mpuData !== 'object') return null;

  // Helper: converte para número com fallback para undefined
  const toNum = (val) => {
    if (val === undefined || val === null) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  };

  // Extrai e converte campos do acelerômetro
  const ax_g = toNum(mpuData.ax_g);
  const ay_g = toNum(mpuData.ay_g);
  const az_g = toNum(mpuData.az_g);

  // Extrai e converte campos do giroscópio
  const gx_dps = toNum(mpuData.gx_dps);
  const gy_dps = toNum(mpuData.gy_dps);
  const gz_dps = toNum(mpuData.gz_dps);

  // Se nenhum campo válido foi encontrado, retorna null
  const hasAccel = [ax_g, ay_g, az_g].some(v => v !== undefined);
  const hasGyro = [gx_dps, gy_dps, gz_dps].some(v => v !== undefined);
  
  if (!hasAccel && !hasGyro && mpuData.ts_mpu === undefined) {
    return null;
  }

  // Monta estrutura no formato do schema
  const result = {};

  // Inclui accelerometer apenas se houver dados válidos
  if (hasAccel) {
    result.accelerometer = {
      ax_g, ay_g, az_g
    };
  }

  // Inclui gyroscope apenas se houver dados válidos
  if (hasGyro) {
    result.gyroscope = {
      gx_dps, gy_dps, gz_dps
    };
  }

  // Timestamp do MPU (opcional)
  if (mpuData.ts_mpu !== undefined) {
    result.ts_mpu = parseInt(mpuData.ts_mpu);
  }

  return result;
}

/**
 * Função principal para decodificar qualquer frame CAN
 * @param {object} canFrame - Frame CAN com id, data e campos extras (ex: mpu, ts_can)
 * @returns {object|null} - Dados decodificados + campos transformados, ou null se ID desconhecido
 * 
 * @example
 * // Entrada (ESP32):
 * { 
 *   canId: 288, 
 *   data: [...], 
 *   mpu: { ax_g: "0.02", gx_dps: "1.2", ts_mpu: 123456 },
 *   ts_can: 1717789234567 
 * }
 * 
 * // Saída (pronta para o schema):
 * {
 *   type: 'battery',
 *   battery: { soc: "85", voltage: "350.5", ... },
 *   accelerometer: { ax_g: 0.02, ay_g: undefined, az_g: undefined },
 *   gyroscope: { gx_dps: 1.2, gy_dps: undefined, gz_dps: undefined },
 *   ts_mpu: 123456,
 *   ts_can: 1717789234567
 * }
 */
function decodeCanFrame(canFrame) {
  const { canId, data } = canFrame;

  // 1️⃣ Extrai campos extras para passthrough (ex: ts_can, ide, dlc, deviceId)
  const extras = extractPassthroughFields(canFrame, ['canId', 'data', 'mpu']);
  // Nota: excluímos 'mpu' porque vamos transformá-lo separadamente

  // 2️⃣ Transforma dados do MPU (se existirem)
  const mpuTransformed = canFrame.mpu ? transformMpuData(canFrame.mpu) : null;

  // 3️⃣ Decodifica conforme o ID CAN
  if (canId === BASE_BATTERY_ID) {
    return {
      type: 'battery',
      battery: decodeBatteryData(data),
      // Mescla campos transformados do MPU
      ...(mpuTransformed || {}),
      // Mescla outros campos extras (ts_can, ide, etc.)
      ...extras
    };
  }

  if (canId === BASE_CONTROLLER_ID) {
    return {
      type: 'motor',
      motor: decodeMotorControllerData(data),
      // Mescla campos transformados do MPU
      ...(mpuTransformed || {}),
      // Mescla outros campos extras
      ...extras
    };
  }

  // ID não reconhecido: retorna apenas campos extras + MPU transformado (para debug)
  if (Object.keys(extras).length > 0 || mpuTransformed) {
    return {
      type: 'unknown',
      canId,
      ...(mpuTransformed || {}),
      ...extras
    };
  }

  return null; // Nada para retornar
}

module.exports = {
  decodeBatteryData,
  decodeMotorControllerData,
  decodeCanFrame,
  transformMpuData,        // Exporta para testes unitários
  extractPassthroughFields,
  BASE_BATTERY_ID,
  BASE_CONTROLLER_ID
};