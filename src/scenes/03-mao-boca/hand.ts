/**
 * MÃO PROCEDURAL — placeholder documentado.
 * ---------------------------------------------------------------------------
 * Não existe asset realista de mão neste repositório (ver ASSETS.md desta
 * cena). Este rig é um MANEQUIM: anatomia suficiente para ler como mão
 * (proporções, articulações, pinça de dois dedos), sem pretensão fotorrealista.
 * Quando o asset chegar, `buildHand` é substituído por um GLB em Suspense e o
 * resto da cena continua igual — a animação consome apenas `HandPose`.
 *
 * ARMADILHA CORRIGIDA AQUI: dobrar um dedo em Z cisalha; os dedos "tesouram"
 * lateralmente porque a falange é filha da anterior e herda o eixo. A flexão
 * vai em X, no espaço local do pai, e cada articulação acumula sobre a
 * anterior — o resultado é uma curva de dedo, não um leque.
 */
import * as THREE from 'three';

export interface FingerSpec {
  /** comprimento de cada falange (proximal, média, distal) em metros */
  lengths: [number, number, number];
  radius: number;
  /** separação lateral a partir do centro da palma */
  spread: number;
  /** abdução em Z (dedos nunca são paralelos) */
  splay: number;
}

export const FINGERS = {
  index: { lengths: [0.045, 0.027, 0.022], radius: 0.0088, spread: 0.026, splay: 0.06 },
  middle: { lengths: [0.05, 0.031, 0.024], radius: 0.0092, spread: 0.009, splay: 0.01 },
  ring: { lengths: [0.046, 0.029, 0.022], radius: 0.0086, spread: -0.01, splay: -0.04 },
  pinky: { lengths: [0.036, 0.022, 0.019], radius: 0.0078, spread: -0.028, splay: -0.1 },
} as const satisfies Record<string, FingerSpec>;

export type FingerName = keyof typeof FINGERS;

export interface HandPose {
  /** 0 = mão aberta, 1 = fechada em pinça */
  curl: number;
  /** 0 = relaxada, 1 = pinça firme */
  pinch: number;
  /** adução do polegar (aproxima da ponta do indicador) */
  thumbIn: number;
}

/** Cápsula com topo esférico: a dobra não mostra emenda */
function phalanx(len: number, radius: number) {
  const g = new THREE.CapsuleGeometry(radius, len, 4, 14);
  g.translate(0, len / 2, 0);
  return g;
}

/**
 * Constantes da pinça. Foram resolvidas por busca numérica (minimizar a
 * distância entre as pontas do polegar e do indicador na pose de pinça, com a
 * mão aberta mantendo vão suficiente). Não são valores estéticos.
 */
export const TUNING = {
  thumbAbduct: 1.02,
  thumbTiltX: 0.22,
  /**
   * Polegar na pinça, em radianos: CMC ≈ −2°, MCP ≈ 26°, IP ≈ 23°.
   * Um polegar quase reto encontra o indicador já curvado — é assim que a
   * pinça fina funciona de verdade (não é o polegar que dobra, é o indicador).
   */
  thumbFlex: [-0.026, 0.445, 0.399] as [number, number, number],
  /** adução do indicador em direção ao polegar (0 = alinhado ao eixo do dedo) */
  indexAdduct: 0,
  /**
   * Indicador na pinça: MCP 87°, PIP 61°, DIP 24° — dentro dos limites
   * anatômicos (MCP ≤ 90°, PIP ≤ 100°, DIP ≤ 80°). Valores resolvidos por
   * busca numérica; ver scripts/check-timelines.ts.
   */
  indexFlex: [1.522, 1.071, 0.419] as [number, number, number],
};

export interface HandRig {
  group: THREE.Group;
  /** articulações na ordem: MCP, PIP, DIP */
  joints: Record<FingerName, THREE.Group[]>;
  /** raiz de cada dedo, para adução/abdução */
  roots: Record<FingerName, THREE.Group>;
  thumb: THREE.Group[];
  geos: THREE.BufferGeometry[];
  /** ponto entre a ponta do polegar e do indicador (onde o cogumelo fica) */
  pinchPoint: THREE.Object3D;
}

