import fs from 'fs';
import path from 'path';

const distPath = path.join(process.cwd(), 'dist');
const assetsPath = path.join(distPath, 'assets');
const reportsAssetsPath = path.join(distPath, 'reports-assets');

// 1. Copy Code.gs to dist
const sourceGs = path.join(process.cwd(), 'Code.gs');
const destGs = path.join(distPath, 'Code.gs');
if (fs.existsSync(sourceGs)) {
    fs.copyFileSync(sourceGs, destGs);
    console.log('Copied Code.gs to dist/');
}

// 2. Process JS and CSS into .html files
const files = fs.readdirSync(assetsPath);

let jsContent = '';
let cssContent = '';
let reportsContent = '';

const createScriptHtml = (content) => {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    return `<script>(function(){var binary=atob('${encoded}');var bytes=Array.prototype.map.call(binary,function(char){return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);}).join('');var code=decodeURIComponent(bytes);eval(code);})();</script>`;
};

const reportsFile = path.join(reportsAssetsPath, 'reports.js');
if (fs.existsSync(reportsFile)) {
    reportsContent = fs.readFileSync(reportsFile, 'utf-8');
    fs.writeFileSync(path.join(distPath, 'ReportJavaScript.html'), createScriptHtml(reportsContent));
    fs.rmSync(reportsAssetsPath, { recursive: true, force: true });
    console.log('Created dist/ReportJavaScript.html');
}

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
    fs.writeFileSync(path.join(distPath, 'JavaScript.html'), createScriptHtml(jsContent));
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
        let scripts = "<?!= include('JavaScript'); ?>";
        if (reportsContent) scripts += "\n<?!= include('ReportJavaScript'); ?>";
        indexHtml = indexHtml.replace('</body>', scripts + "\n</body>");
    }

    fs.writeFileSync(indexFile, indexHtml);
    console.log('Transformed dist/index.html with correct include() placements');
}

console.log('GAS build preparation finished.');
