import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { SceneDefinition, SceneProps, TextBlock } from '../types';
import { useJourneyStore } from '../../store/useJourneyStore';
import { palette } from '../../design/tokens';
import { useVeinQualityConfig } from './sceneQuality';
import { createVascularSpline } from './splineData';
import { VesselTunnel } from './VesselTunnel';
import { BloodCells } from './BloodCells';
import { BodyMiniMap } from './BodyMiniMap';

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Pulso cardíaco arterial fisiológico ("lub-dub": pico sistólico + incisura dicrótica ~70 bpm).
 */
function arterialPulse(timeSeconds: number): number {
  const phase = (timeSeconds * (70 / 60)) % 1;
  const systolic = Math.exp(-Math.pow((phase - 0.14) / 0.065, 2));
  const dicrotic = 0.46 * Math.exp(-Math.pow((phase - 0.31) / 0.085, 2));
  return clamp(systolic + dicrotic, 0, 1);
}

export function Component({ progress }: SceneProps) {
  const { camera, scene } = useThree();
  const activeSceneId = useJourneyStore((s) => s.sceneId);
  const isSceneActive = activeSceneId === '04-veias';
  const cfg = useVeinQualityConfig();

  const rootRef = useRef<THREE.Group>(null);
  const isActiveRef = useRef(isSceneActive);
  const progressRef = useRef(0);
  const prevProgressRef = useRef(0);
  const velocityRef = useRef(0);
  const heartbeatRef = useRef(0);
  const fogColorRef = useRef(new THREE.Color('#0a0403'));
  const fogDensityRef = useRef(0.065);

  const headLightRef = useRef<THREE.PointLight>(null);
  const forwardLightRef = useRef<THREE.PointLight>(null);
  const exitHaloRef = useRef<THREE.Mesh>(null);

  const spline = useMemo(() => createVascularSpline(), []);
  const endPoint = useMemo(() => spline.getPointAt(0.998), [spline]);

  const colorStops = useMemo(
    () => ({
      c03Entry: new THREE.Color('#0a0403'),
      digestive: new THREE.Color(palette.blood.background),
      hepatic: new THREE.Color('#240806'),
      arterial: new THREE.Color('#2a050c'),
      bbb: new THREE.Color('#0a0b1d'),
      c05Exit: new THREE.Color(palette.neural.background),
    }),
    []
  );

  const camPos = useMemo(() => new THREE.Vector3(), []);
  const lookAhead = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const sideAxis = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    isActiveRef.current = isSceneActive;
    // Ao sair para uma cena anterior (ex.: 03-mao-boca que assume câmera padrão [0,0,5.5]),
    // restaura a câmera para não afetar cenas vizinhas no Canvas compartilhado!
    if (!isSceneActive && useJourneyStore.getState().sceneId !== '05-cerebro') {
      camera.position.set(0, 0, 5.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 42;
        camera.updateProjectionMatrix();
      }
    }
  }, [isSceneActive, camera]);

  useFrame(({ clock }, delta) => {
    const parentVisible = rootRef.current?.parent?.visible ?? true;
    const activeNow = isSceneActive && parentVisible;
    isActiveRef.current = activeNow;
    if (!activeNow || !cfg.isWebGL2) return;

    const dt = Math.min(delta, 0.1);
    const t = clock.getElapsedTime();
    const rawP = clamp(progress.get(), 0, 1);
    const smoothP = lerp(progressRef.current, rawP, 1 - Math.exp(-dt * 18));
    progressRef.current = smoothP;

    const instVel = (smoothP - prevProgressRef.current) / Math.max(dt, 1e-4);
    prevProgressRef.current = smoothP;
    velocityRef.current = lerp(velocityRef.current, instVel, 0.2);

    const heartEnv = smoothstep(0.06, 0.42, smoothP) * (1 - 0.65 * smoothstep(0.88, 0.98, smoothP));
    const hb = (cfg.reducedMotion ? 0.22 : arterialPulse(t)) * heartEnv;
    heartbeatRef.current = hb;

    // Transição contínua de cor/fog: começa escura casando com a Cena 03 e termina em palette.neural.background (Cena 05)
    const fogCol = fogColorRef.current;
    fogCol.copy(colorStops.c03Entry);
    fogCol.lerp(colorStops.digestive, smoothstep(0.02, 0.14, smoothP));
    fogCol.lerp(colorStops.hepatic, smoothstep(0.18, 0.30, smoothP));
    fogCol.lerp(colorStops.arterial, smoothstep(0.40, 0.54, smoothP));
    fogCol.lerp(colorStops.bbb, smoothstep(0.80, 0.90, smoothP));
    fogCol.lerp(colorStops.c05Exit, smoothstep(0.92, 1.0, smoothP));

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(fogCol);
    }

    fogDensityRef.current =
      lerp(0.086, 0.044, smoothstep(0.0, 0.15, smoothP)) *
      (1 - 0.45 * smoothstep(0.88, 1.0, smoothP));

    // Câmera em primeira pessoa guiada pela CatmullRomCurve3
    const camS = smoothP * 0.978;
    const lookS = Math.min(0.999, camS + 0.022);
    spline.getPointAt(camS, camPos);
    spline.getPointAt(lookS, lookAhead);
    spline.getTangentAt(camS, tangent).normalize();

    const endStabilizer = 1 - smoothstep(0.86, 0.98, smoothP);
    const startStabilizer = smoothstep(0.0, 0.06, smoothP);
    const swayMask = startStabilizer * endStabilizer;

    if (!cfg.reducedMotion && swayMask > 0.001) {
      sideAxis.crossVectors(tangent, worldUp).normalize();
      camPos.addScaledVector(sideAxis, Math.sin(t * 1.15) * 0.13 * swayMask);
      camPos.y += (Math.cos(t * 0.85) * 0.09 + hb * 0.06) * swayMask;
    }

    camera.position.copy(camPos);

    upVec.copy(worldUp);
    if (!cfg.reducedMotion && swayMask > 0.001) {
      upVec.applyAxisAngle(tangent, Math.sin(smoothP * Math.PI * 4.0) * 0.13 * swayMask);
    }
    camera.up.copy(upVec);
    camera.lookAt(lookAhead);

    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = lerp(42, 52, startStabilizer);
      const finalFov = lerp(baseFov, 46, smoothstep(0.84, 1.0, smoothP));
      const pulseFov = cfg.reducedMotion ? 0 : hb * 1.3 * swayMask;
      const velFov = cfg.reducedMotion ? 0 : Math.min(3.0, Math.abs(velocityRef.current) * 2.0) * swayMask;
      const targetFov = finalFov + pulseFov + velFov;
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }
    }

    if (headLightRef.current) {
      headLightRef.current.position.copy(camPos);
      const entryDim = smoothstep(0.0, 0.09, smoothP);
      const bbbMix = smoothstep(0.80, 0.94, smoothP);
      headLightRef.current.intensity = lerp(0.25, 2.2 + hb * 0.85, entryDim);
      headLightRef.current.color.setRGB(
        lerp(1.0, 0.45, bbbMix),
        lerp(0.34, 0.82, bbbMix),
        lerp(0.40, 1.0, bbbMix)
      );
    }

    if (forwardLightRef.current) {
      forwardLightRef.current.position.copy(lookAhead).addScaledVector(tangent, 4.5);
      const conv = smoothstep(0.20, 0.35, smoothP);
      forwardLightRef.current.intensity = 1.5 + conv * 1.1;
      forwardLightRef.current.color.set(conv > 0.5 ? '#38bdf8' : '#a855f7');
    }

    if (exitHaloRef.current) {
      const reveal = smoothstep(0.88, 1.0, smoothP);
      exitHaloRef.current.scale.setScalar(0.6 + reveal * 1.7);
      const mat = exitHaloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = reveal * 0.42;
    }
  });

  return (
    <group ref={rootRef}>
      {cfg.isWebGL2 && (
        <>
          <pointLight ref={headLightRef} distance={18} decay={1.6} />
          <pointLight ref={forwardLightRef} distance={24} decay={1.8} />

          <VesselTunnel
            spline={spline}
            isActiveRef={isActiveRef}
            progressRef={progressRef}
            heartbeatRef={heartbeatRef}
            fogColorRef={fogColorRef}
            fogDensityRef={fogDensityRef}
            reducedMotion={cfg.reducedMotion}
            tubularSegments={cfg.tubularSegments}
            radialSegments={cfg.radialSegments}
          />

          <BloodCells
            spline={spline}
            isActiveRef={isActiveRef}
            progressRef={progressRef}
            velocityRef={velocityRef}
            heartbeatRef={heartbeatRef}
            fogColorRef={fogColorRef}
            fogDensityRef={fogDensityRef}
            erythrocyteCount={cfg.erythrocyteCount}
            leukocyteCount={cfg.leukocyteCount}
            psilocinCount={cfg.psilocinCount}
            plasmaCount={cfg.plasmaCount}
            reducedMotion={cfg.reducedMotion}
          />

          <mesh ref={exitHaloRef} position={[endPoint.x, endPoint.y, endPoint.z - 2.2]}>
            <sphereGeometry args={[1.4, 20, 20]} />
            <meshBasicMaterial
              color="#67e8f9"
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </>
      )}

      <BodyMiniMap
        progress={progress}
        isActive={isSceneActive}
        isWebGL2={cfg.isWebGL2}
        quality={cfg.quality}
      />
    </group>
  );
}

