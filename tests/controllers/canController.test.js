// __tests__/canController.test.js
const request = require('supertest');
const app = require('../../app');
const mongoose = require('mongoose');
const CanData = require('../../models/canDataModels');

describe('API CAN - Testes de Integração', () => {

  // Teste 1: Deve criar um novo dado CAN
  describe('POST /api/can', () => {
    it('deve criar um novo dado CAN com sucesso', async () => {
      const newData = {
        canId: '0x180',
        data: 'AABBCCDD',
        dlc: 8,
        rtr: false,
      };

      const response = await request(app)
        .post('/api/can')
        .send(newData)
        .expect(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.canId).toBe(newData.canId);
      expect(response.body.data).toBe(newData.data);
    });

    it('não deve criar dado CAN sem campos obrigatórios', async () => {
      const invalidData = {
        deviceId: 'sensor-001',
        // canId faltando
        data: 'AABBCCDD',
        dlc: 8
      };

      const response = await request(app)
        .post('/api/can')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  // Teste 2: Deve listar todos os dados CAN
  describe('GET /api/can', () => {

    // Setup inicial: cria um usuário antes dos testes
    beforeAll(async () => {
      await CanData.deleteMany({});
    });
    it('deve retornar uma lista vazia no início', async () => {
      const response = await request(app)
        .get('/api/can')
        .expect(200);
      
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    it('deve retornar uma lista com dados CAN salvos', async () => {
      const testData = new CanData({
        deviceId: 'sensor-002',
        canId: '0x200',
        data: '11223344',
        dlc: 4,
      });
      await testData.save();

      const response = await request(app)
        .get('/api/can')
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].deviceId).toBe('sensor-002');
    });
  });

  // Teste 3: Deve buscar um dado CAN por ID
  describe('GET /api/can/:id', () => {
    it('deve retornar um dado CAN pelo ID', async () => {
      const testData = new CanData({
        deviceId: 'sensor-003',
        canId: '0x300',
        data: 'DEADBEEF',
        dlc: 8,
      });
      const saved = await testData.save();

      const response = await request(app)
        .get(`/api/can/${saved._id}`)
        .expect(200);

      expect(response.body._id).toBe(saved._id.toString());
      expect(response.body.deviceId).toBe('sensor-003');
    });

    it('deve retornar 404 se o ID não existir', async () => {
      const fakeId = new mongoose.Types.ObjectId(); // ID válido, mas inexistente

      await request(app)
        .get(`/api/can/${fakeId}`)
        .expect(404)
        .then((res) => {
          expect(res.body.message).toBe('Dado CAN não encontrado');
        });
    });
  });

  // Teste 4: Deve deletar um dado CAN
  describe('DELETE /api/can/:id', () => {
    it('deve deletar um dado CAN com sucesso', async () => {
      const testData = new CanData({
        deviceId: 'sensor-004',
        canId: '0x400',
        data: 'ABCDEF00',
        dlc: 8,
      });
      const saved = await testData.save();

      await request(app)
        .delete(`/api/can/${saved._id}`)
        .expect(200)
        .then((res) => {
          expect(res.body.message).toBe('Dado CAN deletado com sucesso');
        });

      // Verifica se foi realmente removido
      const exists = await CanData.findById(saved._id);
      expect(exists).toBeNull();
    });

    it('deve retornar 404 ao tentar deletar ID inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .delete(`/api/can/${fakeId}`)
        .expect(404)
        .then((res) => {
          expect(res.body.message).toBe('Dado CAN não encontrado');
        });
    });
  });
});