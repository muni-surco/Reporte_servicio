const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Documents\\GitHub\\Reporte_servicio\\dist\\index.html', 'utf8');
const search = 'onClick:';
let idx = 0;
while ((idx = content.indexOf(search, idx)) >= 0) {
    const snippet = content.substring(idx, idx + 100);
    if (snippet.includes('REPORTE_RETEN') || snippet.includes('xlsx')) {
        console.log(`Found relevant onClick at ${idx}: ${snippet}`);
    }
    idx += search.length;
}
