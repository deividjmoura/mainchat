# Solicitações de Coordenação — Agente 3 (`04-veias` & `05-cerebro`)

Em conformidade com `docs/CONTRACT.md` v1.0 (§4 e §5) e o adendo de escopo estrito do Agente 3, **este PR altera exclusivamente `src/scenes/04-veias/**`, `src/scenes/05-cerebro/**`, `public/assets/04-veias/**` e `public/assets/05-cerebro/**`** (além deste documento e de `ASSETS.md`). Nenhum arquivo em `src/core`, `src/design`, `src/ui`, `src/content`, `src/components`, `src/hooks` ou `src/scenes/stubs.tsx` foi modificado.

Abaixo estão as mudanças solicitadas ao **Agente Base / Integração** para conectar e consolidar as cenas na branch `feat/scrollytelling-foundation`:

---

## 1. Registro de `04-veias` e `05-cerebro` no Catálogo Central (`src/scenes/stubs.tsx`)

- **Motivo (`docs/CONTRACT.md` v1.0 §5 Passo 5)**: *"O responsável pelo motor atualiza `src/scenes/stubs.tsx`/catálogo com o componente e sua definição (`id`, `scrollLength`, `textBlocks`, `Component`) e verifica a ordem narrativa. O agente da cena não altera o catálogo compartilhado."*
- **Exportações prontas**:
  - `src/scenes/04-veias/index.tsx` exporta `Component`, `scene04TextBlocks`, `scene04Veias: SceneDefinition` (`id: '04-veias'`, `scrollLength: 340`) e `default`.
  - `src/scenes/05-cerebro/index.tsx` exporta `Component`, `scene05TextBlocks`, `scene05Cerebro: SceneDefinition` (`id: '05-cerebro'`, `scrollLength: 420`) e `default`.
- **Alteração sugerida em `src/scenes/stubs.tsx`**:
  ```diff
  +import { scene04Veias } from './04-veias';
  +import { scene05Cerebro } from './05-cerebro';
   export const scenes:SceneDefinition[]=[
     {id:'01-terra', ...},
     {id:'02-cogumelo', ...},
     {id:'03-mao-boca', ...},
  -  {id:'04-veias',scrollLength:145,Component:Veins,textBlocks:[...]},
  -  {id:'05-cerebro',scrollLength:170,Component:Brain,textBlocks:[...]}
  +  scene04Veias,
  +  scene05Cerebro
   ];
  ```

---

## 2. Clamp de Segurança no Índice de Blocos em `src/components/NarrativeText.tsx`

- **Arquivo**: `src/components/NarrativeText.tsx`
- **Problema**: Quando o usuário rola de volta ou salta pelo `?debug=1` de uma cena com mais `textBlocks` (ex.: `04-veias` ou `05-cerebro`, que possuem 6 blocos, `index` até `5`) para uma cena com menos blocos (ex.: `03-mao-boca` ou `01-terra` com 2 blocos), o primeiro render síncrono antes do `useEffect` lê `const b = blocks[index]`, resultando em `undefined` e erro em `b.title`.
- **Sugestão para o Agente Base**:
  ```diff
  -const b=blocks[index];
  +const b=blocks[Math.min(index,blocks.length-1)]??blocks[0];
  ```

---

## 3. Atualização das Chaves de Transição em `src/core/transitions.ts`

- **Arquivo**: `src/core/transitions.ts` (linhas 9–11)
- **Problema**: As chaves atuais usam os slugs preliminares `'03-limiar->04-veias'` e `'04-circulacao->05-cerebro'`, enquanto os IDs congelados no contrato são `'03-mao-boca'`, `'04-veias'` e `'05-cerebro'`.
- **Sugestão para o Agente Base**:
  ```diff
  -'03-limiar->04-veias':{from:'03-limiar',to:'04-veias',mode:'portal'},
  -'04-circulacao->05-cerebro':{from:'04-circulacao',to:'05-cerebro',mode:'crossfade'}
  +'03-mao-boca->04-veias':{from:'03-mao-boca',to:'04-veias',mode:'portal'},
  +'04-veias->05-cerebro':{from:'04-veias',to:'05-cerebro',mode:'crossfade'}
  ```
- **Workaround local já ativo nas Cenas 04 e 05**:
  - `04-veias` inicia em `#0a0403` (cor exata de saída da Cena `03-mao-boca`), evolui para `#2a0d12` (`palette.blood.background`) e encerra na Barreira Hematoencefálica em `#10101f` (`palette.neural.background`), alinhada em `-Z`.
  - `05-cerebro` inicia em `#10101f` emergindo de um capilar pial recuante alinhado ao mesmo eixo `-Z` (`FOV 46°`), garantindo continuidade visual mesmo sem `.transition-veil`.

---

## 4. Detecção Estrita de WebGL2 em `src/hooks/useQuality.ts`

- **Arquivo**: `src/hooks/useQuality.ts` (linha 12)
- **Problema**: `Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))` retorna `true` em navegadores que suportam apenas WebGL1, mas `three@0.180.0` exige WebGL2.
- **Sugestão para o Agente Base**: Verificar `Boolean(canvas.getContext('webgl2'))`.
- **Workaround local já ativo nas Cenas 04 e 05**: `useVeinQualityConfig()` e `useBrainQualityConfig()` checam `gl.capabilities.isWebGL2` (e aceitam `?webgl2=0` e `?quality=low|medium|high` para testes), exibindo automaticamente os fallbacks `/assets/04-veias/fallback-veins.svg` e `/assets/05-cerebro/fallback-brain.svg`.
