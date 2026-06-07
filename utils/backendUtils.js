/**
 * ============================================
 * 🛠️ src/utils/backendUtils.js - Utilitários do Backend
 * ============================================
 * @note Este arquivo usa CommonJS para compatibilidade com Node.js
 */

/**
 * Formata um timestamp para o formato pt-BR
 * @param {string|number|Date} ts - Timestamp
 * @returns {string} Data formatada ou '—'
 */
function formatTimestamp(ts) {
  if (!ts) return '—';
  
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '—';
  
  // Usa replace com regex para compatibilidade com Node.js < 15
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 3
  }).replace(/,/g, '.');
}

/**
 * Formata valor numérico com fallback
 */
function formatValue(val, decimals = 2) {
  if (val == null || val === '--' || val === '') return '—';
  const num = Number(val);
  return isNaN(num) ? '—' : num.toFixed(decimals);
}

/**
 * Formata coordenadas GeoJSON para exibição
 */
function formatLocation(record) {
  const coords = record?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  
  const [lon, lat] = coords;
  return {
    display: `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`,
    lat: Number(lat),
    lon: Number(lon)
  };
}

// ✅ Exportação CommonJS para Node.js
module.exports = {
  formatTimestamp,
  formatValue,
  formatLocation
};