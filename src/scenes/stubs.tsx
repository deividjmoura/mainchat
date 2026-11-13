import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { SceneDefinition, SceneProps } from './types';
import { scene04Veias } from './04-veias';
import { scene05Cerebro } from './05-cerebro';

export function Soil({ progress }: SceneProps) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const value = progress.get();
    ref.current.rotation.y = value * 0.7;
    ref.current.scale.setScalar(1 + value * 0.12);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.65, 5]} />
      <meshStandardMaterial color="#75583d" roughness={1} />
    </mesh>
  );
}

export function Fungus({ progress }: SceneProps) {
  const cap = useRef<Mesh>(null);
  useFrame(() => {
    if (!cap.current) return;
    const value = progress.get();
    const scale = 0.1 + Math.sin(Math.min(value, 0.8) / 0.8 * Math.PI / 2) * 0.9;
    cap.current.scale.set(scale, 0.8 + scale * 0.2, scale);
    cap.current.rotation.z = value > 0.82 ? (value - 0.82) * 1.7 : 0;
  });
  return (
    <group>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 1.2, 32]} />
        <meshStandardMaterial color="#e5d7bd" />
      </mesh>
      <mesh ref={cap} position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.85, 40, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#b98557" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Threshold({ progress }: SceneProps) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const value = progress.get();
    ref.current.rotation.z = value * Math.PI * 1.4;
    ref.current.scale.setScalar(1 + value * 0.3);
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[1.1, 0.06, 24, 100]} />
      <meshStandardMaterial color="#d45c57" emissive="#681c28" emissiveIntensity={1.1} />
    </mesh>
  );
}

export const scenes: SceneDefinition[] = [
  {
    id: '01-terra',
    scrollLength: 140,
    Component: Soil,
    textBlocks: [
      {
        at: 0,
        eyebrow: '01 / ORIGEM',
        title: 'Tudo começa na terra.',
        body: 'Sob a superfície, uma rede viva conecta matéria, água e nutrientes. O fungo faz parte de um ecossistema complexo.',
      },
      {
        at: 0.55,
        eyebrow: 'MICÉLIO',
        title: 'Uma rede invisível.',
        body: 'O micélio é formado por filamentos chamados hifas. Ele cresce pelo substrato e participa da decomposição da matéria orgânica.',
      },
    ],
  },
  {
    id: '02-cogumelo',
    scrollLength: 160,
    Component: Fungus,
    textBlocks: [
      {
        at: 0,
        eyebrow: '02 / DESENVOLVIMENTO',
        title: 'A vida emerge.',
        body: 'O cogumelo é a estrutura reprodutiva visível de certos fungos. Seu ciclo envolve expansão, maturação e senescência.',
      },
      {
        at: 0.5,
        eyebrow: 'MORFOLOGIA',
        title: 'Uma forma passageira.',
        body: 'A estrutura visível é apenas uma parte de um organismo muito maior.',
      },
      {
        at: 0.84,
        eyebrow: 'CICLO',
        title: 'E então, retorna.',
        body: 'Após a maturação, o corpo frutífero envelhece e a matéria retorna aos ciclos do ambiente.',
      },
    ],
  },
  {
    id: '03-mao-boca',
    scrollLength: 115,
    Component: Threshold,
    textBlocks: [
      {
        at: 0,
        eyebrow: '03 / O LIMIAR',
        title: 'Do organismo à experiência.',
        body: 'Uma representação conceitual da exposição humana à psilocibina — não um guia de consumo.',
      },
      {
        at: 0.5,
        eyebrow: 'FARMACOLOGIA',
        title: 'Uma molécula, vários sistemas.',
        body: 'A psilocibina é convertida no organismo em psilocina, que interage com receptores serotoninérgicos.',
      },
    ],
  },
  scene04Veias,
  scene05Cerebro,
];
