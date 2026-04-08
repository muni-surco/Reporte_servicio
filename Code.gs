const APP_CONFIG = {
  SHEETS: {
    settings: 'SHIFT_SETTINGS',
    unitData: 'UNIT_DATA',
    referenceData: 'DATA',
  },
  EXTERNAL_PERSONNEL_SPREADSHEET_ID: '15Dd7IPUmG-HxK9S0QZefNov0sOVhaHgFSPrBC4WXROQ',
  MOBILE_DATA_SPREADSHEET_ID: '11j6Ipd3J6HjUnG91RCliCbjrgzJWhzUwktCgfnAESKU',
};

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
  return normalized.replace(/^SECTOR\s+/, '');
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
    'KM', 'HORARIO', 'COMBUSTIBLE', 'GASTO', 'PARTES', 'CUADRANTE', 'MECANICA_OBS'
  ];
  dataSheet.getRange(1, 1, 1, dataHeaders.length)
           .setValues([dataHeaders])
           .setFontWeight('bold')
           .setBackground('#cfe2f3');
  dataSheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    `Estructura de base de datos creada exitosamente. Las hojas ${APP_CONFIG.SHEETS.settings} y ${APP_CONFIG.SHEETS.unitData} están listas.`
  );
}

/**
 * Fetches all units and settings for a specific date, shift and sector.
 */
function getShiftData(dateStr, shift, sector) {
  const ss = SpreadsheetApp.openById(APP_CONFIG.MOBILE_DATA_SPREADSHEET_ID);
  

  // 1. Get Settings
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
    const settingsRows = settingsSheet.getDataRange().getValues();
    let commonPermanencia = '';

    // First pass: find common permanencia and collect all sector settings
    for (let i = 1; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && row[1] === shift) {
        // Capture permanencia from any row of this shift found
        if (row[5]) commonPermanencia = row[5];
        
        const sectorName = toDisplaySector(row[2]);
        if (sectorName) {
           allSectorSettings[sectorName] = {
            turno: row[1],
            operador: row[3],
            supervisor: row[4],
            nombrePuesto: sectorName,
            permanencia: row[5]
          };
        }

        // Check if this row is for the requested sector (for single view compatibility)
        if (toStorageSector(sectorName) === toStorageSector(sector)) {
          shiftSettings = {
            turno: row[1],
            operador: row[3],
            supervisor: row[4],
            nombrePuesto: sectorName,
            permanencia: row[5]
          };
        }
      }
    }
    
    // Propagate common permanencia if missing in specific sectors
    if (commonPermanencia) {
      if (!shiftSettings.permanencia) shiftSettings.permanencia = commonPermanencia;
      Object.keys(allSectorSettings).forEach(key => {
        if (!allSectorSettings[key].permanencia) {
          allSectorSettings[key].permanencia = commonPermanencia;
        }
      });
    }
  }

  // 2. Get Unit Data
  const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
  const allUnits = [];

  if (dataSheet) {
    const dataRows = dataSheet.getDataRange().getValues();
    for (let i = 1; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && row[1] === shift) {
        allUnits.push({
          id: row[3],
          sector: toDisplaySector(row[2]),
          type: row[4],
          model: row[5],
          personnel1: row[6],
          personnel2: row[7],
          plate: row[8],
          indicative: row[9],
          radio: row[10],
          status: row[11],
          reason: row[12],
          km: row[13],
          hours: row[14],
          fuel: row[15],
          expense: row[16],
          parts: row[17],
          quadrant: row[18],
          mechanics: row[19]
        });
      }
    }
  }

  return { 
    settings: shiftSettings, 
    allSectorSettings: allSectorSettings, 
    units: allUnits, 
    personnelList: getPersonnelList() 
  };
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
  
  const mobileData = [];
  const indicativesSet = new Set();
  const statusesSet = new Set();
  const quadrantsSet = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Collect Mobile Data
    if (movilIdx !== -1 && row[movilIdx]) {
      mobileData.push({
        id: String(row[movilIdx]),
        plate: placaIdx !== -1 ? String(row[placaIdx] || '') : '',
        model: modeloIdx !== -1 ? String(row[modeloIdx] || '') : '',
        radio: radioIdx !== -1 ? String(row[radioIdx] || '') : '',
        quadrant: cuadranteIdx !== -1 ? String(row[cuadranteIdx] || '') : '',
        sector: sectorIdx !== -1 ? String(row[sectorIdx] || '') : '' 
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
      quadrantsSet.add(String(row[cuadranteIdx]).trim());
    }
  }
  
  
  // Fetch External Personnel Data
  const personnelSet = new Set();
  try {
    const extSS = getExternalPersonnelSpreadsheet();
    const extSheet = extSS.getSheets()[0]; // Assumes first sheet
    const extData = extSheet.getDataRange().getValues();
    if (extData.length > 1) {
      const extHeaders = extData[0].map(h => String(h).toLowerCase().trim());
      const nameIdx = extHeaders.indexOf('apellidos_nombres');
      if (nameIdx !== -1) {
        for (let i = 1; i < extData.length; i++) {
          if (extData[i][nameIdx]) {
            personnelSet.add(String(extData[i][nameIdx]).trim());
          }
        }
      }
    }
  } catch (e) {
    console.error('Error fetching external personnel:', e);
  }

  return {
    mobiles: mobileData,
    indicatives: Array.from(indicativesSet).sort(),
    statuses: Array.from(statusesSet).sort(),
    personnel: Array.from(personnelSet).sort(),
    quadrants: Array.from(quadrantsSet).sort()
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
      return -1;
    };

    const fieldIndices = {
      dni: findHeader('dni'),
      apellidos_nombres: findHeader('apellidos_nombres'),
      regimen_laboral: findHeader('regimen_laboral'),
      estado: findHeader('estado'),
      rol_operativo: findHeader('rol_operativo')
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
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000); // 30s timeout

    // 1. Update Settings
    const settingsSheet = ss.getSheetByName(APP_CONFIG.SHEETS.settings);
    if (!settingsSheet) {
      return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.settings}. Ejecuta la función initialSetup desde el editor de código.` };
    }

    const targetSector = toStorageSector(settings.nombrePuesto || '1A');
    const settingsRows = settingsSheet.getDataRange().getValues();
    let settingsFoundIdx = -1;
    let rowsToUpdatePermanencia = [];

    for (let i = 1; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      const rowDate = row[0] ? Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '';
      
      if (rowDate === dateStr && row[1] === shift) {
        // Collect all rows for this shift to update permanencia later
        rowsToUpdatePermanencia.push(i + 1);

        // Check if this is the specific sector row
        if (toStorageSector(row[2]) === targetSector) {
          settingsFoundIdx = i + 1;
        }
      }
    }

    const settingsValues = [dateStr, shift, targetSector, settings.operador, settings.supervisor, settings.permanencia];
    
    if (settingsFoundIdx > -1) {
      // Update specific sector row
      settingsSheet.getRange(settingsFoundIdx, 1, 1, settingsValues.length).setValues([settingsValues]);
    } else {
      // Create new row for this sector
      settingsSheet.appendRow(settingsValues);
      // Add this new row index to permanencia update list (though it already has the value)
      rowsToUpdatePermanencia.push(settingsSheet.getLastRow());
    }

    // Update Permanencia for ALL other sectors in this shift
    if (rowsToUpdatePermanencia.length > 0) {
      rowsToUpdatePermanencia.forEach(rowIndex => {
         // Column 6 is PERMANENCIA
         settingsSheet.getRange(rowIndex, 6).setValue(settings.permanencia);
      });
    }

    // 2. Update Units
    const dataSheet = ss.getSheetByName(APP_CONFIG.SHEETS.unitData);
    if (!dataSheet) {
      return { success: false, error: `No se encontró la hoja ${APP_CONFIG.SHEETS.unitData}. Ejecuta la función initialSetup desde el editor de código.` };
    }

    const dataRows = dataSheet.getDataRange().getValues();
    
    // Only replace units of this sector to avoid overwriting other sectors' data during a single sector save
    const unitsToSave = units.filter(u => u.id && !u.id.startsWith('NEW-'));
    
    // However, we only delete and replace rows belonging to the CURRENT sector being edited in the frontend
    // to allow multi-user editing of different sectors.
    for (let i = dataRows.length - 1; i >= 1; i--) {
      const row = dataRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && 
          row[1] === shift && 
          toStorageSector(row[2]) === targetSector) {
        dataSheet.deleteRow(i + 1);
      }
    }
    
    const sectorUnits = unitsToSave.filter(u => toStorageSector(u.sector) === targetSector);

    if (sectorUnits.length > 0) {
      const newRows = sectorUnits.map(u => [
        dateStr, shift, targetSector,
        u.id, u.type, u.model || '', u.personnel1, u.personnel2, u.plate, u.indicative, u.radio,
        u.status, u.reason, u.km, u.hours, u.fuel, u.expense, u.parts, u.quadrant, u.mechanics
      ]);
      dataSheet.getRange(dataSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
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