export function buildHand(): HandRig {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const joints = {} as Record<FingerName, THREE.Group[]>;
  const roots = {} as Record<FingerName, THREE.Group>;
  const thumbJoint: THREE.Group[] = [];

  /* ------------------------------ palma ------------------------------ */
  const palmGeo = new THREE.BoxGeometry(0.072, 0.088, 0.026, 4, 4, 4);
  {
    const pos = palmGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // arredonda o contorno (raiz dos dedos mais estreita que a base)
      const nx = Math.abs(x) / 0.036;
      const ny = (y + 0.044) / 0.088;
      const taper = 1 - ny * 0.14;
      const round = 1 - Math.pow(Math.max(nx, Math.abs(ny * 2 - 1)), 8) * 0.5;
      pos.setXYZ(i, x * taper, y, z * (0.55 + round * 0.45));
    }
    palmGeo.computeVertexNormals();
  }
  geos.push(palmGeo);
  group.add(new THREE.Mesh(palmGeo));

  // tenar (musculatura do polegar) e hipotenar
  const thenarGeo = new THREE.SphereGeometry(0.022, 18, 14);
  const thenar = new THREE.Mesh(thenarGeo);
  thenar.scale.set(1.05, 1.5, 0.78);
  thenar.position.set(-0.028, -0.008, 0.006);
  geos.push(thenarGeo);
  group.add(thenar);

  /* ------------------------------ dedos ------------------------------ */
  (Object.keys(FINGERS) as FingerName[]).forEach((name, idx) => {
    const spec = FINGERS[name];
    const chain: THREE.Group[] = [];
    // encaixe na borda superior da palma, com leve arco (a "ponte" do dorso)
    const root = new THREE.Group();
    root.position.set(spec.spread, 0.042, Math.cos(idx * 0.9) * 0.004);
    root.rotation.z = spec.splay;
    roots[name] = root;
    group.add(root);

    let parent: THREE.Object3D = root;
    spec.lengths.forEach((len, i) => {
      const seg = new THREE.Group();
      if (i > 0) seg.position.y = spec.lengths[i - 1];
      const geo = phalanx(len, spec.radius * (1 - i * 0.11));
      geos.push(geo);
      seg.add(new THREE.Mesh(geo));
      parent.add(seg);
      parent = seg;
      chain.push(seg);
    });
    joints[name] = chain;
  });

  /* ------------------------------ polegar ------------------------------ */
  // O polegar sai da base da palma, em OPRESSÃO: rotacionado para encarar os
  // dedos. Sem isso a mão não consegue pinçar nada.
  const thumbRoot = new THREE.Group();
  thumbRoot.position.set(-0.034, -0.02, 0.004);
  /**
   * O polegar precisa APONTAR para os dedos. Rotação em +Z levaria o eixo +Y
   * para −X (para fora da mão); −Z leva para +X, que é onde está o indicador.
   * Com o sinal errado a pinça nunca fecha, por mais que as falanges dobrem.
   */
  thumbRoot.rotation.set(TUNING.thumbTiltX, 0, -TUNING.thumbAbduct);
  group.add(thumbRoot);

  const metaSeg = new THREE.Group();
  const metaGeo = phalanx(0.04, 0.0118);
  geos.push(metaGeo);
  metaSeg.add(new THREE.Mesh(metaGeo));
  thumbRoot.add(metaSeg);
  thumbJoint.push(metaSeg);

  const proxSeg = new THREE.Group();
  proxSeg.position.y = 0.04;
  const proxGeo = phalanx(0.031, 0.0104);
  geos.push(proxGeo);
  proxSeg.add(new THREE.Mesh(proxGeo));
  metaSeg.add(proxSeg);
  thumbJoint.push(proxSeg);

  const distSeg = new THREE.Group();
  distSeg.position.y = 0.031;
  const distGeo = phalanx(0.023, 0.0091);
  geos.push(distGeo);
  distSeg.add(new THREE.Mesh(distGeo));
  proxSeg.add(distSeg);
  thumbJoint.push(distSeg);

  // marcador no espaço da mão: onde o objeto segurado deve ficar.
  // Posicionado entre as pontas em repouso; a cena reposiciona se preciso.
  const pinchPoint = new THREE.Object3D();
  pinchPoint.position.set(0.002, 0.072, 0.03);
  group.add(pinchPoint);

  return { group, joints, roots, thumb: thumbJoint, geos, pinchPoint };
}

/**
 * Aplica a pose. Função PURA de `HandPose` — nada é acumulado, então voltar o
 * scroll restaura exatamente a mesma mão.
 */
export function applyHandPose(rig: HandRig, pose: HandPose) {
  const { curl, pinch, thumbIn } = pose;

  const flex: Record<FingerName, [number, number, number]> = {
    // o indicador é o que pinça: dobra menos na base para encontrar o polegar
    index: [
      TUNING.indexFlex[0] * pinch + 0.15 * curl,
      TUNING.indexFlex[1] * pinch + 0.2 * curl,
      TUNING.indexFlex[2] * pinch + 0.15 * curl,
    ],
    middle: [0.12 + curl * 1.15, 0.16 + curl * 1.3, 0.14 + curl * 0.95],
    ring: [0.16 + curl * 1.3, 0.2 + curl * 1.4, 0.16 + curl * 1.0],
    pinky: [0.22 + curl * 1.4, 0.24 + curl * 1.45, 0.18 + curl * 1.05],
  };

  (Object.keys(rig.joints) as FingerName[]).forEach((name) => {
    const chain = rig.joints[name];
    const f = flex[name];
    chain.forEach((seg, i) => {
      seg.rotation.x = f[i];
      seg.rotation.z = 0; // flexão pura: sem cisalhamento lateral
    });
  });

  // adução: o indicador se aproxima da linha média da mão ao pinçar
  rig.roots.index.rotation.z = FINGERS.index.splay - TUNING.indexAdduct * pinch;
  rig.roots.middle.rotation.z = FINGERS.middle.splay;
  rig.roots.ring.rotation.z = FINGERS.ring.splay;
  rig.roots.pinky.rotation.z = FINGERS.pinky.splay;

  // polegar: opressão (vem de trás e por baixo) + flexão em direção ao indicador
  const t = rig.thumb;
  t[0].rotation.x = TUNING.thumbFlex[0] + thumbIn * 0.12;
  t[0].rotation.z = -thumbIn * 0.18;
  t[1].rotation.x = TUNING.thumbFlex[1] + pinch * 0.2;
  t[2].rotation.x = TUNING.thumbFlex[2] + pinch * 0.22;
}

export function disposeHand(rig: HandRig) {
  rig.geos.forEach((g) => g.dispose());
}
