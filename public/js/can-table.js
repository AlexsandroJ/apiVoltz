/**
 * ============================================
 * 📋 can-table.js - Tabela de Frames CAN
 * ============================================
 * Funções para renderização e atualização
 * da tabela de frames CAN brutos.
 * 
 * @module canTable
 * @requires ../config.js
 * @requires ../utils.js
 * @version 1.2.0
 */

import { UI } from './config.js';
import { formatTimestamp, formatTimeOnly } from './utils.js';

// ============================================================================
// === CACHE E UTILITÁRIOS INTERNOS ===
// ============================================================================

/**
 * Cache do último frame para evitar duplicatas visuais consecutivas
 * @private
 */
let _lastFrameHash = null;

/**
 * Gera hash simples para identificar frame único
 * @param {Object} frame - Objeto do frame CAN
 * @returns {string} Hash identificador
 */
function generateFrameHash(frame) {
  if (!frame) return '';
  const dataStr = Array.isArray(frame.data) 
    ? frame.data.join('') 
    : String(frame.data || '');
  return `${frame.timestamp || ''}-${frame.canId || ''}-${dataStr}`;
}

/**
 * Normaliza entrada para array de frames (tolerante a tipos)
 * @param {*} input - Pode ser array, objeto único, null, etc.
 * @returns {Array} Array de frames (pode ser vazio)
 * @private
 */
function normalizeFrames(input) {
  // ✅ Caso array: retorna cópia rasa filtrando inválidos
  if (Array.isArray(input)) {
    return input.filter(f => f && (f.canId !== undefined || f.id !== undefined));
  }
  
  // ✅ Caso null/undefined/string: retorna array vazio
  if (!input || typeof input !== 'object') {
    return [];
  }
  
  // ✅ Caso objeto com canId direto (formato padrão)
  if (input.canId !== undefined) {
    return [input];
  }
  
  // ✅ Caso objeto com 'id' em vez de 'canId' (variação comum)
  if (input.id !== undefined && input.data !== undefined) {
    return [{ ...input, canId: input.id }];
  }
  
  // ✅ Caso objeto com frame aninhado em 'frame', 'payload' ou 'data'
  const nested = input.frame || input.payload || input.data || input.body;
  if (nested && (nested.canId !== undefined || nested.id !== undefined)) {
    return normalizeFrames(nested); // Recursivo para múltiplos níveis
  }
  
  // ✅ Caso objeto com propriedades CAN mas nomes diferentes
  const canId = input.CAN_ID ?? input.can_id ?? input.CanId ?? input.id;
  const data = input.CAN_DATA ?? input.can_data ?? input.Data ?? input.data;
  
  if (canId !== undefined && data !== undefined) {
    return [{
      canId: Number(canId),
      data: Array.isArray(data) ? data : String(data),
      dlc: input.dlc ?? input.DLC ?? input.length ?? (Array.isArray(data) ? data.length : undefined),
      ide: input.ide ?? input.extended ?? false,
      timestamp: input.timestamp ?? input.ts ?? input.time ?? Date.now()
    }];
  }
  
  // ❌ Caso não reconhecido: log debug e retorna array vazio
  if (window.DEBUG_API) {
    console.warn('⚠️ normalizeFrames: objeto não reconhecido como frame CAN', {
      keys: Object.keys(input),
      hasCanId: input?.canId !== undefined,
      sample: JSON.stringify(input).slice(0, 200)
    });
  }
  
  return [];
}

/**
 * Cria elemento <tr> para um frame CAN
 * @param {Object} frame - Dados do frame: { timestamp, canId, data }
 * @returns {HTMLTableRowElement} Linha da tabela
 */
function createCanRow(frame) {
  const tr = document.createElement('tr');
  tr.classList.add('highlight');

  // Validação mínima do frame
  if (!frame) {
    tr.innerHTML = `<td colspan="3" class="error">Frame inválido</td>`;
    return tr;
  }

  // Formata ID CAN para hexadecimal maiúsculo com fallback
  const canId = frame.canId !== undefined ? frame.canId : 0;
  const canIdHex = `0x${canId.toString(16).toUpperCase()}`;

  // Formata dados: array numérico para string hex separada por espaço
  const dataDisplay = Array.isArray(frame.data)
    ? frame.data.map(b => {
        const num = typeof b === 'number' ? b : parseInt(b, 10) || 0;
        return num.toString(16).padStart(2, '0').toUpperCase();
      }).join(' ')
    : String(frame.data || '—');

  // Formata timestamp com fallback
  const ts = frame.timestamp ? formatTimestamp(frame.timestamp) : '—';

  tr.innerHTML = `
    <td class="timestamp" title="${frame.timestamp || ''}">${ts}</td>
    <td class="can-id" title="ID: ${canId} (0x${canId.toString(16)})">${canIdHex}</td>
    <td class="can-data" title="Dados brutos: ${dataDisplay}">${dataDisplay}</td>
  `;

  return tr;
}