export const scene04TextBlocks: TextBlock[] = [
  {
    at: 0,
    eyebrow: '04 / ABSORÇÃO ENTÉRICA · CONSENSO',
    title: 'Do trato digestivo ao sangue.',
    body: 'Após a passagem gástrica e intestinal, a psilocibina entra nos capilares mesentéricos ainda como pró-fármaco fosforilado hidrossolúvel.',
  },
  {
    at: 0.22,
    eyebrow: 'BIOTRANSFORMAÇÃO HEPÁTICA · CONSENSO',
    title: 'A conversão em psilocina.',
    body: 'No epitélio intestinal, plasma e sinusoides do fígado, fosfatases alcalinas removem o grupo fosfato e originam a psilocina (4-HO-DMT), metabólito lipofílico ativo.',
  },
  {
    at: 0.45,
    eyebrow: 'HEMODINÂMICA CARDÍACA · CONSENSO',
    title: 'Sincronizada ao pulso do coração.',
    body: 'Impulsionada pelas sístoles cardíacas, a molécula flui no plasma entre bilhões de hemácias bicôncavas e leucócitos marginados junto ao endotélio.',
  },
  {
    at: 0.66,
    eyebrow: 'ARTÉRIA CARÓTIDA · CONSENSO',
    title: 'Subida arterial ao encéfalo.',
    body: 'Pelas artérias carótidas internas e vertebrais, o fluxo oxigenado ascende rapidamente até a microcirculação cerebral.',
  },
  {
    at: 0.85,
    eyebrow: 'BARREIRA HEMATOENCEFÁLICA · CONSENSO',
    title: 'A travessia seletiva.',
    body: 'Junções oclusivas endoteliais retêm células sanguíneas no vaso, enquanto a psilocina lipofílica difunde-se pela membrana rumo ao tecido neural.',
  },
];

export const scene04Veias: SceneDefinition = {
  id: '04-veias',
  scrollLength: 360,
  textBlocks: scene04TextBlocks,
  Component,
};

export default scene04Veias;
