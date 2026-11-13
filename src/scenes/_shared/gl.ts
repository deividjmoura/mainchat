/**
 * PRIMITIVAS 3D COMPARTILHADAS (procedurais).
 * Convenção: 1 unidade = 1 metro. Escala macro real, com o micélio levemente
 * exagerado — na natureza a hifa tem ~40 µm e seria invisível em quadro.
 */
import * as THREE from 'three';
import { rng } from './math';

/* ------------------------------ texturas ------------------------------ */

const texCache = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>();

export function canvasTexture(
  canvas: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: [number, number] } = {},
): THREE.CanvasTexture {
  const hit = texCache.get(canvas);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = 4;
  t.needsUpdate = true;
  texCache.set(canvas, t);
  return t;
}

/* ------------------------------ partículas ------------------------------ */

export interface SporeField {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  uniforms: Record<string, THREE.IUniform>;
}

const SPORE_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uDrift;
  uniform float uTurbulence;
  uniform float uSize;
  uniform vec3 uBounds;
  uniform float uReduced;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // deriva vertical com wrap: o campo nunca "esvazia" nem precisa de CPU
    float drift = uTime * uDrift * aSpeed * (1.0 - uReduced * 0.85);
    p.y = mod(p.y + drift + uBounds.y * 0.5, uBounds.y) - uBounds.y * 0.5;

    // turbulência com três frequências primas → movimento não repetitivo
    float t = uTime * 0.35 + aSeed * 6.2831;
    p.x += sin(t * 1.13 + aSeed * 17.0) * uTurbulence;
    p.z += cos(t * 0.91 + aSeed * 29.0) * uTurbulence;
    p.y += sin(t * 0.63 + aSeed * 11.0) * uTurbulence * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    // tamanho em espaço de tela, atenuado pela distância
    gl_PointSize = clamp(uSize * (320.0 / max(1.0, dist)) + 0.02 * uSize, 1.0, 48.0);

    // fade nas bordas do volume (partícula nunca "nasce" na cara do espectador)
    vec3 rel = abs(p) / (uBounds * 0.5 + 1e-4);
    float edge = smoothstep(1.0, 0.55, max(rel.x, max(rel.y, rel.z)));
    float nearFade = smoothstep(0.05, 0.6, dist);
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 40.0);
    vAlpha = edge * nearFade * twinkle;

    gl_Position = projectionMatrix * mv;
  }
