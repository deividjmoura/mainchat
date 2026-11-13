/**
 * Testes de lógica pura das cenas 02 e 03.
 * Roda com tsx: `npx tsx scripts/check-timelines.ts`.
 *
 * O que se testa aqui é o que quebra silenciosamente em scrollytelling:
 * monotonias erradas, saltos no scrub reverso, e a mão não conseguindo
 * realmente pinçar (as pontas não se encontram).
 */
import * as THREE from 'three';
import { cycleAt } from '../src/scenes/02-cogumelo/timeline';
import { gestureAt } from '../src/scenes/03-mao-boca/timeline';
import { applyGrowth, createMaterials } from '../src/scenes/02-cogumelo/mushroom';
import { buildHand, applyHandPose } from '../src/scenes/03-mao-boca/hand';

let pass = 0;
const failures: string[] = [];
const check = (cond: boolean, msg: string) => (cond ? pass++ : failures.push(msg));

const SAMPLES = 200;
const range = (fn: (p: number) => void) => {
  for (let i = 0; i <= SAMPLES; i++) fn(i / SAMPLES);
};

/* ------------------ 02: ciclo é monótono e reversível ------------------ */
{
  let prev = cycleAt(0);
  let growthMonotonic = true;
  let openMonotonic = true;
  let dryMonotonic = true;
  let wiltMonotonic = true;
  range((p) => {
    const c = cycleAt(p);
    if (c.growth < prev.growth - 1e-9) growthMonotonic = false;
    if (c.open < prev.open - 1e-9) openMonotonic = false;
    if (c.dry < prev.dry - 1e-9) dryMonotonic = false;
    if (c.wilt < prev.wilt - 1e-9) wiltMonotonic = false;
    prev = c;
  });
  check(growthMonotonic, '02: growth nunca retrocede');
  check(openMonotonic, '02: open nunca retrocede');
  check(dryMonotonic, '02: dry nunca retrocede');
  check(wiltMonotonic, '02: wilt nunca retrocede');

  // continuidade: nenhum canal pode dar saltos entre amostras vizinhas
  let worstJump = 0;
  let prevC = cycleAt(0);
  range((p) => {
    const c = cycleAt(p);
    for (const k of ['network', 'primordium', 'growth', 'open', 'spores', 'dry', 'wilt', 'life'] as const) {
      worstJump = Math.max(worstJump, Math.abs(c[k] - prevC[k]));
    }
    prevC = c;
  });
  /**
   * Amostragem de 1/200 de progresso ≈ 1,1 px de scroll num documento de
   * 22.000 px. O primórdio é a transição mais rápida do ciclo (nasce e
   * desaparece em ~0,16 de progresso), então o limite fica em 0,15 — acima
   * disso a mudança seria visível como um "estalo" entre dois frames.
   */
  check(worstJump < 0.15, `02: maior salto entre amostras ${worstJump.toFixed(3)} (limite 0.15)`);

  check(cycleAt(0).growth === 0 && cycleAt(0).open === 0, '02: começa sem corpo frutífero');
  check(cycleAt(1).wilt > 0.95, '02: termina colapsado');
  check(cycleAt(1).dry > 0.95, '02: termina seco');
  check(cycleAt(0.72).open > 0.99, '02: chapéu totalmente aberto ao fim da fase de abertura (p=0.72)');

  // determinismo: p → mesmo resultado
  const a = JSON.stringify(cycleAt(0.437));
  const b = JSON.stringify(cycleAt(0.437));
  check(a === b, '02: cycleAt é determinístico');
}

/* ------------------ 02: geometria cresce de forma plausível ------------------ */
{
  const mats = createMaterials();
  applyGrowth(mats, { growth: 0, open: 0, wilt: 0, dry: 0 });
  const youngStem = mats.stem.uniforms.uStemLen.value as number;
  check(youngStem < 1e-6, '02: caule ausente no início');

  applyGrowth(mats, { growth: 1, open: 0, wilt: 0, dry: 0 });
  const stem = mats.stem.uniforms.uStemLen.value as number;
  const capR0 = mats.cap.uniforms.uCapR.value as number;
  const capH0 = mats.cap.uniforms.uCapH.value as number;

  applyGrowth(mats, { growth: 1, open: 1, wilt: 0, dry: 0 });
  const capR1 = mats.cap.uniforms.uCapR.value as number;
  const capH1 = mats.cap.uniforms.uCapH.value as number;
  const stemR = mats.stem.uniforms.uStemR.value as number;

  check(stem > 0.03 && stem < 0.04, `02: caule maduro ${(stem * 100).toFixed(2)} cm`);
  // proporção real de Agaricales: chapéu maduro Ø / caule Ø ≈ 5–8
  const ratio = (capR1 * 2) / (stemR * 2);
  check(ratio > 5 && ratio < 8, `02: chapéu/caule = ${ratio.toFixed(2)} (esperado 5–8)`);
  check(capR1 > capR0, '02: abrir aumenta o diâmetro do chapéu');
  check(capH1 < capH0, '02: abrir achata a calota');
  // calota/raio entre 0.4 e 1.0 em toda a vida
  for (const open of [0, 0.25, 0.5, 0.75, 1]) {
    applyGrowth(mats, { growth: 1, open, wilt: 0, dry: 0 });
    const h = mats.cap.uniforms.uCapH.value as number;
    const r = mats.cap.uniforms.uCapR.value as number;
    const k = h / r;
    check(k > 0.4 && k < 1.0, `02: calota/raio = ${k.toFixed(2)} em open=${open}`);
  }
  // secagem aumenta o enrugamento e mata o brilho
  applyGrowth(mats, { growth: 1, open: 1, wilt: 0, dry: 1 });
  check((mats.cap.uniforms.uWrinkle.value as number) > 0.8, '02: secagem enruga o tecido');
  check((mats.cap.uniforms.uWet.value as number) < 0.2, '02: secagem remove o brilho úmido');
}

