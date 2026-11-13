/**
 * CENA 02 — CICLO DO COGUMELO (cena principal)
 * ---------------------------------------------------------------------------
 * Entrada: a mesma vista baixa e escura em que a Cena 01 termina (#0d0a06),
 * com o micélio já adensado. Saída: corpo seco e colapsado, quase invisível no
 * escuro morno (#120d08) — é nessa sombra que a mão da Cena 03 entra.
 *
 * Decisão técnica (3D + shader em vez de frames): ver README.md desta cena.
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
import { makeSporeField, buildFilaments, makeHyphaMaterial, canvasTexture } from '../_shared/gl';
import { makeHumusMaps } from '../_shared/textures';
import { rng } from '../_shared/math';
import { createMaterials, createGeometries, applyGrowth } from './mushroom';
import { cycleAt } from './timeline';

export const PALETTE = { entry: '#0d0a06', exit: '#120d08' };

/**
 * A câmera faz um arco em torno do cogumelo enquanto ele cresce, com push-in
 * no pico e recuo na morte. Os valores NÃO são estéticos: foram otimizados por
 * busca para que o corpo inteiro (base do caule até as bordas do chapéu) fique
 * dentro do quadro em 16:9, 21:9, 4:3, 9:16 e 20:9. Pior enquadramento medido:
 * 0.70 do meio-quadro (1.00 = fora). Verificado por scripts/check-geometry.mjs.
 */
const KEYS = [
  { pos: [0.0, 0.045, 0.21] as [number, number, number], look: [0.0, 0.012, 0.03] as [number, number, number], fov: 36 },
  { pos: [0.035, 0.042, 0.17] as [number, number, number], look: [0.0, 0.018, 0.03] as [number, number, number], fov: 36 },
  { pos: [0.075, 0.05, 0.17] as [number, number, number], look: [0.0, 0.03, 0.03] as [number, number, number], fov: 34 },
  { pos: [0.085, 0.05, 0.16] as [number, number, number], look: [0.0, 0.036, 0.03] as [number, number, number], fov: 38 },
  { pos: [0.06, 0.052, 0.15] as [number, number, number], look: [0.0, 0.03, 0.03] as [number, number, number], fov: 34 },
];
const rig = buildRig(KEYS);

function Substrate() {
  const { geometry, map } = useMemo(() => {
    const maps = makeHumusMaps(512);
    const g = new THREE.PlaneGeometry(1.2, 1.2, 48, 48);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 8) * 0.002 + Math.cos(y * 7.3) * 0.0015 - Math.hypot(x, y) * 0.004);
    }
    g.computeVertexNormals();
    return { geometry: g, map: canvasTexture(maps.color, { srgb: true, repeat: [3, 3] }) };
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.03]}>
      <meshStandardMaterial map={map} roughness={1} color="#a89c8c" />
    </mesh>
  );
}

/** Rede de micélio que adensa e recua com o ciclo */
function Network({ quality, progress }: { quality: Quality; progress: MotionValue<number> }) {
  const { geometry, material } = useMemo(() => {
    const count = quality === 'high' ? 420 : quality === 'medium' ? 240 : 110;
    return {
      geometry: buildFilaments({ count, spread: 0.28, seed: 4242, minLength: 0.02, maxLength: 0.1, radius: 0.0009 }),
      material: makeHyphaMaterial('#dcefdc'),
    };
  }, [quality]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const c = cycleAt(progress.get());
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uAwake.value = Math.max(0.08, c.network);
    // pico de pulso no primórdio: a rede "carrega" energia para o corpo nascer
    material.uniforms.uPulseSpeed.value = 1.3 + Math.sin(Math.PI * Math.min(1, progress.get() / 0.4)) * 1.4;
  });

  return <mesh geometry={geometry} material={material} position={[0, 0.001, 0.03]} frustumCulled={false} renderOrder={4} />;
}

function Primordium({ progress }: { progress: MotionValue<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#efeadd',
        roughness: 0.55,
        emissive: new THREE.Color('#f6f0e0'),
        emissiveIntensity: 0.28,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const s = cycleAt(progress.get()).primordium;
    mesh.visible = s > 0.01;
    const k = 0.004 + s * 0.006;
    mesh.scale.set(k, k * 0.82, k);
    material.opacity = s;
    // relógio do R3F: performance.now() continuaria correndo com a cena pausada
    material.emissiveIntensity = 0.28 * s + 0.12 * Math.sin(state.clock.elapsedTime * 2) ** 2 * s;
  });

  return (
    <mesh ref={ref} position={[0, 0.0055, 0.03]} material={material}>
      <sphereGeometry args={[1, 24, 18]} />
    </mesh>
  );
}

function Mushroom({ progress }: { progress: MotionValue<number> }) {
  const { camera } = useThree();
  const quality = (
    typeof window !== 'undefined' && window.innerWidth < 700 ? 'medium' : 'high'
  ) as Quality;
  const { geometries, materials } = useMemo(
    () => ({ geometries: createGeometries(quality), materials: createMaterials() }),
    [quality],
  );

  useEffect(
    () => () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [geometries, materials],
  );

  useFrame(() => {
    const c = cycleAt(progress.get());
    applyGrowth(materials, { growth: c.growth, open: c.open, wilt: c.wilt, dry: c.dry });
    // as normais do shader dependem da posição da câmera (fresnel/SSS)
    void camera;
  });

  return (
    <group position={[0, 0, 0.03]}>
      <mesh geometry={geometries.stem} material={materials.stem} frustumCulled={false} />
      <mesh geometry={geometries.cap} material={materials.cap} frustumCulled={false} />
      <mesh geometry={geometries.gills} material={materials.gills} frustumCulled={false} renderOrder={3} />
    </group>
  );
}

/** Luz-chave que "morre" junto com o fungo */
function LightingLife({ progress }: { progress: MotionValue<number> }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.SpotLight>(null);
  useFrame((state) => {
    const c = cycleAt(progress.get());
    const t = state.clock.elapsedTime;
    if (key.current) key.current.intensity = 1.6 + 1.5 * c.life * (0.7 + 0.3 * Math.sin(t * 0.7));
    if (rim.current) rim.current.intensity = 1.2 + 2.4 * c.life;
  });
  return (
    <>
      <directionalLight ref={key} position={[0.16, 0.26, 0.1]} color="#ffd9a0" intensity={2.4} />
      {/* contraluz forte: é o halo que faz o cogumelo "acender" na borda */}
      <spotLight ref={rim} position={[-0.1, 0.18, -0.14]} angle={0.9} penumbra={1} intensity={3} color="#ffcf9a" distance={1} />
      <hemisphereLight args={['#9db3a6', '#160f08', 0.5]} />
      <ambientLight intensity={0.08} color="#3f4a3c" />
    </>
  );
}

function Spores({ quality, progress }: { quality: Quality; progress: MotionValue<number> }) {
  const { geometry, material, uniforms } = useMemo(() => {
    const count = quality === 'high' ? 1400 : quality === 'medium' ? 700 : 280;
    const f = makeSporeField({
      count,
      bounds: [0.16, 0.16, 0.16],
      seed: 991,
      size: 0.0042,
      drift: 0.012,
      turbulence: 0.012,
      color: '#f2ead8',
      opacity: 0,
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
    const c = cycleAt(progress.get());
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uOpacity.value = c.spores * 0.85;
    uniforms.uDrift.value = 0.012 * (1 + c.growth * 0.6);
  });

  return <points geometry={geometry} material={material} position={[0, 0.03, 0.03]} frustumCulled={false} renderOrder={7} />;
}

/** Bokeh de fundo: pontos grandes fora de foco = profundidade fotográfica */
function BackgroundBokeh({ quality }: { quality: Quality }) {
  const { geometry, material } = useMemo(() => {
    const n = quality === 'high' ? 90 : quality === 'medium' ? 50 : 24;
    const rand = rng(31337);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 0.9;
      pos[i * 3 + 1] = 0.02 + rand() * 0.22;
      pos[i * 3 + 2] = -0.25 - rand() * 0.7;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#d9c9a0') } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying float vA;
        uniform float uTime;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.01;
          p.y += cos(uTime * 0.16 + aSeed * 21.0) * 0.008;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // disco grande = desfoque óptico
          gl_PointSize = (140.0 + aSeed * 120.0) / max(1.0, -mv.z);
          vA = 0.12 + aSeed * 0.28;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          // anel de bokeh: a borda da lente é mais brilhante que o centro
          float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.3, 0.46, d);
          gl_FragColor = vec4(uColor * (0.5 + ring), ring * vA * 0.5);
          #include <colorspace_fragment>
        }
      `,
    });
    return { geometry: g, material: m };
  }, [quality]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />;
}

function CameraDriver({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const sway = useMemo(() => new THREE.Vector3(), []);
  const smooth = useRef(0);

  useFrame((state) => {
    smooth.current = THREE.MathUtils.damp(smooth.current, progress.get(), 6.5, 1 / 60);
    const { fov, roll } = sampleCamera(rig, smooth.current, pos, look, {
      gain: reduced ? 0.1 : 1,
      aspect: size.width / Math.max(1, size.height),
    });
    if (!reduced) pos.add(handheld(state.clock.elapsedTime, 0.0012, sway));
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(pos);
    applyCamera(cam, fov, roll); // up antes do lookAt
    cam.lookAt(look);
  });
  return null;
}

export function CogumeloScene({
  progress,
  quality: qualityProp,
  reduced: reducedProp,
}: SceneProps & { quality?: Quality; reduced?: boolean }) {
  // herda a estimativa do dispositivo feita pela fundação; a prop permite
  // forçar um nível no modo de depuração (?debug=1)
  const detected = useQuality().quality;
  const prefersReduced = useReducedMotion();
  const dbg = useSceneDebug('02-cogumelo', progress);
  const quality = qualityProp ?? dbg.quality ?? detected;
  const reduced = reducedProp ?? prefersReduced;
  return (
    <>
      <color attach="background" args={[PALETTE.entry]} />
      <fogExp2 attach="fog" args={[PALETTE.entry, 0.85]} />
      <Substrate />
      <Network quality={quality} progress={progress} />
      <Primordium progress={progress} />
      <Mushroom progress={progress} />
      <Spores quality={quality} progress={progress} />
      <BackgroundBokeh quality={quality} />
      <LightingLife progress={progress} />
      <CameraDriver progress={progress} reduced={reduced} />
      {dbg.enabled && <SceneTelemetry sceneId="02-cogumelo" />}
    </>
  );
}

export const scene: SceneDefinition = {
  id: '02-cogumelo',
  scrollLength: 220,
  Component: CogumeloScene,
  textBlocks: [
    {
      at: 0,
      eyebrow: '02 / DESENVOLVIMENTO',
      title: 'O fungo inteiro está aqui há meses.',
      body: 'O que chamamos de cogumelo é só o órgão reprodutivo. Ele sobe quando o micélio acumulou energia suficiente e as condições de umidade e temperatura se alinham.',
    },
    {
      at: 0.26,
      eyebrow: 'PRIMÓRDIO',
      title: 'Um nó de hifas, do tamanho de uma cabeça de alfinete.',
      body: 'Milhares de filamentos se condensam num primórdio — a estrutura em miniatura que já contém caule, chapéu e lamelas. Se o tempo secar agora, ele aborta sem crescer.',
    },
    {
      at: 0.5,
      eyebrow: 'MORFOLOGIA',
      title: 'Crescer é absorver água.',
      body: 'A expansão vem da pressão de turgor: células alongam-se ao encher de água, empurrando o corpo de frutificação para fora da serapilheira em poucas horas.',
    },
    {
      at: 0.74,
      eyebrow: 'ESPORULAÇÃO',
      title: 'Abrir o chapéu é liberar a próxima geração.',
      body: 'As lamelas se separam e expõem a superfície que produz esporos. Um único exemplar pode liberar bilhões deles, carregados por correntes de ar.',
    },
    {
      at: 0.9,
      eyebrow: 'CICLO',
      title: 'E então, retorna.',
      body: 'Terminada a dispersão, o fungo para de absorver água e desidrata. As paredes celulares perdem rigidez, o tecido escurece e a matéria volta ao ciclo.',
    },
  ],
};

export default scene;
