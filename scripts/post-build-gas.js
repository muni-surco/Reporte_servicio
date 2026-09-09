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

    // Inject JS at the end of body (XLSX is lazy-loaded on demand, not in initial HTML)
    if (jsContent) {
        const scripts = "<?!= include('JavaScript'); ?>";
        indexHtml = indexHtml.replace('</body>', scripts + "\n</body>");
    }

    fs.writeFileSync(indexFile, indexHtml);
    console.log('Transformed dist/index.html with correct include() placements');
}

console.log('GAS build preparation finished.');
