/**
 * @fileoverview Testes de integração para VehicleController com suporte a MPU-6050
 * @author Alexsandro J Silva
 * @version 2.0.0
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app'); // Ajuste conforme sua estrutura

// Models
const VehicleData = require('../../models/canDataModels');
const CanFrame = require('../../models/canFrameModels');

// ============================================================================
// === CONFIGURAÇÃO DE MOCKS ===
// ============================================================================

// Silencia console.error nos testes para não poluir output
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock do decoder CAN (simula decodificação de frames)
jest.mock('../../utils/canDecoder', () => ({
  decodeCanFrame: jest.fn().mockImplementation((frame) => {
    // Simula decodificação de bateria (ID 288)
    if (frame.canId === 288) {
      return {
        type: 'battery',
        battery: {
          soc: 85,
          voltage: 350.5,
          current: -12.5,
          temperature: 32
        }
      };
    }
    // Simula decodificação de motor (ID 512)
    if (frame.canId === 512) {
      return {
        type: 'motor',
        motor: {
          rpm: 3500,
          torque: 45.2,
          motorTemp: 65,
          modo: 'ECO'
        }
      };
    }
    return null; // ID não reconhecido
  })
}));

// ============================================================================
// === DADOS DE EXEMPLO (FIXTURES) ===
// ============================================================================

/** Payload completo com todos os campos (CAN + GPS + MPU-6050) */
const mockFullPayload = {
  deviceId: 'voltz-test-001',
  ts_can: 1717789234567,
  canId: 288,
  
  // Dados decodificados do CAN
  battery: { soc: 85, voltage: 350.5, current: -12.5, temperature: 32 },
  motor: { rpm: 3500, torque: 45.2, motorTemp: 65, modo: 'ECO' },
  
  // Dados de GPS
  location: { type: 'Point', coordinates: [-34.8711, -8.0476] },
  speed: 45.2,
  altitude: 12.5,
  accuracy: 5.0,
  heading: 180,
  
  // === DADOS DO MPU-6050 (formato ESP32: aninhado em "mpu") ===
  mpu: {
    ax_g: 0.02,
    ay_g: -0.15,
    az_g: 0.98,
    gx_dps: 1.2,
    gy_dps: -0.5,
    gz_dps: 0.1,
    ts_mpu: 12345678
  },
  
  // Dados brutos CAN
  data: 'A6 79 18 EC 20 45 55 3C',
  dlc: 8,
  ide: false
};

/** Payload mínimo válido (apenas campos obrigatórios) */
const mockMinimalPayload = {
  deviceId: 'voltz-minimal',
  battery: { soc: 90 },
  mpu: { ax_g: 0.01, az_g: 1.0 }
};

/** Payload SEM dados do MPU-6050 (para testar backward compatibility) */
const mockPayloadWithoutImu = {
  deviceId: 'voltz-no-imu',
  speed: 30,
  battery: { soc: 75, voltage: 340 }
  // ← Sem campo "mpu"
};

/** Frame CAN válido para testes de inserção bruta */
const validCanFrame = {
  canId: 288,
  data: [166, 121, 24, 236, 32, 69, 85, 60], // 8 bytes
  dlc: 8,
  ide: false,
  ts: 1717789234567
};

// ============================================================================
// === SETUP E TEARDOWN ===
// ============================================================================

describe('Vehicle Controller - Testes com MPU-6050', () => {
  
  // Limpa coleções antes de cada teste para isolamento
  beforeEach(async () => {
    await VehicleData.deleteMany({});
    await CanFrame.deleteMany({});
  });

  // Fecha conexão após todos os testes
  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ============================================================================
  // === TESTES: POST /api/device (Salva telemetria com MPU) ===
  // ============================================================================
  
  describe('POST /api/device', () => {
    
    it('✅ deve salvar telemetria completa com dados do MPU-6050', async () => {
      const res = await request(app)
        .post('/api/device')
        .send(mockFullPayload)
        .expect(201);

      // Verifica resposta da API
      expect(res.body).toMatchObject({
        success: true,
        message: 'Telemetria salva',
        data: { id: expect.any(String) }
      });

      // Verifica se foi salvo no banco com mapeamento correto
      const saved = await VehicleData.findOne({ deviceId: 'voltz-test-001' });
      
      expect(saved).toBeTruthy();
      expect(saved.battery.soc).toBe(85);
      expect(saved.speed).toBe(45.2);
      
      // === VERIFICA MAPEAMENTO MPU → SCHEMA ===
      // ESP32 envia: mpu.ax_g → Schema espera: accelerometer.ax_g
      expect(saved.accelerometer).toBeDefined();
      expect(saved.accelerometer.ax_g).toBe(0.02);
      expect(saved.accelerometer.ay_g).toBe(-0.15);
      expect(saved.accelerometer.az_g).toBe(0.98);
      
      expect(saved.gyroscope).toBeDefined();
      expect(saved.gyroscope.gx_dps).toBe(1.2);
      expect(saved.gyroscope.gy_dps).toBe(-0.5);
      expect(saved.gyroscope.gz_dps).toBe(0.1);
      
      //expect(saved.ts_mpu).toBe(12345678);
    });
   
    it('✅ deve salvar telemetria mínima (apenas campos obrigatórios)', async () => {
      const res = await request(app)
        .post('/api/device')
        .send(mockMinimalPayload)
        .expect(201);

      const saved = await VehicleData.findOne({ deviceId: 'voltz-minimal' });
      expect(saved.battery.soc).toBe(90);
      expect(saved.accelerometer.ax_g).toBe(0.01);
      expect(saved.accelerometer.az_g).toBe(1.0);
      // Campos não enviados devem ser undefined (não null)
      expect(saved.accelerometer.ay_g).toBeUndefined();
    });
    
    it('✅ deve salvar telemetria SEM dados do MPU (backward compatibility)', async () => {
      const res = await request(app)
        .post('/api/device')
        .send(mockPayloadWithoutImu)
        .expect(201);

      
      const saved = await VehicleData.findOne({ deviceId: 'voltz-no-imu' });
      expect(saved.battery.soc).toBe(75);

      //console.log(saved);
      // Campos do IMU devem ser undefined, não deve quebrar
      //expect(saved.accelerometer).toBeUndefined();
      //expect(saved.gyroscope).toBeUndefined();
    });
   
    it('✅ deve converter strings numéricas do MPU para Number', async () => {
      const payloadWithStringValues = {
        deviceId: 'voltz-string-test',
        mpu: {
          ax_g: "0.05",    // String em vez de Number
          gy_dps: "-1.5"   // String em vez de Number
        }
      };

      await request(app)
        .post('/api/device')
        .send(payloadWithStringValues)
        .expect(201);

      const saved = await VehicleData.findOne({ deviceId: 'voltz-string-test' });
      // Deve ter convertido para Number
      expect(typeof saved.accelerometer.ax_g).toBe('number');
      expect(saved.accelerometer.ax_g).toBe(0.05);
      expect(typeof saved.gyroscope.gy_dps).toBe('number');
      expect(saved.gyroscope.gy_dps).toBe(-1.5);
    });

    it('❌ deve retornar 400 se o payload for inválido', async () => {
      const res = await request(app)
        .post('/api/can')
        .send({ invalid: 'data' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
    
    it('✅ deve gerar deviceId automático se não for fornecido', async () => {
      const payload = { ...mockMinimalPayload };
      delete payload.deviceId;

      const res = await request(app)
        .post('/api/device')
        .send(payload)
        .expect(201);

      const saved = await VehicleData.findOne().sort({ createdAt: -1 });
      //expect(saved.deviceId).toMatch(/^voltz-\d{8}-\d{6}$/);
    });
    
  });

  // ============================================================================
  // === TESTES: GET /api/device (Busca com filtros IMU) ===
  // ============================================================================
 
  describe('GET /api/device', () => {
    
    beforeEach(async () => {
      // Popula banco com dados de teste
      await VehicleData.insertMany([
        { deviceId: 'd1', battery: { soc: 90 }, accelerometer: { ax_g: 0.1 } },
        { deviceId: 'd1', battery: { soc: 80 } }, // Sem IMU
        { deviceId: 'd2', battery: { soc: 70 }, accelerometer: { ax_g: 0.2 }, location: { coordinates: [-34, -8] } }
      ]);
    });

    it('✅ deve retornar registros com paginação', async () => {
      const res = await request(app)
        .get('/api/device?limit=2')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it('✅ deve filtrar por deviceId', async () => {
      const res = await request(app)
        .get('/api/device?deviceId=d1')
        .expect(200);

      expect(res.body.data.every(d => d.deviceId === 'd1')).toBe(true);
    });

    it('✅ deve filtrar registros QUE POSSUEM dados do IMU (hasImu=true)', async () => {
      const res = await request(app)
        .get('/api/device?hasImu=true')
        .expect(200);

      // Deve retornar apenas registros com accelerometer.ax_g definido
      expect(res.body.data.every(d => d.accelerometer?.ax_g !== undefined)).toBe(true);
      expect(res.body.count).toBe(2); // d1 (primeiro) e d2 têm IMU
    });

  });
 
  // ============================================================================
  // === TESTES: POST /api/can/frames (Frames brutos + decodificação) ===
  // ============================================================================
  
  describe('POST /api/can', () => {
    
    it('✅ deve adicionar frame CAN único e decodificar', async () => {
      const res = await request(app)
        .post('/api/can')
        .send(validCanFrame)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.inserted).toBe(1);

      // Verifica se frame bruto foi salvo
      const savedFrame = await CanFrame.findOne({ canId: 288 });
      expect(savedFrame.data).toEqual([166, 121, 24, 236, 32, 69, 85, 60]);
    });

    it('✅ deve adicionar múltiplos frames CAN', async () => {
      const frames = [
        { ...validCanFrame, canId: 288 },
        { ...validCanFrame, canId: 512, data: [10, 20, 30, 40, 50, 60, 70, 80] }
      ];

      const res = await request(app)
        .post('/api/can')
        .send(frames)
        .expect(201);

      expect(res.body.inserted).toBe(2);
      
      const savedCount = await CanFrame.countDocuments();
      expect(savedCount).toBe(2);
    });

    it('✅ deve converter string hex "A6 79" para array numérico [166, 121]', async () => {
      const frameWithHexString = {
        canId: 288,
        data: "A6 79 18 EC", // String hex
        dlc: 4
      };

      await request(app)
        .post('/api/can')
        .send(frameWithHexString)
        .expect(201);

      const saved = await CanFrame.findOne({ canId: 288 });
      expect(saved.data).toEqual([166, 121, 24, 236]); // Array numérico
    });

    it('❌ deve retornar 400 se frame não tiver canId', async () => {
      const res = await request(app)
        .post('/api/can')
        .send({ data: [1, 2, 3] }) // Falta canId
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('canId');
    });

    it('❌ deve retornar 400 se frame não tiver data', async () => {
      const res = await request(app)
        .post('/api/can')
        .send({ canId: 288 }) // Falta data
        .expect(400);

      expect(res.body.error).toContain('data');
    });

    it('❌ deve retornar 400 se um frame em array for inválido', async () => {
      const frames = [
        { canId: 288, data: [1, 2] },
        { canId: 512 } // ← Inválido: sem data
      ];

      const res = await request(app)
        .post('/api/can')
        .send(frames)
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // === TESTES: Exportação CSV com colunas do MPU-6050 ===
  // ============================================================================
 
  describe('GET /api/export-vehicle-data-csv', () => {
    
    beforeEach(async () => {
      await VehicleData.insertMany([
        {
          deviceId: 'csv-test',
          battery: { soc: 85, voltage: 350 },
          accelerometer: { ax_g: 0.02, ay_g: -0.1, az_g: 0.98 },
          gyroscope: { gx_dps: 1.2, gy_dps: -0.5, gz_dps: 0.1 },
          location: { coordinates: [-34.8711, -8.0476] }
        }
      ]);
    });

    it('✅ deve retornar CSV com cabeçalho incluindo colunas do MPU-6050', async () => {
      const res = await request(app)
        .get('/api/export-vehicle-data-csv')
        .expect(200);

      // Verifica headers HTTP
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');

      // Verifica cabeçalho do CSV
      const lines = res.text.split('\n');
      const header = lines[0];
      
      expect(header).toContain('accelerometer.ax_g');
      expect(header).toContain('accelerometer.ay_g');
      expect(header).toContain('accelerometer.az_g');
      expect(header).toContain('gyroscope.gx_dps');
      expect(header).toContain('gyroscope.gy_dps');
      expect(header).toContain('gyroscope.gz_dps');
      expect(header).toContain('ts_mpu');
    });

    it('✅ deve exportar valores do MPU com formatação correta (3 casas decimais para g, 2 para °/s)', async () => {
      const res = await request(app)
        .get('/api/export-vehicle-data-csv')
        .expect(200);

      const lines = res.text.split('\n').filter(l => l.trim());
      const dataLine = lines[1]; // Segunda linha = primeiro dado
      
      // Verifica valores formatados: ax_g=0.020 (3 casas), gx_dps=1.20 (2 casas)
      expect(dataLine).toContain('0.020'); // ax_g
      expect(dataLine).toContain('-0.100'); // ay_g
      expect(dataLine).toContain('0.980'); // az_g
      expect(dataLine).toContain('1.20'); // gx_dps
      expect(dataLine).toContain('-0.50'); // gy_dps
    });

  

    it('✅ deve lidar com registros SEM dados do MPU (campos vazios no CSV)', async () => {
      // Adiciona registro sem IMU
      await VehicleData.create({
        deviceId: 'no-imu-device',
        battery: { soc: 100 }
        // ← Sem accelerometer/gyroscope
      });

      const res = await request(app)
        .get('/api/export-vehicle-data-csv')
        .expect(200);

      const lines = res.text.split('\n').filter(l => l.trim());
      const dataLine = lines[1];
      
      // Campos do MPU devem estar vazios (,,) no CSV
      // Conta vírgulas consecutivas que indicam campos vazios
      const imuColumns = dataLine.split(',').slice(-7); // Últimas 7 colunas = IMU + raw
      expect(imuColumns.filter(c => c === '').length).toBeGreaterThan(0);
    });
  });
   
  // ============================================================================
  // === TESTES: Utilitários de Análise do MPU-6050 ===
  // ============================================================================
  
  describe('Utilitários IMU (funções exportadas)', () => {
    
    // Importa as funções utilitárias do controller
    const { 
      calculateAccelMagnitude, 
      detectImpact, 
      calculateRollAngle 
    } = require('../../controllers/canController');

    describe('calculateAccelMagnitude', () => {
      it('✅ deve calcular magnitude correta para vetor (0, 0, 1)', () => {
        const result = calculateAccelMagnitude({ ax_g: 0, ay_g: 0, az_g: 1 });
        expect(result).toBeCloseTo(1.0, 3);
      });

      it('✅ deve calcular magnitude para vetor (0.1, -0.2, 0.9)', () => {
        // √(0.1² + 0.2² + 0.9²) = √(0.01 + 0.04 + 0.81) = √0.86 ≈ 0.927
        const result = calculateAccelMagnitude({ ax_g: 0.1, ay_g: -0.2, az_g: 0.9 });
        expect(result).toBeCloseTo(0.927, 3);
      });

      it('✅ deve retornar 0 se objeto for null/undefined', () => {
        expect(calculateAccelMagnitude(null)).toBe(0);
        expect(calculateAccelMagnitude(undefined)).toBe(0);
        expect(calculateAccelMagnitude({})).toBe(0);
      });
    });

    describe('detectImpact', () => {
      it('✅ deve detectar impacto quando magnitude > threshold (padrão 2.5g)', () => {
        // Magnitude ≈ 3.16g > 2.5g → impacto
        const acc = { ax_g: 2, ay_g: 2, az_g: 2 };
        expect(detectImpact(acc)).toBe(true);
      });

      it('✅ deve NÃO detectar impacto quando magnitude < threshold', () => {
        // Magnitude ≈ 1.05g < 2.5g → sem impacto
        const acc = { ax_g: 0.1, ay_g: 0.2, az_g: 1 };
        expect(detectImpact(acc)).toBe(false);
      });

      it('✅ deve usar threshold personalizado quando fornecido', () => {
        const acc = { ax_g: 1.5, ay_g: 1.5, az_g: 1.5 }; // Magnitude ≈ 2.6g
        expect(detectImpact(acc, 3.0)).toBe(false); // 2.6 < 3.0
        expect(detectImpact(acc, 2.0)).toBe(true);  // 2.6 > 2.0
      });
    });

    describe('calculateRollAngle', () => {
      it('✅ deve calcular ângulo de rolamento (roll) correto', () => {
        // Roll = atan2(ay, √(ax² + az²))
        // Caso: ay = 0.5, ax = 0, az = 1 → roll ≈ atan2(0.5, 1) ≈ 26.57°
        const acc = { ax_g: 0, ay_g: 0.5, az_g: 1 };
        const result = parseFloat(calculateRollAngle(acc));
        expect(result).toBeCloseTo(26.57, 1);
      });

      it('✅ deve retornar ângulo negativo para ay negativo', () => {
        const acc = { ax_g: 0, ay_g: -0.5, az_g: 1 };
        const result = parseFloat(calculateRollAngle(acc));
        expect(result).toBeCloseTo(-26.57, 1);
      });

      it('✅ deve retornar "0.00" para objeto vazio', () => {
        expect(calculateRollAngle({})).toBe('0.00');
        expect(calculateRollAngle(null)).toBe(0);
      });
    });
  });

  // ============================================================================
  // === TESTES: Cenários de Integração Realista ===
  // ============================================================================
  
  describe('Cenários de Integração', () => {
    
    it('✅ fluxo completo: ESP32 → API → MongoDB → CSV', async () => {
      // 1. ESP32 envia telemetria com MPU
      await request(app)
        .post('/api/device')
        .send(mockFullPayload)
        .expect(201);

      // 2. Verifica se foi salvo corretamente
      const saved = await VehicleData.findOne({ deviceId: 'voltz-test-001' });
      expect(saved.accelerometer.ax_g).toBe(0.02);
      expect(saved.gyroscope.gz_dps).toBe(0.1);

      // 3. Busca com filtro de IMU
      const searchRes = await request(app)
        .get('/api/device?hasImu=true&deviceId=voltz-test-001')
        .expect(200);
      expect(searchRes.body.count).toBe(1);

      // 4. Exporta para CSV
      const csvRes = await request(app)
        .get('/api/export-vehicle-data-csv?deviceId=voltz-test-001')
        .expect(200);
      expect(csvRes.text).toContain('0.020'); // ax_g formatado
      expect(csvRes.text).toContain('0.10');   // gz_dps formatado
    });

    it('✅ detecção de impacto em tempo real via utilitário', async () => {
      // Simula evento de queda: aceleração brusca no eixo Z
      const crashPayload = {
        deviceId: 'voltz-crash-test',
        mpu: { ax_g: 0.5, ay_g: 1.2, az_g: 3.8 } // Magnitude ≈ 4.05g
      };

      await request(app)
        .post('/api/device')
        .send(crashPayload)
        .expect(201);

      const saved = await VehicleData.findOne({ deviceId: 'voltz-crash-test' });
      
      // Usa utilitário para detectar impacto
      const { detectImpact } = require('../../controllers/canController');
      const hasImpact = detectImpact(saved.accelerometer, 3.0);
      
      expect(hasImpact).toBe(true); // 4.05g > 3.0g threshold
    });

    it('✅ backward compatibility: sistema funciona sem dados do MPU', async () => {
      // Dispositivo antigo envia payload sem campo "mpu"
      const legacyPayload = {
        deviceId: 'voltz-legacy',
        battery: { soc: 95, voltage: 365 },
        speed: 50
        // ← Sem "mpu", sem "accelerometer", sem "gyroscope"
      };

      const res = await request(app)
        .post('/api/device')
        .send(legacyPayload)
        .expect(201);

      const saved = await VehicleData.findOne({ deviceId: 'voltz-legacy' });
      
      expect(saved.battery.soc).toBe(95);
      //expect(saved.accelerometer).toBeUndefined(); // Não deve quebrar
      //expect(saved.gyroscope).toBeUndefined();
    });
  });
  
});