/**
 * INITIAL SETUP: Creates the database structure for historical persistence.
 * Run this function once from the GAS editor.
 */
function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup SHIFT_SETTINGS (Operator, Supervisor per Shift/Date)
  let settingsSheet = ss.getSheetByName('SHIFT_SETTINGS');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('SHIFT_SETTINGS');
  }
  settingsSheet.clear();
  const settingsHeaders = ['FECHA', 'TURNO', 'SECTOR', 'OPERADOR', 'SUPERVISOR', 'PERMANENCIA'];
  settingsSheet.getRange(1, 1, 1, settingsHeaders.length)
               .setValues([settingsHeaders])
               .setFontWeight('bold')
               .setBackground('#d9ead3');
  settingsSheet.setFrozenRows(1);

  // 2. Setup UNIT_DATA (The actual unit records per Shift/Date)
  let dataSheet = ss.getSheetByName('UNIT_DATA');
  if (!dataSheet) {
    dataSheet = ss.insertSheet('UNIT_DATA');
  }
  dataSheet.clear();
  const dataHeaders = [
    'FECHA', 'TURNO', 'SECTOR', 'ID', 'TIPO', 'PERSONAL_1', 'PERSONAL_2', 
    'PLACA', 'INDICATIVO', 'RADIO', 'ESTADO', 'MOTIVO', 
    'KM', 'HORARIO', 'COMBUSTIBLE', 'GASTO', 'PARTES', 'CUADRANTE', 'MECANICA_OBS'
  ];
  dataSheet.getRange(1, 1, 1, dataHeaders.length)
           .setValues([dataHeaders])
           .setFontWeight('bold')
           .setBackground('#cfe2f3');
  dataSheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('Estructura de Base de Datos creada exitosamente. Las hojas SHIFT_SETTINGS y UNIT_DATA están listas.');
}

/**
 * Fetches all units and settings for a specific date, shift and sector.
 */
function getShiftData(dateStr, shift, sector) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  

  // 1. Get Settings
  const settingsSheet = ss.getSheetByName('SHIFT_SETTINGS');
  let shiftSettings = {
    turno: shift,
    operador: '',
    supervisor: '',
    nombrePuesto: sector || 'SECTOR 1A',
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
        
        const sectorName = row[2];
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
        if (sectorName === sector) {
          shiftSettings = {
            turno: row[1],
            operador: row[3],
            supervisor: row[4],
            nombrePuesto: row[2],
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
  const dataSheet = ss.getSheetByName('UNIT_DATA');
  const allUnits = [];

  if (dataSheet) {
    const dataRows = dataSheet.getDataRange().getValues();
    for (let i = 1; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && row[1] === shift) {
        allUnits.push({
          id: row[3],
          sector: row[2],
          type: row[4],
          personnel1: row[5],
          personnel2: row[6],
          plate: row[7],
          indicative: row[8],
          radio: row[9],
          status: row[10],
          reason: row[11],
          km: row[12],
          hours: row[13],
          fuel: row[14],
          expense: row[15],
          parts: row[16],
          quadrant: row[17],
          mechanics: row[18]
        });
      }
    }
  }

  return { settings: shiftSettings, allSectorSettings: allSectorSettings, units: allUnits };
}

/**
 * Fetches mobile reference data (id, plate, radio, quadrant) from "DATA" sheet.
 */
function getMobileData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DATA');
  
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  // Find column indices (case-insensitive)
  const headers = data[0].map(h => String(h).toLowerCase());
  const movilIdx = headers.indexOf('movil');
  const placaIdx = headers.indexOf('placa');
  const radioIdx = headers.indexOf('radio');
  const cuadranteIdx = headers.indexOf('cuadrante');
  const sectorIdx = headers.indexOf('sector');
  
  if (movilIdx === -1) {
    return [];
  }
  
  const mobileData = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[movilIdx]) {
      mobileData.push({
        id: String(row[movilIdx]),
        plate: placaIdx !== -1 ? String(row[placaIdx] || '') : '',
        radio: radioIdx !== -1 ? String(row[radioIdx] || '') : '',
        quadrant: cuadranteIdx !== -1 ? String(row[cuadranteIdx] || '') : '',
        // Sector might be used in frontend to filter, or just passed for reference
        sector: sectorIdx !== -1 ? String(row[sectorIdx] || '') : '' 
      });
    }
  }
  
  return mobileData;
}

/**
 * Saves all units and settings for a specific date and shift.
 */
function saveShiftData(dateStr, shift, settings, units) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000); // 30s timeout

    // 1. Update Settings
    const settingsSheet = ss.getSheetByName('SHIFT_SETTINGS');
    if (!settingsSheet) {
      return { success: false, error: 'No se encontró la hoja SHIFT_SETTINGS. Por favor ejecuta la función initialSetup desde el editor de código.' };
    }

    const targetSector = settings.nombrePuesto || 'SECTOR 1A';
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
        if (row[2] === targetSector) {
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
    const dataSheet = ss.getSheetByName('UNIT_DATA');
    if (!dataSheet) {
      return { success: false, error: 'No se encontró la hoja UNIT_DATA. Por favor ejecuta la función initialSetup desde el editor de código.' };
    }

    const dataRows = dataSheet.getDataRange().getValues();
    
    // Filter out existing rows for this date/shift AND SECTOR (Only replace units of this sector)
    // IMPORTANT: Previous logic deleted ALL units for the shift. Now we must only delete units for CURRENT SECTOR.
    for (let i = dataRows.length - 1; i >= 1; i--) {
      const row = dataRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && 
          row[1] === shift && 
          row[2] === targetSector) {
        dataSheet.deleteRow(i + 1);
      }
    }

    // Add new units (filtered by current sector just in case, though frontend should send only relevant ones or all with sector field)
    // The frontend sends 'units' array. We should filter this array to only include units of 'targetSector' to be safe,
    // OR assume 'units' contains only what needs to be saved.
    // However, App.tsx logic suggests 'units' state might contain ALL units.
    // Let's filter 'units' to only save those belonging to 'targetSector'.
    
    const unitsToSave = units.filter(u => u.sector === targetSector);

    if (unitsToSave.length > 0) {
      const newRows = unitsToSave.map(u => [
        dateStr, shift, targetSector,
        u.id, u.type, u.personnel1, u.personnel2, u.plate, u.indicative, u.radio,
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
