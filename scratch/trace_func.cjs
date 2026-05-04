const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Documents\\GitHub\\Reporte_servicio\\dist\\index.html', 'utf8');
const search = 'REPORTE_RETEN';
const idx = content.indexOf(search);
if (idx >= 0) {
    // Find the beginning of the function
    const start = content.lastIndexOf('=', idx);
    const funcName = content.substring(content.lastIndexOf(',', start) + 1, start);
    console.log(`Function name seems to be: ${funcName}`);
    
    // Now search for where this function name is used
    let callIdx = 0;
    while ((callIdx = content.indexOf(funcName, callIdx)) >= 0) {
        console.log(`Found use of ${funcName} at ${callIdx}: ${content.substring(callIdx - 20, callIdx + 50)}`);
        callIdx += funcName.length;
    }
}