`;

const SPORE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    // disco com halo: descarta o resto do quad
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = smoothstep(0.5, 0.28, d);
    gl_FragColor = vec4(uColor, (core * 0.55 + halo * 0.45) * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeSporeField(opts: {
  count: number;
  bounds: [number, number, number];
  seed?: number;
  size?: number;
  drift?: number;
  turbulence?: number;
  color?: string;
  opacity?: number;
}): SporeField {
  const rand = rng(opts.seed ?? 1234);
  const { count, bounds } = opts;
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * bounds[0];
    pos[i * 3 + 1] = (rand() - 0.5) * bounds[1];
    pos[i * 3 + 2] = (rand() - 0.5) * bounds[2];
    seeds[i] = rand();
    speeds[i] = 0.4 + rand() * 1.1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(...bounds));

  const uniforms = {
    uTime: { value: 0 },
    uDrift: { value: opts.drift ?? 0.05 },
    uTurbulence: { value: opts.turbulence ?? 0.07 },
    uSize: { value: opts.size ?? 0.01 },
    uBounds: { value: new THREE.Vector3(...bounds) },
    uColor: { value: new THREE.Color(opts.color ?? '#e8f2e0') },
    uOpacity: { value: opts.opacity ?? 1 },
    uReduced: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: SPORE_VERT,
    fragmentShader: SPORE_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { geometry, material, uniforms };
}

/* ------------------------------ filamentos ------------------------------ */

/** Mescla geometrias simples (menos draw calls que N meshes) */
export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const indexed = geos.every((g) => g.index);
  let vCount = 0;
  let iCount = 0;
  geos.forEach((g) => {
    vCount += g.attributes.position.count;
    if (indexed) iCount += (g.index as THREE.BufferAttribute).count;
  });
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const idx = indexed ? new Uint32Array(iCount) : null;
  let pa = 0;
  let na = 0;
  let ii = 0;
  let offset = 0;
  geos.forEach((g) => {
    pos.set(g.attributes.position.array as ArrayLike<number>, pa);
    pa += g.attributes.position.array.length;
    const n = g.attributes.normal?.array;
    if (n) {
      nor.set(n as ArrayLike<number>, na);
      na += n.length;
    }
    if (idx && g.index) {
      const gi = g.index.array as ArrayLike<number>;
      for (let k = 0; k < gi.length; k++) idx[ii++] = gi[k] + offset;
    }
    offset += g.attributes.position.count;
    g.dispose();
  });
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (idx) merged.setIndex(new THREE.BufferAttribute(idx, 1));
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Filamentos de micélio: curvas que "rastejam" pelo substrato e erguem na
 * ponta. Uma única geometria mesclada.
 */
export function buildFilaments(opts: {
  count: number;
  spread: number;
  seed?: number;
  minLength?: number;
  maxLength?: number;
  radius?: number;
}) {
  const rand = rng(opts.seed ?? 77);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < opts.count; i++) {
    const angle = rand() * Math.PI * 2;
    const r0 = Math.sqrt(rand()) * opts.spread;
    const start = new THREE.Vector3(Math.cos(angle) * r0, 0, Math.sin(angle) * r0);
    const len = (opts.minLength ?? 0.04) + rand() * ((opts.maxLength ?? 0.16) - (opts.minLength ?? 0.04));
    const dir = new THREE.Vector3(
      Math.cos(angle + (rand() - 0.5) * 0.9),
      0,
      Math.sin(angle + (rand() - 0.5) * 0.9),
    ).normalize();

    const pts: THREE.Vector3[] = [];
    const segs = 5;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const p = start.clone().addScaledVector(dir, len * t);
      p.x += Math.sin(t * 6 + i) * 0.035 * opts.spread;
      p.z += Math.cos(t * 5 + i * 1.7) * 0.03 * opts.spread;
      p.y += Math.pow(t, 1.6) * (0.01 + rand() * 0.03);
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    geos.push(
      new THREE.TubeGeometry(curve, 8, (opts.radius ?? 0.0016) * (0.6 + rand() * 0.9), 4, false),
    );
  }
  return mergeGeometries(geos);
}

/**
 * Material do micélio: brilho tipo fibra óptica (fresnel) + pulso viajando
 * pela rede. `uAwake` permite ligar/desligar o brilho com o progresso.
 */
export function makeHyphaMaterial(color = '#cfe8d2') {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 1 },
      uAwake: { value: 0 },
      uPulseSpeed: { value: 1.3 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uAwake;
      uniform float uPulseSpeed;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vW;

      void main() {
        // fibra óptica: quanto mais rasante o olhar, mais a borda brilha
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
        // duas ondas incomensuráveis → pulso irregular, não "metrônomo"
        float w1 = sin(vW.x * 22.0 + vW.z * 17.0 - uTime * uPulseSpeed);
        float w2 = sin(vW.x * 9.0 - vW.z * 13.0 - uTime * uPulseSpeed * 0.55);
        float pulse = smoothstep(0.2, 1.0, w1 * 0.6 + w2 * 0.4) * 0.65 + 0.35;

        float a = (0.18 + fres * 0.85) * pulse * smoothstep(0.0, 0.25, uAwake);
        vec3 col = uColor * (0.3 + fres * 1.1) * uIntensity * pulse;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/* ------------------------------ sombra de contato ------------------------------ */

/** Sombra suave sem shadow map: um quad com gradiente radial */
export function makeContactShadow(opacity = 0.55) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float a = smoothstep(1.0, 0.1, length(p));
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOpacity);
      }
    `,
  });
}
