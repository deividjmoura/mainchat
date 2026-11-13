import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { useFrame } from '@react-three/fiber';
import { corticalSurfaceFragmentShader, corticalSurfaceVertexShader } from './shaders';
import { clamp, rangeWeight, smoothstep } from './cameraKeyframes';

export interface BrainGeometries {
  cortex: THREE.BufferGeometry;
  thalamus: THREE.BufferGeometry;
  hippocampus: THREE.BufferGeometry;
  cerebellum: THREE.BufferGeometry;
  brainstem: THREE.BufferGeometry;
}

/**
 * Fallback procedural leve exibido instantaneamente enquanto `/assets/05-cerebro/brain.glb`
 * (707 KB comprimido com Meshopt) carrega em segundo plano, ou caso a rede falhe.
 */
function buildProceduralFallbackBrain(): BrainGeometries {
  const buildHemisphere = (signX: number): THREE.BufferGeometry => {
    const geo = new THREE.SphereGeometry(1.0, 40, 30);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 4);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) * 0.54;
      let y = pos.getY(i) * 0.88;
      const z = pos.getZ(i) * 1.38;

      if (x * signX < 0) x *= 0.22;
      if (y < -0.35) y = -0.35 + (y + 0.35) * 0.45;

      const gyri =
        Math.sin(x * 16.0 + Math.cos(z * 9.0) * 1.5) *
        Math.cos(y * 14.0 + Math.sin(z * 11.0) * 1.3);
      const sulcalDepth = clamp(0.5 - gyri * 0.5, 0, 1);
      const disp = 1.0 + gyri * 0.055;

      const fx = x * disp + signX * 0.52;
      const fy = y * disp + 0.12;
      const fz = z * disp;
      pos.setXYZ(i, fx, fy, fz);

      const pfcMask = smoothstep(0.45, 0.95, fz);
      const dmnFront = smoothstep(0.65, 1.1, fz) * (1 - smoothstep(0.15, 0.55, Math.abs(fx)));
      const dmnBack = smoothstep(-0.95, -0.45, fz) * smoothstep(0.0, 0.45, fy);
      const dmnMask = clamp(dmnFront + dmnBack, 0, 1);

      colors[i * 4] = sulcalDepth;
      colors[i * 4 + 1] = pfcMask;
      colors[i * 4 + 2] = dmnMask;
      colors[i * 4 + 3] = 0.78;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geo.computeVertexNormals();
    return geo;
  };

  const lh = buildHemisphere(1);
  const rh = buildHemisphere(-1);
  const c1 = lh.attributes.position.count;
  const c2 = rh.attributes.position.count;

  const posArr = new Float32Array((c1 + c2) * 3);
  posArr.set(lh.attributes.position.array as Float32Array, 0);
  posArr.set(rh.attributes.position.array as Float32Array, c1 * 3);

  const normArr = new Float32Array((c1 + c2) * 3);
  normArr.set(lh.attributes.normal.array as Float32Array, 0);
  normArr.set(rh.attributes.normal.array as Float32Array, c1 * 3);

  const colArr = new Float32Array((c1 + c2) * 4);
  colArr.set(lh.attributes.color.array as Float32Array, 0);
  colArr.set(rh.attributes.color.array as Float32Array, c1 * 4);

  const idx1 = lh.index!.array;
  const idx2 = rh.index!.array;
  const idxArr = new Uint32Array(idx1.length + idx2.length);
  idxArr.set(idx1, 0);
  for (let i = 0; i < idx2.length; i++) idxArr[idx1.length + i] = idx2[i] + c1;

  lh.dispose();
  rh.dispose();

  const cortex = new THREE.BufferGeometry();
  cortex.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  cortex.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  cortex.setAttribute('color', new THREE.BufferAttribute(colArr, 4));
  cortex.setIndex(new THREE.BufferAttribute(idxArr, 1));

  const thalamus = new THREE.SphereGeometry(0.28, 22, 16);
  thalamus.scale(1.25, 0.72, 1.05);
  thalamus.translate(0, -0.04, -0.05);

  const hippocampus = new THREE.TorusGeometry(0.32, 0.08, 10, 24, Math.PI * 1.1);
  hippocampus.rotateX(Math.PI * 0.45);
  hippocampus.translate(0, -0.32, -0.15);

  const cerebellum = new THREE.SphereGeometry(0.62, 24, 18);
  cerebellum.scale(1.45, 0.68, 0.85);
  cerebellum.translate(0, -0.58, -0.82);

  const brainstem = new THREE.CylinderGeometry(0.16, 0.12, 0.95, 16);
  brainstem.rotateX(0.26);
  brainstem.translate(0, -0.68, -0.22);

  return { cortex, thalamus, hippocampus, cerebellum, brainstem };
}

let cachedGlbBrain: BrainGeometries | null = null;
let pendingGlbPromise: Promise<BrainGeometries | null> | null = null;

