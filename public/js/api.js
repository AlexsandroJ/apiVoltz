/**
 * ============================================
 * 🔌 api.js - Comunicação com Backend
 * ============================================
 * Funções para requisições HTTP à API REST
 * com tratamento de múltiplos formatos de resposta.
 * 
 * @module api
 * @version 2.1.0
 */

import { API } from './config.js';
import { formatValue, formatLocation, formatTimestamp } from './utils.js';

// ============================================================================
// === CACHE INTELIGENTE ===
// ============================================================================

const _cache = {
  deviceData: null,
  lastFetch: 0,
  TTL: 1000,  // 1 segundo
  lastError: null  // Armazena último erro para não cachear falhas
};

/**
 * Extrai array de dados de resposta da API (tolerante a múltiplos formatos)
 * @param {*} response - Resposta JSON da API
 * @returns {Array} Array de registros (pode ser vazio)
 * @private
 */
function extractDataArray(response) {
  // ✅ Caso 1: Resposta direta é array [ {...}, {...} ]
  if (Array.isArray(response)) {
    return response;
  }
  
  // ✅ Caso 2: Resposta é objeto com propriedade 'data' contendo array
  if (response && typeof response === 'object' && Array.isArray(response.data)) {
    return response.data;
  }
  
  // ✅ Caso 3: Resposta é objeto com propriedade 'records', 'items', 'results'
  if (response && typeof response === 'object') {
    const possibleArrays = ['data', 'records', 'items', 'results', 'telemetry'];
    for (const key of possibleArrays) {
      if (Array.isArray(response[key])) {
        return response[key];
      }
    }
  }
  
  // ❌ Caso não reconhecido: retorna array vazio
  if (window.DEBUG_API) {
    console.warn('⚠️ extractDataArray: formato de resposta não reconhecido', {
      type: typeof response,
      isArray: Array.isArray(response),
      keys: response ? Object.keys(response) : null,
      sample: JSON.stringify(response).slice(0, 200)
    });
  }
  return [];
}

// ============================================================================
// === FUNÇÕES PÚBLICAS ===
// ============================================================================

/**
 * Busca dados decodificados do dispositivo (BMS, motor, GPS, MPU-6050)
 * 
 * @param {boolean} useCache - Se pode usar dados em cache (padrão: true)
 * @returns {Promise<Array>} Lista de registros do dispositivo
 */
export async function fetchDecodedData(useCache = true) {
  const now = Date.now();
  
  // ✅ Cache: só retorna se tiver dados válidos E não houver erro recente
  if (useCache && 
      _cache.deviceData !== null && 
      _cache.lastError === null &&
      (now - _cache.lastFetch) < _cache.TTL) {
    
    if (window.DEBUG_API) {
      console.log('📦 [CACHE HIT] Returning cached data:', _cache.deviceData.length, 'records');
    }
    return _cache.deviceData;
  }
  
  try {
    if (window.DEBUG_API) {
      console.log('📡 [FETCH] Requesting:', API.DEVICE_DATA);
    }
    
    const response = await fetch(API.DEVICE_DATA);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const json = await response.json();
    
    if (window.DEBUG_API) {
      console.log('📦 [RESPONSE] Raw:', json);
      console.log('📦 [RESPONSE] Type:', Array.isArray(json) ? 'array' : typeof json);
      if (json?.data) {
        console.log('📦 [RESPONSE] data.data length:', Array.isArray(json.data) ? json.data.length : 'not array');
      }
    }
    
    // ✅ Extrai array independentemente do formato da resposta
    const dataArray = extractDataArray(json);
    
    if (window.DEBUG_API) {
      console.log('📦 [EXTRACTED] Array length:', dataArray.length);
    }
    
    // ✅ Atualiza cache APENAS se tiver dados válidos
    if (Array.isArray(dataArray)) {
      _cache.deviceData = dataArray;
      _cache.lastFetch = now;
      _cache.lastError = null;  // Limpa erro anterior
    }
    
    return dataArray;
    
  } catch (error) {
    // ✅ Marca erro no cache para forçar retry na próxima chamada
    _cache.lastError = error.message;
    _cache.lastFetch = 0;  // Invalida cache temporal
    
    console.error('❌ Failed to fetch decoded data:', {
      message: error.message,
      url: API.DEVICE_DATA,
      hint: 'Verify: 1) Backend running, 2) CORS configured, 3) Endpoint returns valid JSON'
    });
    
    // Retorna cache antigo se existir (fallback gracioso)
    if (_cache.deviceData && _cache.deviceData.length > 0) {
      console.warn('⚠️ Using stale cache due to fetch error');
      return _cache.deviceData;
    }
    
    throw error;
  }
}

