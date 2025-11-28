const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app'); // ou onde estiver seu app Express
const VehicleData = require('../../models/canDataModels');
const CanFrame = require('../../models/canFrameModels');

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
 const deviceId = 'voltz-test-device';
  const validFrame = {
    canId: 288,
    data: [166, 121, 24, 236],
    dlc: 4,
    rtr: false
  };

describe('Vehicle Controller - API Tests', () => {
    // Limpa a coleção antes de cada teste
  beforeEach(async () => {
    await CanFrame.deleteMany({});
  });

  afterAll(async () => {
    await VehicleData.deleteMany({});
    await CanFrame.deleteMany({});
  });

  /*

 
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

  */
  describe('POST /api/can/:deviceId', () => {
    it('deve adicionar um único frame CAN com sucesso', async () => {
      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send(validFrame)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.insertedCount).toBe(1);

      // Verifica se o frame foi salvo no banco
      const savedFrames = await CanFrame.find({ deviceId });
      expect(savedFrames).toHaveLength(1);
      expect(savedFrames[0].canId).toBe(validFrame.canId);
      expect(savedFrames[0].data).toEqual(validFrame.data);
    });

    it('deve adicionar múltiplos frames CAN com sucesso', async () => {
      const frames = [
        { ...validFrame, canId: 288 },
        { ...validFrame, canId: 768 },
        { ...validFrame, canId: 512 }
      ];

      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send(frames)
        .expect(201);

      expect(response.body.insertedCount).toBe(3);

      // Verifica se todos os frames foram salvos
      const savedFrames = await CanFrame.find({ deviceId });
      expect(savedFrames).toHaveLength(3);
      expect(savedFrames.map(f => f.canId)).toEqual([288, 768, 512]);
    });

    it('deve retornar 400 se o body estiver vazio', async () => {
      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Dados incompletos');
    });

    it('deve retornar 400 se faltar canId em um frame', async () => {
      const invalidFrame = { ...validFrame };
      delete invalidFrame.canId;

      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send(invalidFrame)
        .expect(400);

      expect(response.body.error).toBe('Dados incompletos');
    });

    it('deve retornar 400 se faltar data em um frame', async () => {
      const invalidFrame = { ...validFrame };
      delete invalidFrame.data;

      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send(invalidFrame)
        .expect(400);

      expect(response.body.error).toBe('Dados incompletos');
    });

    it('deve retornar 400 se um frame em um array for inválido', async () => {
      const frames = [
        { ...validFrame, canId: 288 },
        { canId: 768 } // Faltando data
      ];

      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send(frames)
        .expect(400);

      expect(response.body.error).toBe('Dados incompletos');
    });

    it('deve definir rtr como false se não for fornecido', async () => {
      const frameWithoutRtr = { ...validFrame };
      delete frameWithoutRtr.rtr;

      await request(app)
        .post(`/api/can/${deviceId}`)
        .send(frameWithoutRtr)
        .expect(201);

      const savedFrame = await CanFrame.findOne({ deviceId, canId: validFrame.canId });
      expect(savedFrame.rtr).toBe(false);
    });

    it('deve gerar timestamp automaticamente', async () => {
      await request(app)
        .post(`/api/can/${deviceId}`)
        .send(validFrame)
        .expect(201);

      const savedFrame = await CanFrame.findOne({ deviceId });
      expect(savedFrame.timestamp).toBeInstanceOf(Date);
    });

    it('deve retornar 500 se ocorrer erro no banco de dados', async () => {
      // Simula erro no banco de dados
      jest.spyOn(CanFrame, 'insertMany').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post(`/api/can/${deviceId}`)
        .send(validFrame)
        .expect(500);

      expect(response.body.error).toBe('Falha ao adicionar mensagens CAN');
    });
  });

  /*
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
  */
});