/**
 * Shaders GLSL da Cena 04 (`04-veias`) — compatíveis com WebGL2 / GLSL ES 3.00:
 * - Parede orgânica e translúcida (Fresnel + SSS fake), pulsação cardíaca, volumetric fog
 *   e junções oclusivas (tight junctions) na Barreira Hematoencefálica.
 * - Hemácias bicôncavas instanciadas com SSS de hemoglobina, DOF óptico por distância focal
 *   e motion blur leve direcional sincronizado à velocidade do fluxo.
 * - Membrana endotelial seletiva da Barreira Hematoencefálica.
 */

export const vesselWallVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeartbeat;
  uniform float uReducedMotion;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vSplineT;

  void main() {
    vUv = uv;
    vSplineT = uv.x;

    float motionScale = mix(1.0, 0.15, uReducedMotion);
    float pulseWave = sin(uTime * 7.3 - vSplineT * 44.0) * 0.5 + 0.5;
    float microRipple = sin(vSplineT * 125.0 + uv.y * 18.84955 + uTime * 2.1) * 0.032;

    // Estreitamento fisiológico suave ao entrar no capilar da BHE (s > 0.78)
    float bbbNarrow = smoothstep(0.76, 0.96, vSplineT) * 0.34;
    float radialOffset = (uHeartbeat * 0.13 * pulseWave + microRipple) * motionScale - bbbNarrow;

    // Em TubeGeometry com BackSide, o vetor normal aponta para fora do cilindro
    vec3 displaced = position + normal * radialOffset;
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);

    vWorldPos = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * (-normal));

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const vesselWallFragmentShader = /* glsl */ `
  uniform sampler2D uEndotheliumMap;
  uniform float uTime;
  uniform float uProgress;
  uniform float uHeartbeat;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vSplineT;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    vec2 uvCoarse = vec2(vUv.x * 38.0, vUv.y * 4.0);
    vec2 uvDetail = vec2(vUv.x * 80.0 - uTime * 0.028, vUv.y * 8.0);
    vec4 texA = texture2D(uEndotheliumMap, uvCoarse);
    vec4 texB = texture2D(uEndotheliumMap, uvDetail);

    float cellRelief = mix(texA.r, texB.r, 0.35);
    float tightJunction = texA.g;
    float collagen = texA.b;
    float sssThickness = texA.a;

    // Gradiente anatômico: digestivo escuro -> fígado âmbar-vinho -> carótida rubi -> BHE neurovascular
    vec3 digestiveCol = vec3(0.10, 0.018, 0.032);
    vec3 hepaticCol = vec3(0.28, 0.062, 0.038);
    vec3 arterialCol = vec3(0.44, 0.042, 0.088);
    vec3 bbbCol = vec3(0.065, 0.075, 0.19);

    float wHepatic = smoothstep(0.15, 0.27, vSplineT) * (1.0 - smoothstep(0.39, 0.49, vSplineT));
    float wArterial = smoothstep(0.39, 0.52, vSplineT) * (1.0 - smoothstep(0.80, 0.90, vSplineT));
    float wBbb = smoothstep(0.80, 0.92, vSplineT);

    vec3 tissue = digestiveCol;
    tissue = mix(tissue, hepaticCol, wHepatic);
    tissue = mix(tissue, arterialCol, wArterial);
    tissue = mix(tissue, bbbCol, wBbb);

    // Fresnel + Subsurface Scattering (SSS fake translúcido)
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(max(1e-4, 1.0 - ndotv), 2.35);
    vec3 sssTint = mix(vec3(0.96, 0.16, 0.24), vec3(0.30, 0.84, 0.98), wBbb);
    vec3 sss = sssTint * fresnel * (0.58 + 0.40 * uHeartbeat) * sssThickness;

    vec3 col = tissue * (0.56 + 0.56 * cellRelief + 0.24 * collagen) + sss;

    // Micro-ramificações venulares escuras sob a túnica íntima
    float subVein = smoothstep(0.72, 0.98, sin(vUv.x * 96.0 + sin(vUv.y * 12.566) * 2.4) * 0.5 + 0.5);
    col *= 1.0 - 0.22 * subVein * (1.0 - wBbb);

    // Emissão HDR (> 0.75 para acionar o Bloom global) nas junções oclusivas da BHE
    float bbbGlow = wBbb * tightJunction * (0.9 + 0.45 * sin(uTime * 3.4 + vUv.x * 120.0));
    col += vec3(0.22, 0.92, 1.15) * bbbGlow * 1.45;

    // Começa escuro/interno casando com o final da Cena 03
    float entryOpen = smoothstep(0.0, 0.10, max(uProgress, vSplineT * 0.85));
    col *= mix(0.14, 1.0, entryOpen);

    // Transição suave para o espaço intracraniano na saída da BHE (match cut Cena 05)
    float exitFade = 1.0 - smoothstep(0.945, 0.998, vSplineT);

    // Volumetric fog quadrática simulando espalhamento óptico no plasma sanguíneo
    float dFog = length(cameraPosition - vWorldPos) * uFogDensity;
    float fogFactor = 1.0 - exp(-(dFog * dFog));
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, exitFade);
  }
`;

