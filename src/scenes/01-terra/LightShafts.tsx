/**
 * VOLUMETRIA DE LUZ FILTRADA ("god rays" fake).
 * ---------------------------------------------------------------------------
 * Raymarch volumétrico real é caríssimo. Aqui usamos planos aditivos
 * orientados à câmera, com gradiente vertical + ruído animado que desloca a
 * silhueta do feixe. Lê como luz entrando pela copa a custo quase zero.
 */
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { rng } from '../_shared/math';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    // clareia no topo (origem do feixe) e some no chão
    float vertical = pow(1.0 - vUv.y, 1.35);
    // núcleo do feixe com bordas suaves
    float core = pow(smoothstep(0.0, 0.5, 1.0 - abs(vUv.x - 0.5) * 2.0), 2.1);
    // poeira em suspensão desloca a silhueta (o feixe nunca é uma barra rígida)
    float dust = noise(vec2(vUv.x * 3.0 + uSeed, vUv.y * 4.0 - uTime * 0.08));
    float a = vertical * core * (0.82 + dust * 0.36) * uIntensity;
    gl_FragColor = vec4(uColor * (0.75 + dust * 0.5), a);
    #include <colorspace_fragment>
  }
`;

export function LightShafts({
  count = 7,
  intensity = 0.3,
  color = '#ffe2b0',
}: {
  count?: number;
  intensity?: number;
  color?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const shafts = useMemo(() => {
    const rand = rng(808);
    return Array.from({ length: count }, () => ({
      pos: [(rand() - 0.5) * 2.4, 0.55 + rand() * 0.5, (rand() - 0.9) * 1.6] as [number, number, number],
      width: 0.18 + rand() * 0.34,
      height: 1.2 + rand() * 0.9,
      seed: rand() * 100,
      inten: 0.45 + rand() * 0.75,
    }));
  }, [count]);

  const materials = useMemo(
    () =>
      shafts.map(
        (s) =>
          new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: {
              uTime: { value: 0 },
              uIntensity: { value: intensity * s.inten },
              uColor: { value: new THREE.Color(color) },
              uSeed: { value: s.seed },
            },
          }),
      ),
    [shafts, intensity, color],
  );

  // materiais criados em useMemo vazam se não forem descartados
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame((state) => {
    materials.forEach((m) => {
      m.uniforms.uTime.value = state.clock.elapsedTime;
    });
    // billboard: os feixes sempre se apresentam à câmera
    groupRef.current?.children.forEach((c) => {
      c.lookAt(state.camera.position.x, c.position.y * 0.4, state.camera.position.z);
    });
  });

  return (
    <group ref={groupRef}>
      {shafts.map((s, i) => (
        <mesh key={i} position={s.pos} material={materials[i]} renderOrder={5} frustumCulled={false}>
          <planeGeometry args={[s.width, s.height]} />
        </mesh>
      ))}
    </group>
  );
}
