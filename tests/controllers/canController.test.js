const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app'); // ou onde estiver seu app Express
const VehicleData = require('../../models/canDataModels');

// Mock do console.error para evitar poluir o terminal
jest.spyOn(console, 'error').mockImplementation(() => {});

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
    motorTemp: 65,
    controlTemp: 58
  },
  location: {
    type: 'Point',
    coordinates: [-46.5755, -23.6789]
  },
  canMessages: [
    {
      canId: 288,
      data: [166, 121, 24, 236],
      dlc: 4,
      rtr: false
    }
  ]
};

describe('Vehicle Controller - API Tests', () => {
  beforeAll(async () => {
    // Conecte-se ao MongoDB de teste (opcional)
    // await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await VehicleData.deleteMany({});
  });

  describe('POST /api/vehicle-data', () => {
    it('deve criar um novo registro com sucesso', async () => {
      const response = await request(app)
        .post('/api/vehicle-data')
        .send(mockData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.deviceId).toBe(mockData.deviceId);
      expect(response.body.speed).toBe(mockData.speed);
      expect(response.body.battery.soc).toBe(85);
    });

    it('deve retornar 400 se dados forem inválidos', async () => {
      const response = await request(app)
        .post('/api/vehicle-data')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Falha ao salvar dados');
    });
  });

  describe('GET /api/vehicle-data/latest', () => {
    it('deve retornar o dado mais recente', async () => {
      await VehicleData.create(mockData);

      const response = await request(app)
        .get('/api/vehicle-data/latest')
        .expect(200);

      expect(response.body.deviceId).toBe(mockData.deviceId);
      expect(response.body.speed).toBe(45);
    });

    it('deve retornar 404 se não houver dados', async () => {
      const response = await request(app)
        .get('/api/vehicle-data/latest')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Nenhum dado encontrado');
    });
  });

  describe('GET /api/vehicle-data/history', () => {
    it('deve retornar histórico com limite padrão', async () => {
      const now = new Date();
      await VehicleData.create({ ...mockData, timestamp: new Date(now - 300000) });
      await VehicleData.create({ ...mockData, timestamp: new Date(now - 200000) });

      const response = await request(app)
        .get('/api/vehicle-data/history')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('deve aplicar filtro por deviceId se fornecido', async () => {
      await VehicleData.create({ ...mockData, deviceId: 'voltz-test-123' });

      const response = await request(app)
        .get('/api/vehicle-data/history?deviceId=voltz-test-123')
        .expect(200);

      expect(response.body[0].deviceId).toBe('voltz-test-123');
    });
  });

  describe('GET /api/vehicle-data/device/:deviceId', () => {
    it('deve retornar todos os registros de um deviceId específico', async () => {
      await VehicleData.create(mockData);

      const response = await request(app)
        .get(`/api/vehicle-data/device/${mockData.deviceId}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].deviceId).toBe(mockData.deviceId);
    });

    it('deve retornar 404 se deviceId não tiver dados', async () => {
      const response = await request(app)
        .get('/api/vehicle-data/device/invalid-id')
        .expect(404);

      expect(response.body.error).toContain('Nenhum dado encontrado para o deviceId');
    });
  });

  describe('POST /api/can/:deviceId', () => {
    const validCanMessage = {
      canId: 288,
      data: [166, 121, 24, 236],
      dlc: 4,
      rtr: false
    };

    it('deve adicionar uma nova mensagem CAN a um documento existente', async () => {
      await VehicleData.create(mockData);

      const response = await request(app)
        .post(`/api/can/${mockData.deviceId}`)
        .send(validCanMessage)
        .expect(201);

      expect(response.body.savedData.canMessages).toHaveLength(2);
      expect(response.body.savedData.canMessages[1]).toMatchObject(validCanMessage);
    });

    it('deve criar um novo documento se o deviceId não existir', async () => {
      const newDeviceId = 'voltz-new-device-test';

      const response = await request(app)
        .post(`/api/can/${newDeviceId}`)
        .send(validCanMessage)
        .expect(201);

      expect(response.body.savedData).toHaveProperty('_id');
      expect(response.body.savedData.deviceId).toBe(newDeviceId);
      expect(response.body.savedData.canMessages).toHaveLength(1);
    });

    it('deve retornar 400 se o corpo estiver incompleto', async () => {
      const response = await request(app)
        .post(`/api/can/voltz-test`)
        .send({ canId: 288 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Dados incompletos');
    });
  });

  describe('GET /api/can-data', () => {
    it('deve retornar os últimos frames CAN', async () => {
      await VehicleData.create(mockData);

      const response = await request(app)
        .get('/api/can-data')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('canId', 288);
    });

    it('deve retornar 0 frames se não houver dados', async () => {
      const response = await request(app)
        .get('/api/can-data')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/export-can-data-csv', () => {
    it('deve retornar um arquivo CSV com cabeçalhos corretos', async () => {
      await VehicleData.create(mockData);

      const response = await request(app)
        .get('/api/export-can-data-csv')
        .expect(200)
        .expect('Content-Type', 'text/csv');

      const body = response.text;
      expect(body).toContain('timestamp,canId,data,dlc,rtr');
      expect(body).toContain('0x120'); // ID em hexa
    });
  });
});