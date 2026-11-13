import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { connectomeArcFragmentShader, connectomeArcVertexShader } from './shaders';
import { mniToBrainSpace, smoothstep } from './cameraKeyframes';
import { useManagedDisposable } from './useSceneResources';

interface ConnectomeArcsProps {
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  arcCount: number;
  reducedMotion: boolean;
}

const NETWORK_NODES: Array<{ network: string; mni: [number, number, number]; color: string }> = [
  { network: 'DMN', mni: [-6, 54, 10], color: '#c084fc' },
  { network: 'DMN', mni: [8, 54, 10], color: '#c084fc' },
  { network: 'DMN', mni: [0, -52, 28], color: '#e879f9' },
  { network: 'DMN', mni: [-44, -64, 32], color: '#c084fc' },
  { network: 'DMN', mni: [44, -64, 32], color: '#c084fc' },
  { network: 'FPN', mni: [-38, 40, 24], color: '#38bdf8' },
  { network: 'FPN', mni: [38, 40, 24], color: '#38bdf8' },
  { network: 'VIS', mni: [-14, -88, 4], color: '#34d399' },
  { network: 'VIS', mni: [14, -88, 4], color: '#34d399' },
  { network: 'VIS', mni: [-30, -76, -10], color: '#2dd4bf' },
  { network: 'VIS', mni: [30, -76, -10], color: '#2dd4bf' },
  { network: 'SMN', mni: [-38, -24, 54], color: '#60a5fa' },
  { network: 'SMN', mni: [38, -24, 54], color: '#60a5fa' },
  { network: 'AUD', mni: [-54, -22, 6], color: '#fbbf24' },
  { network: 'AUD', mni: [54, -22, 6], color: '#fbbf24' },
  { network: 'SAL', mni: [-36, 18, 2], color: '#fb7185' },
  { network: 'SAL', mni: [36, 18, 2], color: '#fb7185' },
  { network: 'SUB', mni: [-11, -19, 6], color: '#f59e0b' },
  { network: 'SUB', mni: [11, -19, 6], color: '#f59e0b' },
  { network: 'LIM', mni: [-26, -22, -12], color: '#f472b6' },
  { network: 'LIM', mni: [26, -22, -12], color: '#f472b6' },
  { network: 'DAN', mni: [-26, -56, 52], color: '#38bdf8' },
  { network: 'DAN', mni: [26, -56, 52], color: '#38bdf8' },
  { network: 'LIM', mni: [-24, 34, -14], color: '#a78bfa' },
  { network: 'LIM', mni: [24, 34, -14], color: '#f472b6' },
];

export function ConnectomeArcs({
  isActiveRef,
  progressRef,
  arcCount,
  reducedMotion,
}: ConnectomeArcsProps) {
  const groupRef = useRef<THREE.Group>(null);

  const bundle = useManagedDisposable(
    () => {
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i < NETWORK_NODES.length; i++) {
        for (let j = i + 1; j < NETWORK_NODES.length; j++) {
          if (NETWORK_NODES[i].network !== NETWORK_NODES[j].network) {
            pairs.push([i, j]);
          }
        }
      }

      const total = Math.min(arcCount, pairs.length);
      const arcs = Array.from({ length: total }, (_, k) => {
        const [ia, ib] = pairs[(k * 7) % pairs.length];
        const nodeA = NETWORK_NODES[ia];
        const nodeB = NETWORK_NODES[ib];
        const pA = new THREE.Vector3(...mniToBrainSpace(...nodeA.mni));
        const pB = new THREE.Vector3(...mniToBrainSpace(...nodeB.mni));

        const mid = pA.clone().add(pB).multiplyScalar(0.5);
        const dist = pA.distanceTo(pB);
        const outDir = mid.lengthSq() > 0.01 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0);
        outDir.y += 0.55;
        outDir.normalize();

        const ctrl = mid.clone().addScaledVector(outDir, 0.28 + dist * 0.36);
        const curve = new THREE.QuadraticBezierCurve3(pA, ctrl, pB);
        const radius = k % 5 === 0 ? 0.0105 : 0.0068;
        const geo = new THREE.TubeGeometry(curve, 30, radius, 6, false);

        const uniforms = {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uPhase: { value: (k * 0.6180339) % 1 },
          uColorStart: { value: new THREE.Color(nodeA.color) },
          uColorEnd: { value: new THREE.Color(nodeB.color) },
        };

        const mat = new THREE.ShaderMaterial({
          vertexShader: connectomeArcVertexShader,
          fragmentShader: connectomeArcFragmentShader,
          uniforms,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });

        return {
          geo,
          mat,
          uniforms,
          delay: (k / Math.max(1, total)) * 0.09,
        };
      });

      const hubGeo = new THREE.SphereGeometry(0.022, 10, 10);
      const hubMats = NETWORK_NODES.map(
        (n) =>
          new THREE.MeshBasicMaterial({
            color: n.color,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
      );

      return { arcs, hubGeo, hubMats };
    },
    (res) => {
      for (const arc of res.arcs) {
        arc.geo.dispose();
        arc.mat.dispose();
      }
      res.hubGeo.dispose();
      for (const m of res.hubMats) {
        m.dispose();
      }
    },
    [arcCount]
  );

  const nodePositions = useMemo(
    () => NETWORK_NODES.map((n) => mniToBrainSpace(...n.mni)),
    []
  );

  useFrame(({ clock }) => {
    if (!isActiveRef.current || !bundle) return;
    const p = progressRef.current;
    const active = smoothstep(0.80, 0.85, p);
    if (groupRef.current) {
      groupRef.current.visible = active > 0.005;
    }
    if (active <= 0.005) return;

    const t = reducedMotion ? clock.getElapsedTime() * 0.2 : clock.getElapsedTime();
    for (let i = 0; i < bundle.arcs.length; i++) {
      const arc = bundle.arcs[i];
      arc.uniforms.uTime.value = t;
      arc.uniforms.uReveal.value = smoothstep(0.805 + arc.delay, 0.91 + arc.delay * 0.7, p);
    }
  });

  if (!bundle) return null;

  return (
    <group ref={groupRef} renderOrder={5}>
      {bundle.arcs.map((arc, idx) => (
        <mesh key={idx} args={[arc.geo, arc.mat]} />
      ))}

      {nodePositions.map((pos, idx) => (
        <mesh key={`hub-${idx}`} args={[bundle.hubGeo, bundle.hubMats[idx]]} position={pos} />
      ))}
    </group>
  );
}
