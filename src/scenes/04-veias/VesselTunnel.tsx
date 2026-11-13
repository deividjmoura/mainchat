import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  bbbMembraneFragmentShader,
  bbbMembraneVertexShader,
  vesselWallFragmentShader,
  vesselWallVertexShader,
} from './shaders';
import { VESSEL_RADIUS } from './splineData';
import { useManagedDisposable } from './useSceneResources';

interface VesselTunnelProps {
  spline: THREE.CatmullRomCurve3;
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  heartbeatRef: MutableRefObject<number>;
  fogColorRef: MutableRefObject<THREE.Color>;
  fogDensityRef: MutableRefObject<number>;
  reducedMotion: boolean;
  tubularSegments: number;
  radialSegments: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createProceduralEndotheliumFallback(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const dome = 0.55 + 0.35 * Math.sin(u * 4) * Math.cos(v * 3);
      const junc = Math.pow(Math.abs(Math.sin(u * 4 + 0.6 * Math.sin(v * 2))), 8);
      const stria = 0.5 + 0.4 * Math.sin(u * 7 - v * 3);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(dome * 255);
      data[idx + 1] = Math.round(junc * 255);
      data[idx + 2] = Math.round(stria * 255);
      data[idx + 3] = 210;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function VesselTunnel({
  spline,
  isActiveRef,
  progressRef,
  heartbeatRef,
  fogColorRef,
  fogDensityRef,
  reducedMotion,
  tubularSegments,
  radialSegments,
}: VesselTunnelProps) {
  const bundle = useManagedDisposable(
    () => {
      const fallbackTex = createProceduralEndotheliumFallback();
      const tubeGeo = new THREE.TubeGeometry(spline, tubularSegments, VESSEL_RADIUS, radialSegments, false);
      const wallMat = new THREE.ShaderMaterial({
        vertexShader: vesselWallVertexShader,
        fragmentShader: vesselWallFragmentShader,
        uniforms: {
          uEndotheliumMap: { value: fallbackTex as THREE.Texture },
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uHeartbeat: { value: 0 },
          uReducedMotion: { value: reducedMotion ? 1 : 0 },
          uFogColor: { value: new THREE.Color('#0a0403') },
          uFogDensity: { value: 0.055 },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      });

      const bbbGeo = new THREE.PlaneGeometry(VESSEL_RADIUS * 1.9, VESSEL_RADIUS * 1.9, 26, 26);
      const bbbMat = new THREE.ShaderMaterial({
        vertexShader: bbbMembraneVertexShader,
        fragmentShader: bbbMembraneFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uCrossing: { value: 0 },
        },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });

      const astroRings = Array.from({ length: 8 }, (_, i) => {
        const s = 0.81 + i * 0.018;
        const narrow = smoothstep(0.76, 0.96, s) * 0.34;
        const radius = VESSEL_RADIUS - narrow - 0.04;
        return {
          geo: new THREE.TorusGeometry(radius, 0.022, 8, 40),
          mat: new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? '#38bdf8' : '#818cf8',
            transparent: true,
            opacity: 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        };
      });

      return { fallbackTex, tubeGeo, wallMat, bbbGeo, bbbMat, astroRings };
    },
    (res) => {
      res.tubeGeo.dispose();
      res.wallMat.dispose();
      res.bbbGeo.dispose();
      res.bbbMat.dispose();
      res.fallbackTex.dispose();
      for (const r of res.astroRings) {
        r.geo.dispose();
        r.mat.dispose();
      }
    },
    [spline, tubularSegments, radialSegments]
  );

  useEffect(() => {
    if (!bundle) return;
    let cancelled = false;
    let loadedTex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();

    loader.load(
      '/assets/04-veias/endothelium-map.png',
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        loadedTex = tex;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        bundle.wallMat.uniforms.uEndotheliumMap.value = tex;
      },
      undefined,
      () => {
        // Mantém fallback DataTexture procedural
      }
    );

    return () => {
      cancelled = true;
      bundle.wallMat.uniforms.uEndotheliumMap.value = bundle.fallbackTex;
      if (loadedTex) {
        loadedTex.dispose();
        loadedTex = null;
      }
    };
  }, [bundle]);

  const bbbTransform = useMemo(() => {
    const s = 0.915;
    const pos = spline.getPointAt(s);
    const tangent = spline.getTangentAt(s).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    return { pos, quat };
  }, [spline]);

  const astroTransforms = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const s = 0.81 + i * 0.018;
      const pos = spline.getPointAt(s);
      const tangent = spline.getTangentAt(s).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      return { pos, quat };
    });
  }, [spline]);

  useFrame(({ clock }) => {
    if (!isActiveRef.current || !bundle) return;
    const t = clock.getElapsedTime();
    const p = progressRef.current;

    bundle.wallMat.uniforms.uTime.value = t;
    bundle.wallMat.uniforms.uProgress.value = p;
    bundle.wallMat.uniforms.uHeartbeat.value = heartbeatRef.current;
    bundle.wallMat.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
    bundle.wallMat.uniforms.uFogColor.value.copy(fogColorRef.current);
    bundle.wallMat.uniforms.uFogDensity.value = fogDensityRef.current;

    bundle.bbbMat.uniforms.uTime.value = t;
    bundle.bbbMat.uniforms.uCrossing.value = smoothstep(0.86, 0.95, p);
  });

  if (!bundle) return null;

  return (
    <group>
      <mesh args={[bundle.tubeGeo, bundle.wallMat]} />

      {astroTransforms.map((tr, idx) => (
        <mesh
          key={idx}
          args={[bundle.astroRings[idx].geo, bundle.astroRings[idx].mat]}
          position={tr.pos}
          quaternion={tr.quat}
        />
      ))}

      <mesh
        args={[bundle.bbbGeo, bundle.bbbMat]}
        position={bbbTransform.pos}
        quaternion={bbbTransform.quat}
      />
    </group>
  );
}
