// Elementos do DOM

// Dados BMS
const bmsCurrent = document.getElementById('bms-current');
const bmsVoltage = document.getElementById('bms-voltage');
const bmsSoc = document.getElementById('bms-soc');
const bmsSoH = document.getElementById('bms-soh');
const bmsTemp = document.getElementById('bms-temp');

// Dados Controller
const modo = document.getElementById('modo');
const rpm = document.getElementById('rpm');
const torque = document.getElementById('torque');
const tempMotor = document.getElementById('temp-motor');
const tempBatt = document.getElementById('temp-batt');



const locationGps = document.getElementById('location');


const themeToggle = document.getElementById('theme-toggle');
const statusIndicatorServer = document.getElementById('status-indicator-server');
const statusIndicatorEsp = document.getElementById('status-indicator-esp');
const canBody = document.querySelector('#can-body');

// Adiciona evento ao botão
document.getElementById('download-can-data')?.addEventListener('click', downloadCanData);
document.getElementById('download-device-data')?.addEventListener('click', downloadDeviceData);

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
  location: null
};

// Mapa - Leaflet
let map;
let bikeMarker;
let lat, lon;

// Função para formatar o timestamp (ex: 14:30:25)
function formatTimestamp(date) {
  const d = new Date(date);
  return d.toLocaleTimeString(); // Formato HH:MM:SS
}

// Função para atualizar a tabela CAN a partir da API
function updateCanTableFromApi(messages) {
  canBody.innerHTML = '';
  for (let i = 0; i < messages.length; i++) {
    const element = messages[i];
    const tr = document.createElement('tr');
    tr.classList.add('highlight');
    tr.innerHTML = `
      <td>${formatTimestamp(element.timestamp)}</td>
      <td>0x${element.canId.toString(16).toUpperCase()}</td>
      <td>${Array.isArray(element.data) ? element.data.join(', ') : element.data}</td>
    `;
    canBody.appendChild(tr);
    setTimeout(() => tr.classList.remove('highlight'), 500);
  }
}

// No seu script.js
async function fetchDecodedCanData() {
  try {
    const response = await fetch('/api/device');
    const decodedFrames = await response.json();

    // Atualiza os elementos do DOM com os dados decodificados
    for (const frame of decodedFrames) {
      if (frame.battery) {
        // Aplicação do .toFixed(2) para os valores da bateria
        bmsCurrent.textContent = frame.battery.current.toFixed(2);
        bmsVoltage.textContent = frame.battery.voltage.toFixed(3);
        bmsSoc.textContent = frame.battery.soc;
        bmsSoH.textContent = frame.battery.soh;
        bmsTemp.textContent = frame.battery.temperature;

      } 
      
      if (frame.motor) {
        // Aplicação do .toFixed(2) para os valores do motor
        modo.textContent = frame.motor.modo;
        rpm.textContent = frame.motor.rpm;
        torque.textContent = frame.motor.torque;
        tempMotor.textContent = frame.motor.motorTemp;
        tempBatt.textContent = frame.motor.controlTemp;
      }

        if (frame.location) { 
          locationGps.textContent = frame.location.coordinates;
          updateMapPosition(frame.location.coordinates[1], frame.location.coordinates[0]);
        }
    }
  } catch (error) {
    console.error('Erro ao buscar dados decodificados:', error);
  }
}

async function fetchRecentCanData() {
  try {
    const response = await fetch('/api/can-data'); // Últimos 50 frames
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const canMessages = await response.json();

    if (!canMessages || canMessages.length === 0) {
      canBody.innerHTML = `
    <tr>
      <td colspan="3" class="empty">
        Nenhum frame CAN recebido.
      </td>
    </tr>
  `;
    } else {
      // Atualiza a tabela com os frames CAN recebidos
      updateCanTableFromApi(canMessages);
    }
  } catch (error) {
    console.error('Erro ao buscar dados CAN:', error);
    canBody.innerHTML = `
  <tr>
    <td colspan="3" class="empty" style="color: #f44336;">
      Falha na conexão com a API.
    </td>
  </tr>
`;
  }
}



