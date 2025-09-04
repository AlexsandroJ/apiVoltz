// Elementos do DOM
const statusIndicator = document.getElementById('status-indicator');
const speedEl = document.getElementById('speed');
const batteryEl = document.getElementById('battery');
const rangeEl = document.getElementById('range');
const tempBattEl = document.getElementById('temp-batt');
const driveModeEl = document.getElementById('drive-mode');
const powerEl = document.getElementById('power');
const canBody = document.getElementById('can-body');
const themeToggle = document.getElementById('theme-toggle');

// Nome dos IDs CAN conhecidos
const canIdNames = {
  '0x100': 'Vehicle Speed',
  '0x201': 'Motor Power',
  '0x202': 'Motor RPM',
  '0x203': 'Regen Level',
  '0x5A0': 'BMS Status',
  '0x5A2': 'Battery Voltage',
  '0x5A3': 'Battery Current',
  '0x5A4': 'Battery Temperature',
  '0x5A5': 'Battery SoC',
  '0x5A6': 'Charging Status',
  '0x300': 'Drive Mode',
  '0x301': 'Throttle Input',
  '0x400': 'Odometer',
  '0x600': 'Error Codes',
  '0x700': 'GPS Location',
  '0x7E8': 'OBD-II Response'
};

// Dados atuais
const liveData = {
  speed: '--',
  battery: '--',
  range: '--',
  tempBatt: '--',
  driveMode: '--',
  power: '--',
  lastCoords: null
};

// URL da API
const API_URL = 'http://localhost:3001/api/history';

// Mapa - Leaflet
let map;
let bikeMarker;
let lat, lon;

// Inicializa o mapa
function initMap() {
  const initialCoords = [-23.5505, -46.6333];

  map = L.map('map').setView(initialCoords, 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileSize: 512,
    zoomOffset: -1
  }).addTo(map);

  bikeMarker = L.marker(initialCoords, { title: 'Moto Voltz RV1' }).addTo(map);
  bikeMarker.bindPopup('📍 Moto Voltz RV1<br><small>Em movimento</small>');
}

// Função para processar mensagens CAN
function processCanMessage(msg) {

  const id = msg.canId?.toUpperCase() || 'N/D';
  const data = msg.data ? msg.data.split(' ').map(b => parseInt(b, 16)) : [];
  const timestamp = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('pt-BR')
    : 'N/D';
  speedEl.textContent = msg.speed;
  batteryEl.textContent = msg.battery.soc;
  rangeEl.textContent = msg.range;
  tempBattEl.textContent = msg.battery.temperature;
  driveModeEl.textContent = msg.driveMode;
  powerEl.textContent = msg.motor.power;

  return {
    ...msg.canMessages[0],        // copia todas as propriedades da primeira CAN message
    timestamp: msg.deviceId       // adiciona o timestamp do objeto pai
  };
}

// Atualiza posição no mapa
function updateMapPosition(lat, lon) {
  if (bikeMarker) {
    bikeMarker.setLatLng([lat, lon]);
    map.setView([lat, lon], map.getZoom());
    bikeMarker.getPopup().setContent(`
      📍 Moto Voltz RV1<br>
      <small>Lat: ${lat.toFixed(6)}°<br>Lon: ${lon.toFixed(6)}°</small>
    `);
  }
  liveData.lastCoords = [lat, lon];
}

// Atualiza tabela CAN
function updateCanTable(messages) {

  canBody.innerHTML = '';
  const recent = messages.slice(-50);
  if (recent.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="5" class="empty">Nenhuma mensagem recebida.</td>`;
    canBody.appendChild(row);
    return;
  }
  
  recent.forEach(msgData => {
    const tr = document.createElement('tr');
    tr.classList.add('highlight');
    tr.innerHTML = `
      <td><strong>${msgData.timestamp}</strong></td>
      <td>${msgData.canId}</td>
      <td>${msgData.data}</td>
      <td>${msgData.dlc}</td>
    `;
    canBody.appendChild(tr);
    setTimeout(() => tr.classList.remove('highlight'), 500);
  });
}

// Busca dados da API
async function fetchCanData() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const messages = await response.json();
    const processedMessages = messages.map(processCanMessage).filter(Boolean);

    if (!messages || messages.length === 0) {
      console.warn('Nenhum dado recebido da API');
      statusIndicator.classList.remove('online');
    canBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty" ">
          Nenhum dado recebido da API.
        </td>
      </tr>
    `;
      return; // ou atualize UI com "sem dados"
    }
    const { gpsLocation, speed, battery, driveMode, motor } = messages[0];
    const { lat, lon } = gpsLocation;

    updateCanTable(processedMessages);
    updateMapPosition(lat, lon);

    statusIndicator.classList.add('online');
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    statusIndicator.classList.remove('online');
    canBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty" style="color: #f44336;">
          Falha na conexão com a API.
        </td>
      </tr>
    `;
  }
}

// Alternar tema
function toggleTheme() {
  const isDark = document.body.classList.contains('dark-theme');
  const newTheme = isDark ? 'light-theme' : 'dark-theme';
  document.body.className = newTheme;
  localStorage.setItem('theme', newTheme);
  themeToggle.textContent = isDark ? '🌙' : '☀️';
}

// Carrega tema salvo
function loadSavedTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark-theme' : 'light-theme');
  document.body.className = theme;
  themeToggle.textContent = theme === 'dark-theme' ? '☀️' : '🌙';
}

// Eventos
document.addEventListener('DOMContentLoaded', () => {
  loadSavedTheme();
  initMap();
  fetchCanData();
});

themeToggle?.addEventListener('click', toggleTheme);

// Atualização automática
setInterval(fetchCanData, 5000);