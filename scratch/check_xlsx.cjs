const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Documents\\GitHub\\Reporte_servicio\\dist\\index.html', 'utf8');
const regex = /(?<!window\.)XLSX/g;
let match;
while ((match = regex.exec(content)) !== null) {
    console.log(`Found bare XLSX at ${match.index}: ${content.substring(match.index - 50, match.index + 50)}`);
}
