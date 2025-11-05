// Elementos do DOM
const rpm = document.getElementById('rpm');
const torque = document.getElementById('torque');
const tempMotor = document.getElementById('temp-motor');
const tempBatt = document.getElementById('temp-batt');
const bmsVoltage = document.getElementById('bms-voltage');
const bmsCurrent = document.getElementById('bms-current');
const bmsSoc = document.getElementById('bms-soc');
const bmsSoH = document.getElementById('bms-soh');
const bmsTemp = document.getElementById('bms-temp');
const themeToggle = document.getElementById('theme-toggle');
// Nome dos IDs CAN conhecidos
const canIdNames = {
  '0x120': 'BMS Status',
  '0x300': 'Motor Status',
};
// Dados atuais
const liveData = {
  rpm: '--',
  torque: '--',
  tempMotor: '--',
  tempBatt: '--',
  bmsCurrent: '--',
  bmsVoltage: '--',
  bmsSoc: '--',
  bmsSoH: '--',
  bmsTemp: '--',
  lastCoords: null
};
// Mapa - Leaflet
let map;
let bikeMarker;
let lat, lon;
// Inicializa o mapa
function initMap() {
  const initialCoords = [-8.055581, -34.951640];
  map = L.map('map').setView(initialCoords, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileSize: 512,
    zoomOffset: -1
  }).addTo(map);
  // Cria um ícone personalizado de moto
  const bikeIcon = L.icon({
    iconUrl: 'https://www.jav.com.br/wp-content/uploads/2017/03/map-marker-icon.png', // Ícone de moto (tamanho ~32x32)
    iconSize: [32, 32],        // Tamanho do ícone
    iconAnchor: [16, 32],      // Ponto de ancoragem (base do ícone)
    popupAnchor: [0, -32]      // De onde o popup abre
  });
  // Adiciona o marcador com o ícone personalizado
  bikeMarker = L.marker(initialCoords, { 
    icon: bikeIcon,
    title: 'Moto Voltz' 
  }).addTo(map);
  bikeMarker.bindPopup('📍 Moto Voltz <br><small>Em movimento</small>');
}
// Atualiza posição no mapa
function updateMapPosition(lat, lon) {
  if (bikeMarker) {
    bikeMarker.setLatLng([lat, lon]);
    map.setView([lat, lon], map.getZoom());
    bikeMarker.getPopup().setContent(`
      📍 Moto Voltz<br>
      <small>Lat: ${lat.toFixed(6)}°<br>Lon: ${lon.toFixed(6)}°</small>
    `);
  }
  liveData.lastCoords = [lat, lon];
}
// Atualiza tabela CAN
function updateCanTable(messages) {
  canBody.innerHTML = '';
  for (let x = 0; x < messages.length; x++) {
    let data = messages[x].canMessages;
    for (let index = 0; index < data.length; index++) {
      let element = data[index];
      let tr = document.createElement('tr');
      tr.classList.add('highlight');
      tr.innerHTML = `
      <td><strong>${messages[x].deviceId}</strong></td>
      <td>${element.canId}</td>
      <td>${element.data}</td>
    `;
      canBody.appendChild(tr);
      setTimeout(() => tr.classList.remove('highlight'), 500);
    }
  }
}
// Busca dados da API
async function fetchCanData() {
  try {
    const dashboardApiUrl = '/api/dashboard-data';
    // Faz a requisição e espera pela resposta
    const response = await fetch(dashboardApiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const messages = await response.json();
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
    } else {
      const { gpsLocation, speed, battery, driveMode, motor } = messages[0];
      const { lat, lon } = gpsLocation;
      speedEl.textContent = messages[0].speed;
      batteryEl.textContent = messages[0].battery.soc;
      rangeEl.textContent = messages[0].range;
      tempBattEl.textContent = messages[0].battery.temperature;
      driveModeEl.textContent = messages[0].driveMode;
      powerEl.textContent = messages[0].motor.power;
      updateCanTable(messages);
      updateMapPosition(lat, lon);
      statusIndicator.classList.add('online');
    }
  } catch (error) {
    /*
    console.error('Erro ao buscar dados:', error);
    statusIndicator.classList.remove('online');
    canBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty" style="color: #f44336;">
          Falha na conexão com a API.
        </td>
      </tr>
    `;
    */
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