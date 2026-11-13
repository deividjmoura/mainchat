/**
 * COGUMELO PARAMÉTRICO
 * ---------------------------------------------------------------------------
 * A escolha (3D + shader) e sua justificativa estão no README desta cena.
 * Resumo: o scrub precisa ser reversível e determinístico; um modelo onde a
 * POSIÇÃO é reconstruída no vertex shader faz `progresso → geometria` ser uma
 * função pura, com ~9k vértices e zero download de assets.
 *
 * GEOMETRIA: plano paramétrico (u = ângulo, v = perfil). Crescer, abrir, secar
 * e murchar são só mudanças de uniform — a malha nunca é reconstruída.
 * NORMAL: diferenças finitas do próprio perfil, então acompanha qualquer
 * deformação (inclusive a curvatura do colapso) sem recalcular atributos.
 */
import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash11(i.x + i.y * 57.0);
    float b = hash11(i.x + 1.0 + i.y * 57.0);
    float c = hash11(i.x + (i.y + 1.0) * 57.0);
    float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

/**
 * Colapso: rotação progressiva em X com ângulo ∝ y^1.6.
 * O topo tomba, a base permanece ancorada no substrato.
 */
const BEND = /* glsl */ `
  vec3 bend(vec3 p, float stemLen, float wilt) {
    float t = clamp(p.y / max(stemLen, 1e-4), 0.0, 1.2);
    float ang = wilt * 1.45 * pow(t, 1.6);
    float c = cos(ang);
    float s = sin(ang);
    return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  }
`;

const STEM_VERT = /* glsl */ `
  uniform float uStemLen, uStemR, uWilt, uDry, uWrinkle;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  varying float vRim;
  varying float vDry;
  ${NOISE}
  ${BEND}

  vec3 stemPoint(float ang, float v) {
    float bulge = 0.62 * exp(-v * 7.5);          // base bulbosa
    float taper = 1.0 - 0.30 * pow(v, 0.8);      // afinamento até o ápice
    float r = uStemR * (taper + bulge);
    float wr = fbm(vec2(ang * 3.0, v * 7.0)) - 0.5;
    r *= 1.0 - uDry * 0.22 + wr * uWrinkle * 0.16; // enruga ao secar
    r += sin(ang * 9.0) * 0.012 * uStemR;          // estrias fibrosas
    float h = uStemLen * v * (1.0 - uDry * 0.12);  // seco encurta
    return vec3(cos(ang) * r, h, sin(ang) * r);
  }

  void main() {
    vUv = uv;
    float ang = uv.x * 6.2831853;
    float v = uv.y;
    vec3 p = stemPoint(ang, v);

    // normal por diferenças finitas: robusta a qualquer deformação
    float e = 0.004;
    vec3 pu = stemPoint(ang + e * 6.2831853, v);
    vec3 pv = stemPoint(ang, min(1.0, v + e));
    vec3 n = normalize(cross(pu - p, pv - p));

    p = bend(p, uStemLen, uWilt);
    float t = clamp(p.y / max(uStemLen, 1e-4), 0.0, 1.2);
    float ba = uWilt * 1.45 * pow(t, 1.6);
    float c = cos(ba);
    float s = sin(ba);
    n = normalize(vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c));

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vRim = 0.0;              // o caule não tem "borda de chapéu"
    vDry = uDry;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CAP_VERT = /* glsl */ `
  uniform float uStemLen, uCapR, uCapH, uRimDrop, uOpen, uWilt, uDry, uWrinkle;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  varying float vRim;
  varying float vDry;
  ${NOISE}
  ${BEND}

  vec3 capPoint(float ang, float v) {
    // Perfil de QUARTO DE ELIPSE: raio = R·cosθ, altura = H·sinθ.
    // Potências no raio geram um ombro cilíndrico — o "cogumelo de nuvem".
    float a = v * 1.5707963;
    float ca = cos(a);
    float sa = sin(a);
    float r = uCapR * pow(ca, 0.92) * (0.9 + 0.1 * uOpen);
    float h = uCapH * sa;
    // a borda desce: fechado esconde as lamelas, aberto forma a saia
    float rim = uRimDrop * pow(1.0 - v, 2.4);
    float w = fbm(vec2(ang * 2.4, v * 4.0)) - 0.5;
    r *= 1.0 - uDry * 0.16 + w * uWrinkle * 0.11;
    h -= uWrinkle * 0.22 * uCapH * (fbm(vec2(ang * 3.1, v * 2.0)) - 0.5);
    return vec3(cos(ang) * r, uStemLen + h - rim, sin(ang) * r);
  }

  void main() {
    vUv = uv;
    float ang = uv.x * 6.2831853;
    float v = uv.y;
    vec3 p = capPoint(ang, v);

    float e = 0.004;
    vec3 pu = capPoint(ang + e * 6.2831853, v);
    vec3 pv = capPoint(ang, clamp(v + e, 0.0, 1.0));
    vec3 n = normalize(cross(pu - p, pv - p));

    p = bend(p, uStemLen, uWilt);
    float t = clamp(p.y / max(uStemLen, 1e-4), 0.0, 1.2);
    float ba = uWilt * 1.45 * pow(t, 1.6);
    float c = cos(ba);
    float s = sin(ba);
    n = normalize(vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c));

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vRim = v;
    vDry = uDry;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/**
 * Iluminação com SSS falso. Três componentes:
 *  - difusa com "wrap" (luz contorna o volume, típico de tecido vivo);
 *  - translucidez de contraluz (a luz atravessa a carne e sai âmbar);
 *  - especular que desaparece quando a superfície seca.
 */
const FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorRim;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uFillDir;
  uniform vec3 uFillColor;
  uniform vec3 uRimLightDir;
  uniform vec3 uRimLightColor;
  uniform float uSSS;
  uniform float uWet;
  uniform float uDry;
  uniform float uIsCap;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  varying float vRim;
  varying float vDry;
  ${NOISE}

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    if (uIsCap > 0.5 && !gl_FrontFacing) N = -N;

    vec3 base = mix(uColorA, uColorB, vDry);
    // manchas de pigmento (o chapéu nunca é uma cor chapada)
    base *= 0.88 + fbm(vUv * vec2(14.0, 5.0)) * 0.24;

    vec3 L = normalize(uLightDir);
    float wrap = uSSS * 0.6;
    float diff = clamp((dot(N, L) + wrap) / (1.0 + wrap), 0.0, 1.0);

    // SSS: quão alinhado o olhar está com a luz por trás do objeto
    float back = pow(clamp(dot(-V, -L), 0.0, 1.0), 3.0);
    vec3 trans = base * vec3(1.18, 0.72, 0.52) * (uSSS * back);

    float fill = clamp(dot(N, normalize(uFillDir)) * 0.5 + 0.5, 0.0, 1.0) * 0.5;
    float rimF = pow(1.0 - abs(dot(N, V)), 2.6);
    float rimBack = clamp(dot(-N, normalize(uRimLightDir)), 0.0, 1.0);
    float rim = rimF * (0.35 + rimBack) * (0.6 + 0.4 * vRim);

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), mix(14.0, 90.0, uWet)) * mix(0.25, 1.0, uWet);

    vec3 col = base * diff * uLightColor * 1.05;
    col += base * fill * uFillColor;
    col += trans * uLightColor * 0.9;
    col += uRimLightColor * rim * 0.55;
    col += uColorRim * spec * uLightColor;
    col += base * 0.045;                 // ambiente mínimo: nada é 100% preto
    col *= mix(0.55, 1.0, smoothstep(0.0, 0.35, vUv.y)); // AO na base

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const GILL_VERT = /* glsl */ `
  uniform float uStemLen, uCapR, uCapH, uRimDrop, uOpen, uWilt, uDry, uWrinkle;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  varying float vR;
  ${NOISE}
  ${BEND}

  void main() {
    vUv = uv;
    float ang = uv.x * 6.2831853;
    float r = uv.y;
    float radius = uCapR * 0.965 * (0.9 + 0.1 * uOpen) * r;
    // disco côncavo, logo abaixo da borda do chapéu
    float y = uStemLen + uCapH * 0.06 - uRimDrop * 0.72 + pow(r, 2.0) * uCapH * 0.16;
    vec3 p = vec3(cos(ang) * radius, y, sin(ang) * radius);
    vec3 n = normalize(vec3(0.0, -1.0, 0.0)); // lamelas olham para baixo

    p = bend(p, uStemLen, uWilt);
    float t = clamp(p.y / max(uStemLen, 1e-4), 0.0, 1.2);
    float ba = uWilt * 1.45 * pow(t, 1.6);
    float c = cos(ba);
    float s = sin(ba);
    n = normalize(vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c));

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vR = r;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GILL_FRAG = /* glsl */ `
  uniform vec3 uGillColor;
  uniform vec3 uColorB;
  uniform vec3 uLightColor;
  uniform float uOpen;
  uniform float uDry;
  uniform float uLamelas;
  varying vec2 vUv;
  varying float vR;
  ${NOISE}

  void main() {
    // LAMELAS: estrias radiais que se ADENSAM na periferia (como na natureza)
    float ang = vUv.x * 6.2831853;
    float density = uLamelas * (0.55 + vR * 0.9);
    float blade = smoothstep(-0.15, 0.55, sin(ang * density));
    // oclusão entre lâminas: as frestas ficam escuras
    float crevice = mix(0.35, 1.0, blade);
    float inner = smoothstep(0.10, 0.22, vR);       // interrompe antes do caule
    float outer = 1.0 - smoothstep(0.93, 1.0, vR);  // afina na borda

    vec3 base = mix(uGillColor, uColorB * 1.25, uDry * 0.7);
    float bounce = 0.55 + 0.45 * fbm(vUv * 6.0);    // luz rebatida pelo substrato
    vec3 col = base * uLightColor * crevice * bounce * (0.55 + 0.45 * inner);
    col += uGillColor * (1.0 - uDry) * smoothstep(0.75, 1.0, blade) * 0.25 * uOpen; // brilho úmido

    gl_FragColor = vec4(col, outer * smoothstep(0.06, 0.16, vR) * (0.35 + 0.65 * uOpen));
    #include <colorspace_fragment>
  }
