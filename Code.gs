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
  return normalized.replace(/^SECTOR\s+/, '');
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
  return toStorageSector(value);
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
    'TASER', 'BODYCAM', 'CODIGO_BODYCAM', 'OBS_BODYCAM', 'CODIGO_TASER'
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
    const settingsRows = sLastRow > 1 ? settingsSheet.getRange(2, 1, sLastRow - 1, 20).getValues() : [];
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

    // Fallback: legacy sheet
    if (!fromFirebase) {
      const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
      if (dataSheet) {
        const dLastRow = dataSheet.getLastRow();
        const dataRows = dLastRow > 1 ? dataSheet.getRange(2, 1, dLastRow - 1, 31).getValues() : [];
        for (let i = 0; i < dataRows.length; i++) {
          const r = dataRows[i];
          if (!r[0]) continue;
          try {
            if (Utilities.formatDate(new Date(r[0]), timeZone, 'yyyy-MM-dd') === dateStr && String(r[1]) === shift) {
              allUnits.push(_toUnitData({
                id: r[3], unit_id: r[23], sector: r[2], type: r[4], model: r[5],
                personnel1: r[6], personnel2: r[7], plate: r[8], indicative: r[9], radio: r[10],
                status: r[11], reason: r[12], kmStart: r[13], kmEnd: r[14], totalKm: r[15],
                kmRecarga: r[16], hours: r[17], fuel: r[18], expense: r[19],
                quadrant: cellToStr(r[21], timeZone), mechanics: r[22],
                lugarEstado: r[24], motivoEstado: r[25],
                taser: r[27] || '', bodycam: r[28] || '', codigoBodycam: r[29] || '', obsBodycam: r[30] || ''
              }));
            }
          } catch (e) { continue; }
        }
      }
    }

    cache.put(cacheKey, JSON.stringify(allUnits), 60);
    console.log('[getShiftData] OK — units=' + allUnits.length + ' src=' + (fromFirebase ? 'firebase' : 'sheet'));
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

    if (!fromFirebase) {
      const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
      if (dataSheet) {
        const dLastRow = dataSheet.getLastRow();
        const dataRows = dLastRow > 1 ? dataSheet.getRange(2, 1, dLastRow - 1, 31).getValues() : [];
        for (let i = 0; i < dataRows.length; i++) {
          const r = dataRows[i];
          if (!r[0]) continue;
          try {
            if (Utilities.formatDate(new Date(r[0]), timeZone, 'yyyy-MM-dd') === dateStr && String(r[1]) === shift && toStorageSector(r[2]) === targetSectorStorage) {
              allUnits.push(_toUnitData({
                id: r[3], unit_id: r[23], sector: r[2], type: r[4], model: r[5],
                personnel1: r[6], personnel2: r[7], plate: r[8], indicative: r[9], radio: r[10],
                status: r[11], reason: r[12], kmStart: r[13], kmEnd: r[14], totalKm: r[15],
                kmRecarga: r[16], hours: r[17], fuel: r[18], expense: r[19],
                quadrant: cellToStr(r[21], timeZone), mechanics: r[22],
                lugarEstado: r[24], motivoEstado: r[25],
                taser: r[27] || '', bodycam: r[28] || '', codigoBodycam: r[29] || '', obsBodycam: r[30] || ''
              }));
            }
          } catch (e) { continue; }
        }
      }
    }

    cache.put(cacheKey, JSON.stringify(allUnits), 60);
    console.log('[getSectorData] OK — units=' + allUnits.length + ' src=' + (fromFirebase ? 'firebase' : 'sheet'));
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
        type: getUnitType(id, tipoIdx !== -1 ? row[tipoIdx] : null, sectorIdx !== -1 ? row[sectorIdx] : null)
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

    // Read directly from the previous shift's unit data (1 specific read, no scan)
    const prevShiftInfo = getPreviousShift(currentDateStr, currentShift, timeZone);
    const targetSector = toStorageSector(sector || '');
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
 * Fast single-unit save: always appends a new row. No locks, no timeouts.
 * The frontend deduplicates by unit_id on load, taking the most recent row.
 */
