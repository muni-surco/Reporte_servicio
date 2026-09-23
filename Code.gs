const APP_CONFIG = {
  SHEETS: {
    settings: 'SHIFT_SETTINGS',
    unitData: 'UNIT_DATA',
    referenceData: 'DATA',
    retenLog: 'RETEN_LOG',
  },
  EXTERNAL_PERSONNEL_SPREADSHEET_ID: '15Dd7IPUmG-HxK9S0QZefNov0sOVhaHgFSPrBC4WXROQ',
  MOBILE_DATA_SPREADSHEET_ID: '11j6Ipd3J6HjUnG91RCliCbjrgzJWhzUwktCgfnAESKU',
  VEHICLE_RQ_SPREADSHEET_ID: '1ZdHMyeGTrz6ylAhP3J-h3coTmN0w6w_KrDOFQo-T75k',
  WANTED_SPREADSHEET_ID: '1EWiRDCUbHEFuEPqG-z1AFhCWlY8aL1AaHKTKKohbs0o',
  FUEL_SPREADSHEET_ID: '1AxxSBf_KdCHjtGPxWmb10QMPAoAvpXGaAVI6d_-zcHM',
  WANTED_DRIVE_FOLDER_ID: '1faER1P0Pq7DaDmmeanw34WO6HPHa4L_d',
};

const SHIFT_HOURS = {
  MAÑANA: { start: 6.5, end: 14.5 },
  TARDE:  { start: 14.5, end: 22.5 },
  NOCHE:  { start: 22.5, end: 6.5 },
};

function cellToStr(val, tz) {
  if (val instanceof Date) {
    return tz ? Utilities.formatDate(val, tz, 'yyyy-MM-dd HH:mm') : String(val);
  }
  return String(val || '');
}

function getExternalPersonnelSpreadsheet() {
  return SpreadsheetApp.openById(APP_CONFIG.EXTERNAL_PERSONNEL_SPREADSHEET_ID);
}

function normalizeSectorValue(value) {
  return String(value || '').trim().toUpperCase();
}

function toStorageSector(value) {
  const normalized = normalizeSectorValue(value);
  if (!normalized) return '';
  if (normalized === 'RESCATE' || normalized === 'GIR') return normalized;
  // Handle cases like "SECTOR 1A" -> "1A"
  const cleaned = normalized.replace(/^SECTOR\s+/, '');
  // OTRAS AREAS uses underscore in storage to avoid spaces in RTDB keys
  if (cleaned === 'OTRAS AREAS') return 'OTRAS_AREAS';
  return cleaned;
}

function getUnitType(id, typeFromSheet, sector) {
  if (typeFromSheet) {
    const t = String(typeFromSheet).toUpperCase().trim();
    if (t.includes('MOTO')) return 'MOTO';
    if (t.includes('SERENO')) return 'SERENO';
    if (t.includes('CHOFER') || t.includes('MOVIL') || t.includes('VEHICULO')) return 'CHOFER';
  }

  // Si el sector es C4 o COVV, por defecto son SERENOS
  const s = toStorageSector(sector);
  if (s === 'C4' || s === 'COVV') return 'SERENO';

  const upperId = String(id || '').toUpperCase();
  if (upperId.startsWith('H') || upperId.startsWith('A-G')) return 'MOTO';
  // La lógica de prefijo 'S' ha sido eliminada por solicitud del usuario
  return 'CHOFER';
}

function toDisplaySector(value) {
  const stored = toStorageSector(value);
  // OTRAS_AREAS is stored with underscore; display uses space
  if (stored === 'OTRAS_AREAS') return 'OTRAS AREAS';
  return stored;
}

// Virtual sectors have a storage key that never existed in the legacy UNIT_DATA
// sheet (defaults come from the DATA sheet / RTDB). For them, the full-sheet
// fallback is guaranteed to find nothing, so it must be skipped to avoid slow scans.
function _isVirtualSector(storageSector) {
  return storageSector === 'OTRAS_AREAS';
}

// CacheService values are limited to 100KB. Full-shift payloads can exceed it,
// so cache writes must never throw (a throw would fail the whole backend call).
function _cachePutSafe(cache, key, value, ttlSeconds) {
  try {
    cache.put(key, value, ttlSeconds);
  } catch (e) {
    console.warn('[_cachePutSafe] skip cache for ' + key + ': ' + e);
  }
}

/**
 * INITIAL SETUP: Creates the database structure for historical persistence.
 * Run this function once from the GAS editor.
 */
function initialSetup() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  
  // 1. Setup SHIFT_SETTINGS (Operator, Supervisor per Shift/Date)
  let settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(APP_CONFIG.SHEETS.settings);
  }
  settingsSheet.clear();
  const settingsHeaders = ['FECHA', 'TURNO', 'SECTOR', 'OPERADOR', 'SUPERVISOR', 'PERMANENCIA', 'SUP_TASER', 'SUP_BODYCAM', 'SUP_COD_TASER', 'SUP_COD_BODYCAM', 'PERM_TASER', 'PERM_BODYCAM', 'PERM_COD_TASER', 'PERM_COD_BODYCAM', 'SUP_ESTADO', 'SUP_RADIO', 'SUP_ENCARGADO', 'PERM_ESTADO', 'PERM_RADIO', 'PERM_ENCARGADO', 'SUP_MOTIVO', 'PERM_MOTIVO'];
  settingsSheet.getRange(1, 1, 1, settingsHeaders.length)
               .setValues([settingsHeaders])
               .setFontWeight('bold')
               .setBackground('#d9ead3');
  settingsSheet.setFrozenRows(1);

  // 2. Setup UNIT_DATA (The actual unit records per Shift/Date)
  let dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(APP_CONFIG.SHEETS.unitData);
  }
  dataSheet.clear();
  const dataHeaders = [
    'FECHA', 'TURNO', 'SECTOR', 'ID', 'TIPO', 'MODELO', 'PERSONAL_1', 'PERSONAL_2', 
    'PLACA', 'INDICATIVO', 'RADIO', 'ESTADO', 'MOTIVO', 
    'KM_INICIO', 'KM_FIN', 'TOTAL_KM', 'KM_RECARGA', 'HORARIO', 'COMBUSTIBLE', 'GASTO', 'PARTES', 'CUADRANTE', 'MECANICA_OBS', 'UNIT_ID',
    'LUGAR_ESTADO', 'MOTIVO_ESTADO', 'AUDIT_LOG',
    'TASER', 'BODYCAM', 'CODIGO_BODYCAM', 'OBS_BODYCAM', 'CODIGO_TASER', 'COMBUSTIBLE_2', 'GASTO_2'
  ];
  dataSheet.getRange(1, 1, 1, dataHeaders.length)
           .setValues([dataHeaders])
           .setFontWeight('bold')
           .setBackground('#cfe2f3');
  dataSheet.setFrozenRows(1);

  // 3. Setup RETEN_LOG
  setupRetenLogSheet(ss);

  SpreadsheetApp.getUi().alert(
    `Estructura de base de datos creada exitosamente. Las hojas ${APP_CONFIG.SHEETS.settings}, ${APP_CONFIG.SHEETS.unitData} y ${APP_CONFIG.SHEETS.retenLog} están listas.`
  );
}

/**
 * Setup RETEN_LOG sheet
 */
function setupRetenLogSheet(ss) {
  let retenSheet = ss.getSheetByName(APP_CONFIG.SHEETS.retenLog);
  if (!retenSheet) {
    retenSheet = ss.insertSheet(APP_CONFIG.SHEETS.retenLog);
  }
  retenSheet.clear();
  const retenHeaders = ['FECHA', 'TURNO', 'UNIDAD_RETEN', 'PLACA_RETEN', 'UNIDAD_REEMPLAZADA', 'PLACA', 'MOTIVO', 'HORA'];
  retenSheet.getRange(1, 1, 1, retenHeaders.length)
            .setValues([retenHeaders])
            .setFontWeight('bold')
            .setBackground('#fff2cc');
  retenSheet.setFrozenRows(1);
}

/**
 * Fetches all units and settings for a specific date, shift and sector.
 * Optimized to read only necessary columns for better performance.
 */
/**
 * Try reading settings from Firebase. Falls back to sheet for legacy data.
 */
function _loadSettings(dateStr, shift, sector, timeZone) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'SETTINGS_' + dateStr + '_' + shift;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const allSectorSettings = parsed.allSettings;
      const sectorDisplay = toDisplaySector(sector || '1A');
      const shiftSettings = allSectorSettings[sectorDisplay] || { turno: shift, operador: '', supervisor: '', supervisorRol: 'SUPERVISOR', nombrePuesto: sectorDisplay, permanencia: '', supervisorTaser: '', supervisorBodycam: '', supervisorCodigoTaser: '', supervisorCodigoBodycam: '', supervisorEstado: '', supervisorRadio: '', supervisorEncargado: '', permanenciaTaser: '', permanenciaBodycam: '', permanenciaCodigoTaser: '', permanenciaCodigoBodycam: '', permanenciaEstado: '', permanenciaRadio: '', permanenciaEncargado: '', supervisorMotivo: '', permanenciaMotivo: '' };
      return { settings: shiftSettings, allSettings: allSectorSettings, from: 'cache' };
    } catch (e) { /* invalid cache, fall through */ }
  }

  let shiftSettings = { turno: shift, operador: '', supervisor: '', supervisorRol: 'SUPERVISOR', nombrePuesto: toDisplaySector(sector || '1A'), permanencia: '', supervisorTaser: '', supervisorBodycam: '', supervisorCodigoTaser: '', supervisorCodigoBodycam: '', supervisorEstado: '', supervisorRadio: '', supervisorEncargado: '', permanenciaTaser: '', permanenciaBodycam: '', permanenciaCodigoTaser: '', permanenciaCodigoBodycam: '', permanenciaEstado: '', permanenciaRadio: '', permanenciaEncargado: '', supervisorMotivo: '', permanenciaMotivo: '' };
  const allSectorSettings = {};

  try {
    const rtdbData = rtdbGet('shifts/' + dateStr + '_' + shift);
    if (rtdbData) {
      const fbSettings = Object.entries(rtdbData).map(([sectorKey, val]) => ({ sector: sectorKey, ...val }));
      fbSettings.forEach(s => {
        const sectorName = toDisplaySector(s.sector);
        if (sectorName) {
          allSectorSettings[sectorName] = { turno: s.shift || shift, operador: String(s.operador || ''), supervisor: String(s.supervisor || ''), supervisorRol: String(s.supervisorRol || 'SUPERVISOR'), nombrePuesto: sectorName, permanencia: String(s.permanencia || ''), supervisorTaser: String(s.supervisorTaser || ''), supervisorBodycam: String(s.supervisorBodycam || ''), supervisorCodigoTaser: String(s.supervisorCodigoTaser || ''), supervisorCodigoBodycam: String(s.supervisorCodigoBodycam || ''), supervisorEstado: String(s.supervisorEstado || ''), supervisorRadio: String(s.supervisorRadio || ''), supervisorEncargado: String(s.supervisorEncargado || ''), supervisorMotivo: String(s.supervisorMotivo || ''), permanenciaTaser: String(s.permanenciaTaser || ''), permanenciaBodycam: String(s.permanenciaBodycam || ''), permanenciaCodigoTaser: String(s.permanenciaCodigoTaser || ''), permanenciaCodigoBodycam: String(s.permanenciaCodigoBodycam || ''), permanenciaEstado: String(s.permanenciaEstado || ''), permanenciaRadio: String(s.permanenciaRadio || ''), permanenciaEncargado: String(s.permanenciaEncargado || ''), permanenciaMotivo: String(s.permanenciaMotivo || '') };
        }
        if (toStorageSector(sectorName) === toStorageSector(sector)) {
          shiftSettings = { turno: s.shift || shift, operador: String(s.operador || ''), supervisor: String(s.supervisor || ''), supervisorRol: String(s.supervisorRol || 'SUPERVISOR'), nombrePuesto: sectorName, permanencia: String(s.permanencia || ''), supervisorTaser: String(s.supervisorTaser || ''), supervisorBodycam: String(s.supervisorBodycam || ''), supervisorCodigoTaser: String(s.supervisorCodigoTaser || ''), supervisorCodigoBodycam: String(s.supervisorCodigoBodycam || ''), supervisorEstado: String(s.supervisorEstado || ''), supervisorRadio: String(s.supervisorRadio || ''), supervisorEncargado: String(s.supervisorEncargado || ''), supervisorMotivo: String(s.supervisorMotivo || ''), permanenciaTaser: String(s.permanenciaTaser || ''), permanenciaBodycam: String(s.permanenciaBodycam || ''), permanenciaCodigoTaser: String(s.permanenciaCodigoTaser || ''), permanenciaCodigoBodycam: String(s.permanenciaCodigoBodycam || ''), permanenciaEstado: String(s.permanenciaEstado || ''), permanenciaRadio: String(s.permanenciaRadio || ''), permanenciaEncargado: String(s.permanenciaEncargado || ''), permanenciaMotivo: String(s.permanenciaMotivo || '') };
        }
      });
      cache.put(cacheKey, JSON.stringify({ allSettings: allSectorSettings }), 300);
      return { settings: shiftSettings, allSettings: allSectorSettings, from: 'rtdb' };
    }
  } catch (e) { /* fallback */ }

  // Fallback: legacy sheet
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (settingsSheet) {
    const sLastRow = settingsSheet.getLastRow();
    const settingsRows = sLastRow > 1 ? settingsSheet.getRange(2, 1, sLastRow - 1, 22).getValues() : [];
    for (let i = 0; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      if (!row[0]) continue;
      try {
        const rowDateStr = Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd');
        if (rowDateStr !== dateStr || String(row[1]) !== shift) continue;
      } catch (e) { continue; }
      const sectorName = toDisplaySector(row[2]);
      if (sectorName) {
        allSectorSettings[sectorName] = { turno: String(row[1] || ''), operador: String(row[3] || ''), supervisor: String(row[4] || ''), supervisorRol: 'SUPERVISOR', nombrePuesto: sectorName, permanencia: String(row[5] || ''), supervisorTaser: String(row[6] || ''), supervisorBodycam: String(row[7] || ''), supervisorCodigoTaser: String(row[8] || ''), supervisorCodigoBodycam: String(row[9] || ''), supervisorEstado: String(row[14] || ''), supervisorRadio: String(row[15] || ''), supervisorEncargado: String(row[16] || ''), supervisorMotivo: String(row[20] || ''), permanenciaTaser: String(row[10] || ''), permanenciaBodycam: String(row[11] || ''), permanenciaCodigoTaser: String(row[12] || ''), permanenciaCodigoBodycam: String(row[13] || ''), permanenciaEstado: String(row[17] || ''), permanenciaRadio: String(row[18] || ''), permanenciaEncargado: String(row[19] || ''), permanenciaMotivo: String(row[21] || '') };
      }
      if (toStorageSector(sectorName) === toStorageSector(sector)) {
        shiftSettings = { turno: String(row[1] || ''), operador: String(row[3] || ''), supervisor: String(row[4] || ''), supervisorRol: 'SUPERVISOR', nombrePuesto: sectorName, permanencia: String(row[5] || ''), supervisorTaser: String(row[6] || ''), supervisorBodycam: String(row[7] || ''), supervisorCodigoTaser: String(row[8] || ''), supervisorCodigoBodycam: String(row[9] || ''), supervisorEstado: String(row[14] || ''), supervisorRadio: String(row[15] || ''), supervisorEncargado: String(row[16] || ''), supervisorMotivo: String(row[20] || ''), permanenciaTaser: String(row[10] || ''), permanenciaBodycam: String(row[11] || ''), permanenciaCodigoTaser: String(row[12] || ''), permanenciaCodigoBodycam: String(row[13] || ''), permanenciaEstado: String(row[17] || ''), permanenciaRadio: String(row[18] || ''), permanenciaEncargado: String(row[19] || ''), permanenciaMotivo: String(row[21] || '') };
      }
    }
  }
  cache.put(cacheKey, JSON.stringify({ allSettings: allSectorSettings }), 300);
  return { settings: shiftSettings, allSettings: allSectorSettings, from: 'sheet' };
}

/**
 * Convert a Firestore unit doc (or sheet row) to the frontend UnitData format.
 */
