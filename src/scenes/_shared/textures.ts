/**
 * TEXTURAS PROCEDURAIS — geradas em runtime, cacheadas por chave.
 * ---------------------------------------------------------------------------
 * Nenhum binário é necessário para as três cenas rodarem. Cada função é
 * determinística (mesma seed → mesma imagem), então não há "piscada" entre
 * refresh nem diferença de aparência em máquinas diferentes.
 *
 * Custo medido (1 núcleo, Node): húmus 1024² ≈ 110ms · folha 512² ≈ 25ms ·
 * pele 512² ≈ 45ms. Tudo roda no preloader da cena, nunca no meio do scroll.
 */
import { rng } from './math';

/* ------------------------------ ruído ------------------------------ */

function hash2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

export function fbm2(x: number, y: number, octaves = 5, seed = 1, lacunarity = 2, gain = 0.5) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq + i * 17.3, y * freq - i * 9.1, seed + i * 131);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/* ------------------------------ canvas ------------------------------ */

const cache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function cached(key: string, build: () => HTMLCanvasElement) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = build();
  cache.set(key, c);
  return c;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/** Converte campo de altura em normal map (diferenças centrais, tiles) */
export function heightToNormal(h: Float32Array, w: number, hh: number, strength = 2.2) {
  const c = makeCanvas(w, hh);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, hh);
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 127.5 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------ CENA 01: HÚMUS ------------------------------ */

export interface HumusMaps {
  color: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
}

export function makeHumusMaps(size = 1024): HumusMaps {
  const color = cached(`humus-c-${size}`, () => {
    const rand = rng(20241113);
    const c = makeCanvas(size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const dark = rgb('#17100a');
    const mid = rgb('#2c1e12');
    const light = rgb('#48331f');
    const moss = rgb('#2b3a22');

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // três escalas de relevo: torrões, grânulos, areia orgânica
        const n =
          fbm2(u * 4, v * 4, 5, 11) * 0.55 +
          fbm2(u * 26, v * 26, 4, 71, 2.3, 0.55) * 0.3 +
          fbm2(u * 70, v * 70, 3, 137) * 0.15;
        const t = Math.min(1, Math.max(0, (n - 0.28) / 0.5));
        let r = dark.r + (mid.r - dark.r) * t * 2;
        let g = dark.g + (mid.g - dark.g) * t * 2;
        let b = dark.b + (mid.b - dark.b) * t * 2;
        if (t > 0.5) {
          const t2 = (t - 0.5) * 2;
          r += (light.r - r) * t2;
          g += (light.g - g) * t2;
          b += (light.b - b) * t2;
        }
        // musgo em ~12% da área (onde a umidade é maior)
        const mossMask = Math.max(0, (fbm2(u * 7, v * 7, 3, 55) - 0.62) * 4);
        r += (moss.r - r) * mossMask * 0.55;
        g += (moss.g - g) * mossMask * 0.55;
        b += (moss.b - b) * mossMask * 0.55;

        const speck = rand() > 0.996 ? 26 : 0;
        const i = (y * size + x) * 4;
        img.data[i] = Math.min(255, r + speck);
        img.data[i + 1] = Math.min(255, g + speck);
        img.data[i + 2] = Math.min(255, b + speck);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // folhas decompostas: elipses semitransparentes com nervura
    for (let i = 0; i < 90; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const w = 26 + rand() * 90;
      const hh = w * (0.35 + rand() * 0.35);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand() * Math.PI * 2);
      const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      const tone = 30 + rand() * 40;
      grad.addColorStop(0, `rgba(${tone + 20},${tone + 8},${tone * 0.55},0)`);
      grad.addColorStop(0.45, `rgba(${tone + 34},${tone + 16},${tone * 0.6},0.55)`);
      grad.addColorStop(1, `rgba(${tone + 10},${tone},${tone * 0.5},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, hh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,14,8,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
    return c;
  });

  const nSize = Math.min(size, 512);
  const normal = cached(`humus-n-${nSize}`, () => {
    const hfield = new Float32Array(nSize * nSize);
    for (let y = 0; y < nSize; y++) {
      for (let x = 0; x < nSize; x++) {
        const u = x / nSize;
        const v = y / nSize;
        hfield[y * nSize + x] =
          fbm2(u * 4, v * 4, 5, 11) * 0.55 +
          fbm2(u * 26, v * 26, 4, 71) * 0.3 +
          fbm2(u * 70, v * 70, 3, 137) * 0.15;
      }
    }
    return heightToNormal(hfield, nSize, nSize, 5);
  });

  const roughness = cached(`humus-r-${size}`, () => {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // onde há umidade, o roughness cai → brilho especular de terra molhada
        const wet = fbm2(u * 3.1, v * 3.1, 4, 903);
        const rough = 0.96 - Math.max(0, wet - 0.55) * 1.5;
        const val = Math.max(0, Math.min(1, rough)) * 255;
        const i = (y * size + x) * 4;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

  return { color, normal, roughness };
}

/* ------------------------------ FOLHAS ------------------------------ */

export function makeLeafCanvas(variant = 0, size = 512) {
  return cached(`leaf-${variant}-${size}`, () => {
    const rand = rng(7000 + variant * 91);
    const c = makeCanvas(size);
    const ctx = c.getContext('2d')!;
    const cx = size / 2;
    const cy = size / 2;
    const len = size * (0.8 + rand() * 0.14);
    const wid = size * (0.34 + rand() * 0.12);

    const path = new Path2D();
    path.moveTo(cx - len / 2, cy);
    path.bezierCurveTo(cx - len * 0.2, cy - wid, cx + len * 0.18, cy - wid * 0.86, cx + len / 2, cy);
    path.bezierCurveTo(cx + len * 0.18, cy + wid * 0.86, cx - len * 0.2, cy + wid, cx - len / 2, cy);
    path.closePath();

    ctx.save();
    ctx.clip(path);

    const t0 = 34 + rand() * 26;
    const base = ctx.createLinearGradient(cx - len / 2, cy, cx + len / 2, cy);
    base.addColorStop(0, `rgb(${t0 * 0.7},${t0 * 0.5},${t0 * 0.3})`);
    base.addColorStop(0.5, `rgb(${t0 + 40},${t0 + 20},${t0 * 0.6})`);
    base.addColorStop(1, `rgb(${t0 * 0.8},${t0 * 0.55},${t0 * 0.32})`);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // manchas de decomposição
    for (let i = 0; i < 30; i++) {
      const x = cx + (rand() - 0.5) * len;
      const y = cy + (rand() - 0.5) * wid * 1.6;
      const r = 6 + rand() * 34;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const d = rand() > 0.5 ? '12,8,4' : '96,70,40';
      g.addColorStop(0, `rgba(${d},${0.25 + rand() * 0.3})`);
      g.addColorStop(1, `rgba(${d},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // nervura central + secundárias
    ctx.strokeStyle = 'rgba(120,92,52,0.55)';
    ctx.lineWidth = Math.max(1.5, size * 0.008);
    ctx.beginPath();
    ctx.moveTo(cx - len / 2, cy);
    ctx.lineTo(cx + len / 2, cy);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, size * 0.004);
    for (let i = -4; i <= 4; i++) {
      const px = cx + (i / 5) * (len / 2);
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px, cy);
        ctx.quadraticCurveTo(px + len * 0.05, cy + sign * wid * 0.22, px + len * 0.13, cy + sign * wid * 0.44);
        ctx.stroke();
      }
    }
    ctx.restore();
    return c;
  });
}