/* ------------------ 03: gesto é monótono e termina fechado ------------------ */
{
  let prev = gestureAt(0);
  let enterMono = true;
  let closeMono = true;
  range((p) => {
    const g = gestureAt(p);
    if (g.enter < prev.enter - 1e-9) enterMono = false;
    if (g.close < prev.close - 1e-9) closeMono = false;
    prev = g;
  });
  check(enterMono, '03: enter nunca retrocede');
  check(closeMono, '03: close nunca retrocede');
  check(gestureAt(0).enter === 0, '03: a mão não está em cena no início');
  check(gestureAt(1).close > 0.99, '03: a imagem fecha por completo no fim');
  // a hesitação sobe e desce — é intencional, não um bug
  check(gestureAt(0.72).hold > gestureAt(0.6).hold, '03: há hesitação antes do fechamento');
  check(gestureAt(0.95).hold < 0.1, '03: a hesitação se resolve antes do fim');
}

/* ------------------ 03: a mão REALMENTE pinça ------------------ */
{
  const rig = buildHand();
  const tip = (chain: THREE.Group[]) => {
    const last = chain[chain.length - 1];
    const marker = new THREE.Object3D();
    // ponta da última falange, no espaço local dela
    marker.position.set(0, 0.022, 0);
    last.add(marker);
    return marker;
  };
  const thumbTip = tip(rig.thumb);
  const indexTip = tip(rig.joints.index);

  applyHandPose(rig, { curl: 0, pinch: 0, thumbIn: 0 });
  rig.group.updateMatrixWorld(true);
  const openGap = thumbTip.getWorldPosition(new THREE.Vector3()).distanceTo(
    indexTip.getWorldPosition(new THREE.Vector3()),
  );

  applyHandPose(rig, { curl: 0.6, pinch: 1, thumbIn: 1 });
  rig.group.updateMatrixWorld(true);
  const pinchGap = thumbTip.getWorldPosition(new THREE.Vector3()).distanceTo(
    indexTip.getWorldPosition(new THREE.Vector3()),
  );

  check(pinchGap < openGap, `03: pinça aproxima as pontas (${openGap.toFixed(3)} → ${pinchGap.toFixed(3)} m)`);
  check(pinchGap < 0.045, `03: pontas ficam a ${(pinchGap * 100).toFixed(1)} cm (precisa < 4.5 cm para segurar)`);
  check(openGap > 0.05, `03: mão aberta tem vão de ${(openGap * 100).toFixed(1)} cm`);

  // o polegar precisa estar do lado do indicador, não atrás da palma
  applyHandPose(rig, { curl: 0.6, pinch: 1, thumbIn: 1 });
  rig.group.updateMatrixWorld(true);
  const thumbTipPos = thumbTip.getWorldPosition(new THREE.Vector3());
  check(
    thumbTipPos.z > 0.02,
    `03: ponta do polegar à frente da palma (z=${thumbTipPos.z.toFixed(3)}, precisa > 0.02)`,
  );
  check(
    thumbTipPos.x > -0.01,
    `03: polegar dentro do contorno da mão (x=${thumbTipPos.x.toFixed(3)})`,
  );

  // pose aplicada duas vezes = idêntica (sem acumulação)
  const read = () => rig.joints.middle.map((j) => j.rotation.x).join(',');
  applyHandPose(rig, { curl: 0.5, pinch: 0.3, thumbIn: 0.2 });
  const once = read();
  applyHandPose(rig, { curl: 0.5, pinch: 0.3, thumbIn: 0.2 });
  check(once === read(), '03: pose não acumula (scrub reverso seguro)');
}

if (failures.length) {
  console.error(`\n${failures.length} falha(s):`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log(`LOGICA OK — ${pass} asserções`);