function _toUnitData(obj) {
  return {
    id: String(obj.id || ''),
    unit_id: String(obj.unit_id || ''),
    sector: toDisplaySector(obj.sector || ''),
    type: String(obj.type || ''),
    model: String(obj.model || ''),
    personnel1: String(obj.personnel1 || ''),
    personnel2: String(obj.personnel2 || ''),
    plate: String(obj.plate || ''),
    indicative: String(obj.indicative || ''),
    radio: String(obj.radio || ''),
    status: String(obj.status || ''),
    reason: String(obj.reason || ''),
    kmStart: String(obj.kmStart || '0'),
    kmEnd: String(obj.kmEnd || '0'),
    totalKm: String(obj.totalKm || '0'),
    kmRecarga: String(obj.kmRecarga || '0'),
    hours: String(obj.hours || ''),
    fuel: String(obj.fuel || '-- / --'),
    expense: String(obj.expense || 'S/ 0.00'),
    fuel2: String(obj.fuel2 || obj.combustible2 || obj.COMBUSTIBLE_2 || ''),
    expense2: String(obj.expense2 || obj.gasto2 || obj.GASTO_2 || ''),
    quadrant: String(obj.quadrant || ''),
    mechanics: String(obj.mechanics || ''),
    lugarEstado: String(obj.lugarEstado || ''),
    motivoEstado: String(obj.motivoEstado || ''),
    taser: String(obj.taser || ''),
    bodycam: String(obj.bodycam || ''),
    codigoBodycam: String(obj.codigoBodycam || ''),
    obsBodycam: String(obj.obsBodycam || ''),
    codigoTaser: String(obj.codigoTaser || '')
  };
}

function getShiftData(dateStr, shift, sector, lastShiftTimestamp) {
  try {
    console.log('[getShiftData] START — dateStr=' + dateStr + ' shift=' + shift);
    
    // 0. Conditional Check
    const meta = rtdbGet('_meta/units/' + dateStr + '_' + shift);
    if (lastShiftTimestamp && meta && meta.updatedAt === lastShiftTimestamp) {
      return { noChanges: true };
    }

    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const timeZone = ss.getSpreadsheetTimeZone();

    // 1. Settings
    const settingsResult = _loadSettings(dateStr, shift, sector, timeZone);
    const shiftSettings = settingsResult.settings;
    const allSectorSettings = settingsResult.allSettings;

    // 2. Units — try cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'UNITS_' + dateStr + '_' + shift;
    const cached = cache.get(cacheKey);
    if (cached && !lastShiftTimestamp) {
      try {
        const allUnits = JSON.parse(cached);
        console.log('[getShiftData] CACHE HIT — units=' + allUnits.length);
        _fbLogUsage();
        return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits, updatedAt: meta ? meta.updatedAt : null };
      } catch (e) { /* invalid cache, fall through */ }
    }

    // 3. Units — try RTDB
    let allUnits = [];
    let fromFirebase = false;
    try {
      const rtdbData = rtdbGet('units/' + dateStr + '_' + shift);
      if (rtdbData) {
        const fbUnits = [];
        Object.values(rtdbData).forEach(val => {
          if (val && typeof val === 'object') {
            if (val.id !== undefined) {
              fbUnits.push(val);
            } else {
              Object.values(val).forEach(u => {
                if (u && typeof u === 'object') fbUnits.push(u);
              });
            }
          }
        });
        allUnits = fbUnits.map(u => _toUnitData(u));
        fromFirebase = true;
      }
    } catch (e) { /* fallback */ }

    allUnits = _inheritLockedStatuses(allUnits, dateStr, shift, null, timeZone);
    _cachePutSafe(cache, cacheKey, JSON.stringify(allUnits), 60);
    console.log('[getShiftData] OK — units=' + allUnits.length + ' src=' + (fromFirebase ? 'firebase' : 'empty'));
    _fbLogUsage();
    return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits, updatedAt: meta ? meta.updatedAt : null };
  } catch (err) {
    console.error('[getShiftData] ERROR', err);
    throw err;
  }
}

/**
 * Like getShiftData but only returns units for the requested sector (faster).
 */
function getSectorData(dateStr, shift, sector, lastUpdatedAt) {
  try {
    console.log('[getSectorData] START — dateStr=' + dateStr + ' shift=' + shift + ' sector=' + sector);
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const timeZone = ss.getSpreadsheetTimeZone();
    const targetSectorStorage = toStorageSector(sector);

    // 0. Conditional Check
    const meta = rtdbGet('_meta/units/' + dateStr + '_' + shift + '/' + targetSectorStorage);
    if (lastUpdatedAt && meta && meta.updatedAt === lastUpdatedAt) {
      return { noChanges: true };
    }

    // 1. Settings
    const settingsResult = _loadSettings(dateStr, shift, sector, timeZone);
    const shiftSettings = settingsResult.settings;
    const allSectorSettings = settingsResult.allSettings;

    // 2. Units — try cache first
    const cache = CacheService.getScriptCache();
    const cacheKey = 'UNITS_' + dateStr + '_' + shift + '_' + targetSectorStorage;
    const cached = cache.get(cacheKey);
    if (cached && !lastUpdatedAt) {
      try {
        const allUnits = JSON.parse(cached);
        console.log('[getSectorData] CACHE HIT — units=' + allUnits.length);
        _fbLogUsage();
        return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits, updatedAt: meta ? meta.updatedAt : null };
      } catch (e) { /* invalid cache, fall through */ }
    }

    // 3. Units — try RTDB
    let allUnits = [];
    let fromFirebase = false;
    try {
      const nestedData = rtdbGet('units/' + dateStr + '_' + shift + '/' + targetSectorStorage);
      if (nestedData) {
        allUnits = Object.values(nestedData).map(u => _toUnitData(u));
        fromFirebase = true;
      }
    } catch (e) { /* fallback */ }

    if (!fromFirebase) {
      try {
        const flatData = rtdbGet('units/' + dateStr + '_' + shift);
        if (flatData) {
          const fbUnits = [];
          Object.values(flatData).forEach(val => {
            if (val && typeof val === 'object') {
              if (val.id !== undefined) {
                fbUnits.push(val);
              } else {
                Object.values(val).forEach(u => {
                  if (u && typeof u === 'object') fbUnits.push(u);
                });
              }
            }
          });
          allUnits = fbUnits.filter(u => u.sector === targetSectorStorage).map(u => _toUnitData(u));
          fromFirebase = true;
        }
      } catch (e) { /* fallback */ }
    }

    allUnits = _inheritLockedStatuses(allUnits, dateStr, shift, targetSectorStorage, timeZone);
    _cachePutSafe(cache, cacheKey, JSON.stringify(allUnits), 60);
    console.log('[getSectorData] OK — units=' + allUnits.length + ' src=' + (fromFirebase ? 'firebase' : 'empty'));
    _fbLogUsage();
    return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits, updatedAt: meta ? meta.updatedAt : null };
  } catch (err) {
    console.error('[getSectorData] ERROR', err);
    throw err;
  }
}

/**
 * Fetches reten replacement logs for a specific date and shift.
 */
function getRetenData(dateStr, shift) {
  try {
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.retenLog);
    if (!sheet) return [];

    const rows = sheet.getDataRange().getValues();
    const results = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;
      
      try {
        const rowDate = Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
        if (rowDate === dateStr && String(row[1]) === shift) {
          results.push({
            fecha: rowDate,
            turno: String(row[1] || ''),
            retenUnit: String(row[2] || ''),
            placaReten: String(row[3] || ''),
            replacedUnit: String(row[4] || ''),
            placa: String(row[5] || ''),
            motivo: String(row[6] || ''),
            hora: (row[7] instanceof Date) 
                  ? Utilities.formatDate(row[7], ss.getSpreadsheetTimeZone(), 'HH:mm')
                  : String(row[7] || ''),
            fechaIngresoTaller: (row[8] instanceof Date) ? Utilities.formatDate(row[8], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(row[8] || ''),
            horaIngresoTaller: (row[9] instanceof Date) ? Utilities.formatDate(row[9], ss.getSpreadsheetTimeZone(), 'HH:mm') : String(row[9] || ''),
            fechaSalidaTaller: (row[10] instanceof Date) ? Utilities.formatDate(row[10], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(row[10] || ''),
            horaSalidaTaller: (row[11] instanceof Date) ? Utilities.formatDate(row[11], ss.getSpreadsheetTimeZone(), 'HH:mm') : String(row[11] || '')
          });
        }
      } catch (e) {
        continue;
      }
    }
    return results.reverse(); // Newest first
  } catch (err) {
    console.error('[getRetenData] ERROR', err);
    return [];
  }
}

/**
 * Saves a new reten replacement record.
 */
function saveRetenData(data) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(APP_CONFIG.SHEETS.retenLog);
  if (!sheet) {
    setupRetenLogSheet(ss);
    sheet = ss.getSheetByName(APP_CONFIG.SHEETS.retenLog);
  }
  
  sheet.appendRow([
    data.fecha,
    data.turno,
    data.retenUnit,
    data.placaReten,
    data.replacedUnit,
    data.placa,
    data.motivo,
    data.hora,
    data.fechaIngresoTaller || '',
    data.horaIngresoTaller || '',
    data.fechaSalidaTaller || '',
    data.horaSalidaTaller || ''
  ]);
  
  return { success: true };
}

/**
 * Updates the exit date and time for a reten replacement record.
 */
function updateRetenSalida(data) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.retenLog);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const timeZone = ss.getSpreadsheetTimeZone();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowDate = row[0] ? Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd') : '';
    const horaActual = (row[7] instanceof Date) ? Utilities.formatDate(row[7], timeZone, 'HH:mm') : String(row[7] || '');
    // Use composite key to find the record
    if (rowDate === data.fecha && 
        String(row[1]) === String(data.turno) && 
        String(row[2]) === String(data.retenUnit) && 
        String(row[4]) === String(data.replacedUnit) && 
        horaActual === String(data.hora || '')) {
      
      // The columns are: 0=fecha, 1=turno, 2=retenUnit, 3=placaReten, 4=replacedUnit, 5=placa, 6=motivo, 7=hora
      // 8=fechaIngreso, 9=horaIngreso, 10=fechaSalida, 11=horaSalida
      
      // Updates are 1-indexed, so row[10] -> column 11
      sheet.getRange(i + 1, 11).setValue(data.fechaSalidaTaller || '');
      sheet.getRange(i + 1, 12).setValue(data.horaSalidaTaller || '');
      
      return { success: true };
    }
  }
  return { success: false, error: 'Record not found' };
}

/**
 * Fetches mobile reference data (id, plate, radio, quadrant) PLUS unique list of Indicatives and Statuses from external "DATA" sheet.
 */
