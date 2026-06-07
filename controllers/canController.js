/**
 * @fileoverview Controller para telemetria do veículo (ESP32 + CAN + MPU-6050).
 * 
 * Responsabilidades:
 * - Receber dados do ESP32 via MQTT/HTTP (formato: mpu.ax_g, battery.soc, etc.)
 * - Decodificar frames CAN brutos usando canDecoder.js
 * - Mapear dados para o schema do MongoDB (accelerometer/gyroscope no root)
 * - Exportar dados para CSV/JSON
 * 
 * @module VehicleController
 * @author Alexsandro J Silva
 * @version 2.1.0
 * @since 2025-11-21
 */

const VehicleData = require('../models/canDataModels');
const CanFrame = require('../models/canFrameModels');
const CurrentLocation = require('../models/currentLocationModels');
const { decodeCanFrame } = require('../utils/canDecoder');
const { formatTimestamp } = require('../utils/backendUtils');

// ============================================================================
// === FUNÇÕES DE MAPEAMENTO (ESP32 → Schema) ===
// ============================================================================

/**
 * Mapeia dados do payload do ESP32 para a estrutura do schema MongoDB.
 * 
 * @param {Object} payload - Dados brutos recebidos do ESP32/MQTT
 * @returns {Object} Documento formatado para o Mongoose
 * 
 * @note O ESP32 envia: { mpu: { ax_g, gx_dps, ... } }
 *       O schema espera: { accelerometer: { ax_g }, gyroscope: { gx_dps } }
 */
function mapPayloadToSchema(payload) {
  return {
    // === IDENTIFICAÇÃO E TIMESTAMPS ===
    deviceId: payload.deviceId || `voltz-${Date.now()}`,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    ts_can: payload.ts_can,
    canId: payload.canId,

    // === BATERIA (já vem no formato correto do canDecoder) ===
    battery: payload.battery ? {
      soc: payload.battery.soc,
      soh: payload.battery.soh,
      voltage: payload.battery.voltage,
      current: payload.battery.current,
      temperature: payload.battery.temperature
    } : undefined,

    // === MOTOR/CONTROLADOR (já vem no formato correto do canDecoder) ===
    motor: payload.motor ? {
      rpm: payload.motor.rpm,
      torque: payload.motor.torque,
      motorTemp: payload.motor.motorTemp,
      controlTemp: payload.motor.controlTemp,
      modo: payload.motor.modo
    } : undefined,

    // === LOCALIZAÇÃO (GPS) - GeoJSON ===
    location: payload.location || (payload.latitude && payload.longitude ? {
      type: 'Point',
      coordinates: [parseFloat(payload.longitude), parseFloat(payload.latitude)]
    } : undefined),
    accuracy: payload.accuracy ? parseFloat(payload.accuracy) : undefined,
    speed: payload.speed ? parseFloat(payload.speed) : undefined,
    altitude: payload.altitude ? parseFloat(payload.altitude) : undefined,
    altitudeAccuracy: payload.altitudeAccuracy ? parseFloat(payload.altitudeAccuracy) : undefined,
    heading: payload.heading ? parseFloat(payload.heading) : undefined,

    // === MPU-6050: MAPEAMENTO ESP32 → SCHEMA ===
    // ESP32 envia: payload.mpu.ax_g → Schema espera: accelerometer.ax_g
    accelerometer: payload.mpu ? {
      ax_g: payload.mpu.ax_g !== undefined ? parseFloat(payload.mpu.ax_g) : undefined,
      ay_g: payload.mpu.ay_g !== undefined ? parseFloat(payload.mpu.ay_g) : undefined,
      az_g: payload.mpu.az_g !== undefined ? parseFloat(payload.mpu.az_g) : undefined
    } : undefined,

    // ESP32 envia: payload.mpu.gx_dps → Schema espera: gyroscope.gx_dps
    gyroscope: payload.mpu ? {
      gx_dps: payload.mpu.gx_dps !== undefined ? parseFloat(payload.mpu.gx_dps) : undefined,
      gy_dps: payload.mpu.gy_dps !== undefined ? parseFloat(payload.mpu.gy_dps) : undefined,
      gz_dps: payload.mpu.gz_dps !== undefined ? parseFloat(payload.mpu.gz_dps) : undefined
    } : undefined,

    ts_mpu: payload.mpu?.ts_mpu !== undefined ? parseInt(payload.mpu.ts_mpu) : undefined,

    // === DADOS BRUTOS CAN (para debug/reprocessamento) ===
    raw: payload.data ? {
      dataHex: payload.data,      // Ex: "A6 79 18 EC"
      dlc: payload.dlc,           // Data Length Code (0-8)
      isExtended: payload.ide     // Frame CAN estendido?
    } : undefined
  };
}

/**
 * Remove campos undefined/null recursivamente para não sobrescrever dados no MongoDB.
 * @param {Object} obj - Objeto para limpar
 * @returns {Object} Objeto sem campos undefined
 */
function cleanUndefined(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined).filter(v => v !== undefined);
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanedValue = cleanUndefined(value);
    // Só inclui se não for undefined E (não for objeto vazio OU for array não-vazio)
    if (cleanedValue !== undefined) {
      if (typeof cleanedValue === 'object' && !Array.isArray(cleanedValue)) {
        if (Object.keys(cleanedValue).length > 0) {
          cleaned[key] = cleanedValue;
        }
      } else {
        cleaned[key] = cleanedValue;
      }
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

// ============================================================================
// === ENDPOINTS DA API ===
// ============================================================================

/**
 * Salva telemetria recebida do ESP32 via MQTT/HTTP.
 * 
 * @async
 * @function createVehicleData
 * @param {Object} req - Express request com payload no body
 * @param {Object} res - Express response
 * 
 * @example
 * POST /api/telemetry
 * Body: {
 *   "ts_can": 1717789234567,
 *   "canId": 288,
 *   "battery": { "soc": 85, "voltage": 350.5 },
 *   "mpu": { "ax_g": 0.02, "gx_dps": 1.2, "ts_mpu": 123456 }
 * }
 */
exports.createVehicleData = async (req, res) => {
  try {
    const payload = req.body;

    // 1️⃣ Mapeia payload do ESP32 → estrutura do schema
    const mapped = mapPayloadToSchema(payload);

    // 2️⃣ Limpa campos undefined para não sobrescrever dados existentes
    const cleanData = cleanUndefined(mapped);

    // 3️⃣ Salva no MongoDB
    const saved = await new VehicleData(cleanData).save();

    res.status(201).json({
      success: true,
      message: 'Telemetria salva',
      data: { id: saved._id, ts: saved.timestamp }
    });

  } catch (error) {
    console.error('❌ Erro ao salvar telemetria:', error.message);
    res.status(400).json({
      success: false,
      error: 'Falha ao salvar',
      message: error.message
    });
  }
};

/**
 * Busca registros de telemetria com filtros e paginação.
 * 
 * @async
 * @function getVehicleData
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * 
 * @example
 * GET /api/telemetry?deviceId=voltz-001&hasImu=true&limit=50
 */
exports.getVehicleData = async (req, res) => {
  try {
    const { deviceId, limit = 50, hasImu, hasGps } = req.query;

    // Monta query dinâmica
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    if (hasImu === 'true') query['accelerometer.ax_g'] = { $exists: true };
    if (hasGps === 'true') query['location.coordinates'] = { $exists: true };

    const data = await VehicleData
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit), 1000))
      .lean();

    res.json({ success: true, count: data.length, data });

  } catch (error) {
    console.error('❌ Erro ao buscar telemetria:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados' });
  }
};

/**
 * Recebe frames CAN brutos, decodifica e salva + processa para telemetria.
 * 
 * @async
 * @function addCanMessages
 * @param {Object} req - Express request com array de frames
 * @param {Object} res - Express response
 */
exports.addCanMessages = async (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    const framesToSave = [];

    // ========================================================================
    // === VALIDAÇÃO E CONVERSÃO DE DADOS ===
    // ========================================================================
    for (const msg of incoming) {
      // 1️⃣ Validação básica obrigatória
      if (!msg?.canId || !msg?.data) {
        return res.status(400).json({
          success: false,
          error: 'Frame inválido: requer canId e data'
        });
      }

      // 2️⃣ Converte string hex "A6 79 18 EC" → array numérico [166, 121, 24, 236]
      const numericData = typeof msg.data === 'string'
        ? msg.data.split(' ').map(h => parseInt(h.trim(), 16)).filter(n => !isNaN(n))
        : Array.isArray(msg.data) 
          ? msg.data.map(b => typeof b === 'string' ? parseInt(b, 16) : b)
          : msg.data;

      // 3️⃣ Monta objeto para salvar no banco (CanFrame)
      framesToSave.push({
        canId: Number(msg.canId),              // Garante que é número
        data: numericData,                      // Array de bytes numéricos
        dlc: msg.dlc || numericData.length,    // Data Length Code
        ide: Boolean(msg.ide),                  // Frame estendido?
        
        // === PRESERVA DADOS DO MPU-6050 (se vierem no payload) ===
        // O ESP32 envia: { mpu: { ax_g: 0.02, gx_dps: 1.2, ... } }
        ...(msg.mpu && typeof msg.mpu === 'object' && {
          mpu: {
            ax_g: msg.mpu.ax_g !== undefined ? Number(msg.mpu.ax_g) : undefined,
            ay_g: msg.mpu.ay_g !== undefined ? Number(msg.mpu.ay_g) : undefined,
            az_g: msg.mpu.az_g !== undefined ? Number(msg.mpu.az_g) : undefined,
            gx_dps: msg.mpu.gx_dps !== undefined ? Number(msg.mpu.gx_dps) : undefined,
            gy_dps: msg.mpu.gy_dps !== undefined ? Number(msg.mpu.gy_dps) : undefined,
            gz_dps: msg.mpu.gz_dps !== undefined ? Number(msg.mpu.gz_dps) : undefined,
            ts_mpu: msg.mpu.ts_mpu !== undefined ? parseInt(msg.mpu.ts_mpu) : undefined
          }
        }),
        
      
        deviceId: msg.deviceId,         // ID do dispositivo (opcional)

        timestamp: msg.ts
      });
    }
    
    // ========================================================================
    // === BULK INSERT DOS FRAMES BRUTOS ===
    // ========================================================================
    const saved = await CanFrame.insertMany(framesToSave);

    
    // ========================================================================
    // === PROCESSAMENTO EM BACKGROUND: DECODIFICAÇÃO + TELEMETRIA ===
    // ========================================================================
    // Não usamos await aqui para não bloquear a resposta da API
    framesToSave.forEach(frame => {
      const decoded = decodeCanFrame(frame);
      
      if (decoded) {
        // Processa frame decodificado para gerar registro de telemetria
        processDecodedFrame(decoded, frame.timestamp)
          .catch(err => {
            // Erro no processamento não deve falhar a requisição original
            console.error('⚠️ Erro ao processar frame em background:', {
              canId: frame.canId,
              error: err.message
            });
          });
      }
    });
    
    // ========================================================================
    // === RESPOSTA DE SUCESSO ===
    // ========================================================================
    res.status(201).json({
      success: true,
      message: `${saved.length} frames processados`,
      inserted: saved.length,
      // Retorna IDs dos documentos salvos (útil para debug)
      ids: saved.map(s => s._id)
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar frames CAN:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Falha ao processar frames',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Retorna frames CAN brutos recentes.
 */
exports.getRecentCanData = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);

    const frames = await CanFrame
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, count: frames.length, data: frames });

  } catch (error) {
    console.error('❌ Erro ao buscar frames:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar frames' });
  }
};

// ============================================================================
// === EXPORTAÇÃO CSV ===
// ============================================================================

/**
 * Exporta telemetria como CSV com streaming (suporta MPU-6050).
 */
exports.exportVehicleDataAsCsv = async (req, res) => {
  const { deviceId, startDate, endDate } = req.query;

  const query = {};
  if (deviceId) query.deviceId = deviceId;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=telemetria-${Date.now()}.csv`);

  // Cabeçalho com TODOS os campos (incluindo MPU-6050)
  const headers = [
    'timestamp', 'deviceId', 'canId',
    'battery.soc', 'battery.voltage', 'battery.current', 'battery.temperature',
    'motor.rpm', 'motor.torque', 'motor.motorTemp', 'motor.modo',
    'location.lat', 'location.lng', 'speed', 'altitude', 'heading',
    // MPU-6050
    'accelerometer.ax_g', 'accelerometer.ay_g', 'accelerometer.az_g',
    'gyroscope.gx_dps', 'gyroscope.gy_dps', 'gyroscope.gz_dps',
  ];
  res.write(headers.join(',') + '\n');

  const cursor = VehicleData.find(query).sort({ timestamp: 1 }).cursor();

  for await (const doc of cursor) {
    const row = [
      formatTimestamp(doc.timestamp),
      doc.deviceId || '',
      doc.canId ?? '',
      // Bateria
      doc.battery?.soc ?? '',
      doc.battery?.voltage ?? '',
      doc.battery?.current ?? '',
      doc.battery?.temperature ?? '',
      // Motor
      doc.motor?.rpm ?? '',
      doc.motor?.torque ?? '',
      doc.motor?.motorTemp ?? '',
      doc.motor?.modo ?? '',
      // GPS
      doc.location?.coordinates?.[1]?.toFixed(6) ?? '', // lat
      doc.location?.coordinates?.[0]?.toFixed(6) ?? '', // lng
      doc.speed ?? '',
      doc.altitude ?? '',
      doc.heading ?? '',
      // MPU-6050
      doc.accelerometer?.ax_g?.toFixed(3) ?? '',
      doc.accelerometer?.ay_g?.toFixed(3) ?? '',
      doc.accelerometer?.az_g?.toFixed(3) ?? '',
      doc.gyroscope?.gx_dps?.toFixed(2) ?? '',
      doc.gyroscope?.gy_dps?.toFixed(2) ?? '',
      doc.gyroscope?.gz_dps?.toFixed(2) ?? '',

    ].map(v => {
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    });
    res.write(row.join(',') + '\n');
  }
  res.end();
};

/**
 * Exporta frames CAN brutos como CSV.
 */
exports.exportAllCanDataAsCsv = async (req, res) => {
  const { deviceId, limit = 1000 } = req.query;
  const query = deviceId ? { deviceId } : {};

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=can-frames-${Date.now()}.csv`);
  res.write('timestamp,canId,dataHex,dlc,ide\n');

  const cursor = CanFrame.find(query).sort({ timestamp: 1 })
    .limit(Math.min(parseInt(limit), 10000)).cursor();

  for await (const frame of cursor) {
    const dataHex = Array.isArray(frame.data)
      ? frame.data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
      : frame.data;
    
    res.write([
      formatTimestamp(frame.timestamp),
      `0x${frame.canId.toString(16).toUpperCase()}`,
      `"${dataHex}"`,
      frame.dlc,
      frame.ide ? 'true' : 'false'
    ].join(',') + '\n');
  }
  res.end();
};

// ============================================================================
// === PROCESSAMENTO INTERNO (CAN → Telemetria) ===
// ============================================================================

/**
 * Processa frame CAN decodificado e salva como registro de telemetria.
 * Mescla dados do frame + GPS atual + histórico anterior.
 * 
 * @param {Object} decoded - Output do decodeCanFrame(): { battery: {...} } ou { motor: {...} }
 * @param {Date} timestamp - Timestamp do evento
 * @private
 */
