#!/usr/bin/env node
/**
 * Verifica o que o typecheck NÃO pega: se as cenas realmente chegaram ao
 * runtime. Uma cena pode compilar, passar no lint, e nunca ser montada porque
 * o catálogo central (src/scenes/stubs.tsx) ainda aponta para o placeholder.
 *
 * Foi exatamente esse o estado após o rebase na fundação nova: `?debug=1`
 * abria `03-mao-boca` e mostrava o stub "O LIMIAR".
 *
 * Checagens:
 *  1. cada pasta de cena exporta `Component` pelo index.tsx (contrato §5);
 *  2. não há `window.scrollTo` / RAF / ScrollTrigger / Lenis nas cenas (§6/§8);
 *  3. textBlocks em ordem crescente de `at` e dentro de 0..1 (contrato §1);
 *  4. scrollLength positivo (§1);
 *  5. o catálogo central importa a implementação real — falha se não importa.
 */
import { readFileSync, existsSync } from 'node:fs';

const SCENES = ['01-terra', '02-cogumelo', '03-mao-boca'];
const failures = [];
const notes = [];
const ok = (cond, msg) => (cond ? null : failures.push(msg));

const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '');

for (const id of SCENES) {
  const indexPath = `src/scenes/${id}/index.tsx`;
  const src = read(indexPath);
  if (!src) {
    failures.push(`${id}: falta ${indexPath}`);
    continue;
  }
  ok(/export\s*\{[^}]*\bComponent\b/.test(src), `${id}: index.tsx não exporta \`Component\` (contrato §5)`);

  // 2. proibições do contrato §6 e §8
  const dir = `src/scenes/${id}`;
  const files = ['index.tsx', `${id === '01-terra' ? 'Terra' : id === '02-cogumelo' ? 'Cogumelo' : 'MaoBoca'}.tsx`];
  for (const file of files) {
    const body = read(`${dir}/${file}`);
    for (const [pattern, why] of [
      [/window\.scrollTo|scrollIntoView/, 'chama scroll (contrato §6: só o motor rola)'],
      [/new\s+Lenis/, 'cria Lenis (contrato §6)'],
      [/ScrollTrigger\.|gsap\.ticker/, 'cria ScrollTrigger/ticker (contrato §6)'],
      [/requestAnimationFrame/, 'cria RAF próprio (contrato §8)'],
      [/window\.addEventListener\(\s*['"]scroll/, 'listener global de scroll (contrato §8)'],
    ]) {
      if (pattern.test(body)) failures.push(`${id}/${file}: ${why}`);
    }
  }

  // 3 e 4. metadados da definição
  const def = read(`${dir}/${indexPath.includes('index') ? '' : ''}${id === '01-terra' ? 'Terra' : id === '02-cogumelo' ? 'Cogumelo' : 'MaoBoca'}.tsx`);
  const at = [...def.matchAll(/\bat:\s*([0-9.]+)/g)].map((m) => parseFloat(m[1]));
  ok(at.length >= 2, `${id}: menos de 2 textBlocks`);
  for (let i = 1; i < at.length; i++) {
    ok(at[i] >= at[i - 1], `${id}: textBlocks fora de ordem (${at[i - 1]} → ${at[i]})`);
  }
  for (const v of at) ok(v >= 0 && v <= 1, `${id}: textBlock.at fora de 0..1 (${v})`);
  const len = def.match(/scrollLength:\s*(\d+)/);
  ok(!!len && parseInt(len[1], 10) > 0, `${id}: scrollLength ausente ou não positivo`);
  ok(new RegExp(`id:\\s*'${id}'`).test(def), `${id}: definição declara outro id`);
  notes.push(`${id}: ${at.length} blocos, scrollLength ${len?.[1] ?? '?'}vh`);
}

// 5. registro central — a checagem que teria evitado o bug do rebase
const catalog = read('src/scenes/stubs.tsx');
for (const id of SCENES) {
  const imported = new RegExp(`from\\s*'\\./${id}'`).test(catalog);
  if (!imported) {
    failures.push(
      `REGISTRO: src/scenes/stubs.tsx não importa './${id}' — a cena compila mas NUNCA é montada; ` +
      `?debug=1 mostra o stub no lugar dela. O registro é do dono do catálogo (contrato §5).`,
    );
  }
}

if (failures.length) {
  console.error(`\nESTRUTURA — ${failures.length} problema(s):\n`);
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}
console.log(`ESTRUTURA OK — ${SCENES.length} cenas`);
for (const n of notes) console.log('  ' + n);