function getMobileData() {
  const externalSS = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const sheet = externalSS.getSheetByName('DATA');
  
  if (!sheet) {
    console.error('Sheet DATA not found in external spreadsheet');
    return { mobiles: [], indicatives: [], statuses: [], personnel: [], quadrants: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { mobiles: [], indicatives: [], statuses: [], personnel: [], quadrants: [] };
  
  // Find column indices (case-insensitive)
  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const movilIdx = headers.indexOf('movil');
  const placaIdx = headers.indexOf('placa');
  const radioIdx = headers.indexOf('radio');
  const tetraIdx = headers.indexOf('tetra'); // Nuevo
  const cuadranteIdx = headers.indexOf('cuadrante');
  const sectorIdx = headers.indexOf('sector');
  const indicativoIdx = headers.indexOf('indicativo');
  const estadoIdx = headers.indexOf('estado');
  const tipoIdx = headers.indexOf('tipo');
  const modeloIdx = headers.indexOf('modelo');
  const motivoTallerIdx = headers.indexOf('motivo_taller');
  const lugarIdx = headers.indexOf('lugar');
  const motivoFaltoIdx = headers.indexOf('motivo_falto');
  const motivoDesperfectosIdx = headers.indexOf('motivo_desperfectos');
  const motivoMantenimientoIdx = headers.indexOf('motivo_mantenimiento');
  const motivoSiniestroIdx = headers.indexOf('motivo_siniestro');
  const motivoSinDocumentosIdx = headers.indexOf('motivo_sin_documentos');
  const motivoSinVehiculoIdx = headers.indexOf('motivo_sin_vehiculo');
  const codigoBodycamIdx = headers.indexOf('codigo_bodycam');
  const codigoTaserIdx = headers.indexOf('codigo_taser');
  const propiedadIdx = headers.indexOf('propiedad');
  const sipcopIdx = headers.indexOf('sipcop');
  
  const mobileData = [];
  const indicativesSet = new Set();
  const statusesSet = new Set();
  const quadrantsSet = new Set();
  const motivoTallerSet = new Set();
  const radiosSet = new Set();
  const lugarSet = new Set();
  const motivoFaltoSet = new Set();
  const motivoDesperfectosSet = new Set();
  const motivoMantenimientoSet = new Set();
  const motivoSiniestroSet = new Set();
  const motivoSinDocumentosSet = new Set();
  const motivoSinVehiculoSet = new Set();
  const codigoBodycamSet = new Set();
  const codigoTaserSet = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Collect Mobile Data
    if (movilIdx !== -1 && row[movilIdx]) {
      const id = String(row[movilIdx]);
      mobileData.push({
        id: id,
        plate: placaIdx !== -1 ? String(row[placaIdx] || '') : '',
        model: modeloIdx !== -1 ? String(row[modeloIdx] || '') : '',
        radio: (tetraIdx !== -1 ? String(row[tetraIdx] || '') : (radioIdx !== -1 ? String(row[radioIdx] || '') : '')),
        quadrant: cuadranteIdx !== -1 ? cellToStr(row[cuadranteIdx], externalSS.getSpreadsheetTimeZone()) : '',
        sector: sectorIdx !== -1 ? toDisplaySector(row[sectorIdx]) : '',
        status: estadoIdx !== -1 ? String(row[estadoIdx] || '').trim() : '',
        type: getUnitType(id, tipoIdx !== -1 ? row[tipoIdx] : null, sectorIdx !== -1 ? row[sectorIdx] : null),
        tipo: tipoIdx !== -1 ? String(row[tipoIdx] || '').trim() : '',
        propiedad: propiedadIdx !== -1 ? String(row[propiedadIdx] || '').trim() : '',
        sipcop: sipcopIdx !== -1 ? String(row[sipcopIdx] || '').trim() : ''
      });
    }

    // Collect Unique Indicatives
    if (indicativoIdx !== -1 && row[indicativoIdx]) {
      indicativesSet.add(String(row[indicativoIdx]).trim());
    }

    // Collect Unique Statuses
    if (estadoIdx !== -1 && row[estadoIdx]) {
      statusesSet.add(String(row[estadoIdx]).trim());
    }

    // Collect Unique Quadrants
    if (cuadranteIdx !== -1 && row[cuadranteIdx]) {
      quadrantsSet.add(cellToStr(row[cuadranteIdx], externalSS.getSpreadsheetTimeZone()).trim());
    }

    // Collect Unique Motivo Taller
    if (motivoTallerIdx !== -1 && row[motivoTallerIdx]) {
      motivoTallerSet.add(String(row[motivoTallerIdx]).trim());
    }

    // Collect Unique Lugar
    if (lugarIdx !== -1 && row[lugarIdx]) {
      lugarSet.add(String(row[lugarIdx]).trim());
    }

    // Collect Unique Motivos by status
    if (motivoFaltoIdx !== -1 && row[motivoFaltoIdx]) {
      motivoFaltoSet.add(String(row[motivoFaltoIdx]).trim());
    }
    if (motivoDesperfectosIdx !== -1 && row[motivoDesperfectosIdx]) {
      motivoDesperfectosSet.add(String(row[motivoDesperfectosIdx]).trim());
    }
    if (motivoMantenimientoIdx !== -1 && row[motivoMantenimientoIdx]) {
      motivoMantenimientoSet.add(String(row[motivoMantenimientoIdx]).trim());
    }
    if (motivoSiniestroIdx !== -1 && row[motivoSiniestroIdx]) {
      motivoSiniestroSet.add(String(row[motivoSiniestroIdx]).trim());
    }
    if (motivoSinDocumentosIdx !== -1 && row[motivoSinDocumentosIdx]) {
      motivoSinDocumentosSet.add(String(row[motivoSinDocumentosIdx]).trim());
    }
    if (motivoSinVehiculoIdx !== -1 && row[motivoSinVehiculoIdx]) {
      motivoSinVehiculoSet.add(String(row[motivoSinVehiculoIdx]).trim());
    }

    // Collect Unique Codigo Bodycam
    if (codigoBodycamIdx !== -1 && row[codigoBodycamIdx]) {
      codigoBodycamSet.add(String(row[codigoBodycamIdx]).trim());
    }
    // Collect Unique Codigo Taser
    if (codigoTaserIdx !== -1 && row[codigoTaserIdx]) {
      codigoTaserSet.add(String(row[codigoTaserIdx]).trim());
    }

    // Collect ALL Unique Radios (even if no movil ID is present)
    if ((tetraIdx !== -1 && row[tetraIdx]) || (radioIdx !== -1 && row[radioIdx])) {
      radiosSet.add(String(row[tetraIdx] || row[radioIdx]).trim());
    }
  }
  
  
  // Fetch External Personnel Data
  const personnelSet = new Set();
  const operatorsSet = new Set();
  const reportOperatorsSet = new Set();
  try {
    const extSS = getExternalPersonnelSpreadsheet();
    let extSheet = extSS.getSheetByName('Personal');
    if (!extSheet) {
      extSheet = extSS.getSheets()[0]; // Fallback to first sheet
    }
    
    const extData = extSheet.getDataRange().getValues();
    if (extData.length > 1) {
      const extHeaders = extData[0].map(h => String(h).toLowerCase().trim());
      const nameIdx = extHeaders.indexOf('apellidos_nombres');
      const estadoIdx = extHeaders.indexOf('estado');
      const funcionIdx = extHeaders.indexOf('funcion_actual');
      
      const allowedRoles = [
        'ANALISTA C4', 'ASISTENTE ADMINISTRATIVO', 'CHOFER', 'JEFE AREA', 
        'JEFE OPERACIONES', 'MOTORIZADO', 'OPERADOR C4', 'OPERADOR RPAS', 
        'PERMANENCIA', 'SERENO A PIE', 'SERENO GIR', 'SUPERVISOR', 
        'PERIODISTA', 'FISCALIZADOR', 'RESCATE', 'INSPECTOR DE TRANSITO'
      ];
      const operatorRoles = [
        'ANALISTA C4', 'OPERADOR C4', 'JEFE AREA', 'SUPERVISOR', 
        'JEFE OPERACIONES', 'ASISTENTE ADMINISTRATIVO', 'PERMANENCIA',
        'RESCATE'
      ];
      
      if (nameIdx !== -1) {
        for (let i = 1; i < extData.length; i++) {
          const row = extData[i];
          const name = String(row[nameIdx] || '').trim();
          const estado = estadoIdx !== -1 ? String(row[estadoIdx] || '').trim().toUpperCase() : 'ACTIVO';
          const funcion = funcionIdx !== -1 ? String(row[funcionIdx] || '').trim().toUpperCase() : '';
          
          // General personnel suggestions
          if (name && estado === 'ACTIVO' && allowedRoles.includes(funcion)) {
            personnelSet.add(name);
          }
          
          // Specific operator suggestions
          if (name && estado === 'ACTIVO' && operatorRoles.includes(funcion)) {
            operatorsSet.add(name);
          }
          
          // Operator list for reports
          const reportRoles = [
            'ANALISTA C4', 'ASISTENTE ADMINISTRATIVO', 'JEFE AREA', 
            'JEFE OPERACIONES', 'OPERADOR C4', 'OPERADOR RPAS', 
            'PERMANENCIA', 'SUPERVISOR'
          ];
          if (name && estado === 'ACTIVO' && reportRoles.includes(funcion)) {
            reportOperatorsSet.add(name);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error fetching external personnel for suggestions:', e);
  }

  return {
    mobiles: mobileData,
    indicatives: Array.from(indicativesSet).sort(),
    statuses: Array.from(statusesSet).sort(),
    personnel: Array.from(personnelSet).sort(),
    operators: Array.from(operatorsSet).sort(),
    reportOperators: Array.from(reportOperatorsSet).sort(),
    quadrants: Array.from(quadrantsSet).sort(),
    motivoTallerOptions: Array.from(motivoTallerSet).sort(),
    lugarOptions: Array.from(lugarSet).sort(),
    motivoFaltoOptions: Array.from(motivoFaltoSet).sort(),
    motivoDesperfectosOptions: Array.from(motivoDesperfectosSet).sort(),
    motivoMantenimientoOptions: Array.from(motivoMantenimientoSet).sort(),
    motivoSiniestroOptions: Array.from(motivoSiniestroSet).sort(),
    motivoSinDocumentosOptions: Array.from(motivoSinDocumentosSet).sort(),
    motivoSinVehiculoOptions: Array.from(motivoSinVehiculoSet).sort(),
    radios: Array.from(radiosSet).sort(),
    codigoBodycamOptions: Array.from(codigoBodycamSet).sort(),
    codigoTaserOptions: Array.from(codigoTaserSet).sort()
  };
}

/**
 * Fetches the full list of personnel from the external spreadsheet.
 */
function getPersonnelList() {
  try {
    const extSS = getExternalPersonnelSpreadsheet();
    let extSheet = extSS.getSheetByName('Personal');
    if (!extSheet) {
      extSheet = extSS.getSheets()[0]; // Fallback to first sheet
    }
    const data = extSheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0].map(h => String(h).toLowerCase().trim());
    
    // Mapping keys with fallbacks
    const findHeader = (target) => {
      const idx = headers.indexOf(target.toLowerCase());
      if (idx !== -1) return idx;
      // Fallbacks for common variations
      if (target === 'apellidos_nombres') {
        const alt = headers.findIndex(h => h.includes('nombre') || h.includes('personal') || h.includes('trabajador'));
        return alt;
      }
      if (target === 'regimen_laboral') {
        const alt = headers.findIndex(h => h.includes('regimen') || h.includes('planilla'));
        return alt;
      }
      if (target === 'codigo_interno') {
        const alt = headers.findIndex(h => h.includes('codigo') || h.includes('interno') || h.includes('cod'));
        return alt;
      }
      if (target === 'sector_id') {
        const alt = headers.findIndex(h => h.includes('sector') || h.includes('area'));
        return alt;
      }
      return -1;
    };

    const fieldIndices = {
      dni: findHeader('dni'),
      apellidos_nombres: findHeader('apellidos_nombres'),
      regimen_laboral: findHeader('regimen_laboral'),
      estado: findHeader('estado'),
      rol_operativo: findHeader('funcion_actual'), // Mapped to funcion_actual per user request
      codigo_interno: findHeader('codigo_interno'),
      sector_id: findHeader('sector_id'),
      foto_url: findHeader('foto_url')
    };

    const personnelList = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const person = {};
      Object.keys(fieldIndices).forEach(key => {
        const idx = fieldIndices[key];
        let val = idx !== -1 ? row[idx] : '';
        // Format dates if they are Date objects
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        person[key] = String(val || '');
      });
      personnelList.push(person);
    }
    return personnelList;
  } catch (e) {
    console.error('Error in getPersonnelList:', e);
    return [];
  }
}

function fmtDateSimple(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  var s = String(val || '').trim();
  if (!s) return '';
  // If it looks like "day month year HH:MM:SS GMT" (JS default), format it
  var d = new Date(s);
  if (!isNaN(d.getTime()) && s.indexOf('/') === -1) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  // Remove trailing time portion like "00:00:00"
  return s.replace(/\s+00:00:00.*$/, '').replace(/T.*$/, '');
}

function fmtTimeSimple(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
  }
  var s = String(val || '').trim();
  if (!s) return '';
  // If full datetime string, extract time
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm');
  }
  // Keep only HH:MM portion
  var m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? m[1] + ':' + m[2] : s;
}

/**
 * Fetches wanted persons from the external spreadsheet with photo file IDs from Drive.
 */
function getWantedPersons() {
  try {
    const ss = SpreadsheetApp.openById(APP_CONFIG.WANTED_SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Hoja1');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0].map(h => String(h).trim().toUpperCase());

    // Build photo map is now replaced by reading directly from URL and FILE_ID columns
    const colMap = {};
    headers.forEach(function(h, i) { colMap[h] = i; });

    const persons = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[colMap['NOMBRE']]) continue;

      var nombre = String(row[colMap['NOMBRE']] || '').trim();
      var dnice = String(row[colMap['DNICE']] || '').trim().toUpperCase();

      persons.push({
        buscado_por: String(row[colMap['BUSCADO POR']] || ''),
        edad: String(row[colMap['EDAD']] || ''),
        nombre: nombre,
        dnice: dnice,
        sexo: String(row[colMap['SEXO']] || ''),
        fecha_hecho: fmtDateSimple(row[colMap['FECHA DEL HECHO']]),
        hora_hecho: fmtTimeSimple(row[colMap['HORA DEL HECHO']]),
        lugar_intervencion: String(row[colMap['LUGAR DE LA INTERVENCIÓN U ORIGEN']] || ''),
        habilitacion_urbana: String(row[colMap['HABILITACIÓN URBANA']] || ''),
        nacionalidad: String(row[colMap['NACIONALIDAD']] || ''),
        recompensa: String(row[colMap['RECOMPENSA']] || ''),
        fuente: String(row[colMap['FUENTE']] || ''),
        estado: String(row[colMap['ESTADO']] || ''),
        sade: String(row[colMap['SADE']] || ''),
        dependencia_policial: String(row[colMap['DEPENDENCIA POLICIAL']] || ''),
        caracteristicas: String(row[colMap['CARACTERISTICAS']] || ''),
        vestimenta: String(row[colMap['VESTIMENTA']] || ''),
        circunstancias: String(row[colMap['CIRCUNSTANCIAS']] || ''),
        cumple_analitica: String(row[colMap['CUMPLE ANALITICA']] || ''),
        video: String(row[colMap['VIDEO']] || ''),
        caso: String(row[colMap['CASO']] || ''),
        reincidente: String(row[colMap['REINCIDENTE']] || ''),
        photoUrl: row[colMap['URL']] || '',
        photoFileId: row[colMap['FILE_ID']] || ''
      });
    }

    var matched = persons.filter(function(p) { return p.photoUrl; }).length;
    console.log('[getWantedPersons] OK — ' + persons.length + ' registros, ' + matched + ' con foto');
    if (persons.length > 0) {
      console.log('[getWantedPersons] Primer registro: NOMBRE="' + persons[0].nombre + '" foto=' + (persons[0].photoUrl ? 'SI' : 'NO'));
    }
    return persons;
  } catch (e) {
    console.error('Error in getWantedPersons:', e);
    return [];
  }
}



/**
 * Saves all units and settings for a specific date and shift.
 * Uses Firestore for storage.
 */
/**
 * Saves only header settings (operador, supervisor, permanencia) without modifying unit data.
 */
function getQuadrantsData() {
  if (typeof QUADRANTS_GEOJSON !== 'undefined') {
    return QUADRANTS_GEOJSON;
  }
  return '{"type":"FeatureCollection","features":[]}';
}

