import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { clamp, lerp, MICRO_ANCHOR, rangeWeight, smoothstep } from './cameraKeyframes';

interface NeuronReceptorMicroProps {
  isActiveRef: MutableRefObject<boolean>;
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
}

/**
 * Ato 3 da Cena 05 (`progress` 0.58 .. 0.81):
 * Zoom microscópico na Camada V do Córtex Pré-Frontal:
 * - Neurônio piramidal com soma, dendrito apical, dendritos basais e espinhas dendríticas
 * - Receptor GPCR 5-HT2A (7 hélices transmembrana)
 * - Molécula de psilocina (4-HO-DMT) ligando-se ao bolso ortostérico
 * - Disparo intracelular e onda de ativação propagando-se pela coluna cortical
 */
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

  const dendriteGeos = useMemo(() => {
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

    return {
      apical: new THREE.TubeGeometry(apicalCurve, 34, 0.0075, 10, false),
      apicalB: new THREE.TubeGeometry(apicalB, 22, 0.005, 8, false),
      spine: new THREE.TubeGeometry(spine, 12, 0.0042, 8, false),
      basals: basals.map((c) => new THREE.TubeGeometry(c, 16, 0.0045, 8, false)),
    };
  }, []);

  useEffect(() => {
    return () => {
      dendriteGeos.apical.dispose();
      dendriteGeos.apicalB.dispose();
      dendriteGeos.spine.dispose();
      dendriteGeos.basals.forEach((g) => g.dispose());
    };
  }, [dendriteGeos]);

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
    if (!isActiveRef.current) return;
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
      const mat = pocketGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = clamp(activation * 0.82, 0, 0.92);
    }

    if (somaGlowRef.current) {
      const somaFire = smoothstep(0.695, 0.745, p) * vis;
      const pulse = 0.85 + 0.22 * Math.sin(t * 6.0 - 1.2);
      somaGlowRef.current.scale.setScalar(0.85 + somaFire * 0.6 * pulse);
      const mat = somaGlowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = somaFire * 0.58;
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
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = waveMaster * (1 - cyc) * 0.65;
    }

    for (let i = 0; i < neighborPulsesRef.current.length; i++) {
      const nb = neighborPulsesRef.current[i];
      if (!nb) continue;
      const delayP = 0.71 + i * 0.011;
      const nbFire = smoothstep(delayP, delayP + 0.035, p) * vis;
      const osc = 0.65 + 0.35 * Math.sin(t * 5.2 - i * 1.3);
      const mat = nb.material as THREE.MeshBasicMaterial;
      mat.opacity = nbFire * osc * 0.78;
      nb.scale.setScalar(0.8 + nbFire * 0.55 * osc);
    }
  });

  return (
    <group ref={rootRef} position={MICRO_ANCHOR}>
      <pointLight position={[0.04, 0.06, 0.08]} intensity={1.15} distance={0.9} color="#38bdf8" />

      <mesh position={[0, -0.115, 0]}>
        <coneGeometry args={[0.028, 0.058, 18]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#1e40af"
          emissiveIntensity={0.95}
          roughness={0.28}
          transparent
          opacity={0.92}
        />
      </mesh>

      <mesh ref={somaGlowRef} position={[0, -0.115, 0]}>
        <sphereGeometry args={[0.048, 16, 16]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh geometry={dendriteGeos.apical}>
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#1d4ed8"
          emissiveIntensity={0.75}
          roughness={0.32}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh geometry={dendriteGeos.apicalB}>
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#1d4ed8"
          emissiveIntensity={0.65}
          roughness={0.35}
          transparent
          opacity={0.85}
        />
      </mesh>
      {dendriteGeos.basals.map((geo, idx) => (
        <mesh key={idx} geometry={geo}>
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#1e3a8a"
            emissiveIntensity={0.55}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}

      <mesh geometry={dendriteGeos.spine}>
        <meshStandardMaterial color="#67e8f9" emissive="#0284c7" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.018, 0.018, 0.018]}>
        <sphereGeometry args={[0.012, 14, 14]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0ea5e9"
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
        />
      </mesh>

      <mesh ref={nascentSpineRef} position={[-0.011, 0.042, 0.008]}>
        <sphereGeometry args={[0.0075, 10, 10]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.85} toneMapped={false} />
      </mesh>

      <group position={[0.018, 0.024, 0.018]} rotation={[0.22, 0, -0.22]}>
        {sevenHelices.map((h, i) => (
          <mesh key={i} position={h.pos} rotation={h.tilt}>
            <cylinderGeometry args={[0.0024, 0.0024, 0.014, 10]} />
            <meshStandardMaterial
              color="#2dd4bf"
              emissive="#0d9488"
              emissiveIntensity={1.1}
              roughness={0.2}
            />
          </mesh>
        ))}

        <mesh ref={pocketGlowRef} position={[0, 0.004, 0]}>
          <sphereGeometry args={[0.018, 14, 14]} />
          <meshBasicMaterial
            color="#5eead4"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <group ref={moleculeRef} position={[-0.045, 0.075, 0.042]}>
        <mesh position={[-0.004, 0, 0]}>
          <torusGeometry args={[0.0052, 0.0016, 8, 6]} />
          <meshBasicMaterial color="#67e8f9" toneMapped={false} />
        </mesh>
        <mesh position={[0.0035, 0, 0]}>
          <torusGeometry args={[0.0042, 0.0015, 8, 5]} />
          <meshBasicMaterial color="#2dd4bf" toneMapped={false} />
        </mesh>
        <mesh position={[-0.009, 0.005, 0]}>
          <sphereGeometry args={[0.0026, 10, 10]} />
          <meshBasicMaterial color="#fb7185" toneMapped={false} />
        </mesh>
        <mesh position={[0.009, -0.004, 0.002]}>
          <sphereGeometry args={[0.0028, 10, 10]} />
          <meshBasicMaterial color="#fde047" toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.014, 10, 10]} />
          <meshBasicMaterial
            color="#2dd4bf"
            transparent
            opacity={0.38}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {[0, 1, 2].map((idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            waveRingsRef.current[idx] = el;
          }}
          position={[0.018, 0.024, 0.018]}
          rotation={[Math.PI * 0.38, 0.2, 0]}
        >
          <torusGeometry args={[1, 0.022, 10, 44]} />
          <meshBasicMaterial
            color={idx % 2 === 0 ? '#38bdf8' : '#c084fc'}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {neighborOffsets.map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh>
            <coneGeometry args={[0.016, 0.036, 10]} />
            <meshBasicMaterial color="#1e3a8a" transparent opacity={0.48} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.0022, 0.0032, 0.22, 6]} />
            <meshBasicMaterial color="#1d4ed8" transparent opacity={0.36} />
          </mesh>
          <mesh
            ref={(el) => {
              neighborPulsesRef.current[idx] = el;
            }}
          >
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshBasicMaterial
              color={idx % 2 === 0 ? '#38bdf8' : '#e879f9'}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
