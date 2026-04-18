
const { app } = require('./app');
const { connectDB } = require('./database/db');
const { handleWebSocketMessage, addData, sendMessage } = require('./utils/handleWebSocketMessage');
const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const { connectMQTT } = require('./mqtt/mqttClient');


/*
wss.on('connection', async (ws, req) => {

  ws.on('message', (message) => {
    handleWebSocketMessage(wss, ws, message, req );
  });

  ws.on('close', () => {
    if (ws.deviceId) {
      console.log(`❌🔌 Esp Desconectado : ${ws.deviceId}`);
      sendMessage(wss, ws,`❌🔌 ESP32 Desconectado ${ws.deviceId}`);
    } else {
      console.log('❌🔌 Dashboard Desconectado');
    }
  });

  ws.on('error', (error) => {
    if (ws.deviceId) {
      console.log(`❌🔌 Erro no Esp : ${ws.deviceId}`);
      sendMessage(wss, ws,`❌🔌 ESP32 Desconectado ${ws.deviceId}`);
    } else {
      console.log('❌🔌 Erro no Dashboard');
    }
    console.error('❌ Erro no WebSocket:', error);    
  });

  ws.send(JSON.stringify({ message: 'Conectado ao servidor WebSocket' }));
});
*/

connectDB()
  .then(() => {
    server.listen(PORT, async () => {
      console.log(`🟢 Servidor rodando na porta ${PORT}`);
      //console.log(`WebSocket disponível em ws://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erro ao iniciar o servidor:', err);
  });

  // Iniciar cliente MQTT
connectMQTT();