function saveShiftSettings(dateStr, shift, settings) {
  const targetSector = toStorageSector(settings.nombrePuesto || '1A');
  const path = 'shifts/' + dateStr + '_' + shift + '/' + targetSector;

  const data = {
    date: dateStr,
    shift: shift,
    sector: targetSector,
    operador: settings.operador || '',
    supervisor: settings.supervisor || '',
    supervisorRol: settings.supervisorRol || 'SUPERVISOR',
    permanencia: settings.permanencia || '',
    supervisorTaser: settings.supervisorTaser || '',
    supervisorBodycam: settings.supervisorBodycam || '',
    supervisorCodigoTaser: settings.supervisorCodigoTaser || '',
    supervisorCodigoBodycam: settings.supervisorCodigoBodycam || '',
    supervisorEstado: settings.supervisorEstado || '',
    supervisorRadio: settings.supervisorRadio || '',
    supervisorEncargado: settings.supervisorEncargado || '',
    supervisorMotivo: settings.supervisorMotivo || '',
    permanenciaTaser: settings.permanenciaTaser || '',
    permanenciaBodycam: settings.permanenciaBodycam || '',
    permanenciaCodigoTaser: settings.permanenciaCodigoTaser || '',
    permanenciaCodigoBodycam: settings.permanenciaCodigoBodycam || '',
    permanenciaEstado: settings.permanenciaEstado || '',
    permanenciaRadio: settings.permanenciaRadio || '',
    permanenciaEncargado: settings.permanenciaEncargado || '',
    permanenciaMotivo: settings.permanenciaMotivo || '',
    updatedAt: Utilities.formatDate(new Date(), SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  };

  rtdbSet(path, data);
  CacheService.getScriptCache().remove('SETTINGS_' + dateStr + '_' + shift);
  _fbLogUsage();
  return { success: true };
}

/**
 * Helper to determine the previous shift and date.
 */
function getPreviousShift(dateStr, shift, timeZone) {
  const shiftOrder = ['MAÑANA', 'TARDE', 'NOCHE'];
  let idx = shiftOrder.indexOf(shift);
  if (idx > 0) {
    return { date: dateStr, shift: shiftOrder[idx - 1] };
  } else {
    // Go to previous day
    let date = new Date(dateStr + 'T12:00:00');
    date.setDate(date.getDate() - 1);
    let prevDateStr = Utilities.formatDate(date, timeZone, "yyyy-MM-dd");
    return { date: prevDateStr, shift: 'NOCHE' };
  }
}

var _LOCKED_STATUSES = { DESPERFECTOS: true, SINIESTRO: true, MANTENIMIENTO: true };

function _normUnitId(id) {
  return String(id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/**
 * Reads the previous shift's units (optionally filtered by sector) from RTDB.
 */
function _readPrevShiftUnits(prevDateStr, prevShift, sectorStorage, timeZone) {
  var out = [];
  try {
    var raw = sectorStorage
      ? rtdbGet('units/' + prevDateStr + '_' + prevShift + '/' + sectorStorage)
      : rtdbGet('units/' + prevDateStr + '_' + prevShift);
    if (raw && typeof raw === 'object') {
      if (sectorStorage) {
        Object.values(raw).forEach(function(u) {
          if (u && typeof u === 'object' && u.id !== undefined) out.push(_toUnitData(u));
        });
      } else {
        Object.values(raw).forEach(function(sec) {
          if (sec && typeof sec === 'object') {
            Object.values(sec).forEach(function(u) {
              if (u && typeof u === 'object' && u.id !== undefined) out.push(_toUnitData(u));
            });
          }
        });
      }
    }
    if (out.length) return out;
  } catch (e) { /* fallback */ }

  return [];
}

function _buildLockedInheritedUnit(prevU, unitId) {
  return {
    id: String(prevU.id || ''),
    unit_id: unitId,
    sector: String(prevU.sector || ''),
    type: String(prevU.type || ''),
    model: String(prevU.model || ''),
    personnel1: '',
    personnel2: '',
    plate: String(prevU.plate || ''),
    indicative: String(prevU.indicative || ''),
    radio: String(prevU.radio || ''),
    status: String(prevU.status || ''),
    reason: '',
    kmStart: '0',
    kmEnd: '0',
    totalKm: '0',
    kmRecarga: '0',
    hours: '--:-- - --:--',
    fuel: '-- / --',
    expense: 'S/ 0.00',
    fuel2: '',
    expense2: '',
    quadrant: String(prevU.quadrant || ''),
    mechanics: String(prevU.mechanics || ''),
    lugarEstado: String(prevU.lugarEstado || ''),
    motivoEstado: String(prevU.motivoEstado || ''),
    taser: '',
    bodycam: '',
    codigoBodycam: '',
    obsBodycam: '',
    codigoTaser: ''
  };
}

/**
 * If a unit was in DESPERFECTOS / SINIESTRO / MANTENIMIENTO in the previous shift,
 * it inherits that status in the current shift whenever its status is still empty.
 * Units absent from the current shift but locked in the previous one are re-added.
 */
function _inheritLockedStatuses(allUnits, dateStr, shift, sectorStorage, timeZone) {
  try {
    var prevInfo = getPreviousShift(dateStr, shift, timeZone);
    var prevUnits = _readPrevShiftUnits(prevInfo.date, prevInfo.shift, sectorStorage, timeZone);
    if (!prevUnits || prevUnits.length === 0) return allUnits;

    var prevByNorm = {};
    prevUnits.forEach(function(u) {
      var idNorm = _normUnitId(u.id);
      var sNorm = String(u.sector || '').trim().toUpperCase();
      if (idNorm && _LOCKED_STATUSES[String(u.status || '').toUpperCase()]) {
        prevByNorm[sNorm + '|' + idNorm] = u;
      }
    });
    if (Object.keys(prevByNorm).length === 0) return allUnits;

    var result = allUnits.slice();
    var idxByNorm = {};
    result.forEach(function(o, i) {
      if (o && String(o.id || '').trim()) {
        idxByNorm[String(o.sector || '').trim().toUpperCase() + '|' + _normUnitId(o.id)] = i;
      }
    });

    for (var k in prevByNorm) {
      var prevU = prevByNorm[k];
      if (idxByNorm[k] !== undefined) {
        var cur = result[idxByNorm[k]];
        if (!String(cur.status || '').trim()) {
          cur.status = String(prevU.status || '');
          cur.reason = String(cur.reason || prevU.reason || '');
          cur.lugarEstado = String(prevU.lugarEstado || '');
          cur.motivoEstado = String(prevU.motivoEstado || '');
          cur.mechanics = String(prevU.mechanics || '');
        }
      } else {
        var cleanId = k.split('|')[1];
        var uid = 'INH-' + String(prevU.sector || '').trim().toUpperCase().replace(/\s+/g, '') + '-' + cleanId + '-' + dateStr.replace(/-/g, '') + '-' + shift;
        result.push(_buildLockedInheritedUnit(prevU, uid));
      }
    }

    return result;
  } catch (e) {
    console.error('[inheritLockedStatuses] ERROR', e);
    return allUnits;
  }
}

/**
 * Gets the last recorded KM Final for a unit in a specific sector,
 * ensuring it's from a previous shift/day.
 */
/**
 * Lightweight check for shift timestamp changes.
 */
function checkShiftTimestamp(dateStr, shift) {
  const meta = rtdbGet('_meta/units/' + dateStr + '_' + shift);
  return { updatedAt: meta ? meta.updatedAt : null };
}

function getPreviousKmEnd(currentDateStr, currentShift, unitId, sector) {
  if (!unitId) return '0';
  try {
    const searchId = String(unitId).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    let timeZone = 'America/Lima';
    try {
      timeZone = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone();
    } catch (err) {}

    // El turno previo puede tener más de un registro para la misma unidad (p.ej.
    // una copia antigua con unit_id genérico y el registro real). Se recorre el
    // bucket del sector buscando por id móvil y se prioriza el registro más
    // reciente (updatedAt) que tenga un kmStart válido.
    const prevShiftInfo = getPreviousShift(currentDateStr, currentShift, timeZone);
    const targetSector = toStorageSector(sector || '');
    const kmPrev = _pickPrevKm(prevShiftInfo.date, prevShiftInfo.shift, targetSector, searchId);
    if (kmPrev !== null) return kmPrev;

    // Fallback: read directly by the canonical unit_id path (1 specific read).
    const prevUnitId = prevShiftInfo.date.replace(/-/g, '') + '_' + prevShiftInfo.shift + '_' + targetSector + '_' + searchId;
    const found = rtdbGet('units/' + prevShiftInfo.date + '_' + prevShiftInfo.shift + '/' + targetSector + '/' + prevUnitId);
    if (found && found.kmStart) {
      return String(found.kmStart);
    }

    // Fallback: try latest_km (legacy data from before this change)
    const latest = rtdbGet('latest_km/' + searchId);
    if (latest && latest.kmStart) {
      return String(latest.kmStart);
    }
  } catch (e) {
    console.error('Error in getPreviousKmEnd:', e);
  }
  return '0';
}

/**
 * Busca en el bucket del turno previo el kmStart de la unidad por id móvil.
 * Si hay varias copias del mismo móvil, devuelve la del registro más reciente
 * (updatedAt); sin timestamps, se queda con el kmStart mayor (registro vigente).
 * Devuelve null si no encuentra ningún kmStart válido.
 */
function _pickPrevKm(prevDateStr, prevShift, targetSector, searchId) {
  try {
    const bucket = rtdbGet('units/' + prevDateStr + '_' + prevShift + '/' + targetSector);
    if (!bucket || typeof bucket !== 'object') return null;

    let best = null; // { km, ts }
    Object.values(bucket).forEach(function(u) {
      if (!u || typeof u !== 'object') return;
      const uId = String(u.id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (uId !== searchId) return;
      const km = String(u.kmStart || '').trim();
      if (!km || km === '0') return;
      const ts = String(u.updatedAt || '').trim();
      if (!best) { best = { km: km, ts: ts }; return; }
      if (ts && (!best.ts || ts > best.ts)) {
        best = { km: km, ts: ts };
      } else if (!best.ts && !ts) {
        if (parseFloat(km) > parseFloat(best.km)) best = { km: km, ts: ts };
      }
    });
    return best ? best.km : null;
  } catch (e) {
    console.error('[_pickPrevKm] ERROR', e);
    return null;
  }
}

/**
 * Gets the last taller entry (ingreso) for a unit that has no exit registered.
 * Searches all records in RETEN_LOG from newest to oldest.
 */
function getLastUnitTallerEntry(unitId) {
  try {
    if (!unitId) return null;
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.retenLog);
    if (!sheet) return null;

    const timeZone = ss.getSpreadsheetTimeZone();
    const rows = sheet.getDataRange().getValues();
    const searchId = String(unitId).trim().toUpperCase();

    // Search from bottom (newest) to top (oldest)
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const replacedUnit = String(row[4] || '').trim().toUpperCase();
      const fechaIngreso = (row[8] instanceof Date) ? Utilities.formatDate(row[8], timeZone, 'yyyy-MM-dd') : String(row[8] || '').trim();
      const horaIngreso = (row[9] instanceof Date) ? Utilities.formatDate(row[9], timeZone, 'HH:mm') : String(row[9] || '').trim();
      const fechaSalida = (row[10] instanceof Date) ? Utilities.formatDate(row[10], timeZone, 'yyyy-MM-dd') : String(row[10] || '').trim();

      if (replacedUnit === searchId && fechaIngreso) {
        if (!fechaSalida) {
          return {
            fechaIngresoTaller: fechaIngreso,
            horaIngresoTaller: horaIngreso
          };
        }
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error('[getLastUnitTallerEntry] ERROR', err);
    return null;
  }
}

/**
 * Makes a value safe to use as a single RTDB path token (key).
 * RTDB keys cannot contain . # $ [ ] / nor ASCII control chars (they corrupt
 * the path/URL). Whitespace is also collapsed since paths are concatenated
 * into fetch URLs.
 */
function _sanitizeRtdbKey(value) {
  var key = String(value === undefined || value === null ? '' : value);
  var banned = ['.', '#', '$', '[', ']', '/'];
  for (var i = 0; i < banned.length; i++) {
    key = key.split(banned[i]).join('_');
  }
  return key.replace(/\s+/g, '_').replace(/[\u0000-\u001F\u007F]/g, '_').trim();
}

/**
 * Fast single-unit save: always appends a new row. No locks, no timeouts.
 * The frontend deduplicates by unit_id on load, taking the most recent row.
 */
function _normalizePersonnelName(val) {
  return String(val || '').trim().toUpperCase().replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, ' ').trim();
}

function _parseFuelValue(value) {
  const parts = String(value || '').split('/').map(function (part) { return part.trim(); });
  const type = parts[0] && parts[0] !== '--' ? parts[0] : '';
  const quantity = parts[1] && parts[1] !== '0' ? parts[1] : '';
  return { type: type, quantity: quantity };
}

function _parseAmount(value) {
  const amount = String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  const parsed = parseFloat(amount);
  return isNaN(parsed) ? '' : parsed;
}

function _normalizeFuelHeader(value) {
  return String(value || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _fuelVehicleType(unit) {
  const sourceType = String(unit.type || '').trim().toUpperCase();
  const model = String(unit.model || '').trim().toUpperCase();
  if (sourceType === 'MOTO' || model.indexOf('MOTO') !== -1) return 'MOTOCICLETA';
  if (model.indexOf('CAMIONETA') !== -1 || model.indexOf('PICKUP') !== -1 || model.indexOf('SUV') !== -1) return 'CAMIONETA';
  return 'AUTOMOVIL';
}

function _getFuelVehicleReference(unit) {
  const lookupKey = String(unit.id || unit.plate || '').trim().toUpperCase();
  const fallback = { brand: unit.brand || '', model: unit.model || '', year: unit.year || '', propiedad: '' };
  if (!lookupKey) return fallback;

  const cache = CacheService.getScriptCache();
  const cacheKey = 'FUEL_VEHICLE_' + lookupKey.replace(/[^A-Z0-9_-]/g, '_');
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return Object.assign(fallback, JSON.parse(cached)); } catch (e) {}
  }

  try {
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.referenceData);
    if (!sheet) return fallback;
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return fallback;

    const headers = values[0].map(function (header) { return _normalizeFuelHeader(header); });
    const findColumn = function (names) {
      for (let i = 0; i < names.length; i++) {
        const index = headers.indexOf(_normalizeFuelHeader(names[i]));
        if (index !== -1) return index;
      }
      return -1;
    };
    const idIndex = findColumn(['MOVIL', 'CODIGO', 'ID']);
    const plateIndex = findColumn(['PLACA']);
    const brandIndex = findColumn(['MARCA']);
    const modelIndex = findColumn(['MODELO']);
    const yearIndex = findColumn(['AÑO', 'ANO', 'YEAR']);
    const propiedadIndex = findColumn(['PROPIEDAD']);

    for (let i = 1; i < values.length; i++) {
      const rowId = idIndex === -1 ? '' : String(values[i][idIndex] || '').trim().toUpperCase();
      const rowPlate = plateIndex === -1 ? '' : String(values[i][plateIndex] || '').trim().toUpperCase();
      if (rowId !== lookupKey && rowPlate !== lookupKey) continue;

      const reference = {
        brand: brandIndex === -1 ? fallback.brand : String(values[i][brandIndex] || '').trim(),
        model: modelIndex === -1 ? fallback.model : String(values[i][modelIndex] || '').trim(),
        year: yearIndex === -1 ? fallback.year : String(values[i][yearIndex] || '').trim(),
        propiedad: propiedadIndex === -1 ? fallback.propiedad : String(values[i][propiedadIndex] || '').trim()
      };
      cache.put(cacheKey, JSON.stringify(reference), 3600);
      return Object.assign(fallback, reference);
    }
  } catch (e) {
    console.error('[fuel vehicle reference] ERROR', e);
  }
  return fallback;
}

function _fuelCellDateEquals(cell, dateStr, timeZone) {
  try {
    var target = Utilities.parseDate(String(dateStr), timeZone, 'yyyy-MM-dd');
    var d = null;
    if (Object.prototype.toString.call(cell) === '[object Date]') {
      d = cell;
    } else if (cell) {
      var s = String(cell).trim().substring(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        d = Utilities.parseDate(s, timeZone, 'yyyy-MM-dd');
      } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) {
        d = new Date(cell);
      }
    }
    if (!d || isNaN(d.getTime())) return false;
    return d.getFullYear() === target.getFullYear() &&
      d.getMonth() === target.getMonth() &&
      d.getDate() === target.getDate();
  } catch (e) { return false; }
}

function _appendFuelRecords(settings, unit, dateStr, targetSector, previousUnit, optShift, optUnitId) {
  // Toda la sincronizacion va dentro de try/catch: un error del spreadsheet
  // nunca debe bloquear el guardado en Firebase ni dejar al cliente colgado.
  try {
    const shift = optShift || '';
    const finalUnitId = String(optUnitId || unit.unit_id || '');
    const unitCode = String(unit.id || '').trim();
    const sectorNorm = String(targetSector || '').trim().toUpperCase();

    // 1. Combustibles vigentes (sin llamadas API).
    var fuels = [
      { value: unit.fuel, amount: unit.expense },
      { value: unit.fuel2, amount: unit.expense2 }
    ];
    var validFuels = [];
    fuels.forEach(function (fuel) {
      var parsed = _parseFuelValue(fuel.value);
      if (parsed.type && parsed.quantity) validFuels.push(fuel);
    });

    const fuelSpreadsheet = SpreadsheetApp.openById(APP_CONFIG.FUEL_SPREADSHEET_ID);
    let sheet = fuelSpreadsheet.getSheetByName('ABASTECIMIENTO');
    if (!sheet) sheet = fuelSpreadsheet.insertSheet('ABASTECIMIENTO');
    const spreadsheetTimeZone = fuelSpreadsheet.getSpreadsheetTimeZone();

    // Layout base solo para hoja nueva. La unica columna nueva que este codigo
    // necesita es UNIT_ID. En hojas existentes NO se agrega nada mas: si la hoja
    // usa la columna combinada 'OPERADOR C4' se respeta tal cual.
    const baseHeaders = ['OPERADOR C4', 'FECHA', 'PROPIEDAD', 'TIPO', 'SECTOR', 'MARCA', 'MODELO', 'PLACA', 'AÑO', 'CODIGO', 'CONDUCTOR', 'ODOMETRO', 'COMBUSTIBLE', 'GALONES', 'MONTO', 'HORA REGISTRO', 'UNIT_ID'];
    var lastColumn;
    var headerRow;
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, baseHeaders.length).setValues([baseHeaders]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      headerRow = baseHeaders.slice();
      lastColumn = baseHeaders.length;
    } else {
      headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      // Solo agregar UNIT_ID si falta. Nada mas.
      var existingNorm = headerRow.map(function (h) { return _normalizeFuelHeader(h); });
      if (existingNorm.indexOf(_normalizeFuelHeader('UNIT_ID')) === -1) {
        sheet.getRange(1, headerRow.length + 1).setValue('UNIT_ID').setFontWeight('bold');
        headerRow = headerRow.concat(['UNIT_ID']);
      }
      lastColumn = headerRow.length;
    }
    const columnByHeader = {};
    headerRow.forEach(function (header, index) {
      const normalizedHeader = _normalizeFuelHeader(header);
      if (normalizedHeader && columnByHeader[normalizedHeader] === undefined) columnByHeader[normalizedHeader] = index;
    });
    var resolveCol = function (names) {
      for (var i = 0; i < names.length; i++) {
        var c = columnByHeader[_normalizeFuelHeader(names[i])];
        if (c !== undefined) return c;
      }
      return undefined;
    };

    const unitIdCol = resolveCol(['UNIT_ID']);
    const fechaCol = resolveCol(['FECHA']);
    const codigoCol = resolveCol(['CODIGO', 'COD', 'MOVIL']);
    const sectorCol = resolveCol(['SECTOR']);
    const turnoCol = resolveCol(['TURNO']); // defensivo: solo si existiera de antes
    const horaRegistroCol = resolveCol(['HORA REGISTRO', 'HORA_REGISTRO', 'HORAREGISTRO', 'HORA DE REGISTRO']);
    const operadorC4Col = resolveCol(['OPERADOR C4', 'OPERADORC4', 'OPERADOR_C4']);
    const operadorCol = resolveCol(['OPERADOR']);
    const c4Col = resolveCol(['C4']);

    // 2. Filas actuales de la unidad por UNIT_ID (barato, busqueda del servidor).
    var lastRow = sheet.getLastRow();
    var hitRows = [];
    if (lastRow > 1 && unitIdCol !== undefined && finalUnitId) {
      try {
        var idHits = sheet.getRange(2, unitIdCol + 1, lastRow - 1, 1)
          .createTextFinder(finalUnitId).matchEntireCell(true).matchCase(true).findAll();
        for (var i = 0; i < idHits.length; i++) hitRows.push(idHits[i].getRow());
      } catch (e) { hitRows = []; }
    }
    hitRows.sort(function (a, b) { return a - b; });

    // 3. Filas legacy (sin UNIT_ID) de la misma unidad: solo se buscan si aun
    // no hay filas con UNIT_ID (tras la primera sincronizacion ya no hace falta).
    // Nunca se toca una fila con UNIT_ID de otra unidad. Inspeccion acotada.
    if (!hitRows.length && lastRow > 1 && codigoCol !== undefined && unitCode) {
      try {
        var codeHits = sheet.getRange(2, codigoCol + 1, lastRow - 1, 1)
          .createTextFinder(unitCode).matchEntireCell(true).matchCase(false).findAll();
        var inspected = 0;
        for (var j = codeHits.length - 1; j >= 0 && inspected < 15; j--) {
          var rowNum = codeHits[j].getRow();
          inspected++;
          var rowVals = sheet.getRange(rowNum, 1, 1, lastColumn).getValues()[0];
          var rowUnitId = unitIdCol !== undefined ? String(rowVals[unitIdCol] || '').trim() : '';
          if (rowUnitId && rowUnitId !== finalUnitId) continue;
          if (fechaCol === undefined || !_fuelCellDateEquals(rowVals[fechaCol], dateStr, spreadsheetTimeZone)) continue;
          if (sectorCol !== undefined && String(rowVals[sectorCol] || '').trim().toUpperCase() !== sectorNorm) continue;
          if (turnoCol !== undefined && String(rowVals[turnoCol] || '').trim() && String(rowVals[turnoCol] || '').trim() !== String(shift || '').trim()) continue;
          hitRows.push(rowNum);
        }
      } catch (e) { console.error('[fuel sync] ERROR buscando filas legacy', e); }
      hitRows.sort(function (a, b) { return a - b; });
    }

    // 4. Si no hay combustible vigente: borrar filas previas (si las hay) y listo.
    // No se consulta la referencia vehicular.
    if (!validFuels.length) {
      if (hitRows.length) {
        try {
          hitRows.sort(function (a, b) { return b - a; });
          hitRows.forEach(function (rowNum) { sheet.deleteRow(rowNum); });
        } catch (e) { console.error('[fuel sync] ERROR borrando registros previos', e); }
      }
      return;
    }

    // 5. Si los datos de combustible son identicos a los ya guardados y la
    // cantidad de filas coincide, no hay nada que escribir (ediciones de otros
    // campos no tocan el spreadsheet).
    var prev = previousUnit || {};
    var norm = function (v) { return String(v || '').trim(); };
    var sameAsPrevious = hitRows.length === validFuels.length &&
      norm(unit.fuel) === norm(prev.fuel) &&
      norm(unit.expense) === norm(prev.expense) &&
      norm(unit.fuel2) === norm(prev.fuel2) &&
      norm(unit.expense2) === norm(prev.expense2) &&
      norm(unit.personnel1) === norm(prev.personnel1) &&
      norm(unit.plate) === norm(prev.plate) &&
      norm(unit.indicative) === norm(prev.indicative) &&
      norm(unit.kmRecarga) === norm(prev.kmRecarga) &&
      norm(unit.kmEnd) === norm(prev.kmEnd) &&
      norm(targetSector) === norm(prev.sector);
    if (sameAsPrevious) return;

    // 6. Solo aqui se consulta la referencia vehicular (hoja DATA).
    const recordDate = Utilities.parseDate(String(dateStr), spreadsheetTimeZone, 'yyyy-MM-dd');
    // Hora explicita de Lima: la zona horaria del spreadsheet puede ser otra (daba 2h menos).
    const horaRegistro = Utilities.formatDate(new Date(), 'America/Lima', 'HH:mm:ss');
    const vehicleReference = _getFuelVehicleReference(unit);
    const vehicleType = _fuelVehicleType(Object.assign({}, unit, { model: vehicleReference.model }));
    const buildRow = function (fuel) {
      const parsed = _parseFuelValue(fuel.value);
      const row = new Array(lastColumn).fill('');
      var setVal = function (col, v) { if (col !== undefined) row[col] = v; };
      // Columna combinada 'OPERADOR C4' o columnas separadas, segun la hoja.
      if (operadorC4Col !== undefined) {
        setVal(operadorC4Col, settings.operador || '');
      } else {
        setVal(operadorCol, settings.operador || '');
        setVal(c4Col, unit.indicative || '');
      }
      setVal(fechaCol, recordDate);
      setVal(resolveCol(['PROPIEDAD']), vehicleReference.propiedad);
      setVal(resolveCol(['TIPO']), vehicleType);
      setVal(sectorCol, targetSector);
      setVal(resolveCol(['MARCA']), vehicleReference.brand);
      setVal(resolveCol(['MODELO']), vehicleReference.model);
      setVal(resolveCol(['PLACA']), unit.plate || '');
      setVal(resolveCol(['AÑO', 'ANO']), vehicleReference.year);
      setVal(codigoCol, unit.id || '');
      setVal(resolveCol(['CONDUCTOR']), unit.personnel1 || '');
      setVal(resolveCol(['ODOMETRO']), unit.kmRecarga || unit.kmEnd || '');
      setVal(resolveCol(['COMBUSTIBLE']), parsed.type);
      setVal(resolveCol(['GALONES']), parseFloat(parsed.quantity) || parsed.quantity);
      setVal(resolveCol(['MONTO']), _parseAmount(fuel.amount));
      setVal(horaRegistroCol, horaRegistro);
      setVal(unitIdCol, finalUnitId);
      return row;
    };
    const newRows = [];
    validFuels.forEach(function (fuel) { newRows.push(buildRow(fuel)); });

    // 7. Reconciliar en el lugar: sobrescribir las filas existentes (sin el
    // costo de deleteRow que reordena la hoja), borrar sobrantes e insertar
    // faltantes al final.
    try {
      var overwriteCount = Math.min(hitRows.length, newRows.length);
      for (var k = 0; k < overwriteCount; k++) {
        sheet.getRange(hitRows[k], 1, 1, lastColumn).setValues([newRows[k]]);
      }
      if (hitRows.length > newRows.length) {
        var extras = hitRows.slice(newRows.length).sort(function (a, b) { return b - a; });
        extras.forEach(function (rowNum) { sheet.deleteRow(rowNum); });
      } else if (newRows.length > hitRows.length) {
        var missing = newRows.slice(hitRows.length);
        sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, lastColumn).setValues(missing);
      }
    } catch (e) { console.error('[fuel sync] ERROR escribiendo registros', e); }
  } catch (e) { console.error('[fuel sync] ERROR general, se guarda solo Firebase', e); }
}