export const erythrocyteVertexShader = /* glsl */ `
  attribute vec3 aCellMeta;

  uniform float uMotionStretch;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vPhase;
  varying float vCamDist;

  void main() {
    vPhase = aCellMeta.x;

    // Motion blur leve direcional ao longo do eixo de translação celular
    vec3 stretched = position;
    stretched.y *= 1.0 + uMotionStretch * 0.38;

    vec4 instPos = instanceMatrix * vec4(stretched, 1.0);
    vec4 worldPos = modelMatrix * instPos;

    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vCamDist = length(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const erythrocyteFragmentShader = /* glsl */ `
  uniform float uProgress;
  uniform float uHeartbeat;
  uniform vec3 uLightDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vPhase;
  varying float vCamDist;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uLightDir);

    float wrapDiff = clamp((dot(N, L) + 0.45) / 1.45, 0.0, 1.0);
    float backDot = max(1e-4, clamp(dot(V, -L), 0.0, 1.0));
    float backScatter = backDot * backDot * backDot;
    float fresnel = pow(max(1e-4, 1.0 - clamp(abs(dot(N, V)), 0.0, 1.0)), 2.5);

    // Oxigenação progressiva ao passar pelo coração rumo à carótida
    float oxy = smoothstep(0.38, 0.58, uProgress);
    vec3 venousHb = vec3(0.33, 0.026, 0.065);
    vec3 arterialHb = vec3(0.78, 0.058, 0.115);
    vec3 rimCol = mix(vec3(0.80, 0.12, 0.22), vec3(1.08, 0.30, 0.26), oxy);

    vec3 baseHb = mix(venousHb, arterialHb, oxy) * (0.90 + 0.14 * sin(vPhase * 6.2831));

    vec3 H = normalize(L + V);
    float spec = pow(max(1e-4, clamp(dot(N, H), 0.0, 1.0)), 28.0) * 0.26;

    vec3 col = baseHb * (0.28 + 0.82 * wrapDiff);
    col += rimCol * fresnel * (0.68 + 0.26 * uHeartbeat);
    col += vec3(1.0, 0.22, 0.18) * backScatter * 0.36;
    col += vec3(1.0, 0.72, 0.72) * spec;

    // Simulação óptica de Depth of Field (círculo de confusão fora do plano focal ~3.6m)
    float coc = smoothstep(2.0, 11.0, abs(vCamDist - 3.6));
    col = mix(col, mix(col, uFogColor, 0.45), coc * 0.65);

    float entryOpen = smoothstep(0.0, 0.09, uProgress);
    col *= mix(0.15, 1.0, entryOpen);

    float dFog = vCamDist * uFogDensity;
    float fogFactor = 1.0 - exp(-(dFog * dFog));
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const bbbMembraneVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uCrossing;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec2 centered = uv - 0.5;
    float r = length(centered) * 2.0;

    float ripple = sin(r * 16.0 - uTime * 4.4) * 0.085 * (1.0 - smoothstep(0.0, 1.0, r));
    float bulge = uCrossing * 0.40 * exp(-(r * r * 3.2));

    vec3 pos = position + normal * (ripple + bulge);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const bbbMembraneFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uCrossing;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.73205))), p.x);
  }

  float hexGrid(vec2 uv, float scale) {
    vec2 r = vec2(1.0, 1.73205);
    vec2 h = r * 0.5;
    vec2 a = mod(uv * scale, r) - h;
    vec2 b = mod(uv * scale - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float d = 0.5 - hexDist(gv);
    return 1.0 - smoothstep(0.01, 0.09, d);
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float r = length(centered);
    if (r > 1.0) discard;

    float grid = hexGrid(vUv, 12.0);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float oneMinus = max(1e-4, 1.0 - clamp(abs(dot(normalize(vNormal), V)), 0.0, 1.0));
    float fresnel = oneMinus * oneMinus;

    vec3 cyanGlow = vec3(0.28, 1.05, 1.25);
    vec3 violetGlow = vec3(0.68, 0.46, 1.20);
    vec3 col = mix(violetGlow, cyanGlow, 0.5 + 0.5 * sin(r * 8.0 - uTime * 2.8));

    float aperture = smoothstep(0.0, 0.45 * uCrossing + 0.08, r);
    float alpha = (0.18 + 0.58 * grid + 0.35 * fresnel) * (1.0 - smoothstep(0.78, 1.0, r)) * aperture;
    alpha *= 1.0 - smoothstep(0.92, 1.0, uCrossing) * 0.85;

    gl_FragColor = vec4(col * (1.15 + grid * 1.35 + uCrossing * 0.85), clamp(alpha, 0.0, 0.92));
  }
`;
