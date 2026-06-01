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

function getUnitType(id) {
  const upperId = String(id || '').toUpperCase();
  if (upperId.startsWith('H') || upperId.startsWith('A-G')) return 'MOTO';
  if (upperId.startsWith('S')) return 'SERENO';
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
  const settingsHeaders = ['FECHA', 'TURNO', 'SECTOR', 'OPERADOR', 'SUPERVISOR', 'PERMANENCIA'];
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
    'LUGAR_ESTADO', 'MOTIVO_ESTADO', 'AUDIT_LOG'
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
  let shiftSettings = { turno: shift, operador: '', supervisor: '', nombrePuesto: toDisplaySector(sector || '1A'), permanencia: '' };
  const allSectorSettings = {};

  try {
    const fbSettings = fbQuery('shifts', [{ field: 'date', value: dateStr }, { field: 'shift', value: shift }]);
    if (fbSettings && fbSettings.length > 0) {
      fbSettings.forEach(s => {
        const sectorName = toDisplaySector(s.sector);
        if (sectorName) {
          allSectorSettings[sectorName] = { turno: s.shift || shift, operador: String(s.operador || ''), supervisor: String(s.supervisor || ''), nombrePuesto: sectorName, permanencia: String(s.permanencia || '') };
        }
        if (toStorageSector(sectorName) === toStorageSector(sector)) {
          shiftSettings = { turno: s.shift || shift, operador: String(s.operador || ''), supervisor: String(s.supervisor || ''), nombrePuesto: sectorName, permanencia: String(s.permanencia || '') };
        }
      });
      return { settings: shiftSettings, allSettings: allSectorSettings, from: 'firebase' };
    }
  } catch (e) { /* fallback */ }

  // Fallback: legacy sheet
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (settingsSheet) {
    const sLastRow = settingsSheet.getLastRow();
    const settingsRows = sLastRow > 1 ? settingsSheet.getRange(2, 1, sLastRow - 1, 6).getValues() : [];
    for (let i = 0; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      if (!row[0]) continue;
      try {
        const rowDateStr = Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd');
        if (rowDateStr !== dateStr || String(row[1]) !== shift) continue;
      } catch (e) { continue; }
      const sectorName = toDisplaySector(row[2]);
      if (sectorName) {
        allSectorSettings[sectorName] = { turno: String(row[1] || ''), operador: String(row[3] || ''), supervisor: String(row[4] || ''), nombrePuesto: sectorName, permanencia: String(row[5] || '') };
      }
      if (toStorageSector(sectorName) === toStorageSector(sector)) {
        shiftSettings = { turno: String(row[1] || ''), operador: String(row[3] || ''), supervisor: String(row[4] || ''), nombrePuesto: sectorName, permanencia: String(row[5] || '') };
      }
    }
  }
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
    motivoEstado: String(obj.motivoEstado || '')
  };
}

function getShiftData(dateStr, shift, sector) {
  try {
    console.log('[getShiftData] START — dateStr=' + dateStr + ' shift=' + shift + ' sector=' + sector);
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const timeZone = ss.getSpreadsheetTimeZone();

    // 1. Settings
    const settingsResult = _loadSettings(dateStr, shift, sector, timeZone);
    const shiftSettings = settingsResult.settings;
    const allSectorSettings = settingsResult.allSettings;

    // 2. Units — try Firebase first
    let allUnits = [];
    let fromFirebase = false;
    try {
      const fbUnits = fbQuery('units', [{ field: 'date', value: dateStr }, { field: 'shift', value: shift }]);
      if (fbUnits && fbUnits.length > 0) {
        allUnits = fbUnits.map(u => _toUnitData(u));
        fromFirebase = true;
      }
    } catch (e) { /* fallback */ }

    // Fallback: legacy sheet
    if (!fromFirebase) {
      const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
      if (dataSheet) {
        const dLastRow = dataSheet.getLastRow();
        const dataRows = dLastRow > 1 ? dataSheet.getRange(2, 1, dLastRow - 1, 26).getValues() : [];
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
                lugarEstado: r[24], motivoEstado: r[25]
              }));
            }
          } catch (e) { continue; }
        }
      }
    }

    console.log('[getShiftData] OK — units=' + allUnits.length + ' src=' + (fromFirebase ? 'firebase' : 'sheet'));
    return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits };
  } catch (err) {
    console.error('[getShiftData] ERROR', err);
    throw err;
  }
}

/**
 * Like getShiftData but only returns units for the requested sector (faster).
 */
function getSectorData(dateStr, shift, sector) {
  try {
    console.log('[getSectorData] START — dateStr=' + dateStr + ' shift=' + shift + ' sector=' + sector);
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const timeZone = ss.getSpreadsheetTimeZone();

    // 1. Settings
    const settingsResult = _loadSettings(dateStr, shift, sector, timeZone);
    const shiftSettings = settingsResult.settings;
    const allSectorSettings = settingsResult.allSettings;
    const targetSectorStorage = toStorageSector(sector);

    // 2. Units — try Firebase first
    let allUnits = [];
    let fromFirebase = false;
    try {
      const fbUnits = fbQuery('units', [
        { field: 'date', value: dateStr },
        { field: 'shift', value: shift },
        { field: 'sector', value: targetSectorStorage }
      ]);
      if (fbUnits && fbUnits.length > 0) {
        allUnits = fbUnits.map(u => _toUnitData(u));
        fromFirebase = true;
      }
    } catch (e) { /* fallback */ }

    if (!fromFirebase) {
      const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
      if (dataSheet) {
        const dLastRow = dataSheet.getLastRow();
        const dataRows = dLastRow > 1 ? dataSheet.getRange(2, 1, dLastRow - 1, 26).getValues() : [];
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
                lugarEstado: r[24], motivoEstado: r[25]
              }));
            }
          } catch (e) { continue; }
        }
      }
    }

    console.log('[getSectorData] OK — units=' + allUnits.length + ' src=' + (fromFirebase ? 'firebase' : 'sheet'));
    return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits };
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
  // Buscar primero columna 'cuadrante'; si no existe, usar 'cuadrante_sector'
  const cuadranteIdx = headers.indexOf('cuadrante') !== -1 ? headers.indexOf('cuadrante') : headers.indexOf('cuadrante_sector');
  const sectorIdx = headers.indexOf('sector');
  const indicativoIdx = headers.indexOf('indicativo');
  const estadoIdx = headers.indexOf('estado');
  const modeloIdx = headers.indexOf('modelo');
  const motivoTallerIdx = headers.indexOf('motivo_taller');
  const lugarIdx = headers.indexOf('lugar');
  const motivoFaltoIdx = headers.indexOf('motivo_falto');
  const motivoDesperfectosIdx = headers.indexOf('motivo_desperfectos');
  const motivoMantenimientoIdx = headers.indexOf('motivo_mantenimiento');
  const motivoSiniestroIdx = headers.indexOf('motivo_siniestro');
  const motivoSinDocumentosIdx = headers.indexOf('motivo_sin_documentos');
  const motivoSinVehiculoIdx = headers.indexOf('motivo_sin_vehiculo');
  
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

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Collect Mobile Data
    if (movilIdx !== -1 && row[movilIdx]) {
      const id = String(row[movilIdx]);
      mobileData.push({
        id: id,
        plate: placaIdx !== -1 ? String(row[placaIdx] || '') : '',
        model: modeloIdx !== -1 ? String(row[modeloIdx] || '') : '',
        radio: radioIdx !== -1 ? String(row[radioIdx] || '') : '',
        quadrant: cuadranteIdx !== -1 ? cellToStr(row[cuadranteIdx], externalSS.getSpreadsheetTimeZone()) : '',
        sector: sectorIdx !== -1 ? toDisplaySector(row[sectorIdx]) : '',
        status: estadoIdx !== -1 ? String(row[estadoIdx] || '').trim() : '',
        type: getUnitType(id)
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

    // Collect ALL Unique Radios (even if no movil ID is present)
    if (radioIdx !== -1 && row[radioIdx]) {
      radiosSet.add(String(row[radioIdx]).trim());
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
      
      const allowedRoles = ['CHOFER', 'MOTORIZADO', 'SERENO A PIE', 'SERENO GIR', 'RESCATE'];
      const operatorRoles = ['OPERADOR C4', 'OPERADOR COVV', 'JEFE AREA', 'SUPERVISOR'];
      
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
          
          // Operator list for reports (only OPERADOR C4)
          if (name && estado === 'ACTIVO' && funcion === 'OPERADOR C4') {
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
    radios: Array.from(radiosSet).sort()
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

/**
 * Saves all units and settings for a specific date and shift.
 * Uses Firestore for storage.
 */
function saveShiftData(dateStr, shift, settings, units) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);

  const unitsTargetSector = units.reduce((acc, u) => u && u.sector ? toStorageSector(u.sector) : acc, '');
  const targetSector = unitsTargetSector || toStorageSector(settings.nombrePuesto || '1A');
  const timeZone = ss.getSpreadsheetTimeZone();

  // --- Settings ---
  const shiftDocId = dateStr + '_' + shift + '_' + targetSector;
  fbSet('shifts', shiftDocId, {
    date: dateStr,
    shift: shift,
    sector: targetSector,
    operador: settings.operador || '',
    supervisor: settings.supervisor || '',
    permanencia: settings.permanencia || '',
    updatedAt: Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss')
  });

  const email = Session.getActiveUser().getEmail();
  const timestamp = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd HH:mm:ss');
  let auditLog = timestamp;
  if (email) auditLog = email + ' @ ' + auditLog;
  if (settings && settings.operador && settings.operador.trim()) auditLog = settings.operador.trim() + ' / ' + auditLog;

  // --- KM bridge: batch-read prev shift documents in parallel ---
  const prevShiftInfo = getPreviousShift(dateStr, shift, timeZone);
  const prevShiftDate = prevShiftInfo.date.replace(/-/g, '');
  const sectorUnits = units.filter(u => toStorageSector(u.sector) === targetSector);
  const firestoreWrites = [];
  const kmBridgeLookups = [];

  // First pass: build unit data and collect KM bridge candidates
  sectorUnits.forEach((unit) => {
    let unit_id = unit.unit_id || '';
    if (!unit_id || unit_id === 'undefined') {
      unit_id = 'UID-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    }
    if (!unit_id.includes(shift)) {
      const cleanDate = dateStr.replace(/-/g, '');
      const cleanId = String(unit.id || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (cleanId) {
        unit_id = cleanDate + '_' + shift + '_' + targetSector + '_' + cleanId;
      } else {
        unit_id = 'UID-' + cleanDate + '-' + Utilities.getUuid().substring(0, 5).toUpperCase();
      }
    }

    const data = {
      date: dateStr,
      shift: shift,
      sector: targetSector,
      id: unit.id,
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
      auditLog: auditLog,
      updatedAt: timestamp
    };

    firestoreWrites.push({ collection: 'units', docId: unit_id, data });

    if (unit.id && unit.kmStart && unit.kmStart !== '0') {
      const cleanId = String(unit.id).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (cleanId) {
        kmBridgeLookups.push({
          unitId: cleanId,
          prevUnitId: prevShiftDate + '_' + prevShiftInfo.shift + '_' + targetSector + '_' + cleanId,
          currentKmStart: unit.kmStart
        });
      }
    }
  });

  // Batch-read all prev shift units in parallel
  if (kmBridgeLookups.length > 0) {
    const token = _getFirebaseToken();
    const config = _getFirebaseConfig();
    const baseUrl = FIRESTORE_BASE + '/' + _fsEncode(config.project_id) + '/databases/(default)/documents/units/';
    const getRequests = kmBridgeLookups.map(lookup => ({
      url: baseUrl + _fsEncode(lookup.prevUnitId),
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    }));
    const getResponses = UrlFetchApp.fetchAll(getRequests);

    for (let i = 0; i < getResponses.length; i++) {
      if (getResponses[i].getResponseCode() !== 200) continue;
      const prevDoc = _fromFields(JSON.parse(getResponses[i].getContentText()).fields);
      if (!prevDoc || !prevDoc.kmStart) continue;

      const lookup = kmBridgeLookups[i];
      const newKmEnd = parseFloat(lookup.currentKmStart) || 0;
      const origKmStart = parseFloat(prevDoc.kmStart) || 0;
      const newTotal = newKmEnd >= origKmStart ? (newKmEnd - origKmStart).toFixed(1) : '0';
      prevDoc.kmEnd = lookup.currentKmStart;
      prevDoc.totalKm = newTotal;
      prevDoc.updatedAt = timestamp;
      firestoreWrites.push({ collection: 'units', docId: lookup.prevUnitId, data: prevDoc });
    }
  }

  // --- Batch write all units (current + KM updates) in parallel ---
  if (firestoreWrites.length > 0) {
    fbSetAll(firestoreWrites);
  }

  return { success: true };
}

/**
 * Saves only header settings (operador, supervisor, permanencia) without modifying unit data.
 */
function saveShiftSettings(dateStr, shift, settings) {
  const targetSector = toStorageSector(settings.nombrePuesto || '1A');
  const docId = dateStr + '_' + shift + '_' + targetSector;

  const data = {
    date: dateStr,
    shift: shift,
    sector: targetSector,
    operador: settings.operador || '',
    supervisor: settings.supervisor || '',
    permanencia: settings.permanencia || '',
    updatedAt: Utilities.formatDate(new Date(), SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  };

  fbSet('shifts', docId, data);
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
function getPreviousKmEnd(currentDateStr, currentShift, unitId, sector) {
  if (!unitId) return '0';
  try {
    const searchId = String(unitId).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const targetSector = toStorageSector(sector);
    const shiftOrder = ['MAÑANA', 'TARDE', 'NOCHE'];
    const currentIdx = shiftOrder.indexOf(currentShift);
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const timeZone = ss.getSpreadsheetTimeZone();

    // Walk back: same date prev shifts → previous dates all shifts
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const d = new Date(currentDateStr);
      d.setDate(d.getDate() - dayOffset);
      const dStr = Utilities.formatDate(d, timeZone, 'yyyy-MM-dd');
      const dStamp = dStr.replace(/-/g, '');
      const maxShift = dayOffset === 0 ? currentIdx - 1 : 2;

      for (let si = maxShift; si >= 0; si--) {
        const prevUnitId = dStamp + '_' + shiftOrder[si] + '_' + targetSector + '_' + searchId;
        try {
          const doc = fbGet('units', prevUnitId);
          if (doc && doc.kmEnd) return String(doc.kmEnd);
        } catch (e2) { /* not found */ }
      }
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
    id: unit.id,
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
    auditLog: auditLog,
    updatedAt: timestamp
  };

  fbSet('units', unit_id, data);
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
    if (!term || plate.indexOf(term) !== -1) {
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
  var idx = headers.indexOf('cuadrante_sector');
  if (idx === -1) return [];

  var seen = {};
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var val = String(data[i][idx] || '').trim();
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
  const testPrefixes = ['STRESS-FB-', 'STRESS-BATCH-', 'LOAD-', 'TEST-T'];
  const dateStr = Utilities.formatDate(new Date(), SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID).getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const dateStamp = dateStr.replace(/-/g, '');

  // Query all units for today
  const units = fbQuery('units', [{ field: 'date', value: dateStr }, { field: 'shift', value: 'MAÑANA' }]);
  if (!units || units.length === 0) { console.log('No units found for today.'); return; }

  let deleted = 0;
  for (const unit of units) {
    const id = (unit.id || '').toUpperCase();
    const isTest = testPrefixes.some(p => id.startsWith(p));
    if (isTest) {
      try { fbDelete('units', unit._id); deleted++; } catch (e) { console.error('Error deleting ' + unit._id + ': ' + e); }
    }
  }

  // Also clean shifts with test data
  const shifts = fbQuery('shifts', [{ field: 'date', value: dateStr }, { field: 'shift', value: 'MAÑANA' }]);
  let delShifts = 0;
  for (const s of shifts || []) {
    const op = (s.operador || '').toUpperCase();
    if (op === 'TEST' || op === 'STRESS' || op === 'OP_STRESS' || op === 'OP_FINAL') {
      try { fbDelete('shifts', s._id); delShifts++; } catch (e) { console.error('Error deleting shift: ' + e); }
    }
  }

  console.log('Cleaned up: ' + deleted + ' units, ' + delShifts + ' shifts');
  // Also clean up from sheets (legacy)
  try {
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      let sheetDeletions = 0;
      for (let i = rows.length - 1; i >= 1; i--) {
        const id = String(rows[i][3] || '').toUpperCase();
        if (testPrefixes.some(p => id.startsWith(p))) {
          sheet.deleteRow(i + 1);
          sheetDeletions++;
        }
      }
      console.log('Cleaned from sheet: ' + sheetDeletions + ' rows');
    }
  } catch (e) { console.error('Sheet cleanup: ' + e); }
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

  // Test 2: saveShiftData (10 units + settings)
  console.log('[StressTest] Test 2: saveShiftData...');
  const units = [];
  for (let i = 0; i < 10; i++) {
    units.push({ id: 'STRESS-BATCH-' + i, type: 'MOTO', status: 'ACTIVO', sector: sector });
  }
  const batchResult = saveShiftData(dateStr, shift, {
    nombrePuesto: sector, operador: 'OP_STRESS', supervisor: 'SUP_STRESS', permanencia: '2H'
  }, units);
  console.log('[StressTest] Test 2: ' + JSON.stringify(batchResult));

  // Test 3: saveShiftSettings
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
 * Web app doGet — sirve la app embedida en GAS
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Reporte Integrado MSS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Web app doPost — endpoint HTTP para pruebas de concurrencia externas.
 * Body JSON con { action, dateStr, shift, settings, units, unit }.
 * Ej: { action: "updateUnit", dateStr: "2026-06-01", shift: "MAÑANA", settings: {...}, unit: {...} }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;

    switch (action) {
      case 'updateUnit':
        result = updateUnit(data.dateStr, data.shift, data.settings || {}, data.unit);
        break;
      case 'saveShiftData':
        result = saveShiftData(data.dateStr, data.shift, data.settings || {}, data.units || []);
        break;
      case 'saveShiftSettings':
        result = saveShiftSettings(data.dateStr, data.shift, data.settings || {});
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
      case 'StressTestFirebase':
        result = StressTestFirebase();
        break;
      case 'ping':
        result = { success: true, pong: true, timestamp: new Date().toISOString() };
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

/**
 * Helper to include other files.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


