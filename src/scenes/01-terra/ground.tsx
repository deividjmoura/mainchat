/**
 * Elementos do solo. Tudo procedural — ver public/assets/01-terra/ASSETS.md.
 */
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { makeHumusMaps, makeLeafCanvas, makeBarkMaps } from '../_shared/textures';
import { canvasTexture, buildFilaments, makeHyphaMaterial, makeContactShadow } from '../_shared/gl';
import { rng } from '../_shared/math';
import type { MotionValue } from 'motion';
import type { Quality } from '../../hooks/useQuality';

/* ------------------------------ terreno ------------------------------ */

export function ForestFloor({
  quality,
  size = 3.2,
}: {
  quality: Quality;
  size?: number;
}) {
  const seg = quality === 'high' ? 200 : quality === 'medium' ? 120 : 64;

  const { geometry, maps } = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // senos incomensuráveis: relevo barato, sem fbm na CPU
      let h = Math.sin(x * 3.1 + 1.2) * Math.cos(y * 2.7 - 0.4) * 0.022;
      h += Math.sin(x * 7.3) * 0.007 + Math.cos(y * 9.1) * 0.005;
      // depressão suave: é onde o micélio se acumula e o primórdio nasce
      const d = Math.hypot(x - 0.05, y - 0.25);
      h -= 0.03 * Math.exp(-d * d * 2.2);
      pos.setZ(i, h);
    }
    g.computeVertexNormals();
    return { geometry: g, maps: makeHumusMaps(quality === 'low' ? 512 : 1024) };
  }, [seg, size, quality]);

  const colorMap = useMemo(() => canvasTexture(maps.color, { srgb: true, repeat: [2.4, 2.4] }), [maps]);
  const normalMap = useMemo(() => canvasTexture(maps.normal, { repeat: [3.1, 3.1] }), [maps]);
  const roughMap = useMemo(() => canvasTexture(maps.roughness, { repeat: [2, 2] }), [maps]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        map={colorMap}
        normalMap={normalMap}
        roughnessMap={roughMap}
        normalScale={new THREE.Vector2(1.35, 1.35)}
        roughness={1}
        metalness={0}
        color="#b9ad9c"
        envMapIntensity={0.25}
      />
    </mesh>
  );
}

/* ------------------------------ folhas caídas ------------------------------ */

export function FallenLeaves({ quality, count = 80 }: { quality: Quality; count?: number }) {
  const n = quality === 'high' ? count : quality === 'medium' ? Math.round(count * 0.6) : Math.round(count * 0.3);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const done = useRef(false);

  const { geometry, material } = useMemo(() => {
    const map = canvasTexture(makeLeafCanvas(0, 512), { srgb: true });
    const g = new THREE.PlaneGeometry(1, 1, 6, 6);
    // dobra a folha no meio e ergue as bordas: aspecto seco, não um adesivo plano
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.pow(Math.abs(x) * 2, 2) * 0.09 - Math.pow(Math.abs(y) * 2, 2) * 0.04);
    }
    g.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
      // alphaTest (não transparent): sem fringe e sem problema de ordenação
      alphaTest: 0.42,
    });
    return { geometry: g, material: mat };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // InstancedMesh precisa das matrizes antes do primeiro frame
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || done.current) return;
    done.current = true;
    const rand = rng(3301);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < n && guard < n * 40) {
      guard++;
      const x = (rand() - 0.5) * 2.6;
      const z = (rand() - 0.5) * 2.6;
      // não cobrir o "palco" onde o cogumelo vai nascer
      if (Math.hypot(x - 0.05, z - 0.25) < 0.16) continue;
      p.set(x, 0.004 + rand() * 0.012, z);
      e.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
      q.setFromEuler(e);
      const sc = 0.035 + rand() * 0.065;
      s.set(sc, sc * (0.75 + rand() * 0.5), sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, n]} frustumCulled={false} receiveShadow />;
}

/* ------------------------------ raízes ------------------------------ */

export function Roots({ quality }: { quality: Quality }) {
  const group = useMemo(() => {
    const bark = makeBarkMaps(quality === 'low' ? 256 : 512);
    const map = canvasTexture(bark.color, { srgb: true, repeat: [1, 3] });
    const normalMap = canvasTexture(bark.normal, { repeat: [1, 3] });
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(1.6, 1.6),
      roughness: 0.92,
      color: '#8f7f6c',
    });

    const g = new THREE.Group();
    const rand = rng(5150);
    const count = quality === 'high' ? 9 : quality === 'medium' ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 0.75 + rand() * 0.65;
      const start = new THREE.Vector3(Math.cos(ang) * rad, 0.05 + rand() * 0.16, Math.sin(ang) * rad);
      const end = new THREE.Vector3(
        Math.cos(ang + (rand() - 0.5) * 1.5) * 0.05,
        -0.04,
        Math.sin(ang + (rand() - 0.5) * 1.5) * 0.05,
      );
      const mid2 = start.clone().lerp(end, 0.25);
      mid2.y = start.y * 0.55;
      const mid = start.clone().lerp(end, 0.55);
      mid.y = 0.012 + rand() * 0.02; // toca o solo no meio do arco
      const curve = new THREE.CatmullRomCurve3([start, mid2, mid, end]);
      const geo = new THREE.TubeGeometry(curve, quality === 'low' ? 24 : 56, 0.006 + rand() * 0.016, quality === 'low' ? 5 : 9, false);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return { group: g, mat };
  }, [quality]);

  useEffect(
    () => () => {
      group.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    },
    [group],
  );

  return <primitive object={group.group} />;
}

/* ------------------------------ micélio ------------------------------ */

export function Mycelium({
  quality,
  progress,
}: {
  quality: Quality;
  progress: MotionValue<number>;
}) {
  const { geometry, material } = useMemo(() => {
    const count = quality === 'high' ? 260 : quality === 'medium' ? 150 : 70;
    const geo = buildFilaments({ count, spread: 0.85, seed: 2026, minLength: 0.04, maxLength: 0.16, radius: 0.0016 });
    return { geometry: geo, material: makeHyphaMaterial('#cfe8d2') };
  }, [quality]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    // o micélio "acorda" no fim da cena — é o gancho para a cena 02
    material.uniforms.uAwake.value = Math.min(1, Math.max(0, (progress.get() - 0.25) / 0.6));
  });

  return <mesh geometry={geometry} material={material} position={[0.05, 0.002, 0.25]} frustumCulled={false} />;
}

/* ------------------------------ sombra ------------------------------ */

export function ContactShadow({
  position,
  scale = 0.5,
  opacity = 0.5,
}: {
  position: [number, number, number];
  scale?: number;
  opacity?: number;
}) {
  const mat = useMemo(() => makeContactShadow(opacity), [opacity]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[scale, scale, 1]} material={mat} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
