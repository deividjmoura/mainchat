import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { connectomeArcFragmentShader, connectomeArcVertexShader } from './shaders';
import { mniToBrainSpace, smoothstep } from './cameraKeyframes';

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
  { network: 'LIM', mni: [24, 34, -14], color: '#a78bfa' },
];

export function ConnectomeArcs({
  isActiveRef,
  progressRef,
  arcCount,
  reducedMotion,
}: ConnectomeArcsProps) {
  const groupRef = useRef<THREE.Group>(null);

  const arcs = useMemo(() => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < NETWORK_NODES.length; i++) {
      for (let j = i + 1; j < NETWORK_NODES.length; j++) {
        if (NETWORK_NODES[i].network !== NETWORK_NODES[j].network) {
          pairs.push([i, j]);
        }
      }
    }

    const total = Math.min(arcCount, pairs.length);
    return Array.from({ length: total }, (_, k) => {
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

      return {
        geo,
        uniforms: {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uPhase: { value: (k * 0.6180339) % 1 },
          uColorStart: { value: new THREE.Color(nodeA.color) },
          uColorEnd: { value: new THREE.Color(nodeB.color) },
        },
        delay: (k / Math.max(1, total)) * 0.09,
      };
    });
  }, [arcCount]);

  useEffect(() => {
    return () => {
      arcs.forEach((a) => a.geo.dispose());
    };
  }, [arcs]);

  const nodePositions = useMemo(
    () => NETWORK_NODES.map((n) => ({ pos: mniToBrainSpace(...n.mni), color: n.color })),
    []
  );

  useFrame(({ clock }) => {
    if (!isActiveRef.current) return;
    const p = progressRef.current;
    const active = smoothstep(0.80, 0.85, p);
    if (groupRef.current) {
      groupRef.current.visible = active > 0.005;
    }
    if (active <= 0.005) return;

    const t = reducedMotion ? clock.getElapsedTime() * 0.2 : clock.getElapsedTime();
    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i];
      arc.uniforms.uTime.value = t;
      arc.uniforms.uReveal.value = smoothstep(0.805 + arc.delay, 0.91 + arc.delay * 0.7, p);
    }
  });

  return (
    <group ref={groupRef} renderOrder={5}>
      {arcs.map((arc, idx) => (
        <mesh key={idx} geometry={arc.geo}>
          <shaderMaterial
            vertexShader={connectomeArcVertexShader}
            fragmentShader={connectomeArcFragmentShader}
            uniforms={arc.uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {nodePositions.map((node, idx) => (
        <mesh key={`hub-${idx}`} position={node.pos}>
          <sphereGeometry args={[0.022, 10, 10]} />
          <meshBasicMaterial
            color={node.color}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