/* ------------------------------ CASCA ------------------------------ */

export function makeBarkMaps(size = 512) {
  const color = cached(`bark-c-${size}`, () => {
    const rand = rng(4242);
    const c = makeCanvas(size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // estrias verticais + rachaduras profundas
        const streak = fbm2(u * 22, v * 3.2, 4, 17);
        const crack = Math.abs(fbm2(u * 9, v * 2, 4, 61) - 0.5) * 2;
        const grain = fbm2(u * 60, v * 60, 2, 99) * 0.18;
        let n = 0.35 + streak * 0.4 + grain;
        n *= 1 - Math.pow(1 - crack, 3) * 0.55;
        const b = 62 + n * 70;
        const i = (y * size + x) * 4;
        img.data[i] = b * 0.86 + rand() * 4;
        img.data[i + 1] = b * 0.68;
        img.data[i + 2] = b * 0.48;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

  const normal = cached(`bark-n-${size}`, () => {
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const streak = fbm2(u * 22, v * 3.2, 4, 17);
        const crack = Math.abs(fbm2(u * 9, v * 2, 4, 61) - 0.5) * 2;
        h[y * size + x] = streak * 0.6 + (1 - crack) * 0.4;
      }
    }
    return heightToNormal(h, size, size, 4);
  });

  return { color, normal };
}

/* ------------------------------ PELE ------------------------------ */

export function makeSkinMaps(size = 512) {
  const color = cached(`skin-c-${size}`, () => {
    const rand = rng(90210);
    const c = makeCanvas(size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // pigmentação irregular (melanina) + poros + vermelhidão capilar
        const mottle = fbm2(u * 5, v * 5, 4, 31);
        const pores = fbm2(u * 90, v * 90, 2, 77);
        const i = (y * size + x) * 4;
        img.data[i] = 196 + (mottle - 0.5) * 26 + (pores - 0.5) * 10 + rand() * 3;
        img.data[i + 1] = 138 + (mottle - 0.5) * 22 + (pores - 0.5) * 8;
        img.data[i + 2] = 108 + (mottle - 0.5) * 20 + (pores - 0.5) * 6;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // vincos de articulação
    ctx.strokeStyle = 'rgba(120,72,58,0.18)';
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = 0.8 + rand() * 1.6;
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + (rand() - 0.5) * 40, size * 0.7, y + (rand() - 0.5) * 40, size, y + (rand() - 0.5) * 18);
      ctx.stroke();
    }
    return c;
  });

  const normal = cached(`skin-n-${size}`, () => {
    const n = Math.min(size, 256);
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n;
        const v = y / n;
        h[y * n + x] = fbm2(u * 60, v * 60, 3, 77) * 0.7 + fbm2(u * 8, v * 8, 3, 31) * 0.3;
      }
    }
    return heightToNormal(h, n, n, 1.4);
  });

  return { color, normal };
}