function updateUnit(dateStr, shift, settings, unit) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);

  const targetSector = unit.sector ? toStorageSector(unit.sector) : toStorageSector(settings.nombrePuesto || '1A');
  const timeZone = ss.getSpreadsheetTimeZone();

  const email = Session.getActiveUser().getEmail();
  const timestamp = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss');
  let auditLog = timestamp;
  if (email) auditLog = email + ' @ ' + auditLog;
  if (settings && settings.operador && settings.operador.trim()) auditLog = settings.operador.trim() + ' / ' + auditLog;

  let unit_id = unit.unit_id || '';
  if (!unit_id || unit_id === 'undefined' || unit_id.startsWith('TEMP-') || unit_id.startsWith('UID-') || unit_id.startsWith('DEF-') || !unit_id.includes(shift)) {
    const cleanDate = dateStr.replace(/-/g, '');
    const cleanId = String(unit.id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const cleanSector = String(targetSector || '').trim().toUpperCase();
    if (cleanId) {
      unit_id = cleanDate + '_' + shift + '_' + cleanSector + '_' + cleanId;
    } else if (!unit_id || unit_id === 'undefined') {
      unit_id = 'UID-' + cleanDate + '-' + Utilities.getUuid().substring(0, 5).toUpperCase();
    }
  }

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

  rtdbSet('units/' + dateStr + '_' + shift + '/' + targetSector + '/' + unit_id, data);

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
  return { success: true, unit_id: unit_id, created: true };
}

/**
 * Searches VEHICULOS_RQ sheet by plate (partial match).
 */
function searchVehicles(searchTerm) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.VEHICLE_RQ_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('RQ');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var colMap = {};
  headers.forEach(function(h, i) { colMap[h] = i; });

  var term = String(searchTerm || '').toLowerCase().trim();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var plate = colMap['placa'] !== undefined ? String(row[colMap['placa']] || '').toLowerCase().trim() : '';
    var marca = colMap['marca'] !== undefined ? String(row[colMap['marca']] || '').toLowerCase().trim() : '';
    var modelo = colMap['modelo'] !== undefined ? String(row[colMap['modelo']] || '').toLowerCase().trim() : '';
    
    if (!term || plate.indexOf(term) !== -1 || marca.indexOf(term) !== -1 || modelo.indexOf(term) !== -1) {
      results.push({
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

  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push('');
  }

  var fieldMapping = {
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
    cuadrante: 'cuadrante'
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
      if (row[0]) existingKeys.add(String(row[0]) + '|' + String(row[1]) + '|' + String(row[2]));
    }

    const newRows = [];
    shiftRefs.forEach(ref => {
      const shiftPath = 'shifts/' + ref.date + '_' + ref.shift;
      const shifts = rtdbGet(shiftPath) || {};
      Object.keys(shifts).forEach(sectorKey => {
        const s = shifts[sectorKey] || {};
        const key = (s.date || ref.date || '') + '|' + (s.shift || ref.shift || '') + '|' + toDisplaySector(s.sector || sectorKey || '');
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
    const existingIds = new Set();
    const existingData = dataSheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][23]) existingIds.add(String(existingData[i][23]));
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
          if (existingIds.has(uid)) return;
          existingIds.add(uid);
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
            u.codigoTaser || ''
          ]);
        });
      });
    });

    if (newRows.length > 0) {
      const startRow = existingData.length + 1;
      const chunkSize = 500;
      for (let chunkStart = 0; chunkStart < newRows.length; chunkStart += chunkSize) {
        const chunk = newRows.slice(chunkStart, chunkStart + chunkSize);
        dataSheet.getRange(startRow + chunkStart, 1, chunk.length, 32).setValues(chunk);
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


