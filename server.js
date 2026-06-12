process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { app } = require('./app');
const fs = require('fs');
const { connectDB } = require('./database/db');
const { handleWebSocketMessage, addData, sendMessage } = require('./utils/handleWebSocketMessage');
const https = require('https');
const http = require('http'); // ✅ Adicionado
const WebSocket = require('ws');
const path = require('path');
const { connectMQTT } = require('./mqtt/mqttClient');

const PORT_HTTPS = process.env.PORT_HTTPS || 3001;
const PORT_HTTP = process.env.PORT_HTTP || 3002; // ✅ Nova porta HTTP

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'config', 'key.pem.example')),
  cert: fs.readFileSync(path.join(__dirname, 'config', 'cert.pem.example'))
};

// ✅ Servidor HTTPS (para frontend/GPS)
const httpsServer = https.createServer(sslOptions, app);

// ✅ Servidor HTTP (para chamadas internas do MQTT)
const httpServer = http.createServer(app);

// WebSocket no HTTPS
const wss = new WebSocket.Server({ server: httpsServer });

wss.on('connection', async (ws, req) => {
  ws.on('message', (message) => {
    handleWebSocketMessage(wss, ws, message, req);
  });

  ws.on('close', () => {
    if (ws.deviceId) {
      console.log(`❌🔌 Esp Desconectado : ${ws.deviceId}`);
      sendMessage(wss, ws, `❌🔌 ESP32 Desconectado ${ws.deviceId}`);
    } else {
      console.log('❌🔌 Dashboard Desconectado');
    }
  });

  ws.on('error', (error) => {
    if (ws.deviceId) {
      console.log(`❌🔌 Erro no Esp : ${ws.deviceId}`);
      sendMessage(wss, ws, `❌🔌 ESP32 Desconectado ${ws.deviceId}`);
    } else {
      console.log('❌🔌 Erro no Dashboard');
    }
    console.error('❌ Erro no WebSocket:', error);
  });

  ws.send(JSON.stringify({ message: 'Conectado ao servidor WebSocket' }));
});

connectDB()
  .then(() => {
    // ✅ Inicia ambos os servidores
    httpsServer.listen(PORT_HTTPS, () => {
      console.log(`🟢 HTTPS rodando na porta ${PORT_HTTPS} (frontend/GPS)`);
    });
    
    httpServer.listen(PORT_HTTP, () => {
      console.log(`🟢 HTTP rodando na porta ${PORT_HTTP} (interno/MQTT)`);
    });
  })
  .catch((err) => {
    console.error('❌ Erro ao iniciar o servidor:', err);
  });

connectMQTT();