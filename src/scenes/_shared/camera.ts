/**
 * RIG DE CÂMERA POR KEYFRAMES
 * ---------------------------------------------------------------------------
 * A câmera é função PURA do progresso (Catmull-Rom sobre os keyframes). Isso
 * garante scrub reversível e determinismo: voltar o scroll nunca deixa a
 * câmera num estado intermediário "sujo".
 *
 * ORDEM DE APLICAÇÃO IMPORTA: `up` (roll) precisa ser definido ANTES do
 * lookAt, senão o roll é ignorado silenciosamente.
 */
import * as THREE from 'three';
import { clamp01, smoothstep } from './math';

export interface CameraKey {
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  roll?: number;
}

export interface CameraRig {
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
  keys: CameraKey[];
}

export function buildRig(keys: CameraKey[]): CameraRig {
  return {
    pos: new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'catmullrom', 0.4),
    look: new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, 'catmullrom', 0.4),
    keys,
  };
}

/**
 * FOV RESPONSIVO.
 * ---------------------------------------------------------------------------
 * O three usa `fov` VERTICAL. Como a composição é feita em paisagem (16:9), em
 * retrato (ex.: 390×844, aspect ≈ 0.46) o campo HORIZONTAL encolhe ~4× e o
 * assunto vaza do quadro. Aqui mantemos o campo horizontal constante,
 * limitando o alargamento a +20° (acima disso a lente vira olho-de-peixe e a
 * perspectiva macro — que é a graça da cena — se distorce).
 */
export function responsiveFov(fovRef: number, aspect: number, aspectRef = 16 / 9): number {
  if (!isFinite(aspect) || aspect <= 0) return fovRef;
  if (aspect >= aspectRef) return fovRef;
  const tanV = Math.tan((fovRef * Math.PI) / 360);
  const tanH = tanV * aspectRef;
  const fovNew = (Math.atan(tanH / Math.max(0.2, aspect)) * 360) / Math.PI;
  return Math.min(fovNew, fovRef + 20);
}

/** Recuo extra (m) em retrato, para dar respiro nas bordas sem encolher demais */
export function responsivePullback(aspect: number, aspectRef = 16 / 9): number {
  if (aspect >= aspectRef) return 0;
  const shrink = Math.min(1, Math.max(0, aspectRef / Math.max(0.3, aspect) - 1));
  return shrink * 0.04;
}

export function sampleCamera(
  rig: CameraRig,
  p: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
  opts: { gain?: number; aspect?: number } = {},
): { fov: number; roll: number } {
  const { gain = 1, aspect } = opts;
  const eased = smoothstep(0, 1, clamp01(p));

  rig.pos.getPoint(eased, outPos);
  rig.look.getPoint(eased, outLook);

  // reduced-motion: reduz a amplitude em torno da primeira pose
  if (gain < 1) {
    const b = rig.keys[0].pos;
    outPos.set(
      b[0] + (outPos.x - b[0]) * gain,
      b[1] + (outPos.y - b[1]) * gain,
      b[2] + (outPos.z - b[2]) * gain,
    );
  }

  const n = rig.keys.length - 1;
  const seg = Math.min(n, Math.floor(eased * n));
  const frac = eased * n - seg;
  const k0 = rig.keys[seg];
  const k1 = rig.keys[Math.min(n, seg + 1)];
  let fov = (k0.fov ?? 34) + ((k1.fov ?? 34) - (k0.fov ?? 34)) * frac;
  const roll = (k0.roll ?? 0) + ((k1.roll ?? 0) - (k0.roll ?? 0)) * frac;

  if (aspect !== undefined) {
    fov = responsiveFov(fov, aspect);
    const pull = responsivePullback(aspect);
    if (pull > 0) {
      const dir = outPos.clone().sub(outLook);
      const len = dir.length() || 1e-4;
      outPos.copy(outLook).addScaledVector(dir, (len + pull) / len);
    }
  }

  return { fov, roll };
}

/** Aplica fov e roll; chamar ANTES do lookAt */
export function applyCamera(cam: THREE.PerspectiveCamera, fov: number, roll: number) {
  if (Math.abs(cam.fov - fov) > 0.001) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  const r = THREE.MathUtils.degToRad(roll);
  if (Math.abs(r) < 1e-5) cam.up.set(0, 1, 0);
  else cam.up.set(Math.sin(r), Math.cos(r), 0).normalize();
}

/** Tremor sutil de mão (soma de senos incomensuráveis) */
export function handheld(time: number, amount: number, out: THREE.Vector3) {
  out.set(
    Math.sin(time * 0.71) * 0.5 + Math.sin(time * 1.37) * 0.3,
    Math.cos(time * 0.53) * 0.5 + Math.sin(time * 1.11) * 0.25,
    Math.sin(time * 0.61) * 0.4,
  );
  out.multiplyScalar(amount);
  return out;
}