function lazyLoadCompressedBrainGlb(fallback: BrainGeometries): Promise<BrainGeometries | null> {
  if (cachedGlbBrain) return Promise.resolve(cachedGlbBrain);
  if (pendingGlbPromise) return pendingGlbPromise;

  pendingGlbPromise = MeshoptDecoder.ready
    .then(
      () =>
        new Promise<BrainGeometries | null>((resolve) => {
          const loader = new GLTFLoader();
          loader.setMeshoptDecoder(MeshoptDecoder);

          // Suporte opcional a DRACOLoader caso o asset seja substituído por versão Draco no futuro
          const draco = new DRACOLoader();
          draco.setDecoderPath('/draco/');
          loader.setDRACOLoader(draco);

          loader.load(
            '/assets/05-cerebro/brain.glb',
            (gltf) => {
              draco.dispose();
              const found: Partial<BrainGeometries> = {};
              gltf.scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh && obj.geometry) {
                  const key = obj.name || obj.parent?.name || '';
                  if (key === 'CerebralCortex') found.cortex = obj.geometry;
                  else if (key === 'Thalamus') found.thalamus = obj.geometry;
                  else if (key === 'Hippocampus') found.hippocampus = obj.geometry;
                  else if (key === 'Cerebellum') found.cerebellum = obj.geometry;
                  else if (key === 'Brainstem') found.brainstem = obj.geometry;
                }
              });

              if (found.cortex) {
                cachedGlbBrain = {
                  cortex: found.cortex,
                  thalamus: found.thalamus ?? fallback.thalamus,
                  hippocampus: found.hippocampus ?? fallback.hippocampus,
                  cerebellum: found.cerebellum ?? fallback.cerebellum,
                  brainstem: found.brainstem ?? fallback.brainstem,
                };
                resolve(cachedGlbBrain);
              } else {
                resolve(null);
              }
            },
            undefined,
            () => {
              draco.dispose();
              resolve(null);
            }
          );
        })
    )
    .catch(() => null);

  return pendingGlbPromise;
}

interface AnatomicalBrainProps {
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
  onGlbLoadedChange?: (loaded: boolean) => void;
}