function updateUnit(dateStr, shift, settings, unit) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const fuel2Value = String(unit.fuel2 || '').trim();
  const expense2Value = String(unit.expense2 || '').trim();
  console.log('[updateUnit] recibido: ' + JSON.stringify({
    date: dateStr,
    shift: shift,
    sector: unit.sector || '',
    unit_id: unit.unit_id || '',
    id: unit.id || '',
    fuel: unit.fuel || '',
    expense: unit.expense || '',
    fuel2: unit.fuel2,
    expense2: unit.expense2,
    fuel2Normalized: fuel2Value,
    expense2Normalized: expense2Value
  }));

  const targetSector = unit.sector ? toStorageSector(unit.sector) : toStorageSector(settings.nombrePuesto || '1A');
  const timeZone = ss.getSpreadsheetTimeZone();
  let previousUnit = null;
  if (unit.unit_id) {
    const previousUnitId = _sanitizeRtdbKey(unit.unit_id);
    const previousPath = 'units/' + dateStr + '_' + shift + '/' + targetSector + '/' + previousUnitId;
    previousUnit = rtdbGet(previousPath);
  }

  // --- Validación anti-duplicado: mismo sector + misma sección (CHOFER/MOTO/SERENO) no permite mismo nombre ---
  try {
    var newNameNorm = _normalizePersonnelName(unit.personnel1);
    var newName2Norm = _normalizePersonnelName(unit.personnel2);
    var targetTypeNorm = String(unit.type || '').trim().toUpperCase();
    var statusNorm = String(unit.status || '').trim().toUpperCase();
    var isNoPersonnelStatus = ['SIN CONDUCTOR','MANTENIMIENTO','DESPERFECTOS','SIN DOCUMENTOS','SINIESTRO','FIN APOYO','SIN OPERADOR'].indexOf(statusNorm) !== -1 || statusNorm.replace(/[.\s]/g,'') === 'TACTICOPPFF';
    if (newNameNorm && !isNoPersonnelStatus) {
      var existingBySector = rtdbGet('units/' + dateStr + '_' + shift + '/' + targetSector);
      if (existingBySector) {
        var newUnitIdNorm = _sanitizeRtdbKey(unit.unit_id);
        for (var key in existingBySector) {
          if (!existingBySector.hasOwnProperty(key)) continue;
          var ex = existingBySector[key];
          if (!ex) continue;
          // Skip self (mismo unit_id)
          if (newUnitIdNorm && String(ex.unit_id || '').trim() === newUnitIdNorm) continue;
          var exTypeNorm = String(ex.type || '').trim().toUpperCase();
          if (exTypeNorm !== targetTypeNorm) continue;
          var exNameNorm = _normalizePersonnelName(ex.personnel1);
          if (!exNameNorm) continue;
          if (exNameNorm === newNameNorm) {
            return { success: false, error: 'DUPLICATE_PERSONNEL: El nombre "' + unit.personnel1 + '" ya está registrado en el sector ' + targetSector + ' - sección ' + targetTypeNorm + '. No se permite duplicar personal en el mismo sector y sección.' };
          }
          if (targetTypeNorm === 'CHOFER') {
            var exP2Norm = _normalizePersonnelName(ex.personnel2);
            if (exP2Norm && exP2Norm === newNameNorm) {
              return { success: false, error: 'DUPLICATE_PERSONNEL: El nombre "' + unit.personnel1 + '" ya está registrado como copiloto en el sector ' + targetSector + ' - sección CHOFER.' };
            }
          }
        }
        // Validar personnel2 (copiloto) también
        if (targetTypeNorm === 'CHOFER' && newName2Norm) {
          if (newName2Norm === newNameNorm) {
            return { success: false, error: 'DUPLICATE_PERSONNEL: El chofer y copiloto no pueden ser la misma persona.' };
          }
          for (var key2 in existingBySector) {
            if (!existingBySector.hasOwnProperty(key2)) continue;
            var ex2 = existingBySector[key2];
            if (!ex2) continue;
            if (newUnitIdNorm && String(ex2.unit_id || '').trim() === newUnitIdNorm) continue;
            if (String(ex2.type || '').trim().toUpperCase() !== 'CHOFER') continue;
            var ex2P1 = _normalizePersonnelName(ex2.personnel1);
            var ex2P2 = _normalizePersonnelName(ex2.personnel2);
            if (ex2P1 === newName2Norm || ex2P2 === newName2Norm) {
              return { success: false, error: 'DUPLICATE_PERSONNEL: El nombre "' + unit.personnel2 + '" ya está registrado en el sector ' + targetSector + ' - sección CHOFER.' };
            }
          }
        }
      }
    }
  } catch (e) { /* no bloquear guardado por error de validación, loggear */ console.error('[updateUnit duplicate check] ERROR', e); }

  const email = Session.getActiveUser().getEmail();
  const timestamp = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss');
  let auditLog = timestamp;
  if (email) auditLog = email + ' @ ' + auditLog;
  if (settings && settings.operador && settings.operador.trim()) auditLog = settings.operador.trim() + ' / ' + auditLog;

  let unit_id = unit.unit_id || '';
  if (!unit_id || unit_id === 'undefined' || unit_id.startsWith('TEMP-') || unit_id.startsWith('UID-') || unit_id.startsWith('DEF-') || unit_id.startsWith('LEGACY-') || !unit_id.includes(shift)) {
    const cleanDate = dateStr.replace(/-/g, '');
    const cleanId = String(unit.id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const cleanSector = String(targetSector || '').trim().toUpperCase().replace(/\s+/g, '_');
    if (cleanId) {
      unit_id = cleanDate + '_' + shift + '_' + cleanSector + '_' + cleanId;
    } else if (!unit_id || unit_id === 'undefined' || unit_id.startsWith('TEMP-') || unit_id.startsWith('LEGACY-') || !unit_id.includes(shift)) {
      // Sin id movil: se genera un unit_id unico y escopado por fecha+turno+sector.
      // Antes se conservaba un id generico (LEGACY-0, TEMP-...) que se repetia entre
      // sectores/turnos y hacia que el backup descartara esos registros.
      unit_id = 'UID-' + cleanDate + '_' + shift + '_' + cleanSector + '-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    // Si ya venia un UID-/DEF- bien formado (con turno) se conserva para no duplicar.
  }
  unit_id = _sanitizeRtdbKey(unit_id);

  const data = {
    date: dateStr,
    shift: shift,
    sector: targetSector,
    id: String(unit.id || '').trim(),
    type: unit.type,
    model: unit.model || '',
    personnel1: unit.personnel1 || '',
    personnel2: unit.personnel2 || '',
    plate: unit.plate || '',
    indicative: unit.indicative || '',
    radio: unit.radio || '',
    status: unit.status || '',
    reason: unit.reason || '',
    kmStart: unit.kmStart || '0',
    kmEnd: unit.kmEnd || '0',
    totalKm: unit.totalKm || '0',
    kmRecarga: unit.kmRecarga || '0',
    hours: unit.hours || '',
    fuel: unit.fuel || '',
    expense: unit.expense || '',
    fuel2: fuel2Value,
    expense2: expense2Value,
    partes: '0',
    quadrant: unit.quadrant || '',
    mechanics: unit.mechanics || '',
    unit_id: unit_id,
    lugarEstado: unit.lugarEstado || '',
    motivoEstado: unit.motivoEstado || '',
    taser: unit.taser || '',
    bodycam: unit.bodycam || '',
    codigoBodycam: unit.codigoBodycam || '',
    obsBodycam: unit.obsBodycam || '',
    codigoTaser: unit.codigoTaser || '',
    auditLog: auditLog,
    updatedAt: timestamp
  };

  const unitPath = 'units/' + dateStr + '_' + shift + '/' + targetSector + '/' + unit_id;
  console.log('[updateUnit] Persisting unit ' + unitPath + ' fuel2=' + fuel2Value + ' expense2=' + expense2Value);
  rtdbSet(unitPath, data);
  const persistedUnit = rtdbGet(unitPath);
  console.log('[updateUnit] leído desde Firebase: ' + JSON.stringify({
    path: unitPath,
    fuel2: persistedUnit && persistedUnit.fuel2,
    expense2: persistedUnit && persistedUnit.expense2,
    fuel2Alias: persistedUnit && persistedUnit.combustible2,
    expense2Alias: persistedUnit && persistedUnit.gasto2
  }));
  if (!persistedUnit ||
      String(persistedUnit.fuel2 || '') !== fuel2Value ||
      String(persistedUnit.expense2 || '') !== expense2Value) {
    throw new Error(
      'Firebase no confirmó COMBUSTIBLE_2/GASTO_2 para la unidad ' + unit_id +
      '. fuel2 enviado="' + fuel2Value + '", fuel2 leído="' + String(persistedUnit && persistedUnit.fuel2 || '') +
      '", expense2 enviado="' + expense2Value + '", expense2 leído="' + String(persistedUnit && persistedUnit.expense2 || '') + '".'
    );
  }

  _appendFuelRecords(settings || {}, unit, dateStr, targetSector, previousUnit, shift, unit_id);

  // KM bridge: update prev unit's kmEnd from current unit's kmStart
  const prevShiftInfo = getPreviousShift(dateStr, shift, timeZone);
  if (unit.id && unit.kmStart && unit.kmStart !== '0') {
    try {
      const cleanId = String(unit.id).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const prevUnitId = prevShiftInfo.date.replace(/-/g, '') + '_' + prevShiftInfo.shift + '_' + targetSector + '_' + cleanId;
      const found = rtdbGet('units/' + prevShiftInfo.date + '_' + prevShiftInfo.shift + '/' + targetSector + '/' + prevUnitId);
      if (found && found.kmStart) {
        const newKmEnd = parseFloat(unit.kmStart) || 0;
        const origKmStart = parseFloat(found.kmStart) || 0;
        found.kmEnd = unit.kmStart;
        found.totalKm = newKmEnd >= origKmStart ? (newKmEnd - origKmStart).toFixed(1) : '0';
        found.updatedAt = timestamp;
        rtdbSet('units/' + prevShiftInfo.date + '_' + prevShiftInfo.shift + '/' + targetSector + '/' + prevUnitId, found);
        rtdbSet('_meta/units/' + prevShiftInfo.date + '_' + prevShiftInfo.shift, { updatedAt: timestamp });
      }
    } catch (e) { /* prev shift not available */ }
  }

  // Update latest_km index with current unit's kmEnd (for next shift's reference)
  if (unit.id && unit.kmEnd && unit.kmEnd !== '0') {
    const searchId = String(unit.id).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    rtdbSet('latest_km/' + searchId, { kmEnd: unit.kmEnd, updatedAt: timestamp });
  }
  rtdbSet('_meta/units/' + dateStr + '_' + shift, { updatedAt: timestamp });
  rtdbSet('_meta/units/' + dateStr + '_' + shift + '/' + targetSector, { updatedAt: timestamp }); // New per-sector meta
  const cache = CacheService.getScriptCache();
  cache.remove('UNITS_' + dateStr + '_' + shift);
  cache.remove('UNITS_' + dateStr + '_' + shift + '_' + targetSector);
  cache.remove('UNITS_' + prevShiftInfo.date + '_' + prevShiftInfo.shift);
  _fbLogUsage();
  return {
    success: true,
    unit_id: unit_id,
    created: true,
    fuel2: persistedUnit.fuel2,
    expense2: persistedUnit.expense2
  };
}

/**
 * Searches VEHICULOS_RQ sheet by plate (partial match).
 */
function searchVehicles(searchTerm, marcaFilter, modeloFilter) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.VEHICLE_RQ_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RQ');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var colMap = {};
  headers.forEach(function(h, i) { colMap[h] = i; });

  // Columna de imagen: 'url_img' exacto o variante (URL IMG, IMAGEN, FOTO...)
  var urlImgIdx = colMap['url_img'];
  if (urlImgIdx === undefined) {
    for (var uhi = 0; uhi < headers.length; uhi++) {
      var uhh = String(headers[uhi]).toLowerCase().trim();
      if ((uhh.indexOf('url') !== -1 && uhh.indexOf('img') !== -1) || uhh === 'imagen' || uhh === 'foto' || uhh === 'fotografia') {
        urlImgIdx = uhi;
        break;
      }
    }
  }

  var term = String(searchTerm || '').toLowerCase().trim();
  var marcaF = String(marcaFilter || '').toLowerCase().trim();
  var modeloF = String(modeloFilter || '').toLowerCase().trim();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var plate = colMap['placa'] !== undefined ? String(row[colMap['placa']] || '').toLowerCase().trim() : '';
    var marca = colMap['marca'] !== undefined ? String(row[colMap['marca']] || '').toLowerCase().trim() : '';
    var modelo = colMap['modelo'] !== undefined ? String(row[colMap['modelo']] || '').toLowerCase().trim() : '';

    // Búsqueda solo por placa (se ignoran guiones/espacios: ABC123 = ABC-123)
    // más filtros aparte de marca y modelo (vacíos = sin filtro)
    var plateNorm = plate.replace(/[^a-z0-9]/g, '');
    var termNorm = term.replace(/[^a-z0-9]/g, '');
    var okPlate = !term || (termNorm && plateNorm.indexOf(termNorm) !== -1);
    var okMarca = !marcaF || marca.indexOf(marcaF) !== -1;
    var okModelo = !modeloF || modelo.indexOf(modeloF) !== -1;
    if (okPlate && okMarca && okModelo) {
      results.push({
        operador: colMap['operador'] !== undefined ? String(row[colMap['operador']] || '') : '',
        sade: colMap['sade'] !== undefined ? cellToStr(row[colMap['sade']], ss.getSpreadsheetTimeZone()) : '',
        fecha: colMap['fecha'] !== undefined ? cellToStr(row[colMap['fecha']], ss.getSpreadsheetTimeZone()) : '',
        tipo: colMap['tipo'] !== undefined ? String(row[colMap['tipo']] || '') : '',
        marca: colMap['marca'] !== undefined ? String(row[colMap['marca']] || '') : '',
        modelo: colMap['modelo'] !== undefined ? String(row[colMap['modelo']] || '') : '',
        color: colMap['color'] !== undefined ? String(row[colMap['color']] || '') : '',
        placa: colMap['placa'] !== undefined ? String(row[colMap['placa']] || '') : '',
        estado: colMap['estado'] !== undefined ? String(row[colMap['estado']] || '') : '',
        relato: colMap['relato'] !== undefined ? String(row[colMap['relato']] || '') : '',
        tipoDelito: colMap['tipo_delito'] !== undefined ? String(row[colMap['tipo_delito']] || '') : '',
        subtipoDelito: colMap['subtipo_delito'] !== undefined ? String(row[colMap['subtipo_delito']] || '') : '',
        sector: colMap['sector'] !== undefined ? String(row[colMap['sector']] || '') : '',
        cuadrante: colMap['cuadrante'] !== undefined ? cellToStr(row[colMap['cuadrante']], ss.getSpreadsheetTimeZone()) : '',
        urlImg: (urlImgIdx === undefined || urlImgIdx === -1) ? '' : String(row[urlImgIdx] || ''),
        propietario: colMap['propietario'] !== undefined ? String(row[colMap['propietario']] || '') : '',
      });
    }
  }

  return results;
}

