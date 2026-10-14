// Builds docs/ (served by GitHub Pages): a self-contained index.html plus manifest, service worker and icons.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const out = 'docs';
mkdirSync(out, { recursive: true });

const js = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['safari15'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  write: false,
  legalComments: 'none',
});
const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const font = readFileSync('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2').toString('base64');
let css = readFileSync('src/styles.css', 'utf8').replace('__FONT__', `data:font/woff2;base64,${font}`);
css = (await build({ stdin: { contents: css, loader: 'css' }, minify: true, write: false, target: ['safari15'] })).outputFiles[0].text;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Swellness</title>
<meta name="description" content="Personal strength training log">
<meta name="theme-color" content="#14171a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Swellness">
<meta name="format-detection" content="telephone=no">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<div id="boot" style="position:fixed;inset:0;display:grid;place-items:center;background:var(--bg)"></div>
<script>${script}</script>
</body>
</html>
`;
writeFileSync(`${out}/index.html`, html);

const version = createHash('sha1').update(html).digest('hex').slice(0, 10);

writeFileSync(`${out}/manifest.webmanifest`, JSON.stringify({
  name: 'Swellness',
  short_name: 'Swellness',
  description: 'Personal strength training log',
  start_url: './',
  scope: './',
  id: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#14171a',
  theme_color: '#14171a',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

writeFileSync(`${out}/sw.js`, `// Swellness offline cache. Bump comes from the build hash.
const CACHE = 'swellness-${version}';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = await caches.open(CACHE);
    for (const k of await caches.keys()) {
      if (k === CACHE) continue;
      const old = await caches.open(k);
      for (const req of await old.keys()) {
        if (new URL(req.url).pathname.includes('/ex/')) { const r = await old.match(req); if (r) await keep.put(req, r); }
      }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // network first for the page so updates arrive, cache when offline
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // cache-first; exercise photos and guides are cached the first time they are viewed
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && new URL(req.url).pathname.includes('/ex/')) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
`);

for (const f of readdirSync('icons')) copyFileSync(`icons/${f}`, `${out}/${f}`);
copyFileSync('THIRD_PARTY_NOTICES.md', `${out}/THIRD_PARTY_NOTICES.md`);
rmSync(`${out}/ex`, { recursive: true, force: true });
cpSync('public/ex', `${out}/ex`, { recursive: true });
writeFileSync(`${out}/.nojekyll`, '');

console.log(`built ${out}/index.html ${(html.length / 1024).toFixed(0)} KB, cache ${version}`);
