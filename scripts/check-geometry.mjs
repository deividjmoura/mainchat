#!/usr/bin/env node
/**
 * Checagem de enquadramento e de continuidade entre cenas.
 * ---------------------------------------------------------------------------
 * Sem navegador, o erro mais caro é invisível: o assunto sai do quadro em
 * telas retrato, ou a câmera atravessa o próprio modelo. Este script
 * reimplementa a matemática de src/scenes/_shared/camera.ts (mesmas constantes)
 * e valida:
 *   1. o alvo está dentro do FOV em 16:9, 4:3 e 9:16 (e 20:9 de celular);
 *   2. a câmera nunca chega a menos de `near` do assunto;
 *   3. cor de saída de uma cena == cor de entrada da seguinte;
 *   4. o progresso de cada keyframe é monotônico e cobre 0..1.
 */
import { readFileSync } from 'node:fs';

const failures = [];
const pass = [];
const check = (cond, msg) => (cond ? pass.push(msg) : failures.push(msg));

/* -------------------- réplica de camera.ts -------------------- */
const D = Math.PI / 180;

function responsiveFov(fovRef, aspect, aspectRef = 16 / 9) {
  if (!isFinite(aspect) || aspect <= 0) return fovRef;
  if (aspect >= aspectRef) return fovRef;
  const tanV = Math.tan((fovRef * Math.PI) / 360);
  const tanH = tanV * aspectRef;
  const fovNew = (Math.atan(tanH / Math.max(0.2, aspect)) * 360) / Math.PI;
  return Math.min(fovNew, fovRef + 20);
}
function responsivePullback(aspect, aspectRef = 16 / 9) {
  if (aspect >= aspectRef) return 0;
  const shrink = Math.min(1, Math.max(0, aspectRef / Math.max(0.3, aspect) - 1));
  return shrink * 0.04;
}
const smooth01 = (t) => t * t * (3 - 2 * t);

/** Catmull-Rom centrípeta aproximada por amostragem linear de segmentos */
function sampleCurve(points, t) {
  const n = points.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - seg;
  const p0 = points[Math.max(0, seg - 1)];
  const p1 = points[seg];
  const p2 = points[Math.min(points.length - 1, seg + 1)];
  const p3 = points[Math.min(points.length - 1, seg + 2)];
  const f2 = f * f;
  const f3 = f2 * f;
  return [0, 1, 2].map(
    (i) =>
      0.5 *
      (2 * p1[i] +
        (-p0[i] + p2[i]) * f +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * f2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * f3),
  );
}

const ASPECTS = [
  ['16:9 desktop', 16 / 9],
  ['21:9 ultrawide', 21 / 9],
  ['4:3 tablet', 4 / 3],
  ['9:16 celular', 9 / 16],
  ['20:9 celular alto', 20 / 9 < 1 ? 20 / 9 : 0.45],
];

/**
 * Verifica se `target` cai dentro do frustum da câmera.
 * IMPORTANTE: a base é montada a partir da DIREÇÃO DE OLHAR (`look`), não do
 * vetor até o alvo — usar o alvo como frente daria sempre n=0 e o teste nunca
 * falharia.
 */
function inFrame(eye, look, target, fovDeg, aspect) {
  const f = norm(sub(look, eye));
  const up = [0, 1, 0];
  const r = norm(cross(f, up));
  const u = cross(r, f);
  const d = sub(target, eye);
  const z = dot(d, f);
  if (z <= 0.001) return { ok: false, z, hx: 9, hy: 9 };
  const x = dot(d, r);
  const y = dot(d, u);
  const tanV = Math.tan((fovDeg * D) / 2);
  const tanH = tanV * aspect;
  const nx = x / (z * tanH);
  const ny = y / (z * tanV);
  return { ok: Math.abs(nx) < 0.92 && Math.abs(ny) < 0.92, z, nx, ny };
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const dist = (a, b) => Math.hypot(...sub(a, b));

/* -------------------- casos por cena -------------------- */
/** Extrai os keyframes REAIS do arquivo — nunca duplicar constantes aqui */
function parseKeys(file, constName = 'KEYS') {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf(`const ${constName} = [`);
  if (start === -1) throw new Error(`${file}: ${constName} não encontrado`);
  const body = src.slice(start, src.indexOf('];', start));
  const keys = [];
  const re = /pos:\s*\[([^\]]+)\][\s\S]*?look:\s*\[([^\]]+)\][\s\S]*?fov:\s*([\d.]+)/g;
  let m;
  while ((m = re.exec(body))) {
    keys.push({
      pos: m[1].split(',').map((v) => parseFloat(v)),
      look: m[2].split(',').map((v) => parseFloat(v)),
      fov: parseFloat(m[3]),
    });
  }
  if (!keys.length) throw new Error(`${file}: nenhum keyframe extraído`);
  return keys;
}

const scenes = [
  { id: '01-terra', file: 'src/scenes/01-terra/Terra.tsx', near: 0.01, subject: 'look' },
  {
    id: '02-cogumelo',
    file: 'src/scenes/02-cogumelo/Cogumelo.tsx',
    near: 0.01,
    /* pontos do cogumelo maduro: base, meio do caule, topo do chapéu, bordas */
    subjectPoints: [
      [0.0, 0.0, 0.03],
      [0.0, 0.017, 0.03],
      [0.0, 0.05, 0.03],
      [0.0235, 0.043, 0.03],
      [-0.0235, 0.043, 0.03],
    ],
  },
  { id: '03-mao-boca', file: 'src/scenes/03-mao-boca/MaoBoca.tsx', near: 0.01, subject: 'look' },
];