/**
 * Returns all unique plates from VEHICULOS_RQ for autocomplete.
 */
function getVehiclePlates() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.VEHICLE_RQ_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RQ');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var placaIdx = headers.indexOf('placa');
  if (placaIdx === -1) return [];

  var plates = [];
  var seen = {};
  for (var i = 1; i < data.length; i++) {
    var plate = String(data[i][placaIdx] || '').trim().toUpperCase();
    if (plate && !seen[plate]) {
      seen[plate] = true;
      plates.push(plate);
    }
  }
  return plates.sort();
}

/**
 * Returns all unique marca values from VEHICULOS_RQ for the brand filter.
 */
function getVehicleMarcas() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.VEHICLE_RQ_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RQ');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var marcaIdx = headers.indexOf('marca');
  if (marcaIdx === -1) return [];

  var marcas = [];
  var seen = {};
  for (var i = 1; i < data.length; i++) {
    var marca = String(data[i][marcaIdx] || '').trim().toUpperCase();
    if (marca && !seen[marca]) {
      seen[marca] = true;
      marcas.push(marca);
    }
  }
  return marcas.sort();
}

/**
 * Returns distinct tipo_delito values and subtipos grouped by tipo from VEHICULOS_RQ.
 */
function getVehicleDelitos() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.VEHICLE_RQ_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RQ');
  if (!sheet) return { tipos: [], porTipo: {} };

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { tipos: [], porTipo: {} };

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var tipoIdx = headers.indexOf('tipo_delito');
  var subIdx = headers.indexOf('subtipo_delito');

  var tipoSeen = {};
  var porTipo = {};
  for (var i = 1; i < data.length; i++) {
    var t = tipoIdx !== -1 ? String(data[i][tipoIdx] || '').trim().toUpperCase() : '';
    var s = subIdx !== -1 ? String(data[i][subIdx] || '').trim().toUpperCase() : '';
    if (t) tipoSeen[t] = true;
    if (t && s) {
      if (!porTipo[t]) porTipo[t] = [];
      if (porTipo[t].indexOf(s) === -1) porTipo[t].push(s);
    }
  }
  var tipos = Object.keys(tipoSeen).sort();
  Object.keys(porTipo).forEach(function(k) { porTipo[k].sort(); });
  return { tipos: tipos, porTipo: porTipo };
}

/**
 * Returns all unique cuadrante values from the DATA sheet for autocomplete.
 */
function getQuadrantList() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.referenceData);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  const cuadranteIdx = headers.indexOf('cuadrante');
  if (cuadranteIdx === -1) return [];

  var seen = {};
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var val = String(data[i][cuadranteIdx] || '').trim();
    if (val && !seen[val]) {
      seen[val] = true;
      list.push(val);
    }
  }
  return list.sort();
}

/**
 * Appends a new vehicle record to the RQ sheet.
 * @param {Object} data - Vehicle data with all fields.
 */
function saveVehicleRQ(data) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.VEHICLE_RQ_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RQ');
  if (!sheet) throw new Error('Sheet RQ not found');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colMap = {};
  headers.forEach(function(h, i) { colMap[String(h).toLowerCase().trim()] = i + 1; });

  // Columnas nuevas se crean solas si no existen (url_img, origen)
  ['url_img', 'origen'].forEach(function(colName) {
    if (colMap[colName] !== undefined) return;
    var foundUrlCol = -1;
    for (var hi = 0; hi < headers.length; hi++) {
      var hh = String(headers[hi]).toLowerCase().trim();
      if (colName === 'url_img' && ((hh.indexOf('url') !== -1 && hh.indexOf('img') !== -1) || hh === 'imagen' || hh === 'foto' || hh === 'fotografia')) {
        foundUrlCol = hi + 1;
        break;
      }
    }
    if (foundUrlCol !== -1) {
      colMap[colName] = foundUrlCol;
    } else {
      sheet.getRange(1, headers.length + 1).setValue(colName === 'url_img' ? 'URL_IMG' : 'ORIGEN');
      headers.push(colName === 'url_img' ? 'URL_IMG' : 'ORIGEN');
      colMap[colName] = headers.length;
    }
  });

  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push('');
  }

  var fieldMapping = {
    operador: 'operador',
    sade: 'sade',
    fecha: 'fecha',
    tipo: 'tipo',
    marca: 'marca',
    modelo: 'modelo',
    color: 'color',
    placa: 'placa',
    estado: 'estado',
    relato: 'relato',
    tipoDelito: 'tipo_delito',
    subtipoDelito: 'subtipo_delito',
    sector: 'sector',
    cuadrante: 'cuadrante',
    urlImg: 'url_img',
    propietario: 'propietario',
    origen: 'origen'
  };

  Object.keys(fieldMapping).forEach(function(key) {
    var colName = fieldMapping[key];
    var colIdx = colMap[colName];
    if (colIdx !== undefined) {
      row[colIdx - 1] = String(data[key] || '');
    }
  });

  sheet.appendRow(row);
  return { success: true };
}

/**
 * Sube una imagen JPG (máx. 200KB) a Drive y devuelve su URL para el campo URL_IMG.
 */
function uploadVehicleImage(dataUrl, fileName) {
  if (!dataUrl) throw new Error('Sin imagen para subir');
  var matches = String(dataUrl).match(/^data:(image\/jpeg|image\/jpg);base64,(.+)$/);
  if (!matches) throw new Error('La imagen debe estar en formato JPG');
  var bytes = Utilities.base64Decode(matches[2]);
  if (bytes.length > 200 * 1024) throw new Error('La imagen supera los 200KB');
  var blob = Utilities.newBlob(bytes, 'image/jpeg', fileName || 'vehiculo.jpg');
  // Carpeta fija de imágenes RQ (ID proporcionado por el usuario)
  var folder = DriveApp.getFolderById('11p2y-Z95zzMp4vXq475Yoz_uYg40Yq34');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

var GEMINI_MODEL = 'gemini-3.6-flash';

/**
 * Extrae datos del vehículo desde una captura (p.ej. SUNARP) usando Gemini.
 * La API key se configura en Propiedades del script: GEMINI_API_KEY.
 * Devuelve {placa, placaVigente, marca, modelo, color, propietario, tipo}.
 */
function extractVehicleFromImage(dataUrl) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Falta configurar GEMINI_API_KEY en las propiedades del script (Configuración del proyecto)');
  var m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!m) throw new Error('La imagen debe ser JPG o PNG');
  var prompt = 'Eres un extractor de datos. Analiza la imagen (captura de consulta vehicular SUNARP del Perú) y devuelve SOLO un objeto JSON válido, sin markdown ni texto extra, con exactamente estas claves: {"placa":"","placaVigente":"","marca":"","modelo":"","color":"","propietario":"","tipo":""}. ' +
    'placa = N° PLACA. placaVigente = PLACA VIGENTE (si existe, si no ""). ' +
    'marca, modelo, color, propietario (PROPIETARIO(S)) tal cual aparecen, en mayúsculas. ' +
    'tipo = clasifica el vehículo según marca/modelo en exactamente uno de: AUTO, CAMIONETA, MOTOTAXI, MOTO. Si no estás seguro, deja "". ' +
    'Si un dato no aparece o no es legible, deja "".';
  var payload = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: m[1].toLowerCase(), data: m[2] } }
    ] }],
    generationConfig: { temperature: 0, response_mime_type: 'application/json' }
  };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
  var options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  // Reintentos con espera progresiva ante saturación (503/429: picos temporales)
  var lastErr = '';
  for (var attempt = 1; attempt <= 3; attempt++) {
    var resp = UrlFetchApp.fetch(url, options);
    var code = resp.getResponseCode();
    if (code === 200) {
      var json = JSON.parse(resp.getContentText());
      var parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts
        ? json.candidates[0].content.parts : [];
      var text = parts.map(function(p) { return p.text || ''; }).join('').replace(/```json|```/g, '').trim();
      var parsed = JSON.parse(text);
      var obj = Array.isArray(parsed) ? (parsed[0] || {}) : (parsed || {});
      if (typeof obj !== 'object') obj = {};
      // Normaliza nombres de clave (el modelo a veces varía: placa_vigente, propietarios...)
      var normKey = function(k) {
        return String(k).toLowerCase().replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
          .replace(/[^a-z]/g, '');
      };
      var ALIASES = {
        placa: ['placa', 'nplaca', 'numeroplaca', 'nrodeplaca', 'numplaca', 'matricula'],
        placaVigente: ['placavigente', 'placaactual', 'vigente', 'placanueva'],
        marca: ['marca', 'brand'],
        modelo: ['modelo', 'model'],
        color: ['color', 'colour', 'colores'],
        propietario: ['propietario', 'propietarios', 'dueno', 'duenos', 'titular', 'titulares', 'owner', 'propietary'],
        tipo: ['tipo', 'tipovehiculo', 'clase', 'clasevehiculo', 'categoria', 'type']
      };
      var out = { placa: '', placaVigente: '', marca: '', modelo: '', color: '', propietario: '', tipo: '' };
      Object.keys(obj).forEach(function(k) {
        var nk = normKey(k);
        Object.keys(ALIASES).forEach(function(canon) {
          if (!out[canon] && typeof obj[k] === 'string' && ALIASES[canon].indexOf(nk) !== -1) {
            out[canon] = obj[k].trim();
          }
        });
      });
      out._raw = String(text).substring(0, 500);
      return out;
    }
    lastErr = 'Error Gemini (' + code + '): ' + String(resp.getContentText()).substring(0, 200);
    if ((code === 503 || code === 429) && attempt < 3) {
      Utilities.sleep(attempt * 2000);
    } else {
      break;
    }
  }
  if (lastErr.indexOf('(503)') !== -1 || lastErr.indexOf('(429)') !== -1) {
    // Fallback automático: OCR de Drive (gratis, sin cuotas de modelo)
    try {
      return extractVehicleOCR(dataUrl);
    } catch (ocrErr) {
      throw new Error('Extracción saturada y OCR no disponible: ' + String((ocrErr && ocrErr.message) || ocrErr));
    }
  }
  throw new Error(lastErr);
}

/**
 * Fallback sin IA: OCR nativo de Drive + parseo por etiquetas del formato SUNARP.
 * Requiere activar el Servicio Avanzado de Drive (Editor > Servicios > Drive API).
 * Devuelve el mismo objeto que extractVehicleFromImage.
 */
function extractVehicleOCR(dataUrl) {
  var m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!m) throw new Error('La imagen debe ser JPG o PNG');
  if (typeof Drive === 'undefined' || !Drive.Files) {
    throw new Error('Activa el servicio avanzado de Drive (Editor > Servicios > Drive API)');
  }
  var bytes = Utilities.base64Decode(m[2]);
  var blob = Utilities.newBlob(bytes, 'image/jpeg', 'ocr-tmp.jpg');
  var inserted = Drive.Files.insert({ title: 'ocr-tmp', mimeType: 'image/jpeg' }, blob, { ocr: true, ocrLanguage: 'es' });
  try {
    var text = DocumentApp.openById(inserted.id).getBody().getText();
    return parseSunarpOCR(text);
  } finally {
    try { Drive.Files.remove(inserted.id); } catch (e) {}
  }
}

var OCR_MOTO_KW = ['XTZ', 'XRE', 'XR150', 'XR190', 'CB125', 'CB190', 'CBR', 'NINJA', 'Z400', 'MT03', 'MT15', 'FZ', 'FAZER', 'YBR', 'GN125', 'DR150', 'PULSAR', 'DOMINAR', 'BOXER', 'DISCOVER', 'DT175', 'AX4', 'NMAX', 'XMAX', 'PCX', 'ELITE', 'NAVI', 'WAVE', 'CRYPTON', 'AGILITY', 'APACHE', 'GIXXER', 'HUNK', 'TORNADO', 'TWISTER', 'KLX', 'DUKE', 'RC200', 'TNT', 'TRK', 'SPLENDOR', 'HAYATE', 'INTRUDER'];
var OCR_MOTOTAXI_KW = ['TORITO', 'BAJAJ RE', 'TVS KING', 'KING'];
var OCR_CAMIONETA_KW = ['HILUX', 'RANGER', 'FRONTIER', 'NAVARA', 'DMAX', 'D-MAX', 'L200', 'AMAROK', 'NP300', 'T60', 'T8', 'POER', 'WINGLE', 'F-150', 'F150', 'RAM 1500', 'SILVERADO', 'COLORADO', 'S10', 'MONTANA', 'SAVEIRO', 'OROCH', 'TORO', 'STRADA', 'ACTYON', 'KYRON', 'REXTON'];
var OCR_AUTO_MARCAS = ['TOYOTA', 'NISSAN', 'KIA', 'HYUNDAI', 'VOLKSWAGEN', 'CHEVROLET', 'MAZDA', 'MITSUBISHI', 'FORD', 'RENAULT', 'PEUGEOT', 'VOLVO', 'SUBARU', 'JEEP', 'DODGE', 'FIAT', 'SEAT', 'SKODA', 'MG', 'CHERY', 'GEELY', 'HAVAL', 'JAC', 'BYD', 'DONGFENG', 'GREAT WALL', 'CITROEN', 'OPEL', 'LEXUS', 'AUDI', 'BMW', 'MERCEDES'];

