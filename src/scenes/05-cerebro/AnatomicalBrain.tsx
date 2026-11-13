import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { useFrame } from '@react-three/fiber';
import { corticalSurfaceFragmentShader, corticalSurfaceVertexShader } from './shaders';
import { clamp, rangeWeight, smoothstep } from './cameraKeyframes';
import { useManagedDisposable } from './useSceneResources';

export interface BrainGeometries {
  cortex: THREE.BufferGeometry;
  thalamus: THREE.BufferGeometry;
  hippocampus: THREE.BufferGeometry;
  cerebellum: THREE.BufferGeometry;
  brainstem: THREE.BufferGeometry;
}

export const EXPECTED_BRAIN_MESH_NAMES = [
  'CerebralCortex',
  'Thalamus',
  'Hippocampus',
  'Cerebellum',
  'Brainstem',
] as const;

type ExpectedBrainMeshName = (typeof EXPECTED_BRAIN_MESH_NAMES)[number];

interface GeometrySnapshot {
  position: Float32Array;
  normal: Float32Array | null;
  color: Float32Array | null;
  colorItemSize: number;
  index: Uint32Array | Uint16Array | null;
}

type BrainSnapshotMap = Partial<Record<ExpectedBrainMeshName, GeometrySnapshot>>;

function snapshotBufferGeometry(geo: THREE.BufferGeometry): GeometrySnapshot {
  const posAttr = geo.getAttribute('position');
  const normAttr = geo.getAttribute('normal');
  const colAttr = geo.getAttribute('color');
  const idxAttr = geo.getIndex();

  const toFloat32 = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array => {
    if (attr.array instanceof Float32Array) {
      return attr.array.slice();
    }
    const out = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      for (let k = 0; k < attr.itemSize; k++) {
        out[i * attr.itemSize + k] = attr.getComponent(i, k);
      }
    }
    return out;
  };

  let indexCopy: Uint32Array | Uint16Array | null = null;
  if (idxAttr) {
    if (idxAttr.array instanceof Uint32Array) indexCopy = idxAttr.array.slice();
    else if (idxAttr.array instanceof Uint16Array) indexCopy = idxAttr.array.slice();
    else indexCopy = Uint32Array.from(idxAttr.array as ArrayLike<number>);
  }

  return {
    position: toFloat32(posAttr),
    normal: normAttr ? toFloat32(normAttr) : null,
    color: colAttr ? toFloat32(colAttr) : null,
    colorItemSize: colAttr ? colAttr.itemSize : 4,
    index: indexCopy,
  };
}

function hydrateGeometrySnapshot(snap: GeometrySnapshot): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(snap.position.slice(), 3));
  if (snap.normal) {
    geo.setAttribute('normal', new THREE.BufferAttribute(snap.normal.slice(), 3));
  }
  if (snap.color) {
    geo.setAttribute('color', new THREE.BufferAttribute(snap.color.slice(), snap.colorItemSize));
  }
  if (snap.index) {
    geo.setIndex(new THREE.BufferAttribute(snap.index.slice(), 1));
  }
  if (!snap.normal) {
    geo.computeVertexNormals();
  }
  return geo;
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

function resolveExpectedMeshName(obj: THREE.Object3D): ExpectedBrainMeshName | null {
  const candidates = [obj.name, obj.parent?.name, obj.userData?.name];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw) continue;
    for (const expected of EXPECTED_BRAIN_MESH_NAMES) {
      if (raw === expected || raw.toLowerCase() === expected.toLowerCase()) {
        return expected;
      }
    }
  }
  return null;
}

let cachedBrainSnapshots: BrainSnapshotMap | null = null;
let pendingSnapshotsPromise: Promise<BrainSnapshotMap | null> | null = null;