`;

/** O PlaneGeometry do three tem v invertido em relação ao nosso perfil */
function flipV(g: THREE.BufferGeometry) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const arr = uv.array as Float32Array;
  for (let i = 1; i < arr.length; i += 2) arr[i] = 1 - arr[i];
  uv.needsUpdate = true;
  return g;
}

export function createMaterials() {
  const shared: Record<string, THREE.IUniform> = {
    uStemLen: { value: 0.032 },
    uStemR: { value: 0.0038 },
    uCapR: { value: 0.024 },
    uCapH: { value: 0.015 },
    uRimDrop: { value: 0.004 },
    uOpen: { value: 0 },
    uWilt: { value: 0 },
    uDry: { value: 0 },
    uWrinkle: { value: 0 },
    uLightDir: { value: new THREE.Vector3(0.45, 1, 0.35).normalize() },
    uLightColor: { value: new THREE.Color('#ffe6c4') },
    uFillDir: { value: new THREE.Vector3(-0.6, 0.25, -0.5).normalize() },
    uFillColor: { value: new THREE.Color('#8fa6a0') },
    uRimLightDir: { value: new THREE.Vector3(-0.5, 0.35, -1).normalize() },
    uRimLightColor: { value: new THREE.Color('#ffd9a8') },
  };

  const stem = new THREE.ShaderMaterial({
    vertexShader: STEM_VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      ...shared,
      uColorA: { value: new THREE.Color('#e8dcc2') },
      uColorB: { value: new THREE.Color('#3a2416') },
      uColorRim: { value: new THREE.Color('#f3e3c4') },
      uSSS: { value: 0.55 },
      uWet: { value: 0.8 },
      uIsCap: { value: 0 },
    },
  });

  const cap = new THREE.ShaderMaterial({
    vertexShader: CAP_VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      ...shared,
      uColorA: { value: new THREE.Color('#9d5325') },
      uColorB: { value: new THREE.Color('#301b10') },
      uColorRim: { value: new THREE.Color('#e0a469') },
      uSSS: { value: 0.8 },
      uWet: { value: 1 },
      uIsCap: { value: 1 },
    },
  });

  const gills = new THREE.ShaderMaterial({
    vertexShader: GILL_VERT,
    fragmentShader: GILL_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      ...shared,
      uGillColor: { value: new THREE.Color('#d9c7a4') },
      uColorB: { value: new THREE.Color('#4a2e1c') },
      uLamelas: { value: 62 },
    },
  });

  return { stem, cap, gills };
}

export function createGeometries(quality: 'high' | 'medium' | 'low') {
  const res = quality === 'high' ? 96 : quality === 'medium' ? 64 : 40;
  const capPlane = flipV(new THREE.PlaneGeometry(1, 1, res, Math.round(res * 0.5)));
  const stemPlane = flipV(new THREE.PlaneGeometry(1, 1, res, Math.round(res * 0.6)));
  const gill = new THREE.CircleGeometry(1, quality === 'low' ? 48 : 96);
  // uv radial útil: 0 no centro, 1 na borda
  const pos = gill.attributes.position;
  const uv = gill.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, Math.atan2(y, x) / (Math.PI * 2) + 0.5, Math.hypot(x, y));
  }
  uv.needsUpdate = true;
  return { cap: capPlane, stem: stemPlane, gills: gill };
}

/**
 * Aplica o estado de crescimento. Todos os parâmetros são funções CONTÍNUAS de
 * `growth`, então o scrub reverso não tem saltos.
 */
export function applyGrowth(
  mats: ReturnType<typeof createMaterials>,
  p: { growth: number; open: number; wilt: number; dry: number },
) {
  const { growth, open, wilt, dry } = p;

  // o caule alonga primeiro (alongamento celular por turgor)
  const stemLen = 0.034 * Math.pow(Math.min(1, growth * 1.15), 0.78);
  /**
   * O primórdio já nasce com o chapéu proporcionalmente largo — é um "botão".
   * Começar a expansão em 0.12 (e não em 0.32) evita o aspecto de lápis no
   * estágio jovem. Na maturidade, diâmetro do chapéu / caule ≈ 6.5.
   */
  const capGrow = Math.max(0, Math.min(1, (growth - 0.12) / 0.88));
  const capR = 0.0235 * Math.pow(capGrow, 0.62) * (0.9 + open * 0.14);
  /**
   * Proporção calota/raio medida em Agaricales: ≈ 0.5–0.6 do raio quando
   * maduro, ≈ 0.95 no botão. Abaixo de 0.4 o chapéu lê como disco achatado.
   */
  const capH = capR * (0.95 - 0.42 * open);
  const rimDrop = capR * (0.16 + 0.08 * open) + 0.0008;
  const stemR = 0.0036 * (0.55 + 0.45 * Math.pow(Math.min(1, growth * 2.2), 0.5)) * (1 - wilt * 0.06);

  for (const m of [mats.stem, mats.cap, mats.gills]) {
    m.uniforms.uStemLen.value = stemLen;
    m.uniforms.uStemR.value = stemR;
    m.uniforms.uCapR.value = capR;
    m.uniforms.uCapH.value = capH;
    m.uniforms.uRimDrop.value = rimDrop;
    m.uniforms.uOpen.value = open;
    m.uniforms.uWilt.value = wilt;
    m.uniforms.uDry.value = dry;
    m.uniforms.uWrinkle.value = dry * 0.9;
  }
  // a umidade cai com a secagem → o brilho especular desaparece
  mats.stem.uniforms.uWet.value = 0.85 * (1 - dry * 0.9);
  mats.cap.uniforms.uWet.value = 1 - dry * 0.88;
}
