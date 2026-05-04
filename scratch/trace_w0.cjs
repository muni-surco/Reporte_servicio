const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Documents\\GitHub\\Reporte_servicio\\dist\\index.html', 'utf8');
const search = 'w0';
let callIdx = 0;
while ((callIdx = content.indexOf(search, callIdx)) >= 0) {
    console.log(`Found use of w0 at ${callIdx}: ${content.substring(callIdx - 20, callIdx + 50)}`);
    callIdx += search.length;
}