function parseSunarpOCR(text) {
  var lines = String(text || '').split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
  var out = { placa: '', placaVigente: '', marca: '', modelo: '', color: '', propietario: '', tipo: '' };
  // Corta restos de la marca de agua que el OCR mezcla en los valores
  var cleanVal = function(s) {
    return String(s || '').split(/sunarp|esta informaci|constituye|publicidad|registral|titularidad|cargando/gi)[0].trim();
  };
  var getLine = function(re) {
    for (var i = 0; i < lines.length; i++) {
      var mm = lines[i].match(re);
      if (mm) {
        var v = cleanVal(mm[1] || '');
        if (!v && i + 1 < lines.length && lines[i + 1].indexOf(':') === -1) v = cleanVal(lines[i + 1]);
        return v;
      }
    }
    return '';
  };
  out.placaVigente = getLine(/^PLACA\s+VIGENTE\s*:?\s*([A-Z0-9][A-Z0-9\-\s]*)/i);
  out.placa = getLine(/^N[o°º0]?\s*PLACA(?!\s*(VIGENTE|ANTERIOR))\s*:?\s*([A-Z0-9][A-Z0-9\-\s]*)/i);
  // Si el grupo 1 trajo el N° por el prefijo opcional, usa el grupo 2
  if (!out.placa) {
    for (var j = 0; j < lines.length; j++) {
      var m2 = lines[j].match(/^N[o°º0]?\s*PLACA(?!\s*(VIGENTE|ANTERIOR))\s*:?\s*(.+)$/i);
      if (m2) { out.placa = cleanVal(m2[2] || m2[1] || ''); break; }
    }
  }
  out.marca = getLine(/^MARCA\s*:?\s*(.+)$/i);
  out.modelo = getLine(/^MODELO\s*:?\s*(.+)$/i);
  out.color = getLine(/^COLOR\s*:?\s*(.+)$/i);
  out.propietario = getLine(/^PROPIETARIO(?:\(S\))?\s*:?\s*(.*)$/i);
  // Tipo por palabras clave de marca+modelo
  var mm = (out.marca + ' ' + out.modelo).toUpperCase();
  var hasAny = function(list) {
    for (var k = 0; k < list.length; k++) { if (mm.indexOf(list[k]) !== -1) return true; }
    return false;
  };
  if (hasAny(OCR_MOTOTAXI_KW)) out.tipo = 'MOTOTAXI';
  else if (hasAny(OCR_MOTO_KW)) out.tipo = 'MOTO';
  else if (hasAny(OCR_CAMIONETA_KW)) out.tipo = 'CAMIONETA';
  else if (hasAny(OCR_AUTO_MARCAS)) out.tipo = 'AUTO';
  out._raw = 'OCR:' + String(text || '').substring(0, 300);
  return out;
}

/**
 * Serves the web application.
 */
/**
 * Cleanup: removes test data created by StressTestFirebase and loadtest.
 * Run from editor: cleanupTestData()
 */
function cleanupTestData() {
  const testPrefixes = ['STRESS-FB-', 'STRESS-BATCH-', 'LOAD-', 'TEST-T', 'PYTEST-', 'LTEST-', 'CTEST-'];
  const testOpPrefixes = ['TEST', 'STRESS', 'OP_STRESS', 'OP_FINAL', 'PYOP-', 'LOP-', 'SUP-', 'COP-', 'CSUP-'];
  const tz = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const shifts = ['MAÑANA', 'TARDE', 'NOCHE'];
  const testDates = [];

  // Collect dates with test data (today and recent days)
  testDates.push(today);
  for (let d = 1; d <= 7; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    testDates.push(Utilities.formatDate(date, tz, 'yyyy-MM-dd'));
  }

  let delUnits = 0, delShifts = 0;

  for (const dateStr of testDates) {
    for (const shift of shifts) {
      // Clean units
      const units = fbQuery('units', [
        { field: 'date', value: dateStr },
        { field: 'shift', value: shift }
      ]);
      for (const unit of units || []) {
        const id = (unit.id || '').toUpperCase();
        const isTestPrefix = testPrefixes.some(p => id.startsWith(p));
        const isEmptyId = !unit.id || unit.id.trim() === '';
        const isTestOp = testOpPrefixes.some(p => (unit.operador || '').toUpperCase().startsWith(p));
        if (isTestPrefix || (isEmptyId && isTestOp)) {
          try { fbDelete('units', unit._id); delUnits++; } catch (e) { console.error('Error deleting unit: ' + e); }
        }
      }

      // Clean shifts
      const shiftsData = fbQuery('shifts', [
        { field: 'date', value: dateStr },
        { field: 'shift', value: shift }
      ]);
      for (const s of shiftsData || []) {
        const op = (s.operador || '').toUpperCase();
        const sup = (s.supervisor || '').toUpperCase();
        if (testOpPrefixes.some(p => op.startsWith(p)) || testOpPrefixes.some(p => sup.startsWith(p))) {
          try { fbDelete('shifts', s._id); delShifts++; } catch (e) { console.error('Error deleting shift: ' + e); }
        }
      }
    }
  }

  console.log('Cleaned up: ' + delUnits + ' units, ' + delShifts + ' shifts');
}

/**
 * One-time migration: copies all UNIT_DATA and SHIFT_SETTINGS from Sheets to Firestore.
 * Run once from the GAS editor after configuring Firebase.
 */
function migrateToFirebase() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const timeZone = ss.getSpreadsheetTimeZone();

  // Migrate SHIFT_SETTINGS
  console.log('[migrate] Starting SHIFT_SETTINGS migration...');
  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (settingsSheet) {
    const rows = settingsSheet.getDataRange().getValues();
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      try {
        const dateStr = Utilities.formatDate(new Date(r[0]), timeZone, 'yyyy-MM-dd');
        const shift = String(r[1] || '');
        const sector = toStorageSector(r[2] || '');
        const docId = dateStr + '_' + shift + '_' + sector;
        fbSet('shifts', docId, {
          date: dateStr, shift: shift, sector: sector,
          operador: String(r[3] || ''), supervisor: String(r[4] || ''), permanencia: String(r[5] || ''),
          supervisorTaser: String(r[6] || ''), supervisorBodycam: String(r[7] || ''),
          supervisorCodigoTaser: String(r[8] || ''), supervisorCodigoBodycam: String(r[9] || ''),
          permanenciaTaser: String(r[10] || ''), permanenciaBodycam: String(r[11] || ''),
          permanenciaCodigoTaser: String(r[12] || ''), permanenciaCodigoBodycam: String(r[13] || ''),
          supervisorEstado: String(r[14] || ''), supervisorRadio: String(r[15] || ''), supervisorEncargado: String(r[16] || ''),
          supervisorMotivo: String(r[20] || ''),
          permanenciaEstado: String(r[17] || ''), permanenciaRadio: String(r[18] || ''), permanenciaEncargado: String(r[19] || ''),
          permanenciaMotivo: String(r[21] || ''),
          updatedAt: Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss')
        });
        count++;
      } catch (e) { console.error('migrate settings row ' + i + ': ' + e); }
    }
    console.log('[migrate] SHIFT_SETTINGS: ' + count + ' docs migrated');
  }

  // Migrate UNIT_DATA
  console.log('[migrate] Starting UNIT_DATA migration...');
  const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  if (dataSheet) {
    const rows = dataSheet.getDataRange().getValues();
    const batchSize = 20;
    let total = 0;

    for (let start = 1; start < rows.length; start += batchSize) {
      const end = Math.min(start + batchSize, rows.length);
      const batch = [];

      for (let i = start; i < end; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        try {
          const dateStr = Utilities.formatDate(new Date(r[0]), timeZone, 'yyyy-MM-dd');
          const unit_id = String(r[23] || '');
          if (!unit_id) continue;

          batch.push({
            collection: 'units',
            docId: unit_id,
            data: {
              date: dateStr, shift: String(r[1] || ''), sector: String(r[2] || ''),
              id: String(r[3] || ''), type: String(r[4] || ''), model: String(r[5] || ''),
              personnel1: String(r[6] || ''), personnel2: String(r[7] || ''),
              plate: String(r[8] || ''), indicative: String(r[9] || ''), radio: String(r[10] || ''),
              status: String(r[11] || ''), reason: String(r[12] || ''),
              kmStart: String(r[13] || '0'), kmEnd: String(r[14] || '0'), totalKm: String(r[15] || '0'),
              kmRecarga: String(r[16] || '0'), hours: String(r[17] || ''),
              fuel: String(r[18] || ''), expense: String(r[19] || ''), partes: String(r[20] || '0'),
              fuel2: String(r[32] || ''), expense2: String(r[33] || ''),
              quadrant: cellToStr(r[21], timeZone), mechanics: String(r[22] || ''),
              unit_id: unit_id, lugarEstado: String(r[24] || ''), motivoEstado: String(r[25] || ''),
              auditLog: String(r[26] || ''),
              updatedAt: Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss')
            }
          });
        } catch (e) { /* skip row */ }
      }

      if (batch.length > 0) {
        fbSetAll(batch);
        total += batch.length;
      }
    }
    console.log('[migrate] UNIT_DATA: ' + total + ' docs migrated');
  }

  return { success: true, message: 'Migration complete. Settings + Units copied to Firestore.' };
}

/**
 * Migrate data from Firestore to RTDB.
 * Copy all units and shifts docs to RTDB with the new path format.
 * Run once from GAS editor after switching to RTDB.
 * Ejecutar: migrateFirestoreToRTDB()
 */
function migrateFirestoreToRTDB() {
  console.log('[migrateFirestoreToRTDB] START');
  let totalUnits = 0, totalShifts = 0;

  // Shifts
  try {
    const shifts = fbQuery('shifts', []);
    for (let i = 0; i < shifts.length; i++) {
      const s = shifts[i];
      if (s.date && s.shift && s.sector) {
        const path = 'shifts/' + s.date + '_' + s.shift + '/' + s.sector;
        rtdbSet(path, s);
        totalShifts++;
      }
    }
    console.log('[migrateFirestoreToRTDB] shifts: ' + totalShifts);
  } catch (e) {
    console.error('[migrateFirestoreToRTDB] ERROR reading shifts:', e);
  }

  // Units
  try {
    const units = fbQuery('units', []);
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.date && u.shift && u.sector && u.unit_id) {
        const sectorKey = toStorageSector(u.sector);
        const path = 'units/' + u.date + '_' + u.shift + '/' + sectorKey + '/' + u.unit_id;
        rtdbSet(path, u);
        totalUnits++;
      }
    }
    console.log('[migrateFirestoreToRTDB] units: ' + totalUnits);
  } catch (e) {
    console.error('[migrateFirestoreToRTDB] ERROR reading units:', e);
  }

  console.log('[migrateFirestoreToRTDB] DONE — shifts=' + totalShifts + ' units=' + totalUnits);
  return { success: true, shifts: totalShifts, units: totalUnits };
}

/**
 * STRESS TEST for Firebase backend.
 * Ejecutar desde el editor GAS: StressTestFirebase()
 */
function StressTestFirebase() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const shift = 'MAÑANA';
  const sector = '2A';

  console.log('[StressTestFirebase] START — ' + dateStr + ' ' + shift + ' ' + sector);

  // Test 1: 50 updateUnit saves
  console.log('[StressTest] Test 1: 50x updateUnit...');
  const ids = [];
  let ok = 0, fail = 0;
  for (let i = 0; i < 50; i++) {
    const result = updateUnit(dateStr, shift, { nombrePuesto: sector, operador: 'STRESS' }, {
      id: 'STRESS-FB-' + i, type: 'CHOFER', status: 'ACTIVO',
      kmStart: String(100 + i), sector: sector
    });
    if (result.success) { ids.push(result.unit_id); ok++; }
    else { fail++; console.error('FAIL ' + i + ': ' + result.error); }
  }
  console.log('[StressTest] Test 1 OK: ' + ok + ' success, ' + fail + ' fail');

  // Test 2: saveShiftSettings
  console.log('[StressTest] Test 3: saveShiftSettings...');
  const setResult = saveShiftSettings(dateStr, shift, {
    nombrePuesto: sector, operador: 'OP_FINAL', supervisor: 'SUP_FINAL', permanencia: '3H'
  });
  console.log('[StressTest] Test 3: ' + JSON.stringify(setResult));

  // Verification
  console.log('[StressTest] Verification: reading back...');
  const data = getSectorData(dateStr, shift, sector);
  const unitIdCounts = {};
  data.units.forEach(u => {
    unitIdCounts[u.unit_id] = (unitIdCounts[u.unit_id] || 0) + 1;
  });
  const dupes = Object.entries(unitIdCounts).filter(([k, v]) => v > 1);
  console.log('[StressTest] Verify — ' + data.units.length + ' rows, ' + Object.keys(unitIdCounts).length + ' unique unit_ids, ' + dupes.length + ' duplicates');

  const settingsRead = data.settings;
  console.log('[StressTest] Settings: ' + JSON.stringify(settingsRead));

  return {
    updateUnitOK: ok, updateUnitFAIL: fail,
    totalUnits: data.units.length, uniqueUnitIds: Object.keys(unitIdCounts).length,
    duplicates: dupes.length,
    settingsOperador: settingsRead.operador
  };
}

/**
 * runLoadTest — Prueba de carga desde GAS (no necesita navegador).
 * Corre en el editor de GAS o desde doPost.
 * 
 * @param {number} numWorkers — cuantos workers simultaneos (default 10)
 * @param {number} savesPerWorker — saves por worker (default 10)
 * @returns {object} resultados con timing
 */
