const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app'); // ou onde estiver seu app Express
const VehicleData = require('../../models/canDataModels');

// Mock do console.error para evitar poluir o terminal
jest.spyOn(console, 'error').mockImplementation(() => {});

// Dados de exemplo
const mockVehicleData = {
  deviceId: 'voltz-20250121-143022',
  speed: 45,
  battery: {
    soc: 85,
    voltage: 350.5
  },
  canMessages: [
    {
      canId: 288,
      data:  [166, 121, 24, 236],
      dlc: 4,
      rtr: false
    }
  ]
};

describe('Vehicle Controller - API Tests', () => {
  beforeAll(async () => {
    // Conecta ao banco de teste (se necessário)
    // await connectDB();
  });

  afterAll(async () => {
    await VehicleData.deleteMany({});
    // await mongoose.disconnect();
  });

  /**
   * Teste: POST /api - Criar novo dado do veículo
   */
  describe('POST /api', () => {
    it('deve criar um novo registro com sucesso', async () => {
      const response = await request(app)
        .post('/api/device')
        .send(mockVehicleData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.deviceId).toBe(mockVehicleData.deviceId);
      expect(response.body.speed).toBe(mockVehicleData.speed);
      expect(response.body.battery.soc).toBe(mockVehicleData.battery.soc);
    });

    it('deve retornar 201 se o body estiver vazio', async () => {
      const response = await request(app)
        .post('/api/device')
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('_id');
    });
  });

  /**
   * Teste: GET /api/device/:deviceId - Buscar por deviceId
   */
  describe('GET /api/device/:deviceId', () => {
    beforeAll(async () => {
      await VehicleData.create(mockVehicleData);
    });

    it('deve retornar todos os registros de um deviceId específico', async () => {
      const response = await request(app)
        .get(`/api/device/${mockVehicleData.deviceId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].deviceId).toBe(mockVehicleData.deviceId);
    });

    it('deve retornar 404 se não houver dados para o deviceId', async () => {
      const response = await request(app)
        .get('/api/device/device-inexistente')
        .expect(404);

      expect(response.body.error).toContain('Nenhum dado encontrado para o deviceId');
    });
  });

  /**
   * Teste: POST /api/can/:deviceId - Adicionar mensagem CAN
   */
  describe('POST /api/can/:deviceId', () => {
    const mockCanMessage = {
      canId: 288,
      data:  [166, 121, 24, 236],
      dlc: 4,
      rtr: false
    };

    it('deve adicionar uma nova mensagem CAN a um documento existente', async () => {
      const response = await request(app)
        .post(`/api/can/${mockVehicleData.deviceId}`)
        .send(mockCanMessage)
        .expect(201);
     
      expect(response.body.savedData.canMessages).toHaveLength(2); // Era 1, adicionou 1

    });

    it('deve criar um novo documento se o deviceId não existir', async () => {
      const newDeviceId = 'voltz-novo-dispositivo';
      const response = await request(app)
        .post(`/api/can/${newDeviceId}`)
        .send(mockCanMessage)
        .expect(201);

      expect(response.body.savedData.deviceId).toBe(newDeviceId);
      expect(response.body.savedData.canMessages).toHaveLength(1);
      
    });

    it('deve retornar 400 se o body estiver incompleto', async () => {
      const response = await request(app)
        .post(`/api/can/${mockVehicleData.deviceId}`)
        .send({ canId: 288 }) // Faltando data
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Dados incompletos');
    });
  });

  /**
   * Teste: GET /api/can-data - Buscar últimos frames CAN
   */
  describe('GET /api/can-data', () => {
    beforeAll(async () => {
      await VehicleData.create({
        deviceId: 'voltz-teste-csv',
        canMessages: [
          {
            canId: 768,
            data:  [25, 28, 54, 48],
            dlc: 4,
            rtr: false
          }
        ]
      });
    });

    it('deve retornar os últimos N frames CAN com limite', async () => {
      const response = await request(app)
        .get('/api/can-data?limit=1')
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });

  /**
   * Teste: GET /api/export-can-data-csv - Exportar dados CAN como CSV
   */
  describe('GET /api/export-can-data-csv', () => {
    it('deve retornar um arquivo CSV com os dados CAN', async () => {
      const response = await request(app)
        .get('/api/export-can-data-csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('can-data-');
      expect(response.text).toContain('timestamp,canId,data,dlc,rtr');
      expect(response.text).toContain('0x768'); // Exemplo de ID
    });

    it('deve retornar CSV filtrado por deviceId se enviado', async () => {
      const response = await request(app)
        .get('/api/export-can-data-csv?deviceId=voltz-teste-csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('0x768'); // Exemplo de ID do dispositivo
    });
  });
});