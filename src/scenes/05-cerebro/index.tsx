import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { SceneDefinition, SceneProps, TextBlock } from '../types';
import { useJourneyStore } from '../../store/useJourneyStore';
import { palette } from '../../design/tokens';
import { useBrainQualityConfig } from './sceneQuality';
import { clamp, lerp, sampleBrainCamera } from './cameraKeyframes';
import { AnatomicalBrain } from './AnatomicalBrain';
import { NeuronReceptorMicro } from './NeuronReceptorMicro';
import { ConnectomeArcs } from './ConnectomeArcs';
import { BrainLabels3D } from './BrainLabels3D';
import { useManagedDisposable } from './useSceneResources';

export function Component({ progress }: SceneProps) {
  const { camera, scene } = useThree();
  const activeSceneId = useJourneyStore((s) => s.sceneId);
  const isSceneActive = activeSceneId === '05-cerebro';
  const cfg = useBrainQualityConfig();

  const [glbLoaded, setGlbLoaded] = useState(false);

  const rootRef = useRef<THREE.Group>(null);
  const isActiveRef = useRef(isSceneActive);
  const progressRef = useRef(0);

  const bgColor = useMemo(() => new THREE.Color(palette.neural.background), []);
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const smoothPos = useMemo(() => new THREE.Vector3(0, -0.58, 2.68), []);
  const smoothTarget = useMemo(() => new THREE.Vector3(0, -0.58, 0), []);

  const ambientParticles = useManagedDisposable(
    () => {
      const count = cfg.ambientParticleCount;
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 1.6 + (((i * 7919) % 1000) / 1000) * 2.8;
        const theta = i * 2.39996;
        const phi = Math.acos(1 - 2 * (((i * 104729) % 1000) / 1000));
        arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        arr[i * 3 + 1] = r * Math.cos(phi);
        arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const mat = new THREE.PointsMaterial({
        color: '#7dd3fc',
        size: 0.022,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      return { geo, mat };
    },
    (res) => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [cfg.ambientParticleCount]
  );

  useEffect(() => {
    isActiveRef.current = isSceneActive;
    if (!isSceneActive && useJourneyStore.getState().sceneId !== '04-veias') {
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

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(bgColor);
    }

    const dt = Math.min(delta, 0.1);
    const t = clock.getElapsedTime();
    const rawP = clamp(progress.get(), 0, 1);
    const smoothP = lerp(progressRef.current, rawP, 1 - Math.exp(-dt * 16));
    progressRef.current = smoothP;

    const fov = sampleBrainCamera(smoothP, desiredPos, desiredTarget);

    if (!cfg.reducedMotion && smoothP > 0.04) {
      const microScale = smoothP > 0.58 && smoothP < 0.80 ? 0.006 : 0.032;
      desiredPos.x += Math.sin(t * 0.45) * microScale;
      desiredPos.y += Math.cos(t * 0.38) * microScale * 0.7;
    }

    const damp = 1 - Math.exp(-dt * 14);
    smoothPos.lerp(desiredPos, damp);
    smoothTarget.lerp(desiredTarget, damp);

    camera.position.copy(smoothPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(smoothTarget);

    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.02) {
      camera.fov = lerp(camera.fov, fov, damp);
      camera.updateProjectionMatrix();
    }
  });

  return (
    <group ref={rootRef}>
      {cfg.isWebGL2 && (
        <>
          <pointLight position={[0, 0.25, 2.3]} intensity={0.95} distance={6.5} color="#38bdf8" />
          <directionalLight position={[-3.2, -1.2, -2.5]} intensity={0.65} color="#818cf8" />

          <AnatomicalBrain
            isActiveRef={isActiveRef}
            progressRef={progressRef}
            reducedMotion={cfg.reducedMotion}
            onGlbLoadedChange={setGlbLoaded}
          />

          <NeuronReceptorMicro
            isActiveRef={isActiveRef}
            progressRef={progressRef}
            reducedMotion={cfg.reducedMotion}
          />

          <ConnectomeArcs
            isActiveRef={isActiveRef}
            progressRef={progressRef}
            arcCount={cfg.connectomeArcCount}
            reducedMotion={cfg.reducedMotion}
          />

          {ambientParticles && <points args={[ambientParticles.geo, ambientParticles.mat]} />}
        </>
      )}

      <BrainLabels3D
        isActive={isSceneActive}
        isActiveRef={isActiveRef}
        progressRef={progressRef}
        isWebGL2={cfg.isWebGL2}
        glbLoaded={glbLoaded}
        quality={cfg.quality}
      />
    </group>
  );
}

export const scene05TextBlocks: TextBlock[] = [
  {
    at: 0,
    eyebrow: '05 / CÓRTEX HUMANO · CONSENSO',
    title: 'Pulsos ao longo dos sulcos.',
    body: 'CONSENSO: ao cruzar a microcirculação cerebral, a psilocina distribui-se pelo manto cortical com ocupação mensurável por PET em áreas associativas.',
  },
  {
    at: 0.25,
    eyebrow: 'CÓRTEX PRÉ-FRONTAL · CONSENSO',
    title: 'Densidade de receptores 5-HT2A.',
    body: 'CONSENSO: o córtex pré-frontal medial e dorsolateral concentra alta expressão de receptores 5-HT2A nos dendritos apicais de neurônios piramidais da Camada V.',
  },
  {
    at: 0.38,
    eyebrow: 'TÁLAMO & CIRCUITO CSTC · HIPÓTESE',
    title: 'O filtro sensorial em questão.',
    body: 'HIPÓTESE EM ESTUDO: o modelo cortico-estriado-tálamo-cortical propõe que a modulação pré-frontal reduz o portão inibitório talâmico, ampliando sinais ascendentes.',
  },
  {
    at: 0.49,
    eyebrow: 'REDE DE MODO PADRÃO (DMN) · HIPÓTESE & EVIDÊNCIA',
    title: 'Desincronização de redes.',
    body: 'CONSENSO EM fMRI: há desincronização aguda em hubs da DMN (mPFC e PCC). HIPÓTESE: sua relação causal direta com dissolução do ego e efeitos clínicos segue em investigação.',
  },
  {
    at: 0.62,
    eyebrow: 'SINAPSE 5-HT2A · CONSENSO & PLASTICIDADE',
    title: 'Ligação molecular e disparo.',
    body: 'CONSENSO: a psilocina atua como agonista parcial 5-HT2A acionando vias Gq/11. HIPÓTESE: a ativação de 5-HT2A intracelulares e brotamento de espinhas dendríticas foi demonstrada em modelos pré-clínicos.',
  },
  {
    at: 0.82,
    eyebrow: 'CONECTOMA GLOBAL · CONSENSO EM NEUROIMAGEM',
    title: 'Diálogo ampliado entre regiões.',
    body: 'CONSENSO EM fMRI: durante o efeito agudo, cresce a comunicação funcional transitória entre redes habitualmente segregadas antes do retorno gradual ao estado basal.',
  },
];

export const scene05Cerebro: SceneDefinition = {
  id: '05-cerebro',
  scrollLength: 420,
  textBlocks: scene05TextBlocks,
  Component,
};

export default scene05Cerebro;
