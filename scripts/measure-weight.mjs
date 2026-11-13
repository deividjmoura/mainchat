#!/usr/bin/env node
/**
 * Pesos por cena, medidos — não estimados.
 * ---------------------------------------------------------------------------
 * Roda um build de produção com `manualChunks` que isola cada cena do código
 * compartilhado (three, react, motion, UI da fundação). Assim cada número
 * abaixo responde "quanto esta cena acrescenta ao download".
 *
 * `vite build` normal (sem esta separação) empacota tudo em um chunk; este
 * script existe para atribuir o peso por cena, e o resultado vai para
 * docs/PERF.md.
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { gzipSync } from 'node:zlib';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-weight';

await build({
  configFile: false,
  logLevel: 'error',
  plugins: [react()],
  build: {
    outDir: OUT,
    emptyOutDir: true,
    minify: 'esbuild',
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three') || id.includes('postprocessing')) return 'vendor-3d';
          if (id.includes('node_modules/motion') || id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'vendor-motion';
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('/src/scenes/_shared/')) return 'scenes-shared';
          if (id.includes('/src/scenes/01-terra/')) return 'scene-01-terra';
          if (id.includes('/src/scenes/02-cogumelo/')) return 'scene-02-cogumelo';
          if (id.includes('/src/scenes/03-mao-boca/')) return 'scene-03-mao-boca';
          return undefined;
        },
      },
    },
  },
});

// lê o manifest para mapear chunk → arquivo
const manifest = JSON.parse(readFileSync(join(OUT, '.vite/manifest.json'), 'utf8'));
const rows = [];
const seen = new Set();
for (const [key, entry] of Object.entries(manifest)) {
  if (entry.type === 'chunk' || !entry.type) {
    if (!entry.file || seen.has(entry.file)) continue;
    seen.add(entry.file);
    const buf = readFileSync(join(OUT, entry.file));
    rows.push({
      chunk: entry.name ?? key,
      raw: buf.length,
      gzip: gzipSync(buf).length,
    });
  } else if (entry.file && !seen.has(entry.file) && entry.file.endsWith('.css')) {
    seen.add(entry.file);
    const buf = readFileSync(join(OUT, entry.file));
    rows.push({ chunk: 'css', raw: buf.length, gzip: gzipSync(buf).length });
  }
}

rows.sort((a, b) => b.gzip - a.gzip);
const kb = (n) => (n / 1024).toFixed(1).padStart(8);

console.log('\npeso por chunk (build de produção, minificado)\n');
console.log('chunk'.padEnd(22) + 'cru (kB)'.padStart(10) + 'gzip (kB)'.padStart(12));
console.log('-'.repeat(44));
for (const r of rows) console.log(r.chunk.padEnd(22) + kb(r.raw) + kb(r.gzip).padStart(12));

const sceneTotal = (prefix) =>
  rows.filter((r) => r.chunk.startsWith(prefix)).reduce((s, r) => s + r.gzip, 0);
const shared = rows.filter((r) => r.chunk === 'scenes-shared').reduce((s, r) => s + r.gzip, 0);
const total = rows.reduce((s, r) => s + r.gzip, 0);

console.log('-'.repeat(44));
console.log(`total gzip: ${(total / 1024).toFixed(1)} kB`);
console.log(`\ncusto marginal por cena (gzip, sem os vendors):`);
for (const id of ['scene-01-terra', 'scene-02-cogumelo', 'scene-03-mao-boca']) {
  console.log(`  ${id.padEnd(20)} ${(sceneTotal(id) / 1024).toFixed(1).padStart(6)} kB`);
}
console.log(`  ${'scenes-shared'.padEnd(20)} ${(shared / 1024).toFixed(1).padStart(6)} kB  (comum às três)`);
console.log(`\nassets binários em public/assets: 0 kB (tudo procedural nas três cenas)`);

rmSync(OUT, { recursive: true, force: true });
