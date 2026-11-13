/**
 * CENA 01 — TERRA
 * ---------------------------------------------------------------------------
 * Solo de floresta úmida em macro. A câmera começa a 10,5 cm do húmus e desce
 * para 4,8 cm enquanto avança — termina apontada para a depressão onde o
 * micélio se acumula, que é exatamente o ponto de partida da Cena 02.
 *
 * Continuidade (exigência do contrato): a pose final e a inicial da cena 02
 * compartilham enquadramento baixo, direção de luz e cor dominante #0d0a06.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MotionValue } from 'motion';
import type { SceneDefinition, SceneProps } from '../types';
import type { Quality } from '../../hooks/useQuality';
import { useQuality } from '../../hooks/useQuality';
import { useReducedMotion } from '../_shared/useReducedMotion';
import { useSceneDebug, SceneTelemetry } from '../_shared/SceneDebug';
import { buildRig, sampleCamera, applyCamera, handheld } from '../_shared/camera';
import { makeSporeField } from '../_shared/gl';
import { ForestFloor, FallenLeaves, Roots, Mycelium, ContactShadow } from './ground';
import { LightShafts } from './LightShafts';

export const PALETTE = {
  /** cor de entrada (casa com o topo do documento) */
  entry: '#0b0907',
  /** cor de saída — igual à entrada da Cena 02 */
  exit: '#0d0a06',
};

const KEYS = [
  { pos: [0.0, 0.105, 0.46] as [number, number, number], look: [0.02, 0.035, 0.2] as [number, number, number], fov: 32 },
  { pos: [0.03, 0.085, 0.36] as [number, number, number], look: [0.04, 0.03, 0.16] as [number, number, number], fov: 33 },
  { pos: [0.02, 0.062, 0.26] as [number, number, number], look: [0.05, 0.022, 0.1] as [number, number, number], fov: 35 },
  { pos: [0.04, 0.048, 0.17] as [number, number, number], look: [0.05, 0.018, 0.05] as [number, number, number], fov: 38 },
];
const rig = buildRig(KEYS);

/** Poeira em suspensão: é o que dá a sensação de ar úmido no feixe de luz */
function DustMotes({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const { geometry, material, uniforms } = useMemo(() => {
    const count = quality === 'high' ? 700 : quality === 'medium' ? 380 : 160;
    const f = makeSporeField({
      count,
      bounds: [2.6, 1.5, 2.4],
      seed: 8123,
      size: 0.009,
      drift: 0.05,
      turbulence: 0.07,
      color: '#ffe7c2',
      opacity: 0.7,
    });
    return { geometry: f.geometry, material: f.material, uniforms: f.uniforms };
  }, [quality]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
}

function CameraDriver({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const sway = useMemo(() => new THREE.Vector3(), []);
  const smooth = useRef(0);

  useFrame((state) => {
    // passo fixo: vários componentes chamam getDelta no mesmo frame e cada um
    // receberia ~0, travando o amortecimento
    smooth.current = THREE.MathUtils.damp(smooth.current, progress.get(), 7, 1 / 60);
    const { fov, roll } = sampleCamera(rig, smooth.current, pos, look, {
      gain: reduced ? 0.12 : 1,
      aspect: size.width / Math.max(1, size.height),
    });
    if (!reduced) pos.add(handheld(state.clock.elapsedTime, 0.0016, sway));
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(pos);
    // up (roll) ANTES do lookAt, senão o roll é ignorado
    applyCamera(cam, fov, roll);
    cam.lookAt(look);
  });
  return null;
}

export function TerraScene({
  progress,
  quality: qualityProp,
  reduced: reducedProp,
}: SceneProps & { quality?: Quality; reduced?: boolean }) {
  const detected = useQuality().quality;
  const prefersReduced = useReducedMotion();
  const dbg = useSceneDebug('01-terra', progress);
  const quality = qualityProp ?? dbg.quality ?? detected;
  const reduced = reducedProp ?? prefersReduced;
  return (
    <>
      <color attach="background" args={[PALETTE.entry]} />
      <fogExp2 attach="fog" args={[PALETTE.entry, 0.75]} />

      {/* luz-chave: sol coado pela copa, quente e lateral */}
      <directionalLight position={[1.2, 2, 0.8]} intensity={2.1} color="#ffdca8" />
      {/* fill: céu frio refletido nas folhas */}
      <hemisphereLight args={['#9fb5a8', '#1a1208', 0.55]} />
      {/* contraluz rasante: destaca a borda das folhas e o micélio */}
      <pointLight position={[-0.5, 0.22, -0.4]} intensity={0.5} color="#b9d7c0" distance={2} decay={2} />
      <ambientLight intensity={0.12} color="#4a5a48" />

      <ForestFloor quality={quality} />
      <FallenLeaves quality={quality} />
      <Roots quality={quality} />
      <Mycelium quality={quality} progress={progress} />
      <ContactShadow position={[0.05, 0.002, 0.25]} />

      <LightShafts count={quality === 'low' ? 3 : 7} />
      <DustMotes quality={quality} />
      <CameraDriver progress={progress} reduced={reduced} />
      {dbg.enabled && <SceneTelemetry sceneId="01-terra" />}
    </>
  );
}

export const scene: SceneDefinition = {
  id: '01-terra',
  scrollLength: 180,
  Component: TerraScene,
  textBlocks: [
    {
      at: 0,
      eyebrow: '01 / ORIGEM',
      title: 'Tudo começa na terra.',
      body: 'Debaixo de cada passo, uma cidade. Uma colher de húmus de floresta pode conter quilômetros de filamentos fúngicos — é por eles que a água e os minerais circulam.',
    },
    {
      at: 0.34,
      eyebrow: 'SERAPILHEIRA',
      title: 'A floresta recicla a si mesma.',
      body: 'Folhas caídas são decompostas por fungos e bactérias em húmus: a camada escura e porosa que sustenta toda a vida acima do solo.',
    },
    {
      at: 0.64,
      eyebrow: 'MICÉLIO',
      title: 'Uma rede invisível.',
      body: 'O micélio é o conjunto de hifas — filamentos mais finos que um fio de cabelo. Ele cresce pelas pontas, empurrando-se entre as partículas de terra.',
    },
  ],
};

export default scene;
