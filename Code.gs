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
  const storageSector = toStorageSector(value);
  if (!storageSector) return '';
  if (storageSector === 'RESCATE' || storageSector === 'GIR') return storageSector;
  return `SECTOR ${storageSector}`;
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
    'LUGAR_ESTADO', 'MOTIVO_ESTADO'
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
function getShiftData(dateStr, shift, sector) {
  try {
    console.log('[getShiftData] START — dateStr=' + dateStr + ' shift=' + shift + ' sector=' + sector);
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);

    // Cache timezone at function start
    const timeZone = ss.getSpreadsheetTimeZone();

    // 1. Get Settings - read only columns 1-6 (FECHA, TURNO, SECTOR, OPERADOR, SUPERVISOR, PERMANENCIA)
    const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
    let shiftSettings = {
      turno: shift,
      operador: '',
      supervisor: '',
      nombrePuesto: toDisplaySector(sector || '1A'),
      permanencia: ''
    };

    // Store settings for ALL sectors to support the Integrated Report view
    const allSectorSettings = {};

    if (settingsSheet) {
      const settingsLastRow = settingsSheet.getLastRow();
      const settingsRows = settingsLastRow > 1
        ? settingsSheet.getRange(2, 1, settingsLastRow - 1, 6).getValues()
        : [];

      for (let i = 0; i < settingsRows.length; i++) {
        const row = settingsRows[i];
        if (!row[0]) continue;
        try {
          const rowDateStr = Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd');
          if (rowDateStr !== dateStr || String(row[1]) !== shift) continue;
        } catch (e) {
          continue;
        }

        const permanenciaVal = String(row[5] || '');
        const sectorName = toDisplaySector(row[2]);
        if (sectorName) {
          allSectorSettings[sectorName] = {
            turno: String(row[1] || ''),
            operador: String(row[3] || ''),
            supervisor: String(row[4] || ''),
            nombrePuesto: sectorName,
            permanencia: permanenciaVal
          };
        }

        if (toStorageSector(sectorName) === toStorageSector(sector)) {
          shiftSettings = {
            turno: String(row[1] || ''),
            operador: String(row[3] || ''),
            supervisor: String(row[4] || ''),
            nombrePuesto: sectorName,
            permanencia: permanenciaVal
          };
        }
      }
    }

    // 2. Get Unit Data
    const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
    const allUnits = [];

    if (dataSheet) {
      const dataLastRow = dataSheet.getLastRow();
      const dataRowsFull = dataLastRow > 1
        ? dataSheet.getRange(2, 1, dataLastRow - 1, 26).getValues()
        : [];

      for (let i = 0; i < dataRowsFull.length; i++) {
        const fullRow = dataRowsFull[i];
        if (!fullRow[0]) continue;
        
        try {
          const rowDateStr = Utilities.formatDate(new Date(fullRow[0]), timeZone, 'yyyy-MM-dd');
          if (rowDateStr === dateStr && String(fullRow[1]) === shift) {
            // Convert all values to String to avoid serialization issues
            allUnits.push({
              id: String(fullRow[3] || ''),
              unit_id: String(fullRow[23] || ''), // New UNIT_ID column (24th)
              sector: toDisplaySector(fullRow[2]),
              type: String(fullRow[4] || ''),
              model: String(fullRow[5] || ''),
              personnel1: String(fullRow[6] || ''),
              personnel2: String(fullRow[7] || ''),
              plate: String(fullRow[8] || ''),
              indicative: String(fullRow[9] || ''),
              radio: String(fullRow[10] || ''),
              status: String(fullRow[11] || ''),
              reason: String(fullRow[12] || ''),
              kmStart: String(fullRow[13] || '0'),
              kmEnd: String(fullRow[14] || '0'),
              totalKm: String(fullRow[15] || '0'),
              kmRecarga: String(fullRow[16] || '0'),
              hours: String(fullRow[17] || ''),
              fuel: String(fullRow[18] || '-- / --'),
              expense: String(fullRow[19] || 'S/ 0.00'),
              quadrant: cellToStr(fullRow[21], timeZone),
              mechanics: String(fullRow[22] || ''),
              lugarEstado: String(fullRow[24] || ''),
              motivoEstado: String(fullRow[25] || '')
            });
          }
        } catch (e) {
          continue;
        }
      }
    }

    console.log('[getShiftData] OK — units=' + allUnits.length);
    // ...


    // NOTE: personnelList is NOT included here to keep the payload small.
    // NOTE: retenData is loaded lazily by RetenManagementView.
    return {
      settings: shiftSettings,
      allSectorSettings: allSectorSettings,
      units: allUnits
    };
  } catch (err) {
    console.error('[getShiftData] ERROR', err);
    throw err;
  }
}

/**
 * Like getShiftData but only returns units for the requested sector (faster).
 * Settings are still read for all sectors (needed for sector switching).
 */
function getSectorData(dateStr, shift, sector) {
  try {
    console.log('[getSectorData] START — dateStr=' + dateStr + ' shift=' + shift + ' sector=' + sector);
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const timeZone = ss.getSpreadsheetTimeZone();
    const targetSectorStorage = toStorageSector(sector);

    // 1. Get Settings (same as getShiftData — needed for sectorSettingsMap)
    const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
    let shiftSettings = {
      turno: shift,
      operador: '',
      supervisor: '',
      nombrePuesto: toDisplaySector(sector || '1A'),
      permanencia: ''
    };
    const allSectorSettings = {};

    if (settingsSheet) {
      const settingsLastRow = settingsSheet.getLastRow();
      const settingsRows = settingsLastRow > 1
        ? settingsSheet.getRange(2, 1, settingsLastRow - 1, 6).getValues()
        : [];
      for (let i = 0; i < settingsRows.length; i++) {
        const row = settingsRows[i];
        if (!row[0]) continue;
        try {
          const rowDateStr = Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd');
          if (rowDateStr !== dateStr || String(row[1]) !== shift) continue;
        } catch (e) { continue; }
        const permanenciaVal = String(row[5] || '');
        const sectorName = toDisplaySector(row[2]);
        if (sectorName) {
          allSectorSettings[sectorName] = { turno: String(row[1] || ''), operador: String(row[3] || ''), supervisor: String(row[4] || ''), nombrePuesto: sectorName, permanencia: permanenciaVal };
        }
        if (toStorageSector(sectorName) === targetSectorStorage) {
          shiftSettings = { turno: String(row[1] || ''), operador: String(row[3] || ''), supervisor: String(row[4] || ''), nombrePuesto: sectorName, permanencia: permanenciaVal };
        }
      }
    }

    // 2. Get Unit Data — filter by sector
    const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
    const allUnits = [];

    if (dataSheet) {
      const dataLastRow = dataSheet.getLastRow();
      const dataRowsFull = dataLastRow > 1
        ? dataSheet.getRange(2, 1, dataLastRow - 1, 26).getValues()
        : [];

      for (let i = 0; i < dataRowsFull.length; i++) {
        const fullRow = dataRowsFull[i];
        if (!fullRow[0]) continue;
        try {
          const rowDateStr = Utilities.formatDate(new Date(fullRow[0]), timeZone, 'yyyy-MM-dd');
          if (rowDateStr === dateStr && String(fullRow[1]) === shift && toStorageSector(fullRow[2]) === targetSectorStorage) {
            allUnits.push({
              id: String(fullRow[3] || ''),
              unit_id: String(fullRow[23] || ''),
              sector: toDisplaySector(fullRow[2]),
              type: String(fullRow[4] || ''),
              model: String(fullRow[5] || ''),
              personnel1: String(fullRow[6] || ''),
              personnel2: String(fullRow[7] || ''),
              plate: String(fullRow[8] || ''),
              indicative: String(fullRow[9] || ''),
              radio: String(fullRow[10] || ''),
              status: String(fullRow[11] || ''),
              reason: String(fullRow[12] || ''),
              kmStart: String(fullRow[13] || '0'),
              kmEnd: String(fullRow[14] || '0'),
              totalKm: String(fullRow[15] || '0'),
              kmRecarga: String(fullRow[16] || '0'),
              hours: String(fullRow[17] || ''),
              fuel: String(fullRow[18] || '-- / --'),
              expense: String(fullRow[19] || 'S/ 0.00'),
              quadrant: cellToStr(fullRow[21], timeZone),
              mechanics: String(fullRow[22] || ''),
              lugarEstado: String(fullRow[24] || ''),
              motivoEstado: String(fullRow[25] || '')
            });
          }
        } catch (e) { continue; }
      }
    }

    console.log('[getSectorData] OK — units=' + allUnits.length + ' sector=' + sector);
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
  const cuadranteIdx = headers.indexOf('cuadrante_sector');
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
 */
function saveShiftData(dateStr, shift, settings, units) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);

  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (!settingsSheet) {
    return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.settings}. Ejecuta la función initialSetup desde el editor de código.` };
  }
  const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  if (!dataSheet) {
    return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.unitData}. Ejecuta la función initialSetup desde el editor de código.` };
  }

  // Force quadrant column (V) as plain text so values like "12, 11" aren't auto-converted to dates
  dataSheet.getRange('V:V').setNumberFormat('@');

  // Derivar targetSector de las unidades primero, con fallback a settings
  const unitsTargetSector = units.reduce((acc, u) => u && u.sector ? toStorageSector(u.sector) : acc, '');
  const targetSector = unitsTargetSector || toStorageSector(settings.nombrePuesto || '1A');
  const timeZone = ss.getSpreadsheetTimeZone();
  const prevShiftInfo = getPreviousShift(dateStr, shift, timeZone);

  // Acquire lock FIRST for consistency (reads + writes inside lock)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    // --- READ SETTINGS (last 5000 rows from bottom) ---
    const SETTINGS_SCAN = 5000;
    const sLastRow = settingsSheet.getLastRow();
    const sStart = Math.max(2, sLastRow - SETTINGS_SCAN + 1);
    const settingsRows = sLastRow > 1 ? settingsSheet.getRange(sStart, 1, sLastRow - sStart + 1, 6).getValues() : [];

    let settingsFoundIdx = -1;
    for (let i = 0; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      if (!row[0]) continue;
      try {
        const rowDate = (row[0] instanceof Date) ? Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') : String(row[0]);
        if (rowDate === dateStr && String(row[1]) === shift && toStorageSector(row[2]) === targetSector) {
          settingsFoundIdx = sStart + i;
        }
      } catch (e) {}
    }

    // --- Settings write ---
    if (settingsFoundIdx > -1) {
      settingsSheet.getRange(settingsFoundIdx, 1, 1, 6).setValues([[dateStr, shift, targetSector, settings.operador, settings.supervisor, settings.permanencia]]);
    } else {
      settingsSheet.appendRow([dateStr, shift, targetSector, settings.operador, settings.supervisor, settings.permanencia]);
    }

    // --- READ UNIT DATA (columnas A-O + X; evita leer 24 columnas completas) ---
    const dLastRow = dataSheet.getLastRow();
    const unitKMData = dLastRow > 1 ? dataSheet.getRange(2, 1, dLastRow - 1, 15).getValues() : [];
    const unitIdCol = dLastRow > 1 ? dataSheet.getRange(2, 24, dLastRow - 1, 1).getValues() : [];

    const unitIdToRowMap = new Map();
    const prevShiftRecords = new Map();
    const targetSectorStr = String(targetSector).trim();
    const KM_START_IDX = 13;   // Col N (14) in 1-based → index 13 in 0-based 15-col array
    const KM_END_IDX = 14;     // Col O (15)

    for (let i = 0; i < unitKMData.length; i++) {
      const row = unitKMData[i];
      const absIdx = i + 2;
      if (!row[0]) continue;
      let rowDate, rowShift;
      try {
        rowDate = (row[0] instanceof Date) ? Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') : String(row[0]);
        rowShift = String(row[1]);
      } catch (e) { continue; }
      if (rowDate === dateStr && rowShift === shift && toStorageSector(row[2]) === targetSectorStr) {
        const unit_id = String(unitIdCol[i][0] || '').trim();
        if (unit_id) unitIdToRowMap.set(unit_id, absIdx);
      }
      // KM bridge: prev shift sin filtrar por sector (la unidad pudo cambiar de sector)
      if (rowDate === prevShiftInfo.date && rowShift === prevShiftInfo.shift) {
        const displayId = String(row[3] || '').trim().toUpperCase();
        if (displayId) prevShiftRecords.set(displayId, {
          rowIndex: absIdx,
          kmStart: String(row[KM_START_IDX] || '0')
        });
      }
    }

    const unitUpdates = [];
    const rowsToAppend = [];
    const sectorUnits = units.filter(u => toStorageSector(u.sector) === targetSector);

    // --- Unit Sync by UNIT_ID ---
    sectorUnits.forEach((unit) => {
      let unit_id = unit.unit_id || '';
      if (!unit_id || unit_id === 'undefined') {
        unit_id = 'UID-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      }

      const unitRow = [
        dateStr, shift, targetSector,
        unit.id, unit.type, unit.model || '', unit.personnel1 || '', unit.personnel2 || '', unit.plate || '', unit.indicative || '', unit.radio || '',
        unit.status || '', unit.reason || '', unit.kmStart || '0', unit.kmEnd || '0', unit.totalKm || '0', unit.kmRecarga || '0', unit.hours || '', unit.fuel || '', unit.expense || '', '0', unit.quadrant || '', unit.mechanics || '',
        unit_id, // Column 24
        unit.lugarEstado || '', // Column 25
        unit.motivoEstado || ''  // Column 26
      ];

      const existingRowIdx = unitIdToRowMap.get(unit_id);
      if (existingRowIdx) {
        unitUpdates.push({ rowIndex: existingRowIdx, values: unitRow });
      } else {
        rowsToAppend.push(unitRow);
      }

      // KM_FIN bridge — escribe solo columnas O(15)=km_end y P(16)=total_km
      if (unit.id && unit.kmStart && unit.kmStart !== '0' && prevShiftRecords.has(unit.id.toUpperCase())) {
        const prev = prevShiftRecords.get(unit.id.toUpperCase());
        const newKmEnd = parseFloat(unit.kmStart) || 0;
        const origKmStart = parseFloat(prev.kmStart) || 0;
        const newTotal = newKmEnd >= origKmStart ? (newKmEnd - origKmStart).toFixed(1) : '0';
        dataSheet.getRange(prev.rowIndex, 15, 1, 2).setValues([[unit.kmStart, newTotal]]);
      }
    });

    // Handle deletions: DISABLED per user request. Records are only created or updated.

    // Write updated rows in contiguous batches (minimizes API round-trips)
    if (unitUpdates.length > 0) {
      const sorted = [...unitUpdates].sort((a, b) => a.rowIndex - b.rowIndex);
      let batchStart = sorted[0].rowIndex;
      let batchValues = [sorted[0].values];
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].rowIndex === batchStart + batchValues.length) {
          batchValues.push(sorted[i].values);
        } else {
          dataSheet.getRange(batchStart, 1, batchValues.length, 26).setValues(batchValues);
          batchStart = sorted[i].rowIndex;
          batchValues = [sorted[i].values];
        }
      }
      dataSheet.getRange(batchStart, 1, batchValues.length, 26).setValues(batchValues);
    }

    if (rowsToAppend.length > 0) {
      dataSheet.getRange(dataSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    return { success: true };
  } catch (e) {
    console.error('Error in saveShiftData:', e);
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Saves only header settings (operador, supervisor, permanencia) without modifying unit data.
 */
function saveShiftSettings(dateStr, shift, settings) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (!settingsSheet) {
    return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.settings}.` };
  }

  const targetSector = toStorageSector(settings.nombrePuesto || '1A');
  const timeZone = ss.getSpreadsheetTimeZone();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const SETTINGS_SCAN = 5000;
    const sLastRow = settingsSheet.getLastRow();
    const sStart = Math.max(2, sLastRow - SETTINGS_SCAN + 1);
    const settingsRows = sLastRow > 1 ? settingsSheet.getRange(sStart, 1, sLastRow - sStart + 1, 6).getValues() : [];

    let settingsFoundIdx = -1;
    for (let i = 0; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      if (!row[0]) continue;
      try {
        const rowDate = (row[0] instanceof Date) ? Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') : String(row[0]);
        if (rowDate === dateStr && String(row[1]) === shift && toStorageSector(row[2]) === targetSector) {
          settingsFoundIdx = sStart + i;
        }
      } catch (e) {}
    }

    if (settingsFoundIdx > -1) {
      settingsSheet.getRange(settingsFoundIdx, 1, 1, 6).setValues([[dateStr, shift, targetSector, settings.operador, settings.supervisor, settings.permanencia]]);
    } else {
      settingsSheet.appendRow([dateStr, shift, targetSector, settings.operador, settings.supervisor, settings.permanencia]);
    }

    lock.releaseLock();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
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
    const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
    if (!dataSheet) return '0';
    
    const data = dataSheet.getDataRange().getValues();
    const targetSector = toStorageSector(sector);
    const searchId = String(unitId).trim().toUpperCase();
    
    const shiftOrder = { 'MAÑANA': 0, 'TARDE': 1, 'NOCHE': 2 };
    const currentShiftVal = shiftOrder[currentShift] !== undefined ? shiftOrder[currentShift] : -1;
    
    // Search from bottom up
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (!row[0]) continue;
      
      const rowDate = Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      const rowShift = row[1];
      const rowShiftVal = shiftOrder[rowShift] !== undefined ? shiftOrder[rowShift] : -1;

      // Skip if it's the same or a future record
      if (rowDate > currentDateStr) continue;
      if (rowDate === currentDateStr && rowShiftVal >= currentShiftVal) continue;
      
      // row[3] is ID, row[14] is KM_FIN
      if (String(row[3]).trim().toUpperCase() === searchId) {
        return String(row[14] || '0');
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
 * Fast single-unit save: reads only 3 columns to find the row, updates in-place or appends.
 * ~1s vs ~5-8s for saveShiftData. Does NOT handle KM bridge (handled by global save).
 */
function updateUnit(dateStr, shift, settings, unit) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  if (!dataSheet) return { success: false, error: 'No se encontró UNIT_DATA' };

  // Force quadrant column (V) as plain text so values like "12, 11" aren't auto-converted to dates
  dataSheet.getRange('V:V').setNumberFormat('@');

  // USAR el sector de la unidad, NO settings.nombrePuesto
  const targetSector = unit.sector ? toStorageSector(unit.sector) : toStorageSector(settings.nombrePuesto || '1A');
  const timeZone = ss.getSpreadsheetTimeZone();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    let unit_id = unit.unit_id || '';
    if (!unit_id || unit_id === 'undefined') {
      unit_id = 'UID-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    }

    const unitRow = [
      dateStr, shift, targetSector,
      unit.id, unit.type, unit.model || '', unit.personnel1 || '', unit.personnel2 || '', unit.plate || '', unit.indicative || '', unit.radio || '',
      unit.status || '', unit.reason || '', unit.kmStart || '0', unit.kmEnd || '0', unit.totalKm || '0', unit.kmRecarga || '0', unit.hours || '', unit.fuel || '', unit.expense || '', '0', unit.quadrant || '', unit.mechanics || '',
      unit_id,
      unit.lugarEstado || '',
      unit.motivoEstado || ''
    ];

    const lastRow = dataSheet.getLastRow();
    if (lastRow <= 1) {
      dataSheet.appendRow(unitRow);
      return { success: true, unit_id: unit_id, created: true };
    }

    // Read cols A(1), B(2), C(3=targetSector), D(4=displayId), X(24=unit_id)
    const dateShiftData = dataSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const sectorData = dataSheet.getRange(2, 3, lastRow - 1, 1).getValues();
    const idDisplayData = dataSheet.getRange(2, 4, lastRow - 1, 1).getValues();
    const unitIdData = dataSheet.getRange(2, 24, lastRow - 1, 1).getValues();

    let foundRow = -1;
    const unitDisplayId = unit.id ? String(unit.id).trim().toUpperCase() : '';
    const targetSectorStr = String(targetSector).trim();

    for (let i = 0; i < dateShiftData.length; i++) {
      if (!dateShiftData[i][0]) continue;
      const rowDate = (dateShiftData[i][0] instanceof Date) ? Utilities.formatDate(dateShiftData[i][0], timeZone, 'yyyy-MM-dd') : String(dateShiftData[i][0]);
      if (rowDate !== dateStr || String(dateShiftData[i][1]) !== shift) continue;

      // Solo considerar filas del mismo sector
      const rowSector = String(toStorageSector(sectorData[i][0])).trim();
      if (rowSector !== targetSectorStr) continue;

      // Match prioritario por UNIT_ID (único global)
      const storedUnitId = String(unitIdData[i][0] || '').trim();
      if (storedUnitId === unit_id) {
        foundRow = i + 2;
        break;
      }

      // Fallback seguro: match por display ID SOLO si estamos en el mismo sector
      const storedDisplayId = String(idDisplayData[i][0] || '').trim().toUpperCase();
      if (storedDisplayId && storedDisplayId === unitDisplayId) {
        foundRow = i + 2;
        break;
      }
    }

    if (foundRow > -1) {
      dataSheet.getRange(foundRow, 1, 1, 26).setValues([unitRow]);
      return { success: true, unit_id: unit_id, created: false };
    } else {
      dataSheet.appendRow(unitRow);
      return { success: true, unit_id: unit_id, created: true };
    }
  } catch (e) {
    console.error('Error in updateUnit:', e);
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
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
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Reporte Integrado MSS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper to include other files.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
