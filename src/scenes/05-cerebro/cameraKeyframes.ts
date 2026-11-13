import * as THREE from 'three';

export interface CameraKeyframe {
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const MICRO_ANCHOR: [number, number, number] = [0.42, 0.22, 0.96];

/**
 * Converte coordenadas estereotáxicas MNI152 (mm) para o referencial Y-up do `brain.glb`.
 */
export function mniToBrainSpace(x: number, y: number, z: number): [number, number, number] {
  const SCALE = 0.018;
  return [-x * SCALE, (z - 8.0) * SCALE, (y + 16.0) * SCALE];
}

export function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function rangeWeight(
  progress: number,
  start: number,
  end: number,
  fadeIn = 0.035,
  fadeOut = 0.035
): number {
  if (progress <= start - fadeIn || progress >= end + fadeOut) return 0;
  const enter = smootherstep(start - fadeIn, start + fadeIn * 0.5, progress);
  const exit = 1 - smootherstep(end - fadeOut * 0.5, end + fadeOut, progress);
  return clamp(enter * exit, 0, 1);
}

/**
 * Keyframes de câmera ligados ao `progress` (0..1) cobrindo os 4 atos da Cena 05:
 * 0.00: Emergência do capilar pial (FOV 46°, alinhado em -Z com a saída da Cena 04)
 * 0.09..0.23: 1. Visão geral do cérebro com pulsos emissivos nos sulcos
 * 0.30:       2A. Destaque do Córtex Pré-Frontal (PFC)
 * 0.41:       2B. Destaque do Tálamo subcortical
 * 0.52:       2C. Destaque da Rede de Modo Padrão (DMN)
 * 0.63..0.78: 3. Zoom até neurônio piramidal e receptor 5-HT2A (acoplamento + disparo + ondas)
 * 0.87..1.00: 4. Pull-back final exibindo conectividade ampliada entre regiões
 */
export const BRAIN_CAMERA_KEYFRAMES: CameraKeyframe[] = [
  {
    at: 0.0,
    position: [0.0, -0.58, 2.68],
    target: [0.0, -0.58, 0.0],
    fov: 46,
  },
  {
    at: 0.09,
    position: [1.68, 0.44, 3.35],
    target: [0.0, 0.02, 0.05],
    fov: 44,
  },
  {
    at: 0.23,
    position: [2.55, 0.88, 2.65],
    target: [0.0, 0.05, 0.0],
    fov: 43,
  },
  {
    at: 0.31,
    position: [1.62, 0.52, 2.88],
    target: [0.15, 0.14, 0.92],
    fov: 41,
  },
  {
    at: 0.41,
    position: [2.78, 0.46, 0.72],
    target: [0.0, -0.03, -0.05],
    fov: 40,
  },
  {
    at: 0.52,
    position: [2.55, 1.48, -1.45],
    target: [0.0, 0.18, 0.05],
    fov: 43,
  },
  {
    at: 0.58,
    position: [1.32, 0.56, 2.12],
    target: [0.42, 0.22, 0.96],
    fov: 41,
  },
  {
    at: 0.65,
    position: [0.42 + 0.19, 0.22 + 0.055, 0.96 + 0.24],
    target: [0.42, 0.22 + 0.025, 0.96],
    fov: 38,
  },
  {
    at: 0.72,
    position: [0.42 - 0.16, 0.22 + 0.04, 0.96 + 0.25],
    target: [0.42, 0.22 + 0.01, 0.96],
    fov: 39,
  },
  {
    at: 0.78,
    position: [0.42 + 0.34, 0.22 + 0.12, 0.96 + 0.52],
    target: [0.42, 0.22 - 0.02, 0.96],
    fov: 42,
  },
  {
    at: 0.87,
    position: [2.45, 1.38, 2.85],
    target: [0.0, 0.08, -0.04],
    fov: 44,
  },
  {
    at: 1.0,
    position: [-2.12, 1.5, 3.02],
    target: [0.0, 0.06, -0.05],
    fov: 44,
  },
];

export function sampleBrainCamera(
  progress: number,
  outPos: THREE.Vector3,
  outTarget: THREE.Vector3
): number {
  const p = clamp(progress, 0, 1);
  const first = BRAIN_CAMERA_KEYFRAMES[0];
  if (p <= first.at) {
    outPos.set(...first.position);
    outTarget.set(...first.target);
    return first.fov;
  }
  const last = BRAIN_CAMERA_KEYFRAMES[BRAIN_CAMERA_KEYFRAMES.length - 1];
  if (p >= last.at) {
    outPos.set(...last.position);
    outTarget.set(...last.target);
    return last.fov;
  }

  let idx = 0;
  for (let i = 0; i < BRAIN_CAMERA_KEYFRAMES.length - 1; i++) {
    if (p >= BRAIN_CAMERA_KEYFRAMES[i].at && p <= BRAIN_CAMERA_KEYFRAMES[i + 1].at) {
      idx = i;
      break;
    }
  }

  const a = BRAIN_CAMERA_KEYFRAMES[idx];
  const b = BRAIN_CAMERA_KEYFRAMES[idx + 1];
  const t = smootherstep(a.at, b.at, p);

  outPos.set(
    lerp(a.position[0], b.position[0], t),
    lerp(a.position[1], b.position[1], t),
    lerp(a.position[2], b.position[2], t)
  );
  outTarget.set(
    lerp(a.target[0], b.target[0], t),
    lerp(a.target[1], b.target[1], t),
    lerp(a.target[2], b.target[2], t)
  );
  return lerp(a.fov, b.fov, t);
}