function lazyLoadCompressedBrainSnapshots(): Promise<BrainSnapshotMap | null> {
  if (cachedBrainSnapshots) return Promise.resolve(cachedBrainSnapshots);
  if (pendingSnapshotsPromise) return pendingSnapshotsPromise;

  pendingSnapshotsPromise = MeshoptDecoder.ready
    .then(
      () =>
        new Promise<BrainSnapshotMap | null>((resolve) => {
          const loader = new GLTFLoader();
          loader.setMeshoptDecoder(MeshoptDecoder);

          const draco = new DRACOLoader();
          draco.setDecoderPath('/draco/');
          loader.setDRACOLoader(draco);

          loader.load(
            '/assets/05-cerebro/brain.glb',
            (gltf) => {
              draco.dispose();
              const snapshots: BrainSnapshotMap = {};
              const disposedTempGeos = new Set<THREE.BufferGeometry>();
              const disposedTempMats = new Set<THREE.Material>();

              gltf.scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh && obj.geometry) {
                  const matchedName = resolveExpectedMeshName(obj);
                  if (matchedName && !snapshots[matchedName]) {
                    snapshots[matchedName] = snapshotBufferGeometry(obj.geometry);
                  }
                  if (!disposedTempGeos.has(obj.geometry)) {
                    disposedTempGeos.add(obj.geometry);
                    obj.geometry.dispose();
                  }
                  const mats = Array.isArray(obj.material)
                    ? obj.material
                    : obj.material
                      ? [obj.material]
                      : [];
                  for (const m of mats) {
                    if (!disposedTempMats.has(m)) {
                      disposedTempMats.add(m);
                      m.dispose();
                    }
                  }
                }
              });

              const missing = EXPECTED_BRAIN_MESH_NAMES.filter((name) => !snapshots[name]);
              if (!snapshots.CerebralCortex) {
                pendingSnapshotsPromise = null;
                console.warn(
                  '[05-cerebro] Procedural fallback brain active: /assets/05-cerebro/brain.glb did not contain CerebralCortex. Missing:',
                  missing
                );
                resolve(null);
                return;
              }

              if (missing.length > 0) {
                console.warn(
                  '[05-cerebro] /assets/05-cerebro/brain.glb loaded partially; using procedural fallback for missing meshes:',
                  missing
                );
              } else {
                console.info(
                  '[05-cerebro] Loaded /assets/05-cerebro/brain.glb — matched all expected meshes:',
                  EXPECTED_BRAIN_MESH_NAMES
                );
              }

              cachedBrainSnapshots = snapshots;
              resolve(snapshots);
            },
            undefined,
            (error) => {
              draco.dispose();
              pendingSnapshotsPromise = null;
              console.warn(
                '[05-cerebro] Failed to load /assets/05-cerebro/brain.glb; keeping procedural fallback brain.',
                error
              );
              resolve(null);
            }
          );
        })
    )
    .catch((error) => {
      pendingSnapshotsPromise = null;
      console.warn(
        '[05-cerebro] MeshoptDecoder error; keeping procedural fallback brain.',
        error
      );
      return null;
    });

  return pendingSnapshotsPromise;
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
  const [snapshots, setSnapshots] = useState<BrainSnapshotMap | null>(() => cachedBrainSnapshots);

  const fallbackLoggedRef = useRef(false);
  const thalamoLinesRef = useRef<THREE.LineSegments>(null);
  const exitCapillaryRef = useRef<THREE.Group>(null);

  const fallbackMeshes = useManagedDisposable(
    () => buildProceduralFallbackBrain(),
    (res) => {
      res.cortex.dispose();
      res.thalamus.dispose();
      res.hippocampus.dispose();
      res.cerebellum.dispose();
      res.brainstem.dispose();
    },
    []
  );

  const glbMeshes = useManagedDisposable(
    () => {
      if (!snapshots?.CerebralCortex) return null;
      return {
        cortex: hydrateGeometrySnapshot(snapshots.CerebralCortex),
        thalamus: snapshots.Thalamus ? hydrateGeometrySnapshot(snapshots.Thalamus) : null,
        hippocampus: snapshots.Hippocampus ? hydrateGeometrySnapshot(snapshots.Hippocampus) : null,
        cerebellum: snapshots.Cerebellum ? hydrateGeometrySnapshot(snapshots.Cerebellum) : null,
        brainstem: snapshots.Brainstem ? hydrateGeometrySnapshot(snapshots.Brainstem) : null,
      };
    },
    (res) => {
      if (!res) return;
      res.cortex.dispose();
      res.thalamus?.dispose();
      res.hippocampus?.dispose();
      res.cerebellum?.dispose();
      res.brainstem?.dispose();
    },
    [snapshots]
  );

  const materials = useManagedDisposable(
    () => {
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
      const thalamocorticalGeo = new THREE.BufferGeometry();
      thalamocorticalGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));

      const thalamoLineMat = new THREE.LineBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const capCylGeo = new THREE.CylinderGeometry(0.42, 0.52, 1.35, 26, 1, true);
      const capCylMat = new THREE.MeshStandardMaterial({
        color: '#19214a',
        emissive: '#38bdf8',
        emissiveIntensity: 0.75,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });

      const capRingGeo = new THREE.TorusGeometry(0.42, 0.018, 10, 36);
      const capRingMat = new THREE.MeshBasicMaterial({
        color: '#67e8f9',
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const thalamusMat = new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#f59e0b',
        emissiveIntensity: 0.35,
        roughness: 0.28,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        toneMapped: false,
      });

      const hippoMat = new THREE.MeshStandardMaterial({
        color: '#e879f9',
        emissive: '#c084fc',
        emissiveIntensity: 0.25,
        roughness: 0.32,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        toneMapped: false,
      });

      const cerebellumMat = new THREE.MeshStandardMaterial({
        color: '#5c4252',
        emissive: '#1a1630',
        emissiveIntensity: 0.3,
        roughness: 0.55,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });

      const brainstemMat = new THREE.MeshStandardMaterial({
        color: '#4f3b4c',
        emissive: '#16142b',
        emissiveIntensity: 0.25,
        roughness: 0.55,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });

      const cortexMat = new THREE.ShaderMaterial({
        vertexShader: corticalSurfaceVertexShader,
        fragmentShader: corticalSurfaceFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSulcalPulse: { value: 0.85 },
          uPfcHighlight: { value: 0 },
          uDmnHighlight: { value: 0 },
          uDmnDesync: { value: 0 },
          uGlassFactor: { value: 0 },
          uMicroDiveFade: { value: 0 },
          uHyperConnect: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
      });

      return {
        thalamocorticalGeo,
        thalamoLineMat,
        capCylGeo,
        capCylMat,
        capRingGeo,
        capRingMat,
        thalamusMat,
        hippoMat,
        cerebellumMat,
        brainstemMat,
        cortexMat,
      };
    },
    (res) => {
      res.thalamocorticalGeo.dispose();
      res.thalamoLineMat.dispose();
      res.capCylGeo.dispose();
      res.capCylMat.dispose();
      res.capRingGeo.dispose();
      res.capRingMat.dispose();
      res.thalamusMat.dispose();
      res.hippoMat.dispose();
      res.cerebellumMat.dispose();
      res.brainstemMat.dispose();
      res.cortexMat.dispose();
    },
    []
  );

  useLayoutEffect(() => {
    onGlbLoadedChange?.(Boolean(snapshots?.CerebralCortex));
  }, [snapshots, onGlbLoadedChange]);

  useEffect(() => {
    let active = true;
    if (!cachedBrainSnapshots && !fallbackLoggedRef.current) {
      fallbackLoggedRef.current = true;
      console.info(
        '[05-cerebro] Using procedural fallback brain while lazy-loading /assets/05-cerebro/brain.glb'
      );
    }

    lazyLoadCompressedBrainSnapshots().then((res) => {
      if (!active) return;
      if (res?.CerebralCortex) {
        setSnapshots(res);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useFrame(({ clock }) => {
    if (!isActiveRef.current || !materials) return;
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

    const u = materials.cortexMat.uniforms;
    u.uTime.value = t;
    u.uSulcalPulse.value = 0.25 + sulcalOverview * 0.95;
    u.uPfcHighlight.value = pfcW;
    u.uDmnHighlight.value = dmnW;
    u.uDmnDesync.value = dmnDesync;
    u.uGlassFactor.value = glassFactor;
    u.uMicroDiveFade.value = microDiveW;
    u.uHyperConnect.value = hyperConnectW;

    const activeThal = Math.max(thalamusW, hyperConnectW * 0.45);
    materials.thalamusMat.emissiveIntensity = 0.3 + activeThal * 2.6;
    materials.thalamusMat.opacity = (0.35 + activeThal * 0.62) * (1 - microDiveW * 0.9);

    materials.thalamoLineMat.opacity = thalamusW * 0.75 * (1 - microDiveW);
    if (thalamoLinesRef.current) {
      thalamoLinesRef.current.visible = materials.thalamoLineMat.opacity > 0.01;
    }

    const activeHippo = Math.max(dmnW * 0.9, hyperConnectW * 0.4);
    materials.hippoMat.emissiveIntensity = 0.25 + activeHippo * 2.0;
    materials.hippoMat.opacity = (0.28 + activeHippo * 0.6) * (1 - microDiveW * 0.9);

    materials.cerebellumMat.opacity = (0.82 - glassFactor * 0.52) * (1 - microDiveW * 0.9);

    const exitFade = 1 - smoothstep(0.01, 0.11, p);
    materials.capCylMat.opacity = exitFade * 0.5;
    materials.capRingMat.opacity = exitFade * 0.65;
    if (exitCapillaryRef.current) {
      exitCapillaryRef.current.visible = exitFade > 0.01;
    }
  });

  if (!fallbackMeshes || !materials) return null;

  const cortexGeo = glbMeshes?.cortex ?? fallbackMeshes.cortex;
  const thalamusGeo = glbMeshes?.thalamus ?? fallbackMeshes.thalamus;
  const hippocampusGeo = glbMeshes?.hippocampus ?? fallbackMeshes.hippocampus;
  const cerebellumGeo = glbMeshes?.cerebellum ?? fallbackMeshes.cerebellum;
  const brainstemGeo = glbMeshes?.brainstem ?? fallbackMeshes.brainstem;

  return (
    <group>
      <group ref={exitCapillaryRef} position={[0, -0.58, 2.25]}>
        <mesh args={[materials.capCylGeo, materials.capCylMat]} rotation={[Math.PI * 0.5, 0, 0]} />
        <mesh args={[materials.capRingGeo, materials.capRingMat]} position={[0, 0, -0.55]} />
      </group>

      <mesh args={[thalamusGeo, materials.thalamusMat]} renderOrder={1} />

      <lineSegments
        ref={thalamoLinesRef}
        args={[materials.thalamocorticalGeo, materials.thalamoLineMat]}
        renderOrder={2}
      />

      <mesh args={[hippocampusGeo, materials.hippoMat]} renderOrder={1} />
      <mesh args={[cerebellumGeo, materials.cerebellumMat]} renderOrder={1} />
      <mesh args={[brainstemGeo, materials.brainstemMat]} renderOrder={1} />
      <mesh args={[cortexGeo, materials.cortexMat]} renderOrder={3} />
    </group>
  );
}
