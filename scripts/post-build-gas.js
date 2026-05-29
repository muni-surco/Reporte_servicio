import fs from 'fs';
import path from 'path';

const distPath = path.join(process.cwd(), 'dist');
const assetsPath = path.join(distPath, 'assets');

// 1. Copy Code.gs to dist
const sourceGs = path.join(process.cwd(), 'Code.gs');
const destGs = path.join(distPath, 'Code.gs');
if (fs.existsSync(sourceGs)) {
    fs.copyFileSync(sourceGs, destGs);
    console.log('Copied Code.gs to dist/');
}

// 1b. Generate QuadrantsData.gs from utils/quadrants_data.html
const quadrantsSource = path.join(process.cwd(), 'utils', 'quadrants_data.html');
const quadrantsGsDest = path.join(distPath, 'QuadrantsData.gs');
if (fs.existsSync(quadrantsSource)) {
    const rawData = fs.readFileSync(quadrantsSource, 'utf-8');
    // Escape for single-quoted JavaScript string: \ -> \\, ' -> \', newlines -> \n
    const escaped = rawData.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
    const gsContent = `var QUADRANTS_GEOJSON = '${escaped}';\n`;
    fs.writeFileSync(quadrantsGsDest, gsContent);
    console.log('Generated dist/QuadrantsData.gs from utils/quadrants_data.html (' + (rawData.length / 1024).toFixed(1) + ' KB)');
}

// 2. Process JS and CSS into .html files
const files = fs.readdirSync(assetsPath);
const xlsxLibPath = path.join(process.cwd(), 'libs', 'xlsx.full.min.js');
if (fs.existsSync(xlsxLibPath)) {
    const xlsxContent = fs.readFileSync(xlsxLibPath, 'utf-8');
    fs.writeFileSync(path.join(distPath, 'XLSX.html'), `<script>\n${xlsxContent}\n</script>`);
    console.log('Created dist/XLSX.html from libs/xlsx.full.min.js');
}

let jsContent = '';
let cssContent = '';

files.forEach(file => {
    const ext = path.extname(file);
    const content = fs.readFileSync(path.join(assetsPath, file), 'utf-8');
    if (ext === '.js') {
        jsContent += content + '\n';
    } else if (ext === '.css') {
        cssContent += content + '\n';
    }
});

// Fallback if Vite inlined CSS
if (!cssContent) {
    const rootCss = path.join(process.cwd(), 'index.css');
    if (fs.existsSync(rootCss)) {
        cssContent = fs.readFileSync(rootCss, 'utf-8');
        console.log('Read CSS from root index.css (fallback)');
    }
}

if (jsContent) {
    fs.writeFileSync(path.join(distPath, 'JavaScript.html'), `<script>\n${jsContent}\n</script>`);
    console.log('Created dist/JavaScript.html');
}

if (cssContent) {
    fs.writeFileSync(path.join(distPath, 'styles.html'), `<style>\n${cssContent}\n</style>`);
    fs.writeFileSync(path.join(distPath, 'index.css'), cssContent);
    console.log('Created dist/styles.html and dist/index.css');
}

// 3. Transform index.html
const indexFile = path.join(distPath, 'index.html');
if (fs.existsSync(indexFile)) {
    let indexHtml = fs.readFileSync(indexFile, 'utf-8');
    
    // Remove existing script and link tags for assets
    indexHtml = indexHtml.replace(/<script[^>]+src="[^"]+assets\/[^"]+"[^>]*><\/script>/g, '');
    indexHtml = indexHtml.replace(/<link[^>]+href="[^"]+assets\/[^"]+"[^>]*>/g, '');
    indexHtml = indexHtml.replace(/<link rel="modulepreload"[^>]+>/g, '');

    // Inject our include() calls
    const includes = [];
    if (cssContent) includes.push("<?!= include('styles'); ?>");
    
    // Inject CSS in head
    if (includes.length > 0) {
        indexHtml = indexHtml.replace('</head>', includes.join('\n') + '\n</head>');
    }

    // Inject JS at the end of body
    if (jsContent) {
        let scripts = "";
        if (fs.existsSync(path.join(distPath, 'XLSX.html'))) {
            scripts += "<?!= include('XLSX'); ?>\n";
        }
        scripts += "<?!= include('JavaScript'); ?>";
        indexHtml = indexHtml.replace('</body>', scripts + "\n</body>");
    }

    fs.writeFileSync(indexFile, indexHtml);
    console.log('Transformed dist/index.html with correct include() placements');
}

console.log('GAS build preparation finished.');
