// Elementos do DOM

// Dados BMS
const bmsCurrent = document.getElementById('bms-current');
const bmsVoltage = document.getElementById('bms-voltage');
const bmsSoc = document.getElementById('bms-soc');
const bmsSoH = document.getElementById('bms-soh');
const bmsTemp = document.getElementById('bms-temp');

// Dados Controller
const rpm = document.getElementById('rpm');
const torque = document.getElementById('torque');
const tempMotor = document.getElementById('temp-motor');
const tempBatt = document.getElementById('temp-batt');

const themeToggle = document.getElementById('theme-toggle');
const statusIndicatorServer = document.getElementById('status-indicator-server');
const statusIndicatorEsp = document.getElementById('status-indicator-esp');
const canBody = document.querySelector('#can-body');

// Adiciona evento ao botão
document.getElementById('download-can-data')?.addEventListener('click', downloadCanData);

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
    const response = await fetch('/api/decoded-can-data');
    const decodedFrames = await response.json();

    // Atualiza os elementos do DOM com os dados decodificados
    for (const frame of decodedFrames) {
      if (frame.source === 'battery') {
        // Aplicação do .toFixed(2) para os valores da bateria
        bmsCurrent.textContent = frame.decoded.current.toFixed(2);
        bmsVoltage.textContent = frame.decoded.voltage.toFixed(3);
        bmsSoc.textContent = frame.decoded.soc;
        bmsSoH.textContent = frame.decoded.soh;
        bmsTemp.textContent = frame.decoded.temperature;

      } else if (frame.source === 'motorController') {
        // Aplicação do .toFixed(2) para os valores do motor
        rpm.textContent = frame.decoded.motorSpeedRpm;
        torque.textContent = frame.decoded.motorTorque;
        tempMotor.textContent = frame.decoded.motorTemperature;
        tempBatt.textContent = frame.decoded.controllerTemperature;
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




function enviarLocalizacaoParaServidor(deviceId) {
  if (!navigator.geolocation) {
    alert("⚠️ Seu navegador não suporta geolocalização.");
    return;
  }

  // Opções de precisão e tempo limite
  const opcoes = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 30000
  };

  navigator.geolocation.getCurrentPosition(
    // ✅ Sucesso
    (posicao) => {
      const { latitude, longitude, accuracy } = posicao.coords;
      console.log("📍 Localização obtida:", latitude, longitude);

      // Envia para sua API
      fetch(`http://localhost:3000/api/device/${deviceId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now()
        })
      })
      .then(res => {
        if (res.ok) {
          console.log("✅ Localização enviada com sucesso!");
        } else {
          console.error("❌ Erro ao enviar para a API");
        }
      })
      .catch(err => {
        console.error("Erro de rede:", err);
      });
    },
    // ❌ Erro
    (erro) => {
      let mensagem = "";
      switch(erro.code) {
        case erro.PERMISSION_DENIED:
          mensagem = "Você negou o acesso à localização. Por favor, permita nas configurações do site.";
          break;
        case erro.POSITION_UNAVAILABLE:
          mensagem = "Não foi possível obter sua localização.";
          break;
        case erro.TIMEOUT:
          mensagem = "Tempo limite excedido. Tente novamente.";
          break;
        default:
          mensagem = "Erro desconhecido: " + erro.message;
      }
      console.error("❌", mensagem);
      alert("Erro de geolocalização:\n" + mensagem);
    },
    opcoes
  );
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

function downloadCanData() {
  // Cria um link temporário para download
  const link = document.createElement('a');
  link.href = '/api/export-can-data-csv'; // Endpoint que você criou
  link.download = `can-data-${Date.now()}.csv`; // Nome do arquivo
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
// setInterval(fetchRecentCanData, 500);
//setInterval(fetchDecodedCanData, 500);
