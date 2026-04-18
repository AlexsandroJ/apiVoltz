// dashboard.js

// === Configuração ===
const API_BASE = 'http://localhost:3001'; // Ajuste conforme necessário
const UPDATE_INTERVAL_MS = 2000; // 2 segundos
const DEVICE_ID = 'esp32-moto-001';

// === Estado global ===
let state = {
  liveData: {
    modo: '--', rpm: '--', torque: '--',
    tempMotor: '--', tempBatt: '--',
    bmsCurrent: '--', bmsVoltage: '--',
    bmsSoc: '--', bmsSoH: '--', bmsTemp: '--',
    location: '—'
  },
  canMessages: [],
  decodedMessages: [],
  gpsWatchId: null,
  motoPosition: null,
  isDarkTheme: false
};

// === Atualiza os cards do painel ===
function updateDashboardCards(data) {
  const map = {
    'val-modo': data.modo,
    'val-rpm': formatValue(data.rpm),
    'val-torque': formatValue(data.torque),
    'val-tempMotor': formatValue(data.tempMotor),
    'val-tempBatt': formatValue(data.tempBatt),
    'val-bmsVoltage': formatValue(data.bmsVoltage, 3),
    'val-bmsCurrent': formatValue(data.bmsCurrent),
    'val-bmsSoc': formatValue(data.bmsSoc),
    'val-bmsSoH': formatValue(data.bmsSoH),
    'val-bmsTemp': formatValue(data.bmsTemp),
    'val-location': data.location
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

/**
 * Extrai os últimos valores úteis de um array de registros
 */
function extractLatestLiveData(records) {
  const latest = { ...state.liveData };

  for (const record of records) {
    // Motor
    if (latest.rpm === '--' && record.motor?.rpm != null) latest.rpm = record.motor.rpm;
    if (latest.torque === '--' && record.motor?.torque != null) latest.torque = record.motor.torque;
    if (latest.tempMotor === '--' && record.motor?.motorTemp != null) latest.tempMotor = record.motor.motorTemp;
    if (latest.tempBatt === '--' && record.motor?.controlTemp != null) latest.tempBatt = record.motor.controlTemp;
    if (latest.modo === '--' && record.motor?.modo != null) latest.modo = record.motor.modo;

    // Bateria
    if (latest.bmsSoc === '--' && record.battery?.soc != null) latest.bmsSoc = record.battery.soc;
    if (latest.bmsSoH === '--' && record.battery?.soh != null) latest.bmsSoH = record.battery.soh;
    if (latest.bmsVoltage === '--' && record.battery?.voltage != null) latest.bmsVoltage = record.battery.voltage;
    if (latest.bmsCurrent === '--' && record.battery?.current != null) latest.bmsCurrent = record.battery.current;
    if (latest.bmsTemp === '--' && record.battery?.temperature != null) latest.bmsTemp = record.battery.temperature;

    // Localização
    const loc = formatLocation(record);
    if (loc && latest.location === '—') {
      latest.location = loc.display;
      if (!state.motoPosition) {
        state.motoPosition = { lat: loc.lat, lon: loc.lon };
        updateMapPlaceholder(loc.lat, loc.lon);
      }
    }

    // Opcional: parar se todos preenchidos
    // if (Object.values(latest).every(v => v !== '--')) break;
  }
  return latest;
}

/**
 * Atualiza a tabela de dados do veículo (tbody com ID fixo)
 */
function updateVehicleTable(records) {
  const tbody = document.getElementById('vehicle-data-body');
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr id="empty-vehicle-row">
        <td colspan="10" class="empty">Nenhum dado de veículo recebido.</td>
      </tr>`;
    return;
  }

  const rows = records.map(record => {
    const loc = formatLocation(record);
    const locationCell = loc 
      ? `<span title="${loc.title}">${loc.display}</span>` 
      : '—';

    return `
      <tr class="highlight">
        <td>${formatTimestamp(record.timestamp)}</td>
        <td>${record.motor?.modo ?? '—'}</td>
        <td>${formatValue(record.motor?.rpm)}</td>
        <td>${formatValue(record.motor?.torque)}</td>
        <td>${formatValue(record.battery?.soc)}</td>
        <td>${formatValue(record.motor?.motorTemp)}</td>
        <td>${formatValue(record.battery?.temperature)}</td>
        <td>${formatValue(record.battery?.voltage, 3)}</td>
        <td>${formatValue(record.battery?.current)}</td>
        <td>${locationCell}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

/**
 * Atualiza a tabela CAN bruta
 */
function updateCanTable(messages) {
  const tbody = document.getElementById('can-table-body');
  if (!tbody) return;

  if (!messages || messages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Aguardando dados CAN...</td></tr>`;
    return;
  }

  const rows = messages.slice(0, 20).map(msg => `
    <tr>
      <td>${formatTimestamp(msg.timestamp)}</td>
      <td>${msg.id ? '0x' + Number(msg.id).toString(16).toUpperCase() : '—'}</td>
      <td>${msg.dlc ?? '—'}</td>
      <td><code>${msg.dataHex ?? '—'}</code></td>
      <td>${msg.source ?? '—'}</td>
    </tr>
  `).join('');

  tbody.innerHTML = rows;
}

/**
 * Atualiza placeholder do mapa
 */
function updateMapPlaceholder(lat, lon) {
  const map = document.getElementById('map');
  const status = document.getElementById('map-status');
  if (map && status) {
    map.style.background = '#e8f5e9';
    status.innerHTML = `📍 ${lat.toFixed(6)}, ${lon.toFixed(6)}<br><small>Clique para abrir no Google Maps</small>`;
    map.onclick = () => window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
  }
}

/**
 * Envia localização para o servidor
 */
async function sendLocationToServer(lat, lon, accuracy) {
  try {
    const res = await fetch(`${API_BASE}/api/device/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lon, accuracy, deviceId: DEVICE_ID })
    });

    const statusEl = document.getElementById('gps-status');
    if (res.ok) {
      if (statusEl) statusEl.textContent = `📍 Enviado: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      state.motoPosition = { lat, lon };
      updateMapPlaceholder(lat, lon);
    } else {
      const text = await res.text();
      if (statusEl) statusEl.textContent = `❌ Erro (${res.status}): ${text.substring(0, 40)}`;
    }
  } catch (err) {
    const statusEl = document.getElementById('gps-status');
    if (statusEl) statusEl.textContent = '🌐 Sem conexão com o servidor';
    console.error('Erro ao enviar GPS:', err);
  }
}

/**
 * Inicia rastreamento GPS do navegador
 */
function startGpsTracking() {
  if (!navigator.geolocation) {
    const status = document.getElementById('gps-status');
    if (status) status.textContent = '❌ Geolocalização não suportada';
    return;
  }

  const status = document.getElementById('gps-status');
  const btn = document.getElementById('btn-gps-toggle');
  
  if (status) status.textContent = '📡 Aguardando localização...';
  if (btn) btn.textContent = '⏹️ Parar GPS';

  state.gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (status) {
        status.textContent = `📡 Recebido: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;
      }
      sendLocationToServer(latitude, longitude, accuracy);
    },
    (err) => {
      let msg = '⚠️ GPS indisponível';
      switch (err.code) {
        case err.PERMISSION_DENIED: msg = '❌ Permissão negada'; break;
        case err.POSITION_UNAVAILABLE: msg = '❌ Indisponível'; break;
        case err.TIMEOUT: msg = '⏱️ Tempo esgotado'; break;
      }
      if (status) status.textContent = msg;
      stopGpsTracking();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

/**
 * Para rastreamento GPS
 */
function stopGpsTracking() {
  if (state.gpsWatchId !== null) {
    navigator.geolocation.clearWatch(state.gpsWatchId);
    state.gpsWatchId = null;
  }
  const btn = document.getElementById('btn-gps-toggle');
  const status = document.getElementById('gps-status');
  if (btn) btn.textContent = '📍 Iniciar GPS do Celular';
  if (status) status.textContent = 'GPS parado';
}

/**
 * Alterna estado do GPS
 */
function toggleGps() {
  if (state.gpsWatchId === null) startGpsTracking();
  else stopGpsTracking();
}

/**
 * Carrega dados da API e atualiza a UI
 */
async function loadData() {
  try {
    // 1. Dados brutos CAN
    const canRes = await fetch(`${API_BASE}/api/can-data`);
    if (canRes.ok) {
      const data = await canRes.json();
      if (Array.isArray(data)) {
        state.canMessages = data.map(m => ({
          ...m,
          timestamp: m.timestamp && !isNaN(Date.parse(m.timestamp)) ? new Date(m.timestamp) : new Date()
        }));
        updateCanTable(state.canMessages);
      }
    }

    // 2. Dados decodificados do veículo
    const deviceRes = await fetch(`${API_BASE}/api/device`);
    if (deviceRes.ok) {
      const records = await deviceRes.json();
      if (Array.isArray(records)) {
        state.decodedMessages = records.map(r => ({
          ...r,
          timestamp: r.timestamp && !isNaN(Date.parse(r.timestamp)) ? new Date(r.timestamp) : new Date()
        }));

        // Atualiza cards com últimos valores
        const latest = extractLatestLiveData(state.decodedMessages);
        state.liveData = { ...state.liveData, ...latest };
        updateDashboardCards(state.liveData);

        // Atualiza tabela
        updateVehicleTable(state.decodedMessages.slice(0, 50)); // mostra últimos 50
      }
    }
  } catch (err) {
    console.error('❌ Erro ao carregar dados:', err);
    // Opcional: mostrar erro na UI
  }
}

/**
 * Inicia atualizações periódicas
 */
function startAutoUpdate() {
  loadData(); // primeira carga imediata
  return setInterval(loadData, UPDATE_INTERVAL_MS);
}

/**
 * Configura eventos de download CSV
 */
function setupDownloadButtons() {
  document.getElementById('btn-download-can')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/export-can-data-csv`;
  });

  document.getElementById('btn-download-vehicle')?.addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/export-vehicle-data-csv`;
  });
}

/**
 * Toggle de tema (claro/escuro)
 */
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // Carrega preferência salva
  const saved = localStorage.getItem('voltz-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    state.isDarkTheme = true;
  }

  btn.addEventListener('click', () => {
    state.isDarkTheme = !state.isDarkTheme;
    document.body.classList.toggle('dark', state.isDarkTheme);
    localStorage.setItem('voltz-theme', state.isDarkTheme ? 'dark' : 'light');
  });
}

/**
 * Inicialização geral
 */
function init() {
  // Configura botões
  document.getElementById('btn-gps-toggle')?.addEventListener('click', toggleGps);
  setupDownloadButtons();
  setupThemeToggle();

  // Inicia atualização automática
  const intervalId = startAutoUpdate();

  // Limpa intervalo ao fechar a página (opcional)
  window.addEventListener('beforeunload', () => {
    clearInterval(intervalId);
    stopGpsTracking();
  });

  console.log('✅ Dashboard Voltz inicializado');
}

// Inicia quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expõe funções para debug no console (opcional)
window.VoltzDashboard = {
  state,
  loadData,
  updateVehicleTable,
  updateDashboardCards,
  startGpsTracking,
  stopGpsTracking
};