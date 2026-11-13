import { useLayoutEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { erythrocyteFragmentShader, erythrocyteVertexShader } from './shaders';
import { VESSEL_RADIUS } from './splineData';
import { useManagedDisposable } from './useSceneResources';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Equação fisiológica de Evans & Fung (1972) para a geometria bicôncava das hemácias:
 *   z(r) = 0.52 * sqrt(1 - r^2) * (0.207 + 2.003 r^2 - 1.123 r^4)
 */
function createBiconcaveErythrocyteGeometry(radialSegments = 16, ringSegments = 7): THREE.BufferGeometry {
  const c0 = 0.207;
  const c2 = 2.003;
  const c4 = -1.123;

  const profileZ = (r: number): number => {
    const rClamped = Math.min(0.9999, Math.max(0, r));
    const root = Math.sqrt(1 - rClamped * rClamped);
    const r2 = rClamped * rClamped;
    return 0.52 * root * (c0 + c2 * r2 + c4 * r2 * r2);
  };

  const positions: number[] = [0, profileZ(0), 0, 0, -profileZ(0), 0];
  const indices: number[] = [];

  for (let ring = 1; ring <= ringSegments; ring++) {
    const t = ring / ringSegments;
    const r = Math.sin(t * Math.PI * 0.5);
    const yHalf = ring === ringSegments ? 0 : profileZ(r);

    for (let seg = 0; seg < radialSegments; seg++) {
      const phi = (seg / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(phi), yHalf, r * Math.sin(phi));
    }
    if (ring < ringSegments) {
      for (let seg = 0; seg < radialSegments; seg++) {
        const phi = (seg / radialSegments) * Math.PI * 2;
        positions.push(r * Math.cos(phi), -yHalf, r * Math.sin(phi));
      }
    }
  }

  const topRingStart = (ring: number): number => {
    if (ring === 0) return 0;
    if (ring === ringSegments) return 2 + (ringSegments - 1) * 2 * radialSegments;
    return 2 + (ring - 1) * 2 * radialSegments;
  };

  const botRingStart = (ring: number): number => {
    if (ring === 0) return 1;
    if (ring === ringSegments) return 2 + (ringSegments - 1) * 2 * radialSegments;
    return 2 + (ring - 1) * 2 * radialSegments + radialSegments;
  };

  for (let seg = 0; seg < radialSegments; seg++) {
    const next = (seg + 1) % radialSegments;
    indices.push(0, topRingStart(1) + next, topRingStart(1) + seg);
    indices.push(1, botRingStart(1) + seg, botRingStart(1) + next);
  }

  for (let ring = 1; ring < ringSegments; ring++) {
    const tCur = topRingStart(ring);
    const tNxt = topRingStart(ring + 1);
    const bCur = botRingStart(ring);
    const bNxt = botRingStart(ring + 1);
    for (let seg = 0; seg < radialSegments; seg++) {
      const next = (seg + 1) % radialSegments;
      indices.push(tCur + seg, tCur + next, tNxt + seg);
      indices.push(tCur + next, tNxt + next, tNxt + seg);
      indices.push(bCur + seg, bNxt + seg, bCur + next);
      indices.push(bCur + next, bNxt + seg, bNxt + next);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createLeukocyteGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.30, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ruffle = 1.0 + 0.08 * Math.sin(x * 19.0 + y * 13.0) + 0.06 * Math.cos(y * 23.0 - z * 17.0);
    pos.setXYZ(i, x * ruffle, y * ruffle, z * ruffle);
  }
  geo.computeVertexNormals();
  return geo;
}

interface FrameSample {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  binormal: THREE.Vector3;
}

function buildSplineLookupTable(spline: THREE.CatmullRomCurve3, samples = 512): FrameSample[] {
  const frames = spline.computeFrenetFrames(samples - 1, false);
  const pts = spline.getSpacedPoints(samples - 1);
  return Array.from({ length: samples }, (_, i) => ({
    pos: pts[i],
    normal: frames.normals[i],
    binormal: frames.binormals[i],
  }));
}

interface BloodCellsProps {
  spline: THREE.CatmullRomCurve3;
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  velocityRef: MutableRefObject<number>;
  heartbeatRef: MutableRefObject<number>;
  fogColorRef: MutableRefObject<THREE.Color>;
  fogDensityRef: MutableRefObject<number>;
  erythrocyteCount: number;
  leukocyteCount: number;
  psilocinCount: number;
  plasmaCount: number;
  reducedMotion: boolean;
}

export function BloodCells({
  spline,
  isActiveRef,
  progressRef,
  velocityRef,
  heartbeatRef,
  fogColorRef,
  fogDensityRef,
  erythrocyteCount,
  leukocyteCount,
  psilocinCount,
  plasmaCount,
  reducedMotion,
}: BloodCellsProps) {
  const rbcMeshRef = useRef<THREE.InstancedMesh>(null);
  const wbcMeshRef = useRef<THREE.InstancedMesh>(null);
  const molCoreRef = useRef<THREE.InstancedMesh>(null);
  const molHaloRef = useRef<THREE.InstancedMesh>(null);
  const flowPhaseRef = useRef(0);

  const lookup = useMemo(() => buildSplineLookupTable(spline, 512), [spline]);

  const resources = useManagedDisposable(
    () => {
      const rbcGeo = createBiconcaveErythrocyteGeometry(16, 7);
      const meta = new Float32Array(erythrocyteCount * 3);
      for (let i = 0; i < erythrocyteCount; i++) {
        meta[i * 3] = (i * 0.6180339887) % 1;
        meta[i * 3 + 1] = (i * 0.381966) % 1;
        meta[i * 3 + 2] = 1.0;
      }
      rbcGeo.setAttribute('aCellMeta', new THREE.InstancedBufferAttribute(meta, 3));

      const rbcMat = new THREE.ShaderMaterial({
        vertexShader: erythrocyteVertexShader,
        fragmentShader: erythrocyteFragmentShader,
        uniforms: {
          uProgress: { value: 0 },
          uHeartbeat: { value: 0 },
          uMotionStretch: { value: 0 },
          uLightDir: { value: new THREE.Vector3(0.3, 0.7, 0.6).normalize() },
          uFogColor: { value: new THREE.Color('#0a0403') },
          uFogDensity: { value: 0.055 },
        },
      });

      const wbcGeo = createLeukocyteGeometry();
      const wbcMat = new THREE.MeshStandardMaterial({
        color: '#d4e0f5',
        emissive: '#32416b',
        emissiveIntensity: 0.42,
        roughness: 0.38,
        transparent: true,
        opacity: 0.85,
      });

      const molCoreGeo = new THREE.OctahedronGeometry(0.068, 1);
      const molCoreMat = new THREE.MeshBasicMaterial({ toneMapped: false });

      const molHaloGeo = new THREE.SphereGeometry(0.165, 12, 12);
      const molHaloMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const positions = new Float32Array(plasmaCount * 3);
      for (let i = 0; i < plasmaCount; i++) {
        const s = ((i * 97531) % 10000) / 10000;
        const frame = lookup[Math.min(lookup.length - 1, Math.floor(s * (lookup.length - 1)))];
        const r = (0.1 + 0.82 * (((i * 31337) % 1000) / 1000)) * (VESSEL_RADIUS - 0.24);
        const ang = i * 2.39996;
        const cosA = Math.cos(ang) * r;
        const sinA = Math.sin(ang) * r;
        positions[i * 3] = frame.pos.x + frame.normal.x * cosA + frame.binormal.x * sinA;
        positions[i * 3 + 1] = frame.pos.y + frame.normal.y * cosA + frame.binormal.y * sinA;
        positions[i * 3 + 2] = frame.pos.z + frame.normal.z * cosA + frame.binormal.z * sinA;
      }
      const plasmaGeo = new THREE.BufferGeometry();
      plasmaGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const plasmaMat = new THREE.PointsMaterial({
        color: '#f6c177',
        size: 0.045,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      return {
        rbcGeo,
        rbcMat,
        wbcGeo,
        wbcMat,
        molCoreGeo,
        molCoreMat,
        molHaloGeo,
        molHaloMat,
        plasmaGeo,
        plasmaMat,
      };
    },
    (res) => {
      res.rbcGeo.dispose();
      res.rbcMat.dispose();
      res.wbcGeo.dispose();
      res.wbcMat.dispose();
      res.molCoreGeo.dispose();
      res.molCoreMat.dispose();
      res.molHaloGeo.dispose();
      res.molHaloMat.dispose();
      res.plasmaGeo.dispose();
      res.plasmaMat.dispose();
    },
    [erythrocyteCount, plasmaCount, lookup]
  );

  const rbcSeeds = useMemo(
    () =>
      Array.from({ length: erythrocyteCount }, (_, i) => {
        const u1 = ((i * 73856093) % 10000) / 10000;
        const u2 = ((i * 19349663) % 10000) / 10000;
        const u3 = ((i * 83492791) % 10000) / 10000;
        return {
          baseS: u1 * 0.905,
          radialFrac: 0.15 + 0.67 * Math.sqrt(u2),
          angle: u3 * Math.PI * 2,
          scale: 0.21 + (0.08 * ((i * 17) % 10)) / 10,
          spinSpeed: (0.6 + (i % 7) * 0.22) * (i % 2 === 0 ? 1 : -1),
          phase: u3 * Math.PI * 2,
        };
      }),
    [erythrocyteCount]
  );

  const wbcSeeds = useMemo(
    () =>
      Array.from({ length: leukocyteCount }, (_, i) => ({
        baseS: 0.04 + (((i * 2654435761) % 10000) / 10000) * 0.85,
        radialFrac: 0.62 + (i % 4) * 0.055,
        angle: ((i * 137.508) * Math.PI) / 180,
        scale: 0.82 + (i % 5) * 0.08,
        phase: i * 1.1,
      })),
    [leukocyteCount]
  );

  const molSeeds = useMemo(
    () =>
      Array.from({ length: psilocinCount }, (_, i) => ({
        baseS: ((i * 49979687) % 10000) / 10000,
        radialFrac: 0.07 + 0.48 * (((i * 67867967) % 10000) / 10000),
        angle: i * 2.39996,
        helixSpeed: 1.1 + (i % 5) * 0.24,
        scale: 0.82 + (i % 4) * 0.15,
      })),
    [psilocinCount]
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const prodrugColor = useMemo(() => new THREE.Color('#9f67ff').multiplyScalar(1.6), []);
  const psilocinColor = useMemo(() => new THREE.Color('#2dd4bf').multiplyScalar(1.9), []);
  const bbbFlashColor = useMemo(() => new THREE.Color('#7dd3fc').multiplyScalar(2.1), []);

  useLayoutEffect(() => {
    if (!resources) return;
    if (rbcMeshRef.current) rbcMeshRef.current.frustumCulled = false;
    if (wbcMeshRef.current) wbcMeshRef.current.frustumCulled = false;
    if (molCoreRef.current) {
      molCoreRef.current.frustumCulled = false;
      for (let i = 0; i < psilocinCount; i++) {
        molCoreRef.current.setColorAt(i, prodrugColor);
      }
      if (molCoreRef.current.instanceColor) molCoreRef.current.instanceColor.needsUpdate = true;
    }
    if (molHaloRef.current) {
      molHaloRef.current.frustumCulled = false;
      for (let i = 0; i < psilocinCount; i++) {
        molHaloRef.current.setColorAt(i, prodrugColor);
      }
      if (molHaloRef.current.instanceColor) molHaloRef.current.instanceColor.needsUpdate = true;
    }
  }, [resources, psilocinCount, prodrugColor]);

  useFrame(({ clock }, delta) => {
    if (!isActiveRef.current || !resources) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    const p = progressRef.current;
    const hb = heartbeatRef.current;
    const vel = Math.abs(velocityRef.current);

    const motionFactor = reducedMotion ? 0.15 : 1.0;
    flowPhaseRef.current += dt * (0.014 + hb * 0.022) * motionFactor;
    const flowPhase = flowPhaseRef.current;

    resources.rbcMat.uniforms.uProgress.value = p;
    resources.rbcMat.uniforms.uHeartbeat.value = hb;
    resources.rbcMat.uniforms.uMotionStretch.value = reducedMotion
      ? 0
      : Math.min(1.5, vel * 1.3 + hb * 0.35);
    resources.rbcMat.uniforms.uFogColor.value.copy(fogColorRef.current);
    resources.rbcMat.uniforms.uFogDensity.value = fogDensityRef.current;

    const sampleFrame = (s: number): FrameSample => {
      const idx = Math.floor(Math.min(0.9999, Math.max(0, s)) * (lookup.length - 1));
      return lookup[idx];
    };

    const rbcMesh = rbcMeshRef.current;
    if (rbcMesh) {
      for (let i = 0; i < erythrocyteCount; i++) {
        const seed = rbcSeeds[i];
        const poiseuille = 1.18 - 0.65 * seed.radialFrac * seed.radialFrac;
        const s = (seed.baseS + flowPhase * poiseuille) % 0.908;
        const frame = sampleFrame(s);
        const narrow = smoothstep(0.76, 0.96, s) * 0.34;
        const effR = (VESSEL_RADIUS - narrow - 0.25) * seed.radialFrac;
        const swirl = seed.angle + (reducedMotion ? 0 : s * 4.2);
        const cosA = Math.cos(swirl) * effR;
        const sinA = Math.sin(swirl) * effR;

        dummy.position.set(
          frame.pos.x + frame.normal.x * cosA + frame.binormal.x * sinA,
          frame.pos.y + frame.normal.y * cosA + frame.binormal.y * sinA,
          frame.pos.z + frame.normal.z * cosA + frame.binormal.z * sinA
        );
        const spin = reducedMotion ? seed.phase : seed.phase + t * seed.spinSpeed;
        dummy.rotation.set(spin * 0.8, spin * 1.1, seed.angle);
        dummy.scale.setScalar(seed.scale);
        dummy.updateMatrix();
        rbcMesh.setMatrixAt(i, dummy.matrix);
      }
      rbcMesh.instanceMatrix.needsUpdate = true;
    }

    const wbcMesh = wbcMeshRef.current;
    if (wbcMesh) {
      for (let i = 0; i < leukocyteCount; i++) {
        const seed = wbcSeeds[i];
        const s = 0.03 + ((seed.baseS + flowPhase * 0.35) % 0.86);
        const frame = sampleFrame(s);
        const narrow = smoothstep(0.76, 0.96, s) * 0.34;
        const effR = (VESSEL_RADIUS - narrow - 0.30) * seed.radialFrac;
        const cosA = Math.cos(seed.angle) * effR;
        const sinA = Math.sin(seed.angle) * effR;

        dummy.position.set(
          frame.pos.x + frame.normal.x * cosA + frame.binormal.x * sinA,
          frame.pos.y + frame.normal.y * cosA + frame.binormal.y * sinA,
          frame.pos.z + frame.normal.z * cosA + frame.binormal.z * sinA
        );
        const rot = reducedMotion ? seed.phase : seed.phase + t * 0.32;
        dummy.rotation.set(rot, rot * 0.7, 0);
        dummy.scale.setScalar(seed.scale);
        dummy.updateMatrix();
        wbcMesh.setMatrixAt(i, dummy.matrix);
      }
      wbcMesh.instanceMatrix.needsUpdate = true;
    }

    const coreMesh = molCoreRef.current;
    const haloMesh = molHaloRef.current;
    if (coreMesh && haloMesh) {
      const companionLimit = Math.floor(psilocinCount * 0.42);
      for (let i = 0; i < psilocinCount; i++) {
        const seed = molSeeds[i];
        let s: number;
        if (i < companionLimit) {
          const localOffset = ((i / companionLimit) * 0.13 + flowPhase * 0.45) % 0.13;
          s = Math.min(0.998, Math.max(0.004, p - 0.012 + localOffset));
        } else {
          s = (seed.baseS + flowPhase * 1.12) % 0.998;
        }

        const frame = sampleFrame(s);
        const narrow = smoothstep(0.76, 0.96, s) * 0.34;
        const rad = (VESSEL_RADIUS - narrow - 0.34) * seed.radialFrac;
        const helAng = seed.angle + (reducedMotion ? 0 : t * seed.helixSpeed + s * 14.0);
        const cosA = Math.cos(helAng) * rad;
        const sinA = Math.sin(helAng) * rad;

        dummy.position.set(
          frame.pos.x + frame.normal.x * cosA + frame.binormal.x * sinA,
          frame.pos.y + frame.normal.y * cosA + frame.binormal.y * sinA,
          frame.pos.z + frame.normal.z * cosA + frame.binormal.z * sinA
        );

        const conversion = smoothstep(0.20, 0.35, s);
        const bbbBoost = smoothstep(0.85, 0.95, s);
        tmpColor.copy(prodrugColor).lerp(psilocinColor, conversion).lerp(bbbFlashColor, bbbBoost * 0.5);

        const shimmer = reducedMotion ? 1.0 : 0.88 + 0.25 * Math.sin(t * 4.4 + i);
        dummy.rotation.set(t * 1.4 + i, t * 1.9, 0);
        dummy.scale.setScalar(seed.scale * shimmer);
        dummy.updateMatrix();
        coreMesh.setMatrixAt(i, dummy.matrix);
        coreMesh.setColorAt(i, tmpColor);

        dummy.scale.setScalar(seed.scale * shimmer * (1.28 + 0.42 * conversion + 0.38 * bbbBoost));
        dummy.updateMatrix();
        haloMesh.setMatrixAt(i, dummy.matrix);
        haloMesh.setColorAt(i, tmpColor);
      }
      coreMesh.instanceMatrix.needsUpdate = true;
      if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;
      haloMesh.instanceMatrix.needsUpdate = true;
      if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true;
    }
  });

  if (!resources) return null;

  return (
    <group>
      <instancedMesh
        ref={rbcMeshRef}
        args={[resources.rbcGeo, resources.rbcMat, erythrocyteCount]}
      />
      <instancedMesh
        ref={wbcMeshRef}
        args={[resources.wbcGeo, resources.wbcMat, leukocyteCount]}
      />
      <instancedMesh
        ref={molCoreRef}
        args={[resources.molCoreGeo, resources.molCoreMat, psilocinCount]}
      />
      <instancedMesh
        ref={molHaloRef}
        args={[resources.molHaloGeo, resources.molHaloMat, psilocinCount]}
      />
      <points args={[resources.plasmaGeo, resources.plasmaMat]} />
    </group>
  );
}