function runLoadTest(numWorkers, savesPerWorker) {
  numWorkers = numWorkers || 15;
  savesPerWorker = savesPerWorker || 1;
  const now = new Date();
  const tz = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone();
  const dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const shift = 'MAÑANA';

  // All 14 sectors
  const sectors = ['1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B', 'RESCATE', 'GIR'];

  // Per sector: which sections and how many units of each
  // [sectionType, idPrefix, count]
  const sectionDefs = {
    '1A':      [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '1B':      [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '2A':      [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '2B':      [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '3':       [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '4':       [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '5':       [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '6':       [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '7':       [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '8':       [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '9A':      [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    '9B':      [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
    'RESCATE': [['CHOFER', 'C', 10]],
    'GIR':     [['CHOFER', 'C', 10], ['MOTO', 'H', 10], ['SERENO', 'S', 10]],
  };

  const statuses = ['ACTIVO', 'COMISION', 'PATIO', 'TALLER', 'DESPACHADO'];
  const reasons = ['TRASLADO', 'MANTENIMIENTO', 'DESCANSO', 'COMBUSTIBLE', 'OTROS'];
  const models = ['TOYOTA HILUX', 'NISSAN NP300', 'HYUNDAI TUCSON', 'KIA SPORTAGE', 'FORD RANGER'];
  const personnels = ['Juan Perez', 'Maria Garcia', 'Carlos Lopez', 'Ana Martinez', 'Pedro Ramirez', 'Lucia Fernandez'];

  const unitsPerSector = Object.values(sectionDefs).reduce((sum, defs) => sum + defs.reduce((s, d) => s + d[2], 0), 0);
  const totalWrites = numWorkers * (sectors.length + unitsPerSector * savesPerWorker);

  console.log('[runLoadTest] START — ' + numWorkers + ' workers, ' + sectors.length + ' sectores, ' + unitsPerSector + ' unidades c/u, ' + savesPerWorker + ' veces = ' + totalWrites + ' writes');
  const startTime = Date.now();

  const allItems = [];
  for (let w = 1; w <= numWorkers; w++) {
    for (let s = 0; s < savesPerWorker; s++) {
      const ts = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');

      for (const sector of sectors) {
        const defs = sectionDefs[sector];
        if (!defs) continue;

        // Settings doc (shifts collection) — one per sector per save
        if (s === 0) {
          const settingsDocId = dateStr + '_' + shift + '_' + sector;
          allItems.push({ collection: 'shifts', docId: settingsDocId, data: {
            date: dateStr, shift: shift, sector: sector,
            operador: 'LOP-W' + w,
            supervisor: 'SUP-W' + w,
            permanencia: String(Math.floor(Math.random() * 8) + 1) + 'H',
            updatedAt: ts
          }});
        }

        // Units per section
        let idx = 0;
        for (const [type, prefix, count] of defs) {
          for (let u = 0; u < count; u++) {
            idx++;
            const unitRawId = prefix + String(100 + (s * 100) + idx);
            const unitId = 'LTEST-W' + w + '-' + sector + '-' + unitRawId;
            const cleanId = String(unitId).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
            const finalUnitId = dateStr.replace(/-/g, '') + '_' + shift + '_' + sector + '_' + cleanId;
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            allItems.push({ collection: 'units', docId: finalUnitId, data: {
              date: dateStr, shift: shift, sector: sector,
              id: unitId,
              type: type,
              model: models[Math.floor(Math.random() * models.length)],
              personnel1: personnels[Math.floor(Math.random() * personnels.length)],
              personnel2: personnels[Math.floor(Math.random() * personnels.length)],
              plate: 'ABC-' + String(1000 + w * 100 + idx),
              indicative: (sector + '-' + unitRawId).toUpperCase(),
              radio: 'RAD-' + String(1000 + w * 100 + idx),
              status: status,
              reason: status !== 'ACTIVO' ? reasons[Math.floor(Math.random() * reasons.length)] : '',
              kmStart: String(Math.floor(Math.random() * 500) + 100),
              kmEnd: String(Math.floor(Math.random() * 200) + 600),
              totalKm: String(Math.floor(Math.random() * 300) + 50),
              kmRecarga: String(Math.floor(Math.random() * 100)),
              hours: String(Math.floor(Math.random() * 12) + 1) + 'H',
              fuel: String(Math.floor(Math.random() * 50) + 10) + 'GL',
              expense: String(Math.floor(Math.random() * 200) + 20),
              partes: '0',
              quadrant: String(Math.floor(Math.random() * 4) + 1),
              mechanics: Math.random() > 0.7 ? 'MEC-' + String(100 + w) : '',
              unit_id: finalUnitId,
              lugarEstado: status !== 'ACTIVO' ? 'SECTOR ' + sector : '',
              motivoEstado: status !== 'ACTIVO' ? reasons[Math.floor(Math.random() * reasons.length)] : '',
              auditLog: 'LOP-W' + w + ' / test@test.com @ ' + ts,
              updatedAt: ts
            }});
          }
        }
      }
    }
  }

  console.log('[runLoadTest] Preparados ' + allItems.length + ' documentos. Enviando...');

  let ok = 0, fail = 0;
  for (let i = 0; i < allItems.length; i += 50) {
    const batch = allItems.slice(i, i + 50);
    try {
      const results = fbSetAll(batch);
      ok += results.length;
    } catch (e) {
      fail += batch.length;
      console.error('[runLoadTest] Batch error: ' + e);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;

  console.log('[runLoadTest] DONE — ' + elapsed + 's, ' + ok + ' OK, ' + fail + ' FAIL');

  return {
    total: totalWrites, written: ok, failed: fail,
    elapsedSeconds: elapsed,
    opsPerSecond: Math.round(totalWrites / elapsed),
    workers: numWorkers, sectors: sectors.length, unitsPerSector: unitsPerSector, savesPerWorker: savesPerWorker
  };
}

/**
 * Web app doGet — sirve la app embedida en GAS
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Sistema Integrado de Control Operativo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Generates and stores a random API key for doPost authentication.
 * Run once from GAS editor: setupApiKey()
 * Then use the key in all POST requests: { action: "...", apiKey: "..." }
 */
function setupApiKey() {
  const key = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('API_KEY', key);
  console.log('[API] Key generated: ' + key);
  return { success: true, apiKey: key };
}

/**
 * Returns the stored API key (requires the current key to verify).
 */
function getApiKey(currentKey) {
  const stored = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!stored) return { success: false, error: 'No API key configured. Run setupApiKey() first.' };
  if (currentKey !== stored) return { success: false, error: 'Invalid API key' };
  return { success: true, apiKey: stored };
}

function _checkApiKey(provided) {
  const stored = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!stored) return false;
  return provided === stored;
}

/**
 * Web app doPost — endpoint HTTP para pruebas de concurrencia externas.
 * Body JSON con { action, dateStr, shift, settings, units, unit, apiKey }.
 * Ej: { action: "updateUnit", apiKey: "...", dateStr: "2026-06-01", shift: "MAÑANA", settings: {...}, unit: {...} }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;

    // Public actions (no API key required)
    switch (action) {
      case 'ping':
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, pong: true, timestamp: new Date().toISOString() }))
          .setMimeType(ContentService.MimeType.JSON);
      case 'setupApiKey':
        result = setupApiKey();
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
    }

    // All other actions require API key
    if (!_checkApiKey(data.apiKey)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Unauthorized: invalid or missing API key' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    switch (action) {
      case 'getApiKey':
        result = getApiKey(data.apiKey);
        break;
      case 'updateUnit':
        result = updateUnit(data.dateStr, data.shift, data.settings || {}, data.unit);
        break;
      case 'saveShiftSettings':
        result = saveShiftSettings(data.dateStr, data.shift, data.settings || {});
        break;
      case 'getQuadrantsData':
        result = getQuadrantsData();
        break;
      case 'getSectorData':
        result = getSectorData(data.dateStr, data.shift, data.sector);
        break;
      case 'getShiftData':
        result = getShiftData(data.dateStr, data.shift, data.sector);
        break;
      case 'setupFirebase':
        result = setupFirebaseFromString(data.jsonKey);
        break;
      case 'migrateToFirebase':
        result = migrateToFirebase();
        break;
      case 'migrateFirestoreToRTDB':
        result = migrateFirestoreToRTDB();
        break;
      case 'StressTestFirebase':
        result = StressTestFirebase();
        break;
      case 'runLoadTest':
        result = runLoadTest(data.numWorkers || 15, data.savesPerWorker || 10);
        break;
      case 'cleanupTestData':
        result = cleanupTestData();
        break;
      case 'backupFirestore':
        result = backupFirestoreToSheets();
        break;
      case 'setupBackupTrigger':
        result = setupBackupTrigger();
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _getLastThreeShiftRefs(baseDateStr, baseShift) {
  const refs = [{ date: baseDateStr, shift: baseShift }];
  const tz = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone();
  let cursorDate = baseDateStr;
  let cursorShift = baseShift;

  for (let i = 0; i < 2; i++) {
    const prev = getPreviousShift(cursorDate, cursorShift, tz);
    refs.push({ date: prev.date, shift: prev.shift });
    cursorDate = prev.date;
    cursorShift = prev.shift;
  }

  return refs;
}

function getAutoTurno() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes >= 390 && totalMinutes < 870) return 'MAÑANA';
  if (totalMinutes >= 870 && totalMinutes < 1350) return 'TARDE';
  return 'NOCHE';
}

/**
 * Builds the duplicate-detection key for the backup.
 * A unit is unique by date+shift+sector+id (that is exactly how it is stored in
 * RTDB), NOT by unit_id alone. Using only unit_id globally made records without a
 * mobile id skip each other whenever their generic unit_id repeated across
 * sectors/turnos (LEGACY-0, TEMP-..., ids without fecha/turno, etc.).
 */
function _backupKey(dateVal, shiftVal, sectorVal, idVal, timeZone) {
  var dateStr;
  if (Object.prototype.toString.call(dateVal) === '[object Date]') {
    dateStr = Utilities.formatDate(dateVal, timeZone, 'yyyy-MM-dd');
  } else {
    dateStr = String(dateVal || '').trim().substring(0, 10);
  }
  return dateStr + '|' + String(shiftVal || '').trim().toUpperCase() + '|' +
    String(toDisplaySector(sectorVal || '') || '').trim().toUpperCase() + '|' +
    String(idVal || '').trim();
}

/**
 * Incremental backup: appends only new records from RTDB to UNIT_DATA and SHIFT_SETTINGS.
 * It only processes the latest 3 turnos to keep network and quota usage low.
 */
function backupFirestoreToSheets() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const timeZone = ss.getSpreadsheetTimeZone();
  const nowDate = new Date();
  const now = Utilities.formatDate(nowDate, timeZone, 'yyyy-MM-dd HH:mm:ss');
  const currentDate = Utilities.formatDate(nowDate, timeZone, 'yyyy-MM-dd');
  const currentShift = getAutoTurno();

  // Adjust: NOCHE shift data is saved with the previous day's date (starts at 22:00)
  let baseDate = currentDate;
  if (currentShift === 'NOCHE') {
    var d = new Date(nowDate);
    d.setDate(d.getDate() - 1);
    baseDate = Utilities.formatDate(d, timeZone, 'yyyy-MM-dd');
  }

  const shiftRefs = _getLastThreeShiftRefs(baseDate, currentShift);
  console.log('[backup] Starting incremental backup at ' + now);
  console.log('[backup] Processing refs: ' + JSON.stringify(shiftRefs));

  // --- Incremental SHIFT_SETTINGS ---
  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (settingsSheet) {
    const existingKeys = new Set();
    const existingData = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (row[0]) existingKeys.add(_backupKey(row[0], row[1], row[2], '', timeZone));
    }

    const newRows = [];
    shiftRefs.forEach(ref => {
      const shiftPath = 'shifts/' + ref.date + '_' + ref.shift;
      const shifts = rtdbGet(shiftPath) || {};
      Object.keys(shifts).forEach(sectorKey => {
        const s = shifts[sectorKey] || {};
        const key = _backupKey(s.date || ref.date || '', s.shift || ref.shift || '', s.sector || sectorKey || '', '', timeZone);
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        newRows.push([
          s.date || ref.date || '',
          s.shift || ref.shift || '',
          toDisplaySector(s.sector || sectorKey || ''),
          s.operador || '',
          s.supervisor || '',
          s.permanencia || '',
          s.supervisorTaser || '',
          s.supervisorBodycam || '',
          s.supervisorCodigoTaser || '',
          s.supervisorCodigoBodycam || '',
          s.permanenciaTaser || '',
          s.permanenciaBodycam || '',
          s.permanenciaCodigoTaser || '',
          s.permanenciaCodigoBodycam || '',
          s.supervisorEstado || '',
          s.supervisorRadio || '',
          s.supervisorEncargado || '',
          s.permanenciaEstado || '',
          s.permanenciaRadio || '',
          s.permanenciaEncargado || '',
          s.supervisorMotivo || '',
          s.permanenciaMotivo || ''
        ]);
      });
    });

    if (newRows.length > 0) {
      const startRow = existingData.length + 1;
      settingsSheet.getRange(startRow, 1, newRows.length, 22).setValues(newRows);
    }
    console.log('[backup] SHIFT_SETTINGS: ' + newRows.length + ' new rows');
  }

  // --- Incremental UNIT_DATA ---
  const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  if (dataSheet) {
    const existingKeys = new Set();
    const existingData = dataSheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (!row[23]) continue;
      existingKeys.add(_backupKey(row[0], row[1], row[2], row[23], timeZone));
    }

    const newRows = [];
    shiftRefs.forEach(ref => {
      const unitsPath = 'units/' + ref.date + '_' + ref.shift;
      const unitsBySector = rtdbGet(unitsPath) || {};
      Object.keys(unitsBySector).forEach(sectorKey => {
        const sectorUnits = unitsBySector[sectorKey] || {};
        Object.keys(sectorUnits).forEach(unitId => {
          const u = sectorUnits[unitId] || {};
          const uid = u.unit_id || unitId || '';
          const key = _backupKey(u.date || ref.date || '', u.shift || ref.shift || '', u.sector || sectorKey || '', uid, timeZone);
          if (existingKeys.has(key)) return;
          existingKeys.add(key);
          newRows.push([
            u.date || ref.date || '',
            u.shift || ref.shift || '',
            toDisplaySector(u.sector || sectorKey || ''),
            u.id || '',
            u.type || '',
            u.model || '',
            u.personnel1 || '',
            u.personnel2 || '',
            u.plate || '',
            u.indicative || '',
            u.radio || '',
            u.status || '',
            u.reason || '',
            u.kmStart || '0',
            u.kmEnd || '0',
            u.totalKm || '0',
            u.kmRecarga || '0',
            u.hours || '',
            u.fuel || '',
            u.expense || '',
            u.partes || '0',
            u.quadrant || '',
            u.mechanics || '',
            uid,
            u.lugarEstado || '',
            u.motivoEstado || '',
            u.auditLog || '',
            u.taser || '',
            u.bodycam || '',
            u.codigoBodycam || '',
            u.obsBodycam || '',
            u.codigoTaser || '',
            u.fuel2 || '',
            u.expense2 || ''
          ]);
        });
      });
    });

    if (newRows.length > 0) {
      const startRow = existingData.length + 1;
      const chunkSize = 500;
      for (let chunkStart = 0; chunkStart < newRows.length; chunkStart += chunkSize) {
        const chunk = newRows.slice(chunkStart, chunkStart + chunkSize);
        dataSheet.getRange(startRow + chunkStart, 1, chunk.length, 34).setValues(chunk);
      }
    }
    console.log('[backup] UNIT_DATA: ' + newRows.length + ' new rows');
  }

  console.log('[backup] Backup completed at ' + now);
  return { success: true };
}

/**
 * Returns true if a given hour (0-23) is safe (outside the first 3 hours of any shift).
 */
function _isSafeBackupHour(hour) {
  const critical = [
    { start: 6.5, end: 9.5 },   // MAÑANA first 3h: 06:30-09:30
    { start: 14.5, end: 17.5 }, // TARDE first 3h: 14:30-17:30
    { start: 22.5, end: 1.5 },  // NOCHE first 3h: 22:30-01:30
  ];
  for (const c of critical) {
    if (c.start <= c.end) {
      if (hour >= c.start && hour < c.end) return false;
    } else {
      // wraps past midnight (NOCHE)
      if (hour >= c.start || hour < c.end) return false;
    }
  }
  return true;
}

/**
 * Creates time-driven triggers for backupFirestoreToSheets at safe hours.
 * Runs at 02:00, 10:00, 18:00 — one per turno, all outside the first 3 critical hours.
 * Run once from GAS editor: setupBackupTrigger()
 */
function setupBackupTrigger() {
  const safeHours = [4, 12, 20];
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'backupFirestoreToSheets') {
      ScriptApp.deleteTrigger(t);
    }
  });
  for (const hour of safeHours) {
    ScriptApp.newTrigger('backupFirestoreToSheets')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .inTimezone(Session.getScriptTimeZone())
      .create();
  }
  console.log('[setupBackupTrigger] Triggers created at hours: ' + safeHours.join(', '));
  return { success: true, safeHours: safeHours };
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Script para migrar fotos de Drive a columnas URL y FILE_ID.
 * Ejecutar solo una vez.
 */
function populateWantedMetadata() {
  const ss = SpreadsheetApp.openById(APP_CONFIG.WANTED_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Hoja1');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toUpperCase());
  
  const colNombre = headers.indexOf('NOMBRE');
  const colDnice = headers.indexOf('DNICE');
  const colUrl = headers.indexOf('URL');
  const colFileId = headers.indexOf('FILE_ID');

  if (colUrl === -1 || colFileId === -1) {
    Logger.log("Error: Asegúrate de tener las columnas 'URL' y 'FILE_ID' en el encabezado.");
    return;
  }

  // Función mejorada: ahora convierte guiones bajos (_) y otros separadores en espacios
  function normalize(str) {
    if (!str) return '';
    return String(str).toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita acentos
      .replace(/[_]/g, ' ')   // Cambia guiones bajos por espacios
      .replace(/[,;.]/g, ' ') // Cambia comas y puntos por espacios
      .replace(/\s+/g, ' ')   // Reduce espacios múltiples a uno
      .trim();
  }

  const photoMap = {};
  function scanFolder(folder) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var name = normalize(file.getName().replace(/\.[^.]+$/, '')); 
      photoMap[name] = { id: file.getId(), url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w200' };
    }
    var subfolders = folder.getFolders();
    while (subfolders.hasNext()) scanFolder(subfolders.next());
  }
  
  scanFolder(DriveApp.getFolderById(APP_CONFIG.WANTED_DRIVE_FOLDER_ID));

  const updates = [];
  for (let i = 1; i < data.length; i++) {
    const nombre = normalize(data[i][colNombre]);
    const dnice = normalize(data[i][colDnice]);
    
    // Busca primero por DNI, si no, por el nombre normalizado
    const match = photoMap[dnice] || photoMap[nombre];
    
    updates.push([match ? match.url : '', match ? match.id : '']);
  }

  sheet.getRange(2, colUrl + 1, updates.length, 2).setValues(updates);
  Logger.log("Migración completada con normalización avanzada (incluye guiones bajos).");
}
