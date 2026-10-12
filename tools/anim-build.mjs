import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist-dev', { recursive: true });
const js = (await build({ entryPoints: ['tools/anim-preview.jsx'], bundle: true, format: 'iife', jsx: 'automatic', jsxImportSource: 'preact', write: false })).outputFiles[0].text;
const css = readFileSync('src/styles.css', 'utf8').replace('__FONT__', '');
writeFileSync('dist-dev/anim.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}
body{padding:12px} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px} figure{margin:0} .pair{display:grid;grid-template-columns:1fr 1fr;gap:4px} .grid:has(.ab){grid-template-columns:repeat(3,1fr)} figcaption{font-size:13px;color:var(--text-2);margin-top:4px}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
console.log('dev page built');
