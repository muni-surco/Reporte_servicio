const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Documents\\GitHub\\Reporte_servicio\\dist\\index.html', 'utf8');
const search = 'Tc=';
const idx = content.indexOf(search);
if (idx >= 0) {
    console.log(content.substring(idx - 100, idx + 400));
} else {
    console.log('Not found');
}
