// Build script for Lights Out.
//   node build.mjs           -> dev build (readable)
//   node build.mjs --min     -> minified build
//   node build.mjs --serve   -> build, watch src/ and serve dist/web on http://localhost:8080
// Outputs:
//   dist/lights-out.html     one self-contained file: double-click to play offline, or share it
//   dist/web/                installable web app (PWA) for hosting on Netlify, itch.io, GitHub Pages...
import { build, context } from 'esbuild';
import fs from 'fs';

const args = process.argv.slice(2);
const minify = args.includes('--min');

function page(js, pwa) {
  const css = fs.readFileSync('src/style.css', 'utf8');
  let html = fs.readFileSync('src/index.html', 'utf8');
  const pwaHead = pwa ? '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#e10600"><link rel="apple-touch-icon" href="icon-180.png"><meta name="apple-mobile-web-app-capable" content="yes">' : '';
  const pwaBody = pwa ? "<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});</script>" : '';
  return html.replace('<!--PWA-->', pwaHead).replace('<!--SW-->', pwaBody)
    .replace('/*CSS*/', () => css).replace('/*JS*/', () => js.replace(/<\/script/g, '<\\/script'));
}

function write(js) {
  fs.mkdirSync('dist/web', { recursive: true });
  fs.writeFileSync('dist/lights-out.html', page(js, false));
  fs.writeFileSync('dist/web/index.html', page(js, true));
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-180.png']) fs.copyFileSync('assets/' + f, 'dist/web/' + f);
  console.log(`built dist/lights-out.html (${(fs.statSync('dist/lights-out.html').size / 1024).toFixed(0)} KB) and dist/web/`);
}

const opts = { entryPoints: ['src/main.js'], bundle: true, minify, format: 'iife', write: false, target: 'es2019', legalComments: 'eof' };

if (args.includes('--serve')) {
  const ctx = await context({ ...opts, plugins: [{ name: 'out', setup(b) { b.onEnd(r => { if (!r.errors.length) write(r.outputFiles[0].text); }); } }] });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist/web', port: 8080 });
  console.log(`serving on http://localhost:${port} (rebuilds when you save a file in src/)`);
} else {
  const r = await build(opts);
  write(r.outputFiles[0].text);
}
