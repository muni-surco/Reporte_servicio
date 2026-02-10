
/**
 * Servidor de archivos para Google Apps Script
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Surco - Sistema de Seguridad Ciudadana')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Funciones de Mock para evitar errores en consola si se intenta llamar a GAS
 */
function getAppData() {
  return JSON.stringify({ units: [], settings: {} });
}

function saveUnit() {
  return true;
}