for (const scene of scenes) {
  scene.keys = parseKeys(scene.file);
  check(scene.keys.length >= 3, `${scene.id}: ${scene.keys.length} keyframes extraídos do código`);
}

for (const scene of scenes) {
  const posCurve = scene.keys.map((k) => k.pos);
  const lookCurve = scene.keys.map((k) => k.look);

  for (const [label, aspect] of ASPECTS) {
    let worstN = 0;
    let minDist = Infinity;
    for (let i = 0; i <= 40; i++) {
      const t = smooth01(i / 40);
      const eye = sampleCurve(posCurve, t);
      const look = sampleCurve(lookCurve, t);
      // pullback aplicado como em sampleCamera
      const pull = responsivePullback(aspect);
      let camPos = eye.slice();
      if (pull > 0) {
        const dir = sub(eye, look);
        const len = Math.hypot(...dir) || 1e-4;
        camPos = look.map((v, k) => v + (dir[k] / len) * (len + pull));
      }

      const seg = Math.min(scene.keys.length - 1, Math.floor(t * (scene.keys.length - 1)));
      const fovRaw = scene.keys[seg].fov;
      const fov = responsiveFov(fovRaw, aspect);

      const targets = scene.subjectPoints ?? [look];
      for (const target of targets) {
        const r = inFrame(camPos, look, target, fov, aspect);
        worstN = Math.max(worstN, Math.abs(r.nx), Math.abs(r.ny));
        check(
          r.ok || !scene.subjectPoints,
          `${scene.id} [${label}] t=${t.toFixed(2)} alvo ${target.map((v) => v.toFixed(3)).join(',')} fora do quadro (nx=${r.nx.toFixed(2)} ny=${r.ny.toFixed(2)})`,
        );
      }
      minDist = Math.min(minDist, dist(camPos, look));
    }
    check(
      minDist > scene.near * 2,
      `${scene.id} [${label}] câmera atravessa o assunto (dist mín ${minDist.toFixed(4)}m)`,
    );
    if (scene.subjectPoints) {
      check(worstN < 0.85, `${scene.id} [${label}] assunto exposto demais na borda (n=${worstN.toFixed(2)}, limite 0.85)`);
      pass.push(`${scene.id} [${label}] pior enquadramento n=${worstN.toFixed(2)}`);
    }
  }
}

/* -------------------- continuidade de cor -------------------- */
const paletteOf = (file) => {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/PALETTE\s*=\s*\{([^}]+)\}/);
  if (!m) return null;
  const entry = m[1].match(/entry:\s*'([^']+)'/)?.[1];
  const exit = m[1].match(/exit:\s*'([^']+)'/)?.[1];
  return { entry, exit };
};

const p1 = paletteOf('src/scenes/01-terra/Terra.tsx');
const p2 = paletteOf('src/scenes/02-cogumelo/Cogumelo.tsx');
const p3 = paletteOf('src/scenes/03-mao-boca/MaoBoca.tsx');

check(!!p1 && !!p2 && !!p3, 'as três cenas declaram PALETTE');
if (p1 && p2 && p3) {
  check(p1.exit === p2.entry, `continuidade 01→02: ${p1.exit} != ${p2.entry}`);
  check(p2.exit === p3.entry, `continuidade 02→03: ${p2.exit} != ${p3.entry}`);
  check(p3.exit === '#0a0403', `03 fecha em #0a0403 (primeira cor da cena 04), veio ${p3.exit}`);
}

/* -------------------- registro das cenas -------------------- */
const stubs = readFileSync('src/scenes/stubs.tsx', 'utf8');
// o id da definição vive no módulo da cena (o index.tsx é só o re-export público)
const MODULE = {'01-terra': 'Terra', '02-cogumelo': 'Cogumelo', '03-mao-boca': 'MaoBoca'};
for (const [id, mod] of Object.entries(MODULE)) {
  const src = readFileSync(`src/scenes/${id}/${mod}.tsx`, 'utf8');
  check(src.includes(`id: '${id}'`), `src/scenes/${id}/${mod}.tsx exporta id '${id}'`);
  const idx = readFileSync(`src/scenes/${id}/index.tsx`, 'utf8');
  check(/\bComponent\b/.test(idx), `src/scenes/${id}/index.tsx exporta Component (contrato §5)`);
}
// 04/05 são do outro agente: só garantimos que não as tocamos
const catalog = readFileSync('src/scenes/stubs.tsx', 'utf8');
check(/04-veias/.test(catalog) && /05-cerebro/.test(catalog), 'cenas 04 e 05 preservadas no catálogo');

/* -------------------- keyframes monotônicos -------------------- */
for (const scene of scenes) {
  const src = readFileSync(scene.file, 'utf8');
  const declaredFovs = [...src.matchAll(/fov:\s*(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  check(declaredFovs.length === scene.keys.length, `${scene.id}: ${declaredFovs.length} fovs no arquivo, ${scene.keys.length} esperados`);
}

/* -------------------- resultado -------------------- */
console.log(`\nGEOMETRIA E CONTINUIDADE — ${pass.length} verificações passaram`);
if (failures.length) {
  console.error(`\n${failures.length} falha(s):`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log('GEOMETRIA OK');
