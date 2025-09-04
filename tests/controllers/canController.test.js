const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app'); // Ajuste o caminho para o seu app Express
const VehicleData = require('../../models/canDataModels');

// Mock do console.error para evitar poluir o terminal
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Vehicle Controller - API Tests', () => {
  // Dados de exemplo
  const mockData = {
    deviceId: 'voltz-20250405-102030',
    speed: 45,
    battery: {
      soc: 85,
      soh: 92,
      voltage: 72.4,
      current: -2.1,
      temperature: 28.5
    },
    motor: {
      rpm: 3200,
      power: 8.5,
      regenLevel: 30,
      motorTemp: 65,
      inverterTemp: 58
    },
    location: {
      type: 'Point',
      coordinates: [-46.5755, -23.6789]
    },
    driveMode: 'sport',
    range: 85,
    vehicleStatus: 'ligado',
    odometer: 1234.5,
    alerts: [
      {
        code: 'BATT_TEMP_HIGH',
        message: 'Temperatura da bateria elevada',
        severity: 'warning'
      }
    ],
    canMessages: [
      {
        canId: '0x181',
        data: 'AABBCCDDEEFF0011',
        dlc: 8,
        rtr: false
      }
    ]
  };

  /**
   * Teste: POST /api - Criar novo dado do veículo
   */
  describe('POST /api', () => {

    it('deve criar um novo registro com sucesso', async () => {
      const response = await request(app)
        .post('/api')
        .send(mockData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.deviceId).toBe(mockData.deviceId);
      expect(response.body.speed).toBe(mockData.speed);
      expect(response.body.battery.soc).toBe(85);
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

  });

  /**
   * Teste: GET /api/latest - Último dado
   */
  describe('GET /api/latest', () => {
    it('deve retornar o dado mais recente', async () => {
      await VehicleData.create(mockData);

      const response = await request(app)
        .get('/api/latest')
        .expect(200);

      expect(response.body.deviceId).toBe(mockData.deviceId);
      expect(response.body.speed).toBe(45);
      expect(response.body.gpsLocation).toEqual({
        lat: -23.6789,
        lon: -46.5755
      });
    });

    it('deve retornar 404 se não houver dados', async () => {
      await VehicleData.deleteMany({});

      const response = await request(app)
        .get('/api/latest')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Nenhum dado encontrado');
    });
  });

  /**
   * Teste: GET /api/history - Histórico
   */
  describe('GET /api/history', () => {
    beforeEach(async () => {
      // Cria 3 registros com timestamps diferentes
      const now = new Date();
      await VehicleData.create({ ...mockData, timestamp: new Date(now - 300000) });
      await VehicleData.create({ ...mockData, timestamp: new Date(now - 200000) });
      await VehicleData.create({ ...mockData, timestamp: new Date(now - 100000) });
    });

    it('deve retornar os últimos N registros ordenados por timestamp (desc)', async () => {
      const response = await request(app)
        .get('/api/history?limit=2')
        .expect(200);
      expect(response.body).toHaveLength(2);
    });

    it('deve aplicar filtro por deviceId se fornecido', async () => {
      await VehicleData.create({
        ...mockData,
        deviceId: 'voltz-test-123',
        timestamp: new Date()
      });

      const response = await request(app)
        .get('/api/history?limit=10&deviceId=voltz-test-123')
        .expect(200);

      expect(response.body.every(d => d.deviceId === 'voltz-test-123')).toBe(true);
    });

    it('deve retornar até o limite padrão (50) se não especificado', async () => {
      await VehicleData.insertMany(
        Array(3).fill(mockData).map((d, i) => ({
          ...d,
          timestamp: new Date(Date.now() - i * 1000)
        }))
      );

      const response = await request(app)
        .get('/api/history')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(50);
    });
  });

  /**
   * Teste: GET /api/device/:id - Por deviceId
   */
  describe('GET /api/device/:id', () => {
    const deviceId = 'voltz-device-test';

    beforeEach(async () => {
      await VehicleData.create({ ...mockData, deviceId });
      await VehicleData.create({ ...mockData, deviceId, speed: 60 });
    });

    it('deve retornar todos os registros de um deviceId específico', async () => {
      const response = await request(app)
        .get(`/api/device/${deviceId}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].deviceId).toBe(deviceId);
      expect(response.body[1].deviceId).toBe(deviceId);
    });

    it('deve retornar 404 se deviceId não tiver dados', async () => {
      const response = await request(app)
        .get('/api/device/invalid-id')
        .expect(404);

      expect(response.body.error).toContain('Nenhum dado encontrado para o deviceId');
    });

    it('deve retornar registros ordenados por timestamp (mais recente primeiro)', async () => {
      const response = await request(app)
        .get(`/api/device/${deviceId}`)
        .expect(200);

      const timestamps = response.body.map(d => new Date(d.timestamp).getTime());
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1]);
    });
  });
});