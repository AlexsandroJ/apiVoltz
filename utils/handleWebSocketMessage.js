/**
 * @fileoverview Módulo para processamento de mensagens WebSocket do ESP32 e persistência de dados CAN no MongoDB.
 * 
 * Este módulo contém funções para:
 * - Adicionar frames CAN diretamente ao banco de dados.
 * - Processar mensagens recebidas via WebSocket.
 * - Decodificar dados CAN e enviar para o frontend.
 * - Gerenciar o ID do dispositivo para persistência.
 * 
 * @module WebSocketHandler
 * @author Alexsandro j Silva
 * @version 1.0.0
 * @since 2025-11-21
 */

const axios = require('axios');
const { decodeCanFrame, } = require('../utils/canDecoder');
const VehicleData = require('../models/canDataModels'); // Importe seu modelo
const uri = `${process.env.API_URL}`;

let deviceId = '';

/**
 * Adiciona um frame CAN diretamente no MongoDB.
 * 
 * @async
 * @function addCanDirectly
 * @param {object} canFrame - Frame CAN a ser adicionado.
 * @param {number} canFrame.canId - ID do frame CAN.
 * @param {number[]} canFrame.data - Array de bytes do frame.
 * @param {number} canFrame.dlc - Data Length Code.
 * @param {boolean} canFrame.rtr - Remote Transmission Request.
 * @returns {Promise<void>}
 * @throws {Error} Se o frame for inválido ou ocorrer erro de banco de dados.
 */
async function addCanDirectly(canFrame) {
  try {
    // Validação básica
    if (!canFrame.canId || !Array.isArray(canFrame.data) || typeof canFrame.dlc !== 'number') {
      console.error('❌ Frame CAN inválido:', canFrame);
      return;
    }

    // Busca o último documento do dispositivo
    let vehicleData = await VehicleData.findOne({ deviceId }).sort({ timestamp: -1 });

    if (vehicleData) {
      // Adiciona o frame CAN ao array existente
      vehicleData.canMessages.push(canFrame);
      vehicleData.timestamp = new Date(); // Atualiza timestamp
    } else {
      // Cria um novo documento com o frame CAN
      vehicleData = new VehicleData({
        deviceId,
        canMessages: [canFrame]
      });
    }

    await vehicleData.save();
    console.log(`✅ Frame CAN adicionado ao deviceId: ${deviceId}`);
  } catch (error) {
    console.error('❌ Erro ao salvar frame CAN diretamente:', error);
  }
}

/**
 * Adiciona dados iniciais para o dispositivo no banco de dados.
 * 
 * @async
 * @function addData
 * @returns {Promise<string|null>} O deviceId gerado ou null em caso de erro.
 */
async function addData() {
  const mockData = {
    location: {
      type: 'Point',
      coordinates: [-46.5755, -23.6789]
    },
  };

  try {
    const response = await axios.post(`${uri}/api`, mockData);
    console.log(`📊 Dados de teste inseridos com sucesso`);
    console.log(`🔑 deviceId:`, response.data.deviceId || response.data.savedData.deviceId);
    deviceId = response.data.deviceId;
    return deviceId;
  } catch (error) {
    console.log(`📊 Erro ao inserir dados:`, error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Processa mensagens recebidas via WebSocket do ESP32.
 * 
 * @async
 * @function handleWebSocketMessage
 * @param {WebSocket} ws - Conexão WebSocket do cliente.
 * @param {Buffer} message - Mensagem recebida do cliente.
 * @param {Set<WebSocket>} clients - Conjunto de todas as conexões WebSocket ativas.
 * @returns {Promise<void>}
 * @description
 * Esta função:
 * - Faz parse da mensagem JSON.
 * - Processa frames CAN recebidos.
 * - Decodifica os dados (bateria/motor) e envia para o frontend.
 * - Salva os frames no banco de dados.
 * - Reenvia mensagens para outros clientes conectados.
 */
async function handleWebSocketMessage(ws, message, clients ) {
  try {
    const rawMessage = message.toString();

    if (rawMessage.trim().startsWith('{') && rawMessage.trim().endsWith('}')) {
      const data = JSON.parse(rawMessage);

      if (typeof data !== 'object' || data === null) {
        console.error('❌ Dados recebidos inválidos:', rawMessage);
        return;
      }

      // Processa mensagem CAN recebida do ESP32
      if (data.type === "canFrame") {
        const canFrame = {
          canId: data.id,
          data: data.data,
          dlc: data.dlc,
          rtr: data.extended || false
        };

        const decoded = decodeCanFrame(canFrame);
        if (decoded) {
          let decodedData;

          if (decoded.type === 'battery') {
            decodedData = {
              type: 'decodedData',
              source: 'battery',
               decoded: decoded.data
            };
          } else if (decoded.type === 'motorController') {
            decodedData = {
              type: 'decodedData',
              source: 'motorController',
               decoded: decoded.data
            };
          }

          if (decodedData) {
            // Envia dados decodificados para o frontend
            ws.send(JSON.stringify(decodedData));

            // Opcional: envia para todos os clientes conectados
            clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(JSON.stringify(decodedData));
              }
            });
          }
        }

        // Salva frame CAN bruto no MongoDB
        addCanDirectly(canFrame, deviceId);
      }

      // Reenvia para outros clientes
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== ws) {
          client.send(JSON.stringify(data));
        }
      });
    } else {
      console.log('💬 Mensagem de texto recebida:', rawMessage);
      if (rawMessage === "ESP32 conectado ao WebSocket!"){
        deviceId = await addData();
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem do ESP32:', error);
    console.error('Mensagem recebida:', message.toString());
  }
}

module.exports = {
  handleWebSocketMessage
};