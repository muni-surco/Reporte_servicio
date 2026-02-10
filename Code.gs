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
 * Fetches all units and settings for a specific date and shift.
 */
function getShiftData(dateStr, shift) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Settings
  const settingsSheet = ss.getSheetByName('SHIFT_SETTINGS');
  let shiftSettings = {
    turno: shift,
    operador: '',
    supervisor: '',
    nombrePuesto: 'SECTOR 1A',
    permanencia: ''
  };

  if (settingsSheet) {
    const settingsRows = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      // Format row[0] as date string for comparison
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && row[1] === shift) {
        shiftSettings = {
          turno: row[1],
          operador: row[3],
          supervisor: row[4],
          nombrePuesto: row[2],
          permanencia: row[5]
        };
        break;
      }
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

  return { settings: shiftSettings, units: allUnits };
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

    const settingsRows = settingsSheet.getDataRange().getValues();
    let settingsFoundIdx = -1;

    for (let i = 1; i < settingsRows.length; i++) {
      const row = settingsRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && row[1] === shift) {
        settingsFoundIdx = i + 1;
        break;
      }
    }

    const settingsValues = [dateStr, shift, settings.nombrePuesto || 'SECTOR 1A', settings.operador, settings.supervisor, settings.permanencia];
    if (settingsFoundIdx > -1) {
      settingsSheet.getRange(settingsFoundIdx, 1, 1, settingsValues.length).setValues([settingsValues]);
    } else {
      settingsSheet.appendRow(settingsValues);
    }

    // 2. Update Units
    const dataSheet = ss.getSheetByName('UNIT_DATA');
    if (!dataSheet) {
      return { success: false, error: 'No se encontró la hoja UNIT_DATA. Por favor ejecuta la función initialSetup desde el editor de código.' };
    }

    const dataRows = dataSheet.getDataRange().getValues();
    
    // Filter out existing rows for this date/shift
    for (let i = dataRows.length - 1; i >= 1; i--) {
      const row = dataRows[i];
      if (row[0] && Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === dateStr && row[1] === shift) {
        dataSheet.deleteRow(i + 1);
      }
    }

    // Add new units
    if (units.length > 0) {
      const newRows = units.map(u => [
        dateStr, shift, settings.nombrePuesto || 'N/A',
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
