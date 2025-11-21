
const { app } = require('./app');
const { connectDB } = require('./database/db');
const { handleWebSocketMessage, addData } = require('./utils/handleWebSocketMessage');
const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection',async (ws, req) => {
  console.log('🔌 Cliente WebSocket conectado:', req.socket.remoteAddress);
  clients.add(ws);

  ws.on('message', (message) => handleWebSocketMessage(ws, message, clients));

  ws.on('close', () => {
    console.log('❌🔌 Cliente WebSocket desconectado');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ Erro no WebSocket:', error);
    clients.delete(ws);
  });

  ws.send(JSON.stringify({ message: 'Conectado ao servidor WebSocket' }));
});



connectDB()
  .then(() => {
    server.listen(PORT, async () => {
      console.log(`🟢 Servidor rodando na porta ${PORT}`);
      console.log(`WebSocket disponível em ws://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erro ao iniciar o servidor:', err);
  });

