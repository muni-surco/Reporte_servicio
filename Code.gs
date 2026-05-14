const APP_CONFIG = {
  SHEETS: {
    settings: 'SHIFT_SETTINGS',
    unitData: 'UNIT_DATA',
    referenceData: 'DATA',
    retenLog: 'RETEN_LOG',
  },
  EXTERNAL_PERSONNEL_SPREADSHEET_ID: '15Dd7IPUmG-HxK9S0QZefNov0sOVhaHgFSPrBC4WXROQ',
  MOBILE_DATA_SPREADSHEET_ID: '11j6Ipd3J6HjUnG91RCliCbjrgzJWhzUwktCgfnAESKU',
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
    'KM_INICIO', 'KM_FIN', 'TOTAL_KM', 'KM_RECARGA', 'HORARIO', 'COMBUSTIBLE', 'GASTO', 'PARTES', 'CUADRANTE', 'MECANICA_OBS'
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

      let commonPermanencia = '';

      for (let i = 0; i < settingsRows.length; i++) {
        const row = settingsRows[i];
        if (!row[0]) continue;
        try {
          const rowDateStr = Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd');
          if (rowDateStr !== dateStr || String(row[1]) !== shift) continue;
        } catch (e) {
          continue;
        }

        // Convert all values to strings to avoid GAS serialization issues with Date/Number cell values
        const permanenciaVal = String(row[5] || '');
        if (permanenciaVal) commonPermanencia = permanenciaVal;

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

      if (commonPermanencia) {
        if (!shiftSettings.permanencia) shiftSettings.permanencia = commonPermanencia;
        Object.keys(allSectorSettings).forEach(key => {
          if (!allSectorSettings[key].permanencia) {
            allSectorSettings[key].permanencia = commonPermanencia;
          }
        });
      }
    }

    // 2. Get Unit Data - two-phase approach for optimal performance
    const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
    const allUnits = [];

    if (dataSheet) {
      const dataLastRow = dataSheet.getLastRow();

      // Phase 1: Read columns 1-4 (FECHA, TURNO, SECTOR, ID) for filtering
      const dataRows = dataLastRow > 1
        ? dataSheet.getRange(2, 1, dataLastRow - 1, 4).getValues()
        : [];

      // Find matching row indices
      const matchingRowIndices = [];
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row[0]) continue;
        try {
          const rowDateStr = Utilities.formatDate(new Date(row[0]), timeZone, 'yyyy-MM-dd');
          if (rowDateStr === dateStr && String(row[1]) === shift) {
            matchingRowIndices.push(i + 2); // +2 because data starts at row 2
          }
        } catch (e) {
          continue;
        }
      }

      // Phase 2: Read full rows for matching indices
      for (const rowIndex of matchingRowIndices) {
        const fullRow = dataSheet.getRange(rowIndex, 1, 1, 23).getValues()[0];

        // Convert all values to String to avoid serialization issues with Date/Number cells
        allUnits.push({
          id: String(fullRow[3] || ''),
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
          mechanics: String(fullRow[22] || '')
        });
      }
    }

    console.log('[getShiftData] OK — units=' + allUnits.length);

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
  const cuadranteIdx = headers.indexOf('cuadrante');
  const sectorIdx = headers.indexOf('sector');
  const indicativoIdx = headers.indexOf('indicativo');
  const estadoIdx = headers.indexOf('estado');
  const modeloIdx = headers.indexOf('modelo');
  const motivoTallerIdx = headers.indexOf('motivo_taller');
  
  const mobileData = [];
  const indicativesSet = new Set();
  const statusesSet = new Set();
  const quadrantsSet = new Set();
  const motivoTallerSet = new Set();
  const radiosSet = new Set();

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
      const operatorRoles = ['OPERADOR DE CAMARAS', 'RADIO OPERADOR', 'JEFE AREA', 'SUPERVISOR', 'SERENO A PIE'];
      
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
      sector_id: findHeader('sector_id')
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

  // Phase 1: Read everything upfront (no lock needed for reads)
  const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
  if (!settingsSheet) {
    return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.settings}. Ejecuta la función initialSetup desde el editor de código.` };
  }
  const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  if (!dataSheet) {
    return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.unitData}. Ejecuta la función initialSetup desde el editor de código.` };
  }

  const targetSector = toStorageSector(settings.nombrePuesto || '1A');

  // Optimization: Read only necessary columns instead of entire sheet
  const settingsLastRow = settingsSheet.getLastRow();
  const settingsRows = settingsLastRow > 1 
    ? settingsSheet.getRange(2, 1, settingsLastRow - 1, 6).getValues() 
    : [];

  const dataLastRow = dataSheet.getLastRow();
  const dataRows = dataLastRow > 1 
    ? dataSheet.getRange(2, 1, dataLastRow - 1, 23).getValues() // Read all 23 columns
    : [];

  const timeZone = ss.getSpreadsheetTimeZone();


  // --- PRE-PROCESS OUTSIDE LOCK (Fast Lookups) ---
  let settingsFoundIdx = -1;
  const permanenciaUpdates = [];
  for (let i = 0; i < settingsRows.length; i++) {
    const row = settingsRows[i];
    if (!row[0]) continue;
    try {
      const rowDate = (row[0] instanceof Date) ? Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') : String(row[0]);
      if (rowDate === dateStr && String(row[1]) === shift) {
        permanenciaUpdates.push(i + 2);
        if (toStorageSector(row[2]) === targetSector) {
          settingsFoundIdx = i + 2;
        }
      }
    } catch (e) {}
  }

  // Find all existing unit row indices for this specific sector/date/shift
  const sectorRowIndices = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row[0]) continue;
    try {
      const rowDate = (row[0] instanceof Date) ? Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') : String(row[0]);
      if (rowDate === dateStr && String(row[1]) === shift && toStorageSector(row[2]) === targetSector) {
        sectorRowIndices.push(i + 2);
      }
    } catch (e) {}
  }

  const specialStatuses = [
    'MAESTRANZA', 'TALLER PARTICULAR', 'CHOFER SIN MOVIL', 'EN PC X DESPERFECTOS',
    'DESCANSO COMPENSATORIO', 'DESCANSO MEDICO', 'DESCANSO MÉDICO',
    'FALTO', 'ONOMASTICO', 'ONOMÁSTICO', 'PERMISO'
  ];

  const unitsToSave = units.filter(u =>
    (u.id && String(u.id).trim() !== '') ||
    (u.personnel1 && String(u.personnel1).trim() !== '') ||
    (u.status && specialStatuses.includes(u.status.toUpperCase()))
  );
  const sectorUnits = unitsToSave.filter(u => toStorageSector(u.sector) === targetSector);

  // Phase 2: Acquire lock only for writes (shortest window possible)
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(20000)) { // 20s timeout
      return { success: false, error: 'LOCK_TIMEOUT', retry: true };
    }

    // --- Settings: Update/Append target sector row ---
    const settingsValues = [dateStr, shift, targetSector, settings.operador, settings.supervisor, settings.permanencia];
    if (settingsFoundIdx > -1) {
      settingsSheet.getRange(settingsFoundIdx, 1, 1, settingsValues.length).setValues([settingsValues]);
    } else {
      settingsSheet.appendRow(settingsValues);
      permanenciaUpdates.push(settingsSheet.getLastRow());
    }

    // --- Permanencia: Sync all sectors for same date/shift ---
    if (permanenciaUpdates.length > 0) {
      let ranges = [];
      let start = permanenciaUpdates[0], end = permanenciaUpdates[0];
      for (let i = 1; i < permanenciaUpdates.length; i++) {
        if (permanenciaUpdates[i] === end + 1) {
          end = permanenciaUpdates[i];
        } else {
          ranges.push({ start: start, end: end });
          start = end = permanenciaUpdates[i];
        }
      }
      ranges.push({ start: start, end: end });
      ranges.forEach(r => {
        const count = r.end - r.start + 1;
        const vals = Array.from({ length: count }, () => [settings.permanencia]);
        settingsSheet.getRange(r.start, 6, count, 1).setValues(vals);
      });
    }

    // --- Mileage Bridge: Find previous shift records to update KM_FIN ---
    const prevShiftInfo = getPreviousShift(dateStr, shift, timeZone);
    const prevShiftRecords = new Map();
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row[0]) continue;
      try {
        const rowDate = (row[0] instanceof Date) ? Utilities.formatDate(row[0], timeZone, 'yyyy-MM-dd') : String(row[0]);
        if (rowDate === prevShiftInfo.date && String(row[1]) === prevShiftInfo.shift) {
          const unitId = String(row[3] || '').trim().toUpperCase();
          if (unitId) {
            prevShiftRecords.set(unitId, { rowIndex: i + 2, rowData: [...row] });
          }
        }
      } catch (e) {}
    }

    // Track updates to perform them in batches
    const unitUpdates = [];
    const rowsToAppend = [];

    // --- Position-Based Unit Sync ---
    for (let i = 0; i < sectorUnits.length; i++) {
      const unit = sectorUnits[i];
      const unitId = String(unit.id || '').trim();
      const unitRow = [
        dateStr, shift, targetSector,
        unitId, unit.type, unit.model || '', unit.personnel1 || '', unit.personnel2 || '', unit.plate || '', unit.indicative || '', unit.radio || '',
        unit.status || '', unit.reason || '', unit.kmStart || '0', unit.kmEnd || '0', unit.totalKm || '0', unit.kmRecarga || '0', unit.hours || '', unit.fuel || '', unit.expense || '', '0', unit.quadrant || '', unit.mechanics || ''
      ];

      if (i < sectorRowIndices.length) {
        unitUpdates.push({ rowIndex: sectorRowIndices[i], values: unitRow });
      } else {
        rowsToAppend.push(unitRow);
      }

      // Update KM_FIN of previous shift if applicable
      if (unitId && unit.kmStart && unit.kmStart !== '0' && prevShiftRecords.has(unitId.toUpperCase())) {
        const prev = prevShiftRecords.get(unitId.toUpperCase());
        prev.rowData[14] = unit.kmStart; // Index 14 is KM_FIN
        const prevKmStart = parseFloat(prev.rowData[13]) || 0;
        const prevKmEnd = parseFloat(unit.kmStart) || 0;
        prev.rowData[15] = prevKmEnd >= prevKmStart ? (prevKmEnd - prevKmStart).toFixed(1) : '0';
        unitUpdates.push({ rowIndex: prev.rowIndex, values: prev.rowData });
      }
    }

    // If there are extra rows in the spreadsheet for this sector, clear them
    if (sectorRowIndices.length > sectorUnits.length) {
      for (let i = sectorUnits.length; i < sectorRowIndices.length; i++) {
        const emptyRow = Array(23).fill('');
        unitUpdates.push({ rowIndex: sectorRowIndices[i], values: emptyRow });
      }
    }

    // Sort updates by rowIndex to facilitate batching
    unitUpdates.sort((a, b) => a.rowIndex - b.rowIndex);

    // Perform unit updates in contiguous batches
    if (unitUpdates.length > 0) {
      let i = 0;
      while (i < unitUpdates.length) {
        let j = i;
        while (j + 1 < unitUpdates.length && unitUpdates[j + 1].rowIndex === unitUpdates[j].rowIndex + 1) {
          j++;
        }
        const startRow = unitUpdates[i].rowIndex;
        const numRows = j - i + 1;
        const batchValues = unitUpdates.slice(i, j + 1).map(u => u.values);
        dataSheet.getRange(startRow, 1, numRows, batchValues[0].length).setValues(batchValues);
        i = j + 1;
      }
    }

    // Write new rows at the end
    if (rowsToAppend.length > 0) {
      dataSheet.getRange(dataSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    return { success: true };
  } catch (e) {
    console.error('Error in saveShiftData:', e);
    if (e.message && e.message.includes('Lock')) {
      return { success: false, error: 'LOCK_TIMEOUT', retry: true };
    }
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
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
