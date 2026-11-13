import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clamp, lerp, MICRO_ANCHOR, rangeWeight, smoothstep } from './cameraKeyframes';
import { useManagedDisposable } from './useSceneResources';

interface NeuronReceptorMicroProps {
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
}

export function NeuronReceptorMicro({
  isActiveRef,
  progressRef,
  reducedMotion,
}: NeuronReceptorMicroProps) {
  const rootRef = useRef<THREE.Group>(null);
  const moleculeRef = useRef<THREE.Group>(null);
  const pocketGlowRef = useRef<THREE.Mesh>(null);
  const somaGlowRef = useRef<THREE.Mesh>(null);
  const nascentSpineRef = useRef<THREE.Mesh>(null);
  const waveRingsRef = useRef<Array<THREE.Mesh | null>>([]);
  const neighborPulsesRef = useRef<Array<THREE.Mesh | null>>([]);

  const res = useManagedDisposable(
    () => {
      const apicalCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, -0.11, 0.0),
        new THREE.Vector3(-0.008, -0.03, 0.005),
        new THREE.Vector3(0.004, 0.05, -0.004),
        new THREE.Vector3(0.016, 0.14, 0.01),
        new THREE.Vector3(0.055, 0.23, 0.025),
      ]);
      const apicalB = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.004, 0.06, -0.004),
        new THREE.Vector3(-0.035, 0.13, -0.02),
        new THREE.Vector3(-0.085, 0.21, -0.045),
      ]);
      const spine = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.012, 0.008, 0.012),
        new THREE.Vector3(0.018, 0.016, 0.018),
      ]);
      const basals = [
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.12, 0),
          new THREE.Vector3(-0.07, -0.16, 0.04),
          new THREE.Vector3(-0.15, -0.21, 0.08),
        ]),
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.12, 0),
          new THREE.Vector3(0.08, -0.16, 0.03),
          new THREE.Vector3(0.16, -0.22, 0.07),
        ]),
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.12, 0),
          new THREE.Vector3(0.02, -0.17, -0.08),
          new THREE.Vector3(0.05, -0.23, -0.16),
        ]),
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -0.12, 0),
          new THREE.Vector3(-0.05, -0.17, -0.07),
          new THREE.Vector3(-0.11, -0.23, -0.14),
        ]),
      ];

      const geos = {
        somaCone: new THREE.ConeGeometry(0.028, 0.058, 18),
        somaGlow: new THREE.SphereGeometry(0.048, 16, 16),
        apical: new THREE.TubeGeometry(apicalCurve, 34, 0.0075, 10, false),
        apicalB: new THREE.TubeGeometry(apicalB, 22, 0.005, 8, false),
        spine: new THREE.TubeGeometry(spine, 12, 0.0042, 8, false),
        basals: basals.map((c) => new THREE.TubeGeometry(c, 16, 0.0045, 8, false)),
        spineHead: new THREE.SphereGeometry(0.012, 14, 14),
        nascentSpine: new THREE.SphereGeometry(0.0075, 10, 10),
        helixCyl: new THREE.CylinderGeometry(0.0024, 0.0024, 0.014, 10),
        pocketGlow: new THREE.SphereGeometry(0.018, 14, 14),
        molRing6: new THREE.TorusGeometry(0.0052, 0.0016, 8, 6),
        molRing5: new THREE.TorusGeometry(0.0042, 0.0015, 8, 5),
        molAtomO: new THREE.SphereGeometry(0.0026, 10, 10),
        molAtomN: new THREE.SphereGeometry(0.0028, 10, 10),
        molHalo: new THREE.SphereGeometry(0.014, 10, 10),
        waveTorus: new THREE.TorusGeometry(1, 0.022, 10, 44),
        neighborCone: new THREE.ConeGeometry(0.016, 0.036, 10),
        neighborShaft: new THREE.CylinderGeometry(0.0022, 0.0032, 0.22, 6),
        neighborPulse: new THREE.SphereGeometry(0.028, 10, 10),
      };

      const mats = {
        somaCone: new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#1e40af',
          emissiveIntensity: 0.95,
          roughness: 0.28,
          transparent: true,
          opacity: 0.92,
        }),
        somaGlow: new THREE.MeshBasicMaterial({
          color: '#67e8f9',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
        apical: new THREE.MeshStandardMaterial({
          color: '#60a5fa',
          emissive: '#1d4ed8',
          emissiveIntensity: 0.75,
          roughness: 0.32,
          transparent: true,
          opacity: 0.9,
        }),
        apicalB: new THREE.MeshStandardMaterial({
          color: '#60a5fa',
          emissive: '#1d4ed8',
          emissiveIntensity: 0.65,
          roughness: 0.35,
          transparent: true,
          opacity: 0.85,
        }),
        basal: new THREE.MeshStandardMaterial({
          color: '#3b82f6',
          emissive: '#1e3a8a',
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.82,
        }),
        spine: new THREE.MeshStandardMaterial({
          color: '#67e8f9',
          emissive: '#0284c7',
          emissiveIntensity: 0.9,
        }),
        spineHead: new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#0ea5e9',
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.85,
        }),
        nascentSpine: new THREE.MeshBasicMaterial({
          color: '#34d399',
          transparent: true,
          opacity: 0.85,
          toneMapped: false,
        }),
        helix: new THREE.MeshStandardMaterial({
          color: '#2dd4bf',
          emissive: '#0d9488',
          emissiveIntensity: 1.1,
          roughness: 0.2,
        }),
        pocketGlow: new THREE.MeshBasicMaterial({
          color: '#5eead4',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
        molRing6: new THREE.MeshBasicMaterial({ color: '#67e8f9', toneMapped: false }),
        molRing5: new THREE.MeshBasicMaterial({ color: '#2dd4bf', toneMapped: false }),
        molAtomO: new THREE.MeshBasicMaterial({ color: '#fb7185', toneMapped: false }),
        molAtomN: new THREE.MeshBasicMaterial({ color: '#fde047', toneMapped: false }),
        molHalo: new THREE.MeshBasicMaterial({
          color: '#2dd4bf',
          transparent: true,
          opacity: 0.38,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
        waveRings: [0, 1, 2].map(
          (idx) =>
            new THREE.MeshBasicMaterial({
              color: idx % 2 === 0 ? '#38bdf8' : '#c084fc',
              transparent: true,
              opacity: 0,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
            })
        ),
        neighborCone: new THREE.MeshBasicMaterial({
          color: '#1e3a8a',
          transparent: true,
          opacity: 0.48,
        }),
        neighborShaft: new THREE.MeshBasicMaterial({
          color: '#1d4ed8',
          transparent: true,
          opacity: 0.36,
        }),
        neighborPulses: Array.from(
          { length: 6 },
          (_, idx) =>
            new THREE.MeshBasicMaterial({
              color: idx % 2 === 0 ? '#38bdf8' : '#e879f9',
              transparent: true,
              opacity: 0,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
            })
        ),
      };

      return { geos, mats };
    },
    ({ geos, mats }) => {
      geos.somaCone.dispose();
      geos.somaGlow.dispose();
      geos.apical.dispose();
      geos.apicalB.dispose();
      geos.spine.dispose();
      geos.basals.forEach((g) => g.dispose());
      geos.spineHead.dispose();
      geos.nascentSpine.dispose();
      geos.helixCyl.dispose();
      geos.pocketGlow.dispose();
      geos.molRing6.dispose();
      geos.molRing5.dispose();
      geos.molAtomO.dispose();
      geos.molAtomN.dispose();
      geos.molHalo.dispose();
      geos.waveTorus.dispose();
      geos.neighborCone.dispose();
      geos.neighborShaft.dispose();
      geos.neighborPulse.dispose();

      mats.somaCone.dispose();
      mats.somaGlow.dispose();
      mats.apical.dispose();
      mats.apicalB.dispose();
      mats.basal.dispose();
      mats.spine.dispose();
      mats.spineHead.dispose();
      mats.nascentSpine.dispose();
      mats.helix.dispose();
      mats.pocketGlow.dispose();
      mats.molRing6.dispose();
      mats.molRing5.dispose();
      mats.molAtomO.dispose();
      mats.molAtomN.dispose();
      mats.molHalo.dispose();
      mats.waveRings.forEach((m) => m.dispose());
      mats.neighborCone.dispose();
      mats.neighborShaft.dispose();
      mats.neighborPulses.forEach((m) => m.dispose());
    },
    []
  );

  const sevenHelices = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const ang = (i / 7) * Math.PI * 2;
        return {
          pos: [Math.cos(ang) * 0.0095, 0, Math.sin(ang) * 0.0085] as [number, number, number],
          tilt: [Math.sin(ang) * 0.12, 0, -Math.cos(ang) * 0.12] as [number, number, number],
        };
      }),
    []
  );

  const neighborOffsets = useMemo<Array<[number, number, number]>>(
    () => [
      [-0.19, -0.05, -0.16],
      [0.21, 0.02, -0.19],
      [-0.26, 0.08, -0.28],
      [0.28, -0.09, -0.26],
      [0.04, 0.14, -0.32],
      [-0.09, -0.16, -0.24],
    ],
    []
  );

  useFrame(({ clock }) => {
    if (!isActiveRef.current || !res) return;
    const p = progressRef.current;
    const vis = rangeWeight(p, 0.58, 0.81, 0.03, 0.035);
    if (!rootRef.current) return;
    rootRef.current.visible = vis > 0.005;
    if (!rootRef.current.visible) return;

    const t = reducedMotion ? clock.getElapsedTime() * 0.25 : clock.getElapsedTime();

    const bindT = smoothstep(0.60, 0.68, p);
    if (moleculeRef.current) {
      moleculeRef.current.position.set(
        lerp(-0.045, 0.018, bindT),
        lerp(0.075, 0.029, bindT) + (1 - bindT) * Math.sin(t * 2.4) * 0.004,
        lerp(0.042, 0.018, bindT)
      );
      moleculeRef.current.rotation.set(
        lerp(0.8, 0.15, bindT),
        t * (1 - bindT * 0.85) * 1.4,
        lerp(-0.5, 0, bindT)
      );
      moleculeRef.current.scale.setScalar(vis);
    }

    const activation = smoothstep(0.67, 0.71, p) * vis;
    if (pocketGlowRef.current) {
      const pulse = 0.85 + 0.25 * Math.sin(t * 7.0);
      pocketGlowRef.current.scale.setScalar((0.4 + activation * 1.35) * pulse);
      res.mats.pocketGlow.opacity = clamp(activation * 0.82, 0, 0.92);
    }

    if (somaGlowRef.current) {
      const somaFire = smoothstep(0.695, 0.745, p) * vis;
      const pulse = 0.85 + 0.22 * Math.sin(t * 6.0 - 1.2);
      somaGlowRef.current.scale.setScalar(0.85 + somaFire * 0.6 * pulse);
      res.mats.somaGlow.opacity = somaFire * 0.58;
    }

    if (nascentSpineRef.current) {
      const plasticity = smoothstep(0.72, 0.79, p) * vis;
      nascentSpineRef.current.scale.setScalar(0.15 + plasticity * 0.95);
    }

    const waveMaster = smoothstep(0.685, 0.725, p) * vis;
    for (let i = 0; i < waveRingsRef.current.length; i++) {
      const ring = waveRingsRef.current[i];
      if (!ring) continue;
      const cyc = (t * 0.72 + i * 0.33) % 1;
      ring.scale.setScalar(0.02 + cyc * 0.34);
      res.mats.waveRings[i].opacity = waveMaster * (1 - cyc) * 0.65;
    }

    for (let i = 0; i < neighborPulsesRef.current.length; i++) {
      const nb = neighborPulsesRef.current[i];
      if (!nb) continue;
      const delayP = 0.71 + i * 0.011;
      const nbFire = smoothstep(delayP, delayP + 0.035, p) * vis;
      const osc = 0.65 + 0.35 * Math.sin(t * 5.2 - i * 1.3);
      res.mats.neighborPulses[i].opacity = nbFire * osc * 0.78;
      nb.scale.setScalar(0.8 + nbFire * 0.55 * osc);
    }
  });

  if (!res) return null;

  return (
    <group ref={rootRef} position={MICRO_ANCHOR}>
      <pointLight position={[0.04, 0.06, 0.08]} intensity={1.15} distance={0.9} color="#38bdf8" />

      <mesh args={[res.geos.somaCone, res.mats.somaCone]} position={[0, -0.115, 0]} />
      <mesh
        ref={somaGlowRef}
        args={[res.geos.somaGlow, res.mats.somaGlow]}
        position={[0, -0.115, 0]}
      />

      <mesh args={[res.geos.apical, res.mats.apical]} />
      <mesh args={[res.geos.apicalB, res.mats.apicalB]} />
      {res.geos.basals.map((geo, idx) => (
        <mesh key={idx} args={[geo, res.mats.basal]} />
      ))}

      <mesh args={[res.geos.spine, res.mats.spine]} />
      <mesh args={[res.geos.spineHead, res.mats.spineHead]} position={[0.018, 0.018, 0.018]} />
      <mesh
        ref={nascentSpineRef}
        args={[res.geos.nascentSpine, res.mats.nascentSpine]}
        position={[-0.011, 0.042, 0.008]}
      />

      <group position={[0.018, 0.024, 0.018]} rotation={[0.22, 0, -0.22]}>
        {sevenHelices.map((h, i) => (
          <mesh key={i} args={[res.geos.helixCyl, res.mats.helix]} position={h.pos} rotation={h.tilt} />
        ))}
        <mesh
          ref={pocketGlowRef}
          args={[res.geos.pocketGlow, res.mats.pocketGlow]}
          position={[0, 0.004, 0]}
        />
      </group>

      <group ref={moleculeRef} position={[-0.045, 0.075, 0.042]}>
        <mesh args={[res.geos.molRing6, res.mats.molRing6]} position={[-0.004, 0, 0]} />
        <mesh args={[res.geos.molRing5, res.mats.molRing5]} position={[0.0035, 0, 0]} />
        <mesh args={[res.geos.molAtomO, res.mats.molAtomO]} position={[-0.009, 0.005, 0]} />
        <mesh args={[res.geos.molAtomN, res.mats.molAtomN]} position={[0.009, -0.004, 0.002]} />
        <mesh args={[res.geos.molHalo, res.mats.molHalo]} />
      </group>

      {[0, 1, 2].map((idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            waveRingsRef.current[idx] = el;
          }}
          args={[res.geos.waveTorus, res.mats.waveRings[idx]]}
          position={[0.018, 0.024, 0.018]}
          rotation={[Math.PI * 0.38, 0.2, 0]}
        />
      ))}

      {neighborOffsets.map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh args={[res.geos.neighborCone, res.mats.neighborCone]} />
          <mesh args={[res.geos.neighborShaft, res.mats.neighborShaft]} position={[0, 0.09, 0]} />
          <mesh
            ref={(el) => {
              neighborPulsesRef.current[idx] = el;
            }}
            args={[res.geos.neighborPulse, res.mats.neighborPulses[idx]]}
          />
        </group>
      ))}
    </group>
  );
}
