const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Documents\\GitHub\\Reporte_servicio\\dist\\JavaScript.html', 'utf8');
const search = 'restricciones de red';
const idx = content.indexOf(search);
if (idx >= 0) {
    console.log(content.substring(idx - 250, idx));
} else {
    console.log('Not found');
}
