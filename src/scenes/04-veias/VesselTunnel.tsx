import { useEffect, useMemo, useRef } from 'react';
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
  const wallMatRef = useRef<THREE.ShaderMaterial>(null);
  const bbbMatRef = useRef<THREE.ShaderMaterial>(null);

  const fallbackTex = useMemo(() => createProceduralEndotheliumFallback(), []);

  useEffect(() => {
    let disposed = false;
    let loadedTex: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();

    loader.load(
      '/assets/04-veias/endothelium-map.png',
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        loadedTex = tex;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        if (wallMatRef.current) {
          wallMatRef.current.uniforms.uEndotheliumMap.value = tex;
        }
      },
      undefined,
      () => {
        // Mantém fallback DataTexture procedural
      }
    );

    return () => {
      disposed = true;
      if (loadedTex) loadedTex.dispose();
      fallbackTex.dispose();
    };
  }, [fallbackTex]);

  const tubeGeo = useMemo(
    () => new THREE.TubeGeometry(spline, tubularSegments, VESSEL_RADIUS, radialSegments, false),
    [spline, tubularSegments, radialSegments]
  );

  useEffect(() => {
    return () => {
      tubeGeo.dispose();
    };
  }, [tubeGeo]);

  const bbbTransform = useMemo(() => {
    const s = 0.915;
    const pos = spline.getPointAt(s);
    const tangent = spline.getTangentAt(s).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    return { pos, quat };
  }, [spline]);

  const astroRings = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const s = 0.81 + i * 0.018;
      const pos = spline.getPointAt(s);
      const tangent = spline.getTangentAt(s).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      const narrow = smoothstep(0.76, 0.96, s) * 0.34;
      return { pos, quat, radius: VESSEL_RADIUS - narrow - 0.04 };
    });
  }, [spline]);

  const wallUniforms = useMemo(
    () => ({
      uEndotheliumMap: { value: fallbackTex as THREE.Texture },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uHeartbeat: { value: 0 },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uFogColor: { value: new THREE.Color('#090306') },
      uFogDensity: { value: 0.055 },
    }),
    [fallbackTex, reducedMotion]
  );

  const bbbUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCrossing: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (!isActiveRef.current) return;
    const t = clock.getElapsedTime();
    const p = progressRef.current;

    if (wallMatRef.current) {
      wallMatRef.current.uniforms.uTime.value = t;
      wallMatRef.current.uniforms.uProgress.value = p;
      wallMatRef.current.uniforms.uHeartbeat.value = heartbeatRef.current;
      wallMatRef.current.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
      wallMatRef.current.uniforms.uFogColor.value.copy(fogColorRef.current);
      wallMatRef.current.uniforms.uFogDensity.value = fogDensityRef.current;
    }

    if (bbbMatRef.current) {
      bbbMatRef.current.uniforms.uTime.value = t;
      bbbMatRef.current.uniforms.uCrossing.value = smoothstep(0.86, 0.95, p);
    }
  });

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <shaderMaterial
          ref={wallMatRef}
          vertexShader={vesselWallVertexShader}
          fragmentShader={vesselWallFragmentShader}
          uniforms={wallUniforms}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>

      {astroRings.map((ring, idx) => (
        <mesh key={idx} position={ring.pos} quaternion={ring.quat}>
          <torusGeometry args={[ring.radius, 0.022, 8, 40]} />
          <meshBasicMaterial
            color={idx % 2 === 0 ? '#38bdf8' : '#818cf8'}
            transparent
            opacity={0.34}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={bbbTransform.pos} quaternion={bbbTransform.quat}>
        <planeGeometry args={[VESSEL_RADIUS * 1.9, VESSEL_RADIUS * 1.9, 26, 26]} />
        <shaderMaterial
          ref={bbbMatRef}
          vertexShader={bbbMembraneVertexShader}
          fragmentShader={bbbMembraneFragmentShader}
          uniforms={bbbUniforms}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
