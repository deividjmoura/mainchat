import * as THREE from 'three';

export interface VascularStation {
  id: string;
  organ: string;
  subtitle: string;
  range: [number, number];
  /** Coordenada (x, y) no viewBox 0..100 x 0..195 da mini-silhueta corporal */
  mapCoord: [number, number];
  accent: string;
}

export const VESSEL_RADIUS = 2.25;

/**
 * Estações anatômicas guiadas pelo `progress` (0..1):
 * Sistema digestivo → Fígado → Coração → Artéria carótida → Barreira hematoencefálica / Cérebro
 */
export const VASCULAR_STATIONS: VascularStation[] = [
  {
    id: 'digestive',
    organ: 'Sistema Digestivo',
    subtitle: 'Mucosa entérica & veia mesentérica',
    range: [0.0, 0.2],
    mapCoord: [53, 156],
    accent: '#a78bfa',
  },
  {
    id: 'liver',
    organ: 'Fígado (Conversão)',
    subtitle: 'Fosfatase alcalina → Psilocina',
    range: [0.2, 0.42],
    mapCoord: [41, 130],
    accent: '#34d399',
  },
  {
    id: 'heart',
    organ: 'Coração',
    subtitle: 'Impulso sistólico & oxigenação',
    range: [0.42, 0.64],
    mapCoord: [52, 98],
    accent: '#fb7185',
  },
  {
    id: 'carotid',
    organ: 'Artéria Carótida',
    subtitle: 'Subida laminar ao encéfalo',
    range: [0.64, 0.84],
    mapCoord: [54, 62],
    accent: '#38bdf8',
  },
  {
    id: 'bbb',
    organ: 'Barreira Hematoencefálica',
    subtitle: 'Travessia lipofílica → Cérebro',
    range: [0.84, 1.0],
    mapCoord: [50, 26],
    accent: '#67e8f9',
  },
];

/**
 * Caminho vascular 3D contínuo em CatmullRomCurve3:
 * - Inicia em [0, 0, 5.5] atravessando [0, 0, 0] (match cut geométrico com o anel da Cena 03!)
 * - Desvia lateralmente pelos sinusoides hepáticos
 * - Curva pelo coração/arco aórtico e sobe verticalmente pela carótida interna
 * - Estabiliza alinhado ao eixo -Z no capilar cerebral para casar com a abertura da Cena 05!
 */
export function createVascularSpline(): THREE.CatmullRomCurve3 {
  const points = [
    // 0.00..0.20: Interior escuro pós-boca/estômago → capilar mesentérico
    new THREE.Vector3(0.0, 0.0, 5.5),
    new THREE.Vector3(0.4, -0.6, -2.5),
    new THREE.Vector3(3.8, -1.8, -11.5),

    // 0.20..0.42: Veia porta → Sinusoides do fígado
    new THREE.Vector3(8.5, -1.2, -20.5),
    new THREE.Vector3(6.8, 1.8, -30.0),
    new THREE.Vector3(0.6, 4.2, -38.5),

    // 0.42..0.64: Veia cava → Coração → Arco aórtico
    new THREE.Vector3(-5.6, 7.8, -46.5),
    new THREE.Vector3(-7.2, 13.5, -54.0),
    new THREE.Vector3(-2.8, 20.0, -61.0),

    // 0.64..0.84: Artéria carótida interna (ascensão rápida ao crânio)
    new THREE.Vector3(2.4, 27.5, -67.5),
    new THREE.Vector3(3.6, 35.0, -74.5),
    new THREE.Vector3(1.4, 41.2, -81.5),

    // 0.84..1.00: Microcapilar cerebral & travessia da Barreira Hematoencefálica (eixo -Z puro)
    new THREE.Vector3(0.2, 44.5, -88.5),
    new THREE.Vector3(0.0, 45.0, -96.0),
    new THREE.Vector3(0.0, 45.0, -104.5),
  ];

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.45);
}

export function getActiveVascularStation(progress: number): VascularStation {
  for (const station of VASCULAR_STATIONS) {
    if (progress >= station.range[0] && progress <= station.range[1]) {
      return station;
    }
  }
  return VASCULAR_STATIONS[VASCULAR_STATIONS.length - 1];
}