// Inicializa o mapa
function initMap() {
  const initialCoords = [-8.055581, -34.951640];
  map = L.map('map').setView(initialCoords, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileSize: 512,
    zoomOffset: -1
  }).addTo(map);

  const bikeIcon = L.icon({
    iconUrl: 'https://www.jav.com.br/wp-content/uploads/2017/03/map-marker-icon.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  bikeMarker = L.marker(initialCoords, { icon: bikeIcon, title: 'Moto Voltz' }).addTo(map);
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

// === Controle de GPS do celular ===
const startGpsBtn = document.getElementById('start-gps-btn');
const gpsStatusEl = document.getElementById('gps-status');
let watchId = null; // ID do watcher de geolocalização contínua
const DEVICE_ID = 'esp32-moto-001'; // ⚠️ Ajuste conforme seu deviceId real

async function sendLocationToServer(lat, lon, accuracy) {
  try {
    const response = await fetch(`/api/device/${DEVICE_ID}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        accuracy: accuracy,
        timestamp: Date.now()
      })
    });

    if (response.ok) {
      console.log('✅ Localização enviada com sucesso');
      updateMapPosition(lat, lon); // Atualiza o marcador no mapa
      gpsStatusEl.textContent = `📍 Enviado: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } else {
      const errorText = await response.text();
      console.error('❌ Falha ao enviar localização:', errorText);
      gpsStatusEl.textContent = '❌ Erro ao enviar GPS';
    }
  } catch (error) {
    console.error('🌐 Erro de rede ao enviar GPS:', error);
    gpsStatusEl.textContent = '🌐 Sem conexão com o servidor';
  }
}

function handleGpsSuccess(position) {
  const { latitude, longitude, accuracy } = position.coords;
  gpsStatusEl.textContent = `📡 Recebido: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${accuracy}m)`;
  sendLocationToServer(latitude, longitude, accuracy);
}

function handleGpsError(error) {
  let message = '⚠️ GPS não disponível';
  switch (error.code) {
    case error.PERMISSION_DENIED:
      message = '❌ Permissão de localização negada';
      break;
    case error.POSITION_UNAVAILABLE:
      message = '❌ Localização indisponível';
      break;
    case error.TIMEOUT:
      message = '⏱️ Tempo limite excedido';
      break;
  }
  console.error('Erro de geolocalização:', message);
  gpsStatusEl.textContent = message;
  stopGpsTracking(); // Para tentativas futuras
}

function startGpsTracking() {
  if (!navigator.geolocation) {
    gpsStatusEl.textContent = '❌ Geolocalização não suportada';
    alert('Seu navegador não suporta geolocalização. Use um navegador moderno para acessar esta funcionalidade.');
    return;
  }

  // Desabilita o botão e muda o texto
  startGpsBtn.disabled = true;
  startGpsBtn.textContent = '📍 Parar GPS';

  gpsStatusEl.textContent = 'Aguardando localização...';

  // Solicita atualizações contínuas (não só uma vez)
  watchId = navigator.geolocation.watchPosition(
    handleGpsSuccess,
    handleGpsError,
    {
      enableHighAccuracy: true, // Usa GPS em vez de Wi-Fi/celular se possível
      timeout: 10000,           // 10 segundos para resposta
      maximumAge: 30000         // Aceita posição com até 30s de idade
    }
  );

  
}

function stopGpsTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  startGpsBtn.disabled = false;
  startGpsBtn.textContent = '📍 Iniciar GPS do Celular';
  gpsStatusEl.textContent = 'GPS parado';
}

// Alterna entre iniciar e parar
startGpsBtn?.addEventListener('click', () => {
  if (watchId === null) {
    startGpsTracking();
  } else {
    stopGpsTracking();
  }
});


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

function downloadCanData() {
  // Cria um link temporário para download
  const link = document.createElement('a');
  link.href = '/api/export-can-data-csv'; // Endpoint que você criou
  link.download = `can-data-${Date.now()}.csv`; // Nome do arquivo
  link.click(); // Clica no link programaticamente
}

function downloadDeviceData() {
  // Cria um link temporário para download
  const link = document.createElement('a');
  link.href = '/api/export-vehicle-data-csv'; // Endpoint que você criou
  link.download = `vehicle-data-${Date.now()}.csv`; // Nome do arquivo
  link.click(); // Clica no link programaticamente
}

// WebSocket
let ws = null;
const wsUrl = `ws://${window.location.hostname}:${window.location.port}`;

function connectWebSocket() {
  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔌 Dashboard Conectado WebSocket do servidor');
      statusIndicatorServer?.classList.add('online');
      ws.send("🔌 Dashboard Conectado ao WebSocket!");
    };

    ws.onmessage = (event) => {
      try {

        if (event.data.includes("ESP32 Conectado")) {
          statusIndicatorEsp?.classList.add('online');
          console.log(event.data);
          return;
        }

        if (event.data.includes("ESP32 Desconectado")) {
          statusIndicatorEsp?.classList.remove('online');
          console.log(event.data);
          return;
        }

        const data = JSON.parse(event.data);

        if (typeof data !== 'object' || data === null) {
          console.error('❌ Dados recebidos inválidos:', event.data);
          return;
        }

        //console.log('📩 Dashboard Dados recebidos via WebSocket:', data.type);

        // ✅ Processa dados decodificados recebidos do servidor
        if (data.type === 'battery') {
          const { current, voltage, soc, soh, temperature } = data.decoded; // ✅ Acesse data.decoded
          bmsCurrent.textContent = current.toFixed(2) !== undefined ? current.toFixed(2) : '--';
          bmsVoltage.textContent = voltage.toFixed(2) !== undefined ? voltage.toFixed(2) : '--';
          bmsSoc.textContent = soc !== undefined ? soc : '--';
          bmsSoH.textContent = soh !== undefined ? soh : '--';
          bmsTemp.textContent = temperature !== undefined ? temperature : '--';

        } else if (data.type === 'motorController') {
          const { motorSpeedRpm, motorTorque, motorTemperature, controllerTemperature } = data.decoded; // ✅ Acesse data.decoded
          rpm.textContent = motorSpeedRpm !== undefined ? motorSpeedRpm : '--';
          torque.textContent = motorTorque !== undefined ? motorTorque : '--';
          tempMotor.textContent = motorTemperature !== undefined ? motorTemperature : '--';
          tempBatt.textContent = controllerTemperature !== undefined ? controllerTemperature : '--';
          if (motorSpeedRpm != 0) {
            console.log("🚴‍♂️ Moto em movimento. Atualizando mapa...");
          }
        } else if (data.type === 'canFrame') {
          // ✅ Atualiza tabela CAN em tempo real com frames brutos recebidos

          const tr = document.createElement('tr');
          tr.classList.add('highlight');
          tr.innerHTML = `
    <td>${formatTimestamp(new Date())}</td> <!-- Timestamp -->
    <td>0x${data.canId.toString(16).toUpperCase()}</td> <!-- ID -->
    <td>${Array.isArray(data.data) ? data.data.join(', ') : data.data}</td> <!-- Dados -->
  `;
          canBody.prepend(tr); // Adiciona no topo
          //setTimeout(() => tr.classList.remove('highlight'), 1000);

          // Remove linhas antigas para não sobrecarregar a tabela
          if (canBody.children.length > 20) {
            canBody.removeChild(canBody.lastChild);
          }
        }

      } catch (error) {
        console.error('❌ Erro ao processar mensagem do WebSocket:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket desconectado');
      statusIndicatorServer?.classList.remove('online');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('❌ Erro no WebSocket:', error);
      statusIndicatorServer?.classList.remove('online');
    };
  } catch (error) {
    console.error('❌ Erro ao criar conexão WebSocket:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSavedTheme();
  initMap();
  connectWebSocket();
  fetchRecentCanData(); // Opcional: carregar dados iniciais da API
});

themeToggle?.addEventListener('click', toggleTheme);

// Opcional: atualizar dados CAN da API a cada 5 segundos
setInterval(fetchRecentCanData, 500);
setInterval(fetchDecodedCanData, 500);
setInterval(loadVehicleTable, 500);

const gpsBtn = document.getElementById('gps-btn');
const gpsLabel = document.getElementById('gps-label');

gpsBtn?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    gpsLabel.textContent = "❌ Navegador sem suporte";
    gpsLabel.style.color = "#f44336";
    return;
  }

  gpsLabel.textContent = "⏳ Buscando sinal...";
  gpsLabel.style.color = "#ff9800";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      gpsLabel.textContent = `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;
      gpsLabel.style.color = "#4CAF50";

      // Atualiza o mapa automaticamente (ajuste os nomes se forem diferentes no seu código)
      if (typeof mapa !== 'undefined' && typeof markerMoto !== 'undefined') {
        markerMoto.setLatLng([latitude, longitude]);
        mapa.setView([latitude, longitude], 16);
      }
    },
    (err) => {
      const erros = ["Permissão negada", "Sinal indisponível", "Timeout"];
      gpsLabel.textContent = `❌ ${erros[err.code-1] || "Erro desconhecido"}`;
      gpsLabel.style.color = "#f44336";
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
});











// vehicleTable.js
const API_BASE = 'http://localhost:3001';

// helpers.js

/**
 * Formata timestamp para pt-BR
 */
function formatTimestamp(ts) {
  if (!ts) return '—';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/**
 * Formata valor numérico com fallback para '—'
 */
function formatValue(val, decimals = 2) {
  if (val == null || val === '--') return '—';
  const num = Number(val);
  return isNaN(num) ? '—' : num.toFixed(decimals);
}

/**
 * Extrai e formata localização de um registro
 * Retorna: { display, lat, lon, title } ou null
 */
function formatLocation(record) {
  const coords = record.location?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lon, lat] = coords; // GeoJSON: [longitude, latitude]
    const latF = Number(lat).toFixed(6);
    const lonF = Number(lon).toFixed(6);
    return {
      display: `${latF}, ${lonF}`,
      lat: Number(lat),
      lon: Number(lon),
      title: `Lat: ${latF}, Lon: ${lonF}`
    };
  }
  return null;
}




/**
 * Busca dados da API e preenche a tabela de veículo
 * @param {string} apiUrl - Endpoint da API (ex: '/api/device')
 * @param {string} tbodyId - ID do tbody no HTML (padrão: 'vehicle-data-body')
 * @param {number} limit - Quantidade máxima de registros a exibir (padrão: 50)
 * @returns {Promise<Array>} - Retorna os registros carregados
 */
async function loadVehicleTable() {
  const tbody = document.getElementById('vehicle-data-body');
  if (!tbody) {
    console.error(`❌ Elemento com ID "vehicle-data-body" não encontrado.`);
    return [];
  }

  try {
    // 🔹 1. Busca os dados
    const response = await fetch('/api/device');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const records = await response.json();

    // 🔹 2. Valida e limita os registros
    const data = Array.isArray(records) ? records.slice(0, 50) : [];

    // 🔹 3. Caso vazio: exibe mensagem
    if (data.length === 0) {
      tbody.innerHTML = `
        <tr id="empty-row">
          <td colspan="10" class="empty">Nenhum dado de veículo recebido.</td>
        </tr>
      `;
      return [];
    }

    // 🔹 4. Remove linha "vazio" se existir
    const emptyRow = document.getElementById('empty-row');
    if (emptyRow) emptyRow.remove();

    // 🔹 5. Gera HTML das linhas (mais eficiente que append um por um)
    const rowsHTML = data.map(record => {
      const loc = formatLocation(record);
      const locationCell = loc 
        ? `<span title="${loc.title}">${loc.display}</span>` 
        : '—';

      return `
        <tr class="highlight" data-timestamp="${record.timestamp || ''}">
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

    // 🔹 6. Injeta tudo de uma vez (menos reflows no DOM)
    tbody.innerHTML = rowsHTML;

    return data;

  } catch (error) {
    console.error('❌ Erro ao carregar dados do veículo:', error);
    
    // 🔹 Exibe erro na tabela
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty" style="color: var(--danger, #dc3545);">
          ⚠️ Erro ao carregar: ${error.message}
        </td>
      </tr>
    `;
    
    return [];
  }
}

/**
 * Inicia atualização automática da tabela
 * @param {string} apiUrl - Endpoint da API
 * @param {number} intervalMs - Intervalo em ms (padrão: 2000)
 * @returns {Function} - Função para parar a atualização (clearInterval)
 */
function startVehicleTableAutoUpdate(apiUrl, intervalMs = 2000) {
  // Chama imediatamente
  loadVehicleTable(apiUrl);
  
  // Agenda repetição
  const intervalId = setInterval(() => {
    loadVehicleTable(apiUrl);
  }, intervalMs);

  console.log(`🔄 Atualização automática iniciada a cada ${intervalMs}ms`);
  
  // Retorna função para parar quando precisar
  return () => {
    clearInterval(intervalId);
    console.log('⏹️ Atualização automática parada');
  };
}









// gps

async function sendLocationToApi(lat, lon, accuracy) {
  try {
    const response = await fetch('/api/device/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        accuracy: accuracy,
        
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    console.log('✅ Localização enviada:', { lat, lon, accuracy });
    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar localização:', error);
    
    // Atualiza label com erro de envio (sem sobrescrever totalmente)
    if (gpsLabel) {
      const currentText = gpsLabel.textContent;
      gpsLabel.textContent = `${currentText} ⚠️ Envio falhou`;
      gpsLabel.style.color = "#ff9800"; // laranja para alerta
    }
    
    return false;
  }
}



let gpsWatchId = null; // Guarda o ID do watch para poder parar depois

/**
 * Inicia rastreamento contínuo de GPS
 */
function startGpsTracking() {
  if (!navigator.geolocation) {
    if (gpsLabel) {
      gpsLabel.textContent = "❌ Sem suporte";
      gpsLabel.style.color = "#f44336";
    }
    return;
  }

  if (gpsLabel) {
    gpsLabel.textContent = "📡 Rastreando...";
    gpsLabel.style.color = "#2196F3";
  }

  // Muda texto do botão para "Parar"
  if (gpsBtn) gpsBtn.textContent = "⏹️ Parar GPS";

  gpsWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      
      // Atualiza UI
      if (gpsLabel) {
        gpsLabel.textContent = `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;
        gpsLabel.style.color = "#4CAF50";
      }

      // Atualiza mapa
      if (typeof mapa !== 'undefined' && typeof markerMoto !== 'undefined') {
        markerMoto.setLatLng([latitude, longitude]);
        mapa.setView([latitude, longitude], 16);
      }

      // Envia para API (com debounce opcional para não sobrecarregar)
      await sendLocationToApi(latitude, longitude, accuracy);

    },
    (err) => {
      const erros = ["Permissão negada", "Sinal indisponível", "Timeout"];
      if (gpsLabel) {
        gpsLabel.textContent = `❌ ${erros[err.code - 1] || "Erro"}`;
        gpsLabel.style.color = "#f44336";
      }
      stopGpsTracking(); // Para ao dar erro
    },
    { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 30000 // Pode usar cache de até 30s para economizar bateria
    }
  );
}

/**
 * Para o rastreamento contínuo
 */
function stopGpsTracking() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (gpsLabel) {
    gpsLabel.textContent = "GPS parado";
    gpsLabel.style.color = "#666";
  }
  if (gpsBtn) gpsBtn.textContent = "📍 Iniciar GPS";
}

/**
 * Alterna entre iniciar/parar GPS
 */
function toggleGps() {
  if (gpsWatchId === null) {
    startGpsTracking();
  } else {
    stopGpsTracking();
  }
}

// === Atualiza o event listener para usar toggle ===
gpsBtn?.addEventListener('click', toggleGps);