// ============================================================================
// === FUNÇÕES PÚBLICAS ===
// ============================================================================

/**
 * Atualiza tabela CAN com lista de frames (batch update)
 * 
 * @param {HTMLElement} tbody - Elemento tbody da tabela
 * @param {*} messages - Array de frames OU frame único (será normalizado)
 * @param {boolean} prepend - Se adiciona no topo (true) ou substitui (false)
 * 
 * @example
 * // Array de frames:
 * updateCanTable(tbody, [{canId:288,data:[1,2,3]}, {canId:512,data:[4,5,6]}]);
 * 
 * // Frame único (também funciona):
 * updateCanTable(tbody, {canId:288, data:[1,2,3]});
 * 
 * // Resposta de API { data: [...] }:
 * updateCanTable(tbody, apiResponse.data);
 */
export function updateCanTable(tbody, messages, prepend = true) {
  // ✅ Validação do elemento DOM
  if (!tbody || !(tbody instanceof HTMLElement)) {
    console.warn('⚠️ updateCanTable: tbody inválido ou não fornecido');
    return;
  }

  // ✅ Normaliza entrada para array (tolerante a objeto único, null, {data: [...]}, etc.)
  const frames = normalizeFrames(messages);

  // 🔹 Caso: sem frames válidos
  if (frames.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="empty">Nenhum frame CAN recebido.</td>
      </tr>
    `;
    return;
  }

  try {
    // 🔹 Modo prepend: adiciona novos frames no topo, mantém antigos
    if (prepend) {
      frames.forEach(frame => {
        // Evita duplicatas consecutivas via hash
        const hash = generateFrameHash(frame);
        if (hash === _lastFrameHash) {
          // Frame duplicado, ignora para evitar repetição visual
          return;
        }
        _lastFrameHash = hash;

        // Cria e insere linha no topo da tabela
        const tr = createCanRow(frame);
        tbody.prepend(tr);

        // Remove classe highlight após animação CSS (fallback 500ms)
        setTimeout(() => tr.classList.remove('highlight'), UI?.HIGHLIGHT_DURATION || 500);
      });

      // 🔹 Limita número de linhas para performance (evita memory leak no DOM)
      const maxRows = UI?.MAX_CAN_ROWS || 100;
      while (tbody.children.length > maxRows) {
        tbody.removeChild(tbody.lastChild);
      }
    }
    // 🔹 Modo replace: substitui todo o conteúdo da tabela
    else {
      tbody.innerHTML = '';
      frames.forEach(frame => {
        const tr = createCanRow(frame);
        tbody.appendChild(tr);
        setTimeout(() => tr.classList.remove('highlight'), UI?.HIGHLIGHT_DURATION || 500);
      });
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar tabela CAN:', {
      message: error.message,
      stack: error.stack,
      framesCount: frames.length,
      prependMode: prepend
    });
    
    // Exibe erro amigável na tabela
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="error" style="color: #dc3545;">
          ⚠️ Erro ao renderizar: ${error.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Atualiza tabela com frame único em tempo real (via WebSocket ou evento)
 * 
 * @param {Object} frame - Frame CAN individual
 * @param {HTMLElement} [tbody] - Elemento tbody (opcional, busca por ID se não fornecido)
 * 
 * @example
 * // Via WebSocket:
 * ws.onmessage = (event) => {
 *   const frame = JSON.parse(event.data);
 *   updateCanTableRealtime(frame);
 * };
 */
export function updateCanTableRealtime(frame, tbody = null) {
  // Busca tbody pelo ID padrão se não fornecido
  const targetTbody = tbody || document.querySelector('#can-body');
  
  if (!targetTbody) {
    console.warn('⚠️ updateCanTableRealtime: tbody não encontrado');
    return;
  }

  // Remove mensagem "vazio" ou "erro" se existir
  const emptyRow = targetTbody.querySelector('.empty, .error');
  if (emptyRow) emptyRow.remove();

  // Cria e insere nova linha no topo
  const tr = createCanRow(frame);
  targetTbody.prepend(tr);
  
  // Animação de highlight
  setTimeout(() => tr.classList.remove('highlight'), UI?.HIGHLIGHT_DURATION || 500);

  // Mantém limite de linhas para performance
  const maxRows = UI?.MAX_CAN_ROWS || 100;
  while (targetTbody.children.length > maxRows) {
    targetTbody.removeChild(targetTbody.lastChild);
  }
}

/**
 * Limpa completamente a tabela CAN e exibe mensagem de espera
 * 
 * @param {HTMLElement} tbody - Elemento tbody
 * @param {string} emptyMessage - Mensagem para exibir quando vazio
 */
export function clearCanTable(tbody, emptyMessage = 'Aguardando frames...') {
  if (!tbody || !(tbody instanceof HTMLElement)) return;
  
  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="empty">${emptyMessage}</td>
    </tr>
  `;
  // Reseta cache de hash para evitar falsos positivos após limpeza
  _lastFrameHash = null;
}

/**
 * Exporta frames CAN como texto CSV formatado
 * 
 * @param {Array} frames - Lista de frames CAN
 * @param {Object} options - Opções de formatação
 * @param {string} options.separator - Separador de campos (padrão: ',')
 * @param {string} options.dataSeparator - Separador dos bytes de dados (padrão: ' ')
 * @returns {string} Texto CSV formatado com cabeçalho e linhas
 * 
 * @example
 * const csv = exportCanFramesAsCsv(frames, { separator: ';', dataSeparator: '-' });
 */
export function exportCanFramesAsCsv(frames, options = {}) {
  const { 
    separator = ',', 
    dataSeparator = ' ' 
  } = options;

  // Normaliza frames de entrada
  const data = normalizeFrames(frames);
  
  // Cabeçalho do CSV
  const headers = ['Timestamp', 'CAN_ID_Hex', 'Data_Hex', 'DLC'];
  
  // Linhas de dados
  const rows = data.map(f => {
    const timestamp = f.timestamp 
      ? new Date(f.timestamp).toISOString() 
      : '';
    
    const canIdHex = f.canId !== undefined 
      ? `0x${f.canId.toString(16).toUpperCase()}` 
      : '';
    
    const dataHex = Array.isArray(f.data)
      ? f.data.map(b => {
          const num = typeof b === 'number' ? b : parseInt(b, 10) || 0;
          return num.toString(16).padStart(2, '0').toUpperCase();
        }).join(dataSeparator)
      : String(f.data || '');
    
    const dlc = f.dlc !== undefined ? f.dlc : (Array.isArray(f.data) ? f.data.length : 0);
    
    return [timestamp, canIdHex, dataHex, dlc];
  });

  // Monta CSV final (com escaping de vírgulas nos campos)
  const escapeCsv = (val) => {
    const str = String(val);
    return str.includes(separator) || str.includes('"') 
      ? `"${str.replace(/"/g, '""')}"` 
      : str;
  };

  return [
    headers.join(separator),
    ...rows.map(row => row.map(escapeCsv).join(separator))
  ].join('\n');
}

/**
 * Filtra frames CAN por ID ou intervalo de tempo
 * 
 * @param {Array} frames - Lista de frames para filtrar
 * @param {Object} filters - Critérios de filtro
 * @param {number|number[]} filters.canId - ID único ou array de IDs para filtrar
 * @param {Date|string} filters.since - Timestamp mínimo (inclusive)
 * @param {Date|string} filters.until - Timestamp máximo (inclusive)
 * @returns {Array} Frames filtrados
 * 
 * @example
 * // Filtrar apenas frames do ID 288 (Bateria)
 * const batteryFrames = filterCanFrames(allFrames, { canId: 288 });
 * 
 * // Filtrar últimos 5 minutos
 * const recent = filterCanFrames(allFrames, { 
 *   since: new Date(Date.now() - 5*60*1000) 
 * });
 */
export function filterCanFrames(frames, filters = {}) {
  const data = normalizeFrames(frames);
  
  return data.filter(frame => {
    // Filtro por canId (suporta único ou array)
    if (filters.canId !== undefined) {
      const ids = Array.isArray(filters.canId) ? filters.canId : [filters.canId];
      if (!ids.includes(frame.canId)) return false;
    }
    
    // Filtro por timestamp mínimo
    if (filters.since !== undefined) {
      const frameTime = new Date(frame.timestamp || 0).getTime();
      const minTime = new Date(filters.since).getTime();
      if (frameTime < minTime) return false;
    }
    
    // Filtro por timestamp máximo
    if (filters.until !== undefined) {
      const frameTime = new Date(frame.timestamp || 0).getTime();
      const maxTime = new Date(filters.until).getTime();
      if (frameTime > maxTime) return false;
    }
    
    return true; // Passou em todos os filtros
  });
}

// ============================================================================
// === EXPORTAÇÕES ===
// ============================================================================

/**
 * Exportação padrão para compatibilidade com import default
 */
export default {
  updateCanTable,
  updateCanTableRealtime,
  clearCanTable,
  exportCanFramesAsCsv,
  filterCanFrames,
  // Funções utilitárias para testes/debug (não usar em produção)
  _utils: {
    normalizeFrames,
    generateFrameHash,
    createCanRow
  }
};

