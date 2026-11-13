/**
 * Shaders GLSL da Cena 05 (`05-cerebro`):
 * - `corticalSurfaceShader`: lê o atributo por vértice `COLOR_0` do `brain.glb`:
 *     color.r = profundidade sulcal normalizada (0 = topo do giro, 1 = fundo do sulco)
 *     color.g = máscara anatômica do Córtex Pré-Frontal (PFC)
 *     color.b = máscara anatômica da Rede de Modo Padrão (DMN)
 *     color.a = densidade cortical relativa de receptores 5-HT2A
 * - `connectomeArcShader`: pulsos fotônicos bidirecionais ao longo dos arcos de conectividade global.
 */

export const corticalSurfaceVertexShader = /* glsl */ `
  #if !defined(USE_COLOR) && !defined(USE_COLOR_ALPHA)
    attribute vec4 color;
  #endif

  varying vec4 vMeta;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;

  void main() {
    vMeta = color;
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const corticalSurfaceFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSulcalPulse;
  uniform float uPfcHighlight;
  uniform float uDmnHighlight;
  uniform float uDmnDesync;
  uniform float uGlassFactor;
  uniform float uMicroDiveFade;
  uniform float uHyperConnect;

  varying vec4 vMeta;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;
  varying vec3 vWorldNormal;

  void main() {
    float sulcalDepth = vMeta.r;
    float pfcMask = vMeta.g;
    float dmnMask = vMeta.b;
    float ht2aDensity = vMeta.a;

    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L1 = normalize(vec3(0.45, 0.75, 0.55));
    vec3 L2 = normalize(vec3(-0.65, 0.25, -0.55));

    float diff1 = clamp((dot(N, L1) + 0.35) / 1.35, 0.0, 1.0);
    float diff2 = clamp((dot(N, L2) + 0.25) / 1.25, 0.0, 1.0);
    float fresnel = pow(max(1e-4, 1.0 - clamp(abs(dot(N, V)), 0.0, 1.0)), 2.4);

    vec3 gyrusTone = vec3(0.46, 0.36, 0.43);
    vec3 sulcusShadow = vec3(0.14, 0.11, 0.21);
    vec3 tissueBase = mix(gyrusTone, sulcusShadow, smoothstep(0.15, 0.88, sulcalDepth));
    vec3 glassTint = vec3(0.08, 0.11, 0.24);
    vec3 baseCol = mix(tissueBase, glassTint, uGlassFactor * 0.82);

    vec3 lit = baseCol * (0.30 + 0.68 * diff1 + 0.25 * diff2);

    vec3 H = normalize(L1 + V);
    float spec = pow(max(1e-4, clamp(dot(N, H), 0.0, 1.0)), 36.0) * (1.0 - sulcalDepth * 0.65);
    lit += vec3(0.68, 0.80, 1.0) * spec * 0.26 * (1.0 - uGlassFactor * 0.5);
    lit += vec3(0.28, 0.58, 0.98) * fresnel * (0.42 + 0.48 * uGlassFactor);

    // 1. Emissão neural ao longo dos sulcos (valores > 0.75 acionam o Bloom do EffectComposer)
    float waveA = sin(vLocalPos.z * 5.2 - vLocalPos.y * 3.1 - uTime * 2.8) * 0.5 + 0.5;
    float waveB = sin(length(vLocalPos.xyz - vec3(0.0, -0.3, 0.2)) * 7.5 - uTime * 3.4) * 0.5 + 0.5;
    float sulcalChannel = pow(clamp(sulcalDepth, 1e-4, 1.0), 1.45);
    float neuralFire = sulcalChannel * pow(max(1e-4, waveA * 0.55 + waveB * 0.45), 2.4);
    vec3 sulcalColor = mix(vec3(0.20, 0.82, 1.25), vec3(0.55, 1.15, 1.05), waveB);
    lit += sulcalColor * neuralFire * (uSulcalPulse * 2.2 + 0.30);

    // 2A. Córtex Pré-Frontal (PFC)
    if (uPfcHighlight > 0.001) {
      float pfcPulse = 0.75 + 0.25 * sin(uTime * 3.6 - vLocalPos.z * 6.0);
      vec3 pfcCol = mix(vec3(0.18, 0.78, 1.22), vec3(0.42, 1.18, 1.05), sulcalChannel);
      lit += pfcCol * pfcMask * uPfcHighlight * (0.85 + 0.65 * sulcalChannel) * pfcPulse * (0.6 + 0.5 * ht2aDensity);
    }

    // 2C. Rede de Modo Padrão (DMN) + desincronização progressiva
    if (uDmnHighlight > 0.001) {
      float syncOsc = 0.72 + 0.28 * sin(uTime * 3.0);
      float desyncField = sin(vLocalPos.x * 19.0 + uTime * 5.3) *
                          cos(vLocalPos.y * 23.0 - uTime * 4.7) *
                          sin(vLocalPos.z * 17.0 + uTime * 6.1);
      float dmnPattern = mix(syncOsc, 0.45 + 0.55 * abs(desyncField), uDmnDesync);
      vec3 dmnCol = mix(vec3(0.92, 0.52, 1.25), vec3(1.18, 0.55, 0.98), sulcalChannel);
      lit += dmnCol * dmnMask * uDmnHighlight * dmnPattern * 1.35;
    }

    // 4. Cintilação cortical distribuída no pull-back de conectividade ampliada
    if (uHyperConnect > 0.001) {
      float globalShimmer = sin(vLocalPos.x * 9.0 + uTime * 2.4) * cos(vLocalPos.z * 8.0 - uTime * 2.1) * 0.5 + 0.5;
      vec3 multiCol = mix(vec3(0.28, 0.92, 1.20), vec3(1.05, 0.58, 1.22), globalShimmer);
      lit += multiCol * sulcalChannel * uHyperConnect * 0.90;
    }

    float regionBoost = max(pfcMask * uPfcHighlight, dmnMask * uDmnHighlight);
    float baseAlpha = mix(0.96, 0.22 + 0.36 * fresnel, uGlassFactor);
    float finalAlpha = clamp(max(baseAlpha, regionBoost * 0.78), 0.0, 1.0) * (1.0 - uMicroDiveFade * 0.86);

    gl_FragColor = vec4(lit, finalAlpha);
  }
`;

export const connectomeArcVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const connectomeArcFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uPhase;
  uniform vec3 uColorStart;
  uniform vec3 uColorEnd;

  varying vec2 vUv;

  void main() {
    if (vUv.x > uReveal) discard;

    vec3 baseCol = mix(uColorStart, uColorEnd, vUv.x);

    float dFwd = fract(vUv.x - uTime * 0.48 - uPhase) * 6.5 - 1.2;
    float dBack = fract(1.0 - vUv.x - uTime * 0.36 - uPhase * 1.7) * 7.5 - 1.2;
    float pulseFwd = exp(-(dFwd * dFwd));
    float pulseBack = exp(-(dBack * dBack));
    float photon = pulseFwd + 0.65 * pulseBack;

    float tipEdge0 = max(0.0, uReveal - 0.08);
    float tipEdge1 = max(tipEdge0 + 0.001, uReveal);
    float endFade = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(tipEdge0, tipEdge1, vUv.x));

    vec3 col = baseCol * (0.55 + 2.1 * photon);
    float alpha = (0.26 + 0.72 * photon) * endFade * smoothstep(0.0, 0.2, uReveal);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;