/**
 * Busca frames CAN brutos recentes
 */
export async function fetchCanFrames(limit = 50) {
  try {
    const safeLimit = Math.min(parseInt(limit) || 50, 1000);
    const url = `${API.CAN_DATA}?limit=${safeLimit}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const json = await response.json();
    
    // Tolerante a múltiplos formatos (mesma lógica de extractDataArray)
    if (Array.isArray(json)) return json;
    if (json?.data && Array.isArray(json.data)) return json.data;
    
    return json?.data || json || [];
    
  } catch (error) {
    console.error('❌ Failed to fetch CAN frames:', error.message);
    throw error;
  }
}

/**
 * Envia coordenadas GPS para o servidor
 */
export async function sendLocationToApi(coords, deviceId) {
  if (!coords?.latitude || !coords?.longitude) {
    console.warn('⚠️ Invalid coordinates:', coords);
    return false;
  }

  try {
    const payload = {
      location: {
        type: "Point",
        coordinates: [parseFloat(coords.longitude), parseFloat(coords.latitude)]
      },
      latitude: parseFloat(coords.latitude),
      longitude: parseFloat(coords.longitude),
      accuracy: coords.accuracy ? parseFloat(coords.accuracy) : undefined,
      speed: coords.speed ? parseFloat(coords.speed) : undefined,
      altitude: coords.altitude ? parseFloat(coords.altitude) : undefined,
      altitudeAccuracy: coords.altitudeAccuracy ? parseFloat(coords.altitudeAccuracy) : undefined,
      heading: coords.heading ? parseFloat(coords.heading) : undefined,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(API.LOCATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    return true;

  } catch (error) {
    console.error('❌ Failed to send location:', error.message);
    return false;
  }
}

/**
 * Carrega e renderiza tabela de dados do veículo
 */
export async function loadVehicleTable(tbody, maxRows = 20) {
  try {
    if (window.DEBUG_API) {
      console.log('📊 [TABLE] Loading vehicle table...', { tbody: !!tbody, maxRows });
    }
    
    if (!tbody || !(tbody instanceof HTMLElement)) {
      console.warn('⚠️ loadVehicleTable: tbody inválido');
      return [];
    }
    
    // 🔹 1. Busca dados da API
    const records = await fetchDecodedData();
    
    if (window.DEBUG_API) {
      console.log('📊 [TABLE] Records received:', {
        count: Array.isArray(records) ? records.length : 'not array',
        type: typeof records,
        first: Array.isArray(records) && records[0] ? Object.keys(records[0]) : null
      });
    }
    
    // 🔹 2. Valida e limita registros
    const data = Array.isArray(records) ? records.slice(0, maxRows) : [];
    
    // 🔹 3. Caso vazio: exibe mensagem
    if (data.length === 0) {
      tbody.innerHTML = `
        <tr id="empty-row">
          <td colspan="21" class="empty">
            ⏳ Aguardando dados do veículo...<br>
            <small style="color: #666; display: block; margin-top: 8px;">
              ${records === null ? 'Erro de conexão' : 'Nenhum registro no banco'}
            </small>
          </td>
        </tr>
      `;
      return [];
    }
    
    // 🔹 4. Remove linha "vazio" se existir
    const emptyRow = tbody.querySelector('#empty-row');
    if (emptyRow) emptyRow.remove();

    // 🔹 5. Gera HTML das linhas
    const rowsHTML = data.map(record => {
      const loc = formatLocation(record);
      const locationCell = loc 
        ? `<span title="${loc.title}" class="location">${loc.display}</span>` 
        : '<span class="empty">—</span>';

      // Destaque visual para SoC crítico
      const soc = record.battery?.soc;
      const socClass = soc < 20 ? 'critical' : soc < 40 ? 'warning' : '';

      return `
        <tr class="data-row ${socClass}" data-timestamp="${record.timestamp || ''}">
          <!-- Dados básicos / CAN -->
          <td class="timestamp">${formatTimestamp(record.timestamp)}</td>
          <td>${record.motor?.modo ?? '—'}</td>
          <td>${formatValue(record.motor?.rpm)}</td>
          <td>${formatValue(record.motor?.torque)}</td>
          <td class="${socClass}">${formatValue(record.battery?.soc)}%</td>
          <td>${formatValue(record.motor?.motorTemp)}°C</td>
          <td>${formatValue(record.battery?.temperature)}°C</td>
          <td>${formatValue(record.battery?.voltage, 3)}V</td>
          <td>${formatValue(record.battery?.current)}A</td>
          
          <!-- Dados de localização (GPS) -->
          <td>${locationCell}</td>
          <td>${formatValue(record.accuracy)}m</td>
          <td>${formatValue(record.speed)}m/s</td>
          <td>${formatValue(record.altitude)}m</td>
          <td>${formatValue(record.altitudeAccuracy)}m</td>
          <td>${formatValue(record.heading)}°</td>
          
          <!-- === Dados do MPU-6050 (IMU) === -->
          <td title="Acc X">${formatValue(record.accelerometer?.ax_g, 3)}g</td>
          <td title="Acc Y">${formatValue(record.accelerometer?.ay_g, 3)}g</td>
          <td title="Acc Z">${formatValue(record.accelerometer?.az_g, 3)}g</td>
          <td title="Giro X">${formatValue(record.gyroscope?.gx_dps, 2)}°/s</td>
          <td title="Giro Y">${formatValue(record.gyroscope?.gy_dps, 2)}°/s</td>
          <td title="Giro Z">${formatValue(record.gyroscope?.gz_dps, 2)}°/s</td>
        </tr>
      `;
    }).join('');

    // 🔹 6. Injeta tudo de uma vez
    tbody.innerHTML = rowsHTML;

    // 🔹 7. Remove highlight após animação
    setTimeout(() => {
      tbody.querySelectorAll('.highlight')?.forEach(tr => 
        tr.classList.remove('highlight')
      );
    }, 500);

    if (window.DEBUG_API) {
      console.log(`📊 [TABLE] Rendered ${data.length} rows`);
    }
    
    return data;

  } catch (error) {
    console.error('❌ Failed to load vehicle table:', error);
    
    tbody.innerHTML = `
      <tr>
        <td colspan="21" class="empty error">
          ⚠️ Erro ao carregar dados<br>
          <small style="display: block; margin: 8px 0; color: #666;">
            ${error.message}
          </small>
          <button onclick="window.location.reload()" class="retry-btn">
            🔄 Tentar novamente
          </button>
        </td>
      </tr>
    `;
    
    return [];
  }
}

/**
 * Inicia download de arquivo CSV
 */
export function downloadCsv(endpoint, filename) {
  try {
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${API.BASE || ''}${endpoint}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${Date.now()}.csv`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📥 Download iniciado: ${filename}`);
    return true;
    
  } catch (error) {
    console.error('❌ Failed to start download:', error);
    alert(`Erro ao iniciar download: ${error.message}`);
    return false;
  }
}

/**
 * Limpa cache forçadamente (útil para debug)
 */
export function clearApiCache() {
  _cache.deviceData = null;
  _cache.lastFetch = 0;
  _cache.lastError = null;
  if (window.DEBUG_API) {
    console.log('🗑️ API cache cleared');
  }
}

// ============================================================================
// === EXPORTAÇÕES ===
// ============================================================================

export default {
  fetchDecodedData,
  fetchCanFrames,
  sendLocationToApi,
  loadVehicleTable,
  downloadCsv,
  clearApiCache,
  // Debug utilities
  _debug: {
    cache: _cache,
    extractDataArray
  }
};

