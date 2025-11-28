// models/VehicleData.js
const mongoose = require('mongoose');

const vehicleDataSchema = new mongoose.Schema({
  // Identificador do dispositivo (moto)
  deviceId: {
    type: String,
    required: true,
    trim: true,
    default: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const formatted = `${year}${month}${day}-${hour}${minute}${second}`;
      return `voltz-${formatted}`;
    }
  },

  // Timestamp principal do evento
  timestamp: {
    type: Date,
    default: Date.now,
    index: true // Para consultas por tempo
  },

  // === DADOS INTERPRETADOS (para dashboard) ===
  // Velocidade (km/h)
  speed: {
    type: Number,
    min: 0,
    max: 200
  },

  // Bateria
  battery: {
    soc: { type: Number, min: 0, max: 100 }, // State of Charge (%)
    soh: { type: Number, min: 0, max: 100 }, // State of Health (%)
    voltage: { type: Number }, // Volts
    current: { type: Number }, // Amperes (negativo = carga)
    temperature: { type: Number } // °C
  },

  // Motor
  motor: {
    rpm: { type: Number },
    power: { type: Number }, // kW
    motorTemp: { type: Number },
    controlTemp: { type: Number }
  },

  // Localização
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: false,
      default: null
      // [longitude, latitude]
    }
  },

  // Autonomia
  range: {
    type: Number,
    min: 0
  },

}, {
  timestamps: true, // createdAt, updatedAt
  // Habilita geolocalização
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índice para geolocalização
vehicleDataSchema.index({ location: '2dsphere' });

// Índices para consultas rápidas
vehicleDataSchema.index({ timestamp: -1 });
vehicleDataSchema.index({ deviceId: 1, timestamp: -1 });

// Virtual para facilitar no frontend
vehicleDataSchema.virtual('gpsLocation').get(function () {
  if (this.location?.coordinates) {
    return {
      lat: this.location.coordinates[1],
      lon: this.location.coordinates[0]
    };
  }
  return null;
});

module.exports = mongoose.model('VehicleData', vehicleDataSchema);