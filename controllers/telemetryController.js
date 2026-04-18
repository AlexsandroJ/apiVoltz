// controllers/telemetryController.js
const VehicleData = require('../models/canDataModels');

/**
 * Processa uma mensagem de telemetria recebida via MQTT
 * @param {Object} data - Dados decodificados do ESP32
 */
// controllers/telemetryController.js

/**
 * Processa mensagem de telemetria recebida via MQTT
 * @param {Object} data - Objeto com campos: ts, v, a, soc, rpm, tq, mod, tB, tM, tC
 */
exports.processTelemetryMessage = async (data) => {
  try {
    // deviceId fixo ou derivado (ajuste conforme sua necessidade)
    const deviceId = 'esp32-moto-001';

    // Cria novo registro SEM o campo location (evita erro de validação)
    const vehicleRecord = new VehicleData({
      deviceId, // ⚠️ obrigatório!
      timestamp: data.ts ? new Date(data.ts) : new Date(), // converte ts para Date
      speed: null,
      battery: {
        soc: data.soc,
        voltage: data.v,
        current: data.a,
        temperature: data.tB
      },
      motor: {
        rpm: data.rpm,
        power: null,
        motorTemp: data.tM,
        controlTemp: data.tC
      },
      drivingMode: data.mod || 'N/A'
      // ⚠️ NÃO inclua "location" aqui → evita erro de validação
    });

    const saved = await vehicleRecord.save();
    

  } catch (error) {
    console.error('❌ Erro ao salvar telemetria:', error.message);
    // Para depuração detalhada:
    if (error.name === 'ValidationError') {
      console.error('Detalhes da validação:', error.errors);
    }
  }
};



/**
 * Atualiza ou cria um registro com localização GPS para um deviceId
 */
/**
 * Cria um NOVO registro de VehicleData contendo apenas os dados de localização.
 * Isso evita corromper registros existentes e mantém o histórico limpo.
 */
exports.updateDeviceLocation = async (req, res) => {
  const { deviceId } = req.params;
  const { latitude, longitude, accuracy, timestamp } = req.body;

  // Validação
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'latitude e longitude são obrigatórios e devem ser números' });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Coordenadas fora do intervalo válido' });
  }

  try {
    const newRecord = new VehicleData({
      deviceId,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude] // [LON, LAT]
      },
      gpsAccuracy: accuracy,
      timestamp: timestamp ? new Date(timestamp) : new Date()
      // demais campos (battery, motor, etc.) ficam undefined → não salvos
    });

    const saved = await newRecord.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Erro ao salvar localização:', error);
    res.status(500).json({ error: 'Falha ao salvar localização' });
  }
};