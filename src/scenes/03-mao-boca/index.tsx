/**
 * CENA 03 — MÃO E BOCA
 * ---------------------------------------------------------------------------
 * EXPLICITAMENTE NÃO-INSTRUCIONAL. A cena não mostra preparo, dosagem, método
 * nem consumo: o gesto é interrompido pela própria dissolução da imagem antes
 * de qualquer ação acontecer. É uma transição narrativa, coerente com o aviso
 * do rodapé ("conteúdo educativo, não é orientação de consumo").
 *
 * Continuidade: entra no escuro morno e seco em que a Cena 02 termina
 * (#120d08) e fecha em direção a #0a0403 — a primeira cor da Cena 04.
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
import { canvasTexture, makeSporeField, makeContactShadow } from '../_shared/gl';
import { makeSkinMaps, makeHumusMaps } from '../_shared/textures';
import { lerp } from '../_shared/math';
import { buildHand, applyHandPose, disposeHand, type HandRig } from './hand';
import { gestureAt } from './timeline';

export const PALETTE = {
  entry: '#120d08',
  /** obrigatório pela continuidade: é a primeira cor da Cena 04 */
  exit: '#0a0403',
};

/**
 * A câmera acompanha a mão de baixo para cima. O último keyframe fica no mesmo
 * eixo de olhar baixo e quente com que a Cena 04 abre.
 */
const KEYS = [
  { pos: [0.0, 0.06, 0.26] as [number, number, number], look: [0.0, 0.05, 0.05] as [number, number, number], fov: 40 },
  { pos: [0.012, 0.075, 0.23] as [number, number, number], look: [0.0, 0.075, 0.05] as [number, number, number], fov: 40 },
  { pos: [0.02, 0.1, 0.2] as [number, number, number], look: [0.0, 0.1, 0.04] as [number, number, number], fov: 42 },
  { pos: [0.015, 0.125, 0.17] as [number, number, number], look: [0.0, 0.125, 0.02] as [number, number, number], fov: 44 },
];
const rig = buildRig(KEYS);

/** Um cogumelo maduro, simplificado: a Cena 02 já o apresentou em detalhe */
function PickedMushroom({ quality, ref: meshRef }: { quality: Quality; ref: React.RefObject<THREE.Group | null> }) {
  const { capMat, stemMat } = useMemo(() => {
    const maps = makeHumusMaps(256); // textura de casca/caule reaproveitada
    const map = canvasTexture(maps.color, { srgb: true, repeat: [1, 4] });
    return {
      stemMat: new THREE.MeshStandardMaterial({ color: '#e2d3b4', roughness: 0.62, map }),
      capMat: new THREE.MeshStandardMaterial({ color: '#8c4a20', roughness: 0.5 }),
    };
  }, []);
  useEffect(
    () => () => {
      capMat.dispose();
      stemMat.dispose();
    },
    [capMat, stemMat],
  );

  const capSeg = quality === 'low' ? 24 : 40;
  return (
    <group ref={meshRef}>
      <mesh position={[0, 0.012, 0]} material={stemMat}>
        <capsuleGeometry args={[0.0034, 0.02, 4, 10]} />
      </mesh>
      {/* calota: meia esfera achatada com a borda virada para baixo */}
      <mesh position={[0, 0.026, 0]} material={capMat} scale={[1, 0.62, 1]}>
        <sphereGeometry args={[0.016, capSeg, capSeg / 2, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 0.0205, 0]} material={capMat} rotation={[Math.PI, 0, 0]} scale={[1, 0.3, 1]}>
        <sphereGeometry args={[0.0158, capSeg, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

/** A mão: placeholder procedural com pinça real */
function Hand({ quality, ref: handRef }: { quality: Quality; ref: React.MutableRefObject<HandRig | null> }) {
  const skin = useMemo(() => {
    const maps = makeSkinMaps(quality === 'low' ? 256 : 512);
    return {
      color: canvasTexture(maps.color, { srgb: true }),
      normal: canvasTexture(maps.normal),
    };
  }, [quality]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: skin.color,
        normalMap: skin.normal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        color: '#d8b9a4',
        roughness: 0.72,
        // pele tem um leve espalhamento: o emissive frio simula o subsurface
        emissive: new THREE.Color('#3a1512'),
        emissiveIntensity: 0.35,
      }),
    [skin],
  );

  const rigInstance = useMemo(() => buildHand(), []);
  useEffect(() => {
    handRef.current = rigInstance;
    rigInstance.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = material;
    });
    return () => {
      disposeHand(rigInstance);
      material.dispose();
    };
  }, [rigInstance, material, handRef]);

  return <primitive object={rigInstance.group} />;
}

/** O rosto: só a silhueta e o lábio inferior entrando na luz */
function Face({ progress }: { progress: MotionValue<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8a5c4a',
        roughness: 0.8,
        emissive: new THREE.Color('#2a0f0b'),
        emissiveIntensity: 0.5,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const g = gestureAt(progress.get());
    if (!groupRef.current) return;
    // o rosto só existe quando o gesto chega perto — nunca no início
    groupRef.current.visible = g.raise > 0.02;
    groupRef.current.position.y = 0.14 + g.raise * 0.035;
  });

  return (
    <group ref={groupRef} position={[0, 0.14, -0.01]}>
      {/* maxilar e queixo */}
      <mesh material={material} scale={[1, 1.15, 0.85]}>
        <sphereGeometry args={[0.055, 28, 20, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.55]} />
      </mesh>
      {/* lábio inferior: a única parte iluminada */}
      <mesh material={material} position={[0, -0.012, 0.042]} rotation={[0.3, 0, 0]} scale={[1, 0.4, 0.6]}>
        <sphereGeometry args={[0.022, 24, 16]} />
      </mesh>
    </group>
  );
}

function CameraDriver({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const sway = useMemo(() => new THREE.Vector3(), []);
  const smooth = useRef(0);

  useFrame((state) => {
    smooth.current = THREE.MathUtils.damp(smooth.current, progress.get(), 6, 1 / 60);
    const { fov, roll } = sampleCamera(rig, smooth.current, pos, look, {
      gain: reduced ? 0.15 : 1,
      aspect: size.width / Math.max(1, size.height),
    });
    if (!reduced) pos.add(handheld(state.clock.elapsedTime, 0.0014, sway));
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(pos);
    applyCamera(cam, fov, roll);
    cam.lookAt(look);
  });
  return null;
}

/** Dissolução radial: a imagem fecha "para dentro", não por fade chapado */
function Dissolve({ progress, color = PALETTE.exit }: { progress: MotionValue<number>; color?: string }) {
  const { mesh, material } = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uAmount: { value: 0 },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          // vinheta que avança do perímetro para o centro
          float d = length(vUv - 0.5) * 1.414;
          float edge = smoothstep(0.0, 1.0, uAmount * 1.6 - d * 0.6);
          float a = max(edge, smoothstep(0.55, 1.0, uAmount));
          gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
          #include <colorspace_fragment>
        }
      `,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 999;
    return { mesh, material: m };
  }, [color]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      material.dispose();
    },
    [mesh, material],
  );

  useFrame(() => {
    material.uniforms.uAmount.value = gestureAt(progress.get()).close;
  });

  // o plano de dissolução vive em espaço de tela, preso à câmera
  return <ScreenQuad mesh={mesh} />;
}

function ScreenQuad({ mesh }: { mesh: THREE.Mesh }) {
  const { camera } = useThree();
  useFrame(() => {
    // 1 cm à frente do plano próximo, sempre centrado na câmera
    const dist = (camera as THREE.PerspectiveCamera).near * 2;
    mesh.position.set(0, 0, -dist);
    mesh.quaternion.copy(camera.quaternion);
  });
  return <primitive object={mesh} />;
}

export function MaoBocaScene({
  progress,
  quality: qualityProp,
  reduced: reducedProp,
}: SceneProps & { quality?: Quality; reduced?: boolean }) {
  const detected = useQuality().quality;
  const prefersReduced = useReducedMotion();
  const dbg = useSceneDebug('03-mao-boca', progress);
  const quality = qualityProp ?? dbg.quality ?? detected;
  const reduced = reducedProp ?? prefersReduced;

  const handRef = useRef<HandRig | null>(null);
  const mushroomRef = useRef<THREE.Group>(null);
  const holdRef = useRef<THREE.Object3D | null>(null);

  const shadow = useMemo(() => makeContactShadow(0.6), []);
  useEffect(() => () => shadow.dispose(), [shadow]);

  /** esporos soltos do solo, subindo na corrente de ar */
  const motes = useMemo(
    () =>
      makeSporeField({
        count: quality === 'high' ? 320 : quality === 'medium' ? 180 : 70,
        bounds: [0.5, 0.5, 0.5],
        seed: 5511,
        size: 0.0022,
        drift: 0.014,
        turbulence: 0.01,
        color: '#e6d3b0',
        opacity: 0.45,
      }),
    [quality],
  );
  useEffect(() => () => {
    motes.geometry.dispose();
    motes.material.dispose();
  }, [motes]);

  useFrame((state) => {
    const g = gestureAt(progress.get());
    const t = state.clock.elapsedTime;

    /* ------------------------------ mão ------------------------------ */
    const rigH = handRef.current;
    if (rigH) {
      // entra pela borda inferior, com leve rotação de pulso
      const enterY = lerp(-0.16, 0.06, g.enter);
      const raiseY = lerp(0, 0.075, g.raise);
      rigH.group.position.set(
        lerp(0.055, 0.0, g.enter) + Math.sin(t * 0.4) * 0.0018 * (1 - g.close),
        enterY + raiseY,
        lerp(0.1, 0.02, g.enter),
      );
      // a mão gira para apresentar a pinça à câmera conforme o objeto sobe
      rigH.group.rotation.set(
        lerp(-0.5, -0.12, g.enter) + g.raise * 0.32,
        lerp(0.4, 0.08, g.enter) - g.raise * 0.12,
        lerp(0.06, 0.0, g.enter) + g.hold * 0.05,
      );
      applyHandPose(rigH, {
        curl: 0.18 + g.pinch * 0.42,
        pinch: g.pinch,
        thumbIn: g.pinch,
      });
      rigH.group.updateMatrixWorld(true);
      holdRef.current = rigH.pinchPoint;
    }

    /* --------------------------- cogumelo --------------------------- */
    const m = mushroomRef.current;
    if (m) {
      const hold = holdRef.current;
      if (hold && g.pinch > 0.05) {
        // segue a pinça em espaço de mundo
        hold.getWorldPosition(m.position);
        m.position.y -= 0.014;
        hold.getWorldQuaternion(m.quaternion);
        m.rotation.x = 0.25;
      } else {
        m.position.set(0, 0.0, 0.045);
        m.rotation.set(0, 0.4, 0);
      }
      // antes de ser pego, está enraizado no solo
      m.scale.setScalar(lerp(1, 1.05, g.lift));
    }

    /* ------------------------------ esporos ------------------------------ */
    motes.uniforms.uTime.value = t;
    motes.uniforms.uOpacity.value = 0.45 * (1 - g.dissolve);
    motes.uniforms.uDrift.value = 0.014 + g.raise * 0.02;
  });

  return (
    <>
      <color attach="background" args={[PALETTE.entry]} />
      <fogExp2 attach="fog" args={[PALETTE.entry, 1.1]} />

      {/* Luz: uma fonte quente baixa, vinda da esquerda — a mesma direção da
          Cena 02, para a continuidade não "quebrar" */}
      <directionalLight position={[-0.2, 0.24, 0.12]} intensity={1.9} color="#ffcfa4" />
      <spotLight position={[0.1, 0.02, 0.24]} angle={0.6} penumbra={1} intensity={1.6} color="#ffb877" />
      <hemisphereLight args={['#8d7f74', '#0c0503', 0.35]} />
      <ambientLight intensity={0.06} color="#3a2418" />

      <PickedMushroom quality={quality} ref={mushroomRef} />
      <Hand quality={quality} ref={handRef} />
      <Face progress={progress} />

      {/* chão implícito: só a sombra, o resto é escuridão */}
      <mesh position={[0, -0.001, 0.05]} rotation={[-Math.PI / 2, 0, 0]} material={shadow} scale={0.28}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      <points geometry={motes.geometry} material={motes.material} frustumCulled={false} renderOrder={6} />
      <CameraDriver progress={progress} reduced={reduced} />
      {dbg.enabled && <SceneTelemetry sceneId="03-mao-boca" />}
      <Dissolve progress={progress} />
    </>
  );
}

export const scene: SceneDefinition = {
  id: '03-mao-boca',
  scrollLength: 160,
  Component: MaoBocaScene,
  textBlocks: [
    {
      at: 0,
      eyebrow: '03 / ENCONTRO',
      title: 'Do solo para a mão.',
      body: 'Por milhares de anos, humanos e fungos se encontraram. O gesto é antigo — e carregado de significado, risco e contexto cultural.',
    },
    {
      at: 0.46,
      eyebrow: 'NOTA',
      title: 'A imagem para antes da ação.',
      body: 'Este é um trabalho educativo sobre biologia e neurociência. A cena não ilustra preparo, dose ou método, e não é orientação de consumo.',
    },
  ],
};

export default scene;