export function AnatomicalBrain({
  isActiveRef,
  progressRef,
  reducedMotion,
  onGlbLoadedChange,
}: AnatomicalBrainProps) {
  const fallbackMeshes = useMemo(() => buildProceduralFallbackBrain(), []);
  const [glbMeshes, setGlbMeshes] = useState<BrainGeometries | null>(() => cachedGlbBrain);

  const cortexMatRef = useRef<THREE.ShaderMaterial>(null);
  const thalamusMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hippoMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const cerebellumMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const thalamoLinesRef = useRef<THREE.LineSegments>(null);
  const exitCapillaryRef = useRef<THREE.Group>(null);

  useEffect(() => {
    let active = true;
    lazyLoadCompressedBrainGlb(fallbackMeshes).then((res) => {
      if (!active) return;
      if (res) {
        setGlbMeshes(res);
        onGlbLoadedChange?.(true);
      }
    });
    return () => {
      active = false;
    };
  }, [fallbackMeshes, onGlbLoadedChange]);

  useEffect(() => {
    return () => {
      fallbackMeshes.cortex.dispose();
      fallbackMeshes.thalamus.dispose();
      fallbackMeshes.hippocampus.dispose();
      fallbackMeshes.cerebellum.dispose();
      fallbackMeshes.brainstem.dispose();
    };
  }, [fallbackMeshes]);

  const thalamocorticalGeo = useMemo(() => {
    const origin = new THREE.Vector3(0, -0.04, -0.05);
    const targets: Array<[number, number, number]> = [
      [0.45, 0.35, 0.98],
      [-0.45, 0.35, 0.98],
      [0.18, 0.12, 1.18],
      [-0.18, 0.12, 1.18],
      [0.68, 0.62, 0.12],
      [-0.68, 0.62, 0.12],
      [0.72, 0.42, -0.78],
      [-0.72, 0.42, -0.78],
      [0.22, 0.08, -1.18],
      [-0.22, 0.08, -1.18],
      [0.82, -0.18, -0.15],
      [-0.82, -0.18, -0.15],
    ];
    const pts: number[] = [];
    for (const [tx, ty, tz] of targets) {
      pts.push(origin.x, origin.y, origin.z, tx, ty, tz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useEffect(() => {
    return () => {
      thalamocorticalGeo.dispose();
    };
  }, [thalamocorticalGeo]);

  const cortexUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSulcalPulse: { value: 0.85 },
      uPfcHighlight: { value: 0 },
      uDmnHighlight: { value: 0 },
      uDmnDesync: { value: 0 },
      uGlassFactor: { value: 0 },
      uMicroDiveFade: { value: 0 },
      uHyperConnect: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (!isActiveRef.current) return;
    const t = reducedMotion ? clock.getElapsedTime() * 0.25 : clock.getElapsedTime();
    const p = progressRef.current;

    const sulcalOverview = rangeWeight(p, 0.04, 0.25, 0.04, 0.05);
    const pfcW = rangeWeight(p, 0.26, 0.36, 0.035, 0.035);
    const thalamusW = rangeWeight(p, 0.37, 0.47, 0.035, 0.035);
    const dmnW = rangeWeight(p, 0.48, 0.57, 0.035, 0.035);
    const dmnDesync = smoothstep(0.50, 0.57, p);
    const microDiveW = rangeWeight(p, 0.59, 0.80, 0.035, 0.04);
    const hyperConnectW = rangeWeight(p, 0.81, 1.0, 0.045, 0.02);

    const glassFactor = clamp(
      Math.max(thalamusW * 0.95, dmnW * 0.74, hyperConnectW * 0.78, pfcW * 0.32),
      0,
      1
    );

    if (cortexMatRef.current) {
      const u = cortexMatRef.current.uniforms;
      u.uTime.value = t;
      u.uSulcalPulse.value = 0.25 + sulcalOverview * 0.95;
      u.uPfcHighlight.value = pfcW;
      u.uDmnHighlight.value = dmnW;
      u.uDmnDesync.value = dmnDesync;
      u.uGlassFactor.value = glassFactor;
      u.uMicroDiveFade.value = microDiveW;
      u.uHyperConnect.value = hyperConnectW;
    }

    if (thalamusMatRef.current) {
      const activeThal = Math.max(thalamusW, hyperConnectW * 0.45);
      thalamusMatRef.current.emissiveIntensity = 0.3 + activeThal * 2.6;
      thalamusMatRef.current.opacity = (0.35 + activeThal * 0.62) * (1 - microDiveW * 0.9);
    }

    if (thalamoLinesRef.current) {
      const mat = thalamoLinesRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = thalamusW * 0.75 * (1 - microDiveW);
      thalamoLinesRef.current.visible = mat.opacity > 0.01;
    }

    if (hippoMatRef.current) {
      const activeHippo = Math.max(dmnW * 0.9, hyperConnectW * 0.4);
      hippoMatRef.current.emissiveIntensity = 0.25 + activeHippo * 2.0;
      hippoMatRef.current.opacity = (0.28 + activeHippo * 0.6) * (1 - microDiveW * 0.9);
    }

    if (cerebellumMatRef.current) {
      cerebellumMatRef.current.opacity = (0.82 - glassFactor * 0.52) * (1 - microDiveW * 0.9);
    }

    if (exitCapillaryRef.current) {
      const exitFade = 1 - smoothstep(0.01, 0.11, p);
      exitCapillaryRef.current.visible = exitFade > 0.01;
      exitCapillaryRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          (child.material as THREE.Material & { opacity: number }).opacity = exitFade * 0.5;
        }
      });
    }
  });

  const meshes = glbMeshes ?? fallbackMeshes;

  return (
    <group>
      {/* Boca recuante do capilar cerebral pial em p=0.00..0.11 (saída contínua do vaso da Cena 04) */}
      <group ref={exitCapillaryRef} position={[0, -0.58, 2.25]}>
        <mesh rotation={[Math.PI * 0.5, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.52, 1.35, 26, 1, true]} />
          <meshStandardMaterial
            color="#19214a"
            emissive="#38bdf8"
            emissiveIntensity={0.75}
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, -0.55]}>
          <torusGeometry args={[0.42, 0.018, 10, 36]} />
          <meshBasicMaterial
            color="#67e8f9"
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <mesh geometry={meshes.thalamus} renderOrder={1}>
        <meshStandardMaterial
          ref={thalamusMatRef}
          color="#fbbf24"
          emissive="#f59e0b"
          emissiveIntensity={0.35}
          roughness={0.28}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <lineSegments ref={thalamoLinesRef} geometry={thalamocorticalGeo} renderOrder={2}>
        <lineBasicMaterial
          color="#fde047"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      <mesh geometry={meshes.hippocampus} renderOrder={1}>
        <meshStandardMaterial
          ref={hippoMatRef}
          color="#e879f9"
          emissive="#c084fc"
          emissiveIntensity={0.25}
          roughness={0.32}
          transparent
          opacity={0.35}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh geometry={meshes.cerebellum} renderOrder={1}>
        <meshStandardMaterial
          ref={cerebellumMatRef}
          color="#5c4252"
          emissive="#1a1630"
          emissiveIntensity={0.3}
          roughness={0.55}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={meshes.brainstem} renderOrder={1}>
        <meshStandardMaterial
          color="#4f3b4c"
          emissive="#16142b"
          emissiveIntensity={0.25}
          roughness={0.55}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={meshes.cortex} renderOrder={3}>
        <shaderMaterial
          ref={cortexMatRef}
          vertexShader={corticalSurfaceVertexShader}
          fragmentShader={corticalSurfaceFragmentShader}
          uniforms={cortexUniforms}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