async function processDecodedFrame(decoded, timestamp) {
  try {
    // Busca dados auxiliares em paralelo
    const [currentGPS, lastRecord] = await Promise.all([
      CurrentLocation.findOne().sort({ createdAt: -1 })
        .select('location speed altitude heading accuracy').lean(),
      VehicleData.findOne().sort({ timestamp: -1 }).lean()
    ]);

    // Função auxiliar de merge: prioridade decoded > GPS > histórico
    const merge = (decodedVal, gpsVal, historyVal) => {
      if (decodedVal !== undefined && decodedVal !== null) return decodedVal;
      if (gpsVal !== undefined && gpsVal !== null) return gpsVal;
      return historyVal;
    };

    // Monta novo registro
    const newRecord = {
      deviceId: lastRecord?.deviceId,
      timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
      
      // Bateria/Motor: já vêm no formato correto do canDecoder
      battery: decoded.battery ? {
        ...lastRecord?.battery,
        ...decoded.battery
      } : lastRecord?.battery,
      
      motor: decoded.motor ? {
        ...lastRecord?.motor,
        ...decoded.motor
      } : lastRecord?.motor,

      // GPS: prioridade para localização atual
      location: currentGPS?.location || lastRecord?.location,
      speed: merge(decoded.speed, currentGPS?.speed, lastRecord?.speed),
      altitude: merge(decoded.altitude, currentGPS?.altitude, lastRecord?.altitude),
      heading: merge(decoded.heading, currentGPS?.heading, lastRecord?.heading),
      accuracy: merge(decoded.accuracy, currentGPS?.accuracy, lastRecord?.accuracy),

      // MPU-6050: mantém do histórico se não vier no frame decodificado
      accelerometer: decoded?.accelerometer,
      gyroscope: decoded?.gyroscope,
      timestamp: timestamp
    };

    
    // Salva após limpeza de undefined
    const clean = cleanUndefined(newRecord);


    
    /*
    if (clean && Object.keys(clean).length > 0) {
      return await new VehicleData(newRecord).save();
    }
    */
    return await new VehicleData(newRecord).save();
  } catch (error) {
    console.error('❌ Erro em processDecodedFrame:', error.message);
    throw error;
  }
}

// ============================================================================
// === UTILITÁRIOS PARA DADOS DO MPU-6050 ===
// ============================================================================

/**
 * Calcula magnitude da aceleração resultante (vetor 3D).
 * @param {Object} acc - { ax_g, ay_g, az_g }
 * @returns {Number} Magnitude em g
 */
exports.calculateAccelMagnitude = (acc) => {
  if (!acc) return 0;
  const { ax_g = 0, ay_g = 0, az_g = 0 } = acc;
  return Math.sqrt(ax_g**2 + ay_g**2 + az_g**2);
};

/**
 * Detecta evento de impacto baseado em threshold de aceleração.
 * @param {Object} acc - Dados do acelerômetro
 * @param {Number} threshold - Limite em g (padrão: 2.5g)
 * @returns {Boolean} true se magnitude > threshold
 */
exports.detectImpact = (acc, threshold = 2.5) => {
  return exports.calculateAccelMagnitude(acc) > threshold;
};

/**
 * Calcula ângulo de inclinação lateral (roll) aproximado a partir do acelerômetro.
 * Fórmula: roll = atan2(ay, sqrt(ax² + az²)) * (180/π)
 * @param {Object} acc - { ax_g, ay_g, az_g }
 * @returns {Number} Ângulo em graus (-180 a +180)
 */
exports.calculateRollAngle = (acc) => {
  if (!acc) return 0;
  const { ax_g = 0, ay_g = 0, az_g = 0 } = acc;
  const rollRad = Math.atan2(ay_g, Math.sqrt(ax_g**2 + az_g**2));
  return (rollRad * 180 / Math.PI).toFixed(2);
};