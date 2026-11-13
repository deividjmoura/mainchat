# Mudanças necessárias fora das pastas de cena (Agente 2)

Base após rebase: `origin/feat/scrollytelling-foundation` @ **d3803ad**.
Contrato vigente: [`docs/CONTRACT.md`](./CONTRACT.md) v1.0 (congelado).

Meu escopo: `src/scenes/01-terra`, `src/scenes/02-cogumelo`,
`src/scenes/03-mao-boca` e `public/assets/01-terra|02-cogumelo|03-mao-boca`.
Nos **fixtures** que a fundação criou nesses caminhos eu mantive a minha
implementação; no resto, não toquei.

---

## 1. **BLOQUEADOR** — minhas cenas não estão no catálogo central

**Arquivo**: `src/scenes/stubs.tsx` (dono: Agente base / integração, contrato §4 e §5)

O contrato é explícito: *"O agente da cena não altera o catálogo compartilhado"*
(§5). Portanto **não registrei**. Consequência, verificada no runtime:

| teste | resultado |
|---|---|
| `?debug=1&cena=03-mao-boca` | abre a cena 03… mas renderiza o **stub** (`Component:Threshold`) |
| texto narrativo exibido | `03 / O LIMIAR` — vem do `stubs.tsx`, não da minha cena |
| `src/scenes/03-mao-boca/index.tsx` | exporta `Component` corretamente (contrato §5) |
| quem importa esse `index.tsx` | **ninguém** |

Ou seja: minhas três cenas compilam, passam no lint e no build, mas **nunca são
montadas**. O `check:structure` que adicionei falha de propósito enquanto isso durar.

### O que o dono do catálogo precisa fazer (3 linhas)

```diff
+import {Component as Terra, scene as terraScene} from './01-terra';
+import {Component as Cogumelo, scene as cogumeloScene} from './02-cogumelo';
+import {Component as MaoBoca, scene as maoBocaScene} from './03-mao-boca';
 export const scenes:SceneDefinition[]=[
-{id:'01-terra',scrollLength:140,Component:Soil,textBlocks:[...]},
-{id:'02-cogumelo',scrollLength:160,Component:Fungus,textBlocks:[...]},
-{id:'03-mao-boca',scrollLength:115,Component:Threshold,textBlocks:[...]},
+terraScene,
+cogumeloScene,
+maoBocaScene,
```

`scene` traz `id`, `scrollLength` e `textBlocks` que eu propus (ver
`src/scenes/<id>/README.md`). Se o texto narrativo for curadoria do projeto,
basta trocar os `textBlocks` e manter o `Component` — a cena não depende do
texto.

Os stubs `Soil` e `Fungus` ficam exportados (não removi nada) e continuam
disponíveis como fallback.

---

## 2. **BLOQUEADOR (pré-existente)** — `NarrativeText` quebra com menos blocos

**Arquivo**: `src/components/NarrativeText.tsx` (dono: Agente base, contrato §4)

`index` do bloco sobrevive à troca de cena. Reproduzido **na fundação nova, sem
nenhum código meu**, navegando pelo painel de debug da própria fundação:

```
?debug=1  ->  seletor "03-mao-boca"  ->  texto "03 / O LIMIAR"   (3 blocos, ok)
```

O crash aparece quando a cena seguinte tem **menos** blocos que a anterior. Com
o catálogo atual (2→3→2 blocos) ele não dispara; **com os meus `textBlocks`
(3→5→2) a cena 03 quebra a página** assim que for registrada. Corrijo meus
blocos para no máximo 3 enquanto isso? Não — o correto é o clamp.

**Correção** (uma linha, **no render**; em `useEffect` roda tarde demais):

```diff
- const b=blocks[index];
+ const b=blocks[Math.min(index,blocks.length-1)];
```

Está pronta e testada em `docs/patches/apply-0001.sh` (idempotente, valida depois
de aplicar). Rode `sh docs/patches/apply-0001.sh`.

## 3. ALTERADO — `package.json`: **somente** adições

Conforme o adendo: mantive todos os scripts e devDependencies da fundação e
acrescentei apenas o necessário para os meus gates.

```diff
   "lint": "eslint src",
+  "check:glsl": "node scripts/check-shaders.mjs",
+  "check:structure": "node scripts/check-structure.mjs",
+  "check:geometry": "node scripts/check-geometry.mjs",
+  "check:logic": "tsx scripts/check-timelines.ts",
+  "measure:weight": "node scripts/measure-weight.mjs",
+  "verify": "npm run typecheck && npm run lint && npm run check:glsl && npm run check:structure && npm run check:geometry && npm run check:logic && npm run build"
...
   "typescript-eslint": "^8.46.4",
+  "@shaderfrog/glsl-parser": "^7.0.1",
+  "tsx": "^4.23.15"
```

`@shaderfrog/glsl-parser` valida o GLSL; `tsx` roda o teste de lógica em
TypeScript. Nenhum script existente foi alterado ou removido.

## 4. REVERTIDO — `vite.config.ts` voltou à versão da fundação

Eu havia adicionado `server.allowedHosts` porque o preview do sandbox respondia
`403 Blocked request`. O adendo proíbe alterar esse arquivo, então **restaurei
verbatim**. Consequência: a pré-visualização embutida não abre por esse host;
testei tudo por `localhost`.

**Se quiserem o preview funcionando**, esta é a mudança (3 linhas):

```ts
export default defineConfig({ plugins:[react()], server:{ host:'0.0.0.0', allowedHosts:['.e2b.app'] }, preview:{ allowedHosts:['.e2b.app'] } });
```

## 5. REVERTIDO — `eslint.config.js` é o da fundação

O adendo proíbe alterar. Uso o `lint` da fundação (`eslint src`) sem mudanças.
Meus scripts em `scripts/` não são cobertos por ele (ficam fora de `src`), o que é
aceitável: eles falham alto quando têm problema.

## 6. OBSERVAÇÃO — `src/scenes/_shared/` (arquivos novos, nenhum da fundação)

Câmera, texturas procedurais, partículas e materiais compartilhados pelas três
cenas. Todos os arquivos são **novos**; nenhum arquivo da fundação foi alterado
ali. O contrato §3 não prevê essa pasta.

**Se o critério for rígido**, a alternativa é mover `_shared/` para
`src/scenes/01-terra/_internal/` e importar de lá. Funciona, mas cria acoplamento
pior entre cenas independentes. A decisão é de vocês.

## 7. RESOLVIDO — `?qualidade=` e o meu painel de debug saíram

Meu `SceneDebug.tsx` montava um painel próprio e aceitava `?cena=` e `?qualidade=`.
Com o contrato §7, o painel é `src/ui/DebugPanel.tsx` (da fundação).
**Removi o meu harness inteiro** e as cenas agora só consomem `progress` —
conforme §6, nenhuma cena chama `scrollTo`, cria RAF ou toca no Lenis.
`?debug=1` funciona pelo painel da fundação (seletor de cena + slider de progresso).

## 8. CONFORME — montagem de cenas adjacentes

O `App.tsx` monta a cena ativa e as vizinhas (`Math.abs(index-activeIndex)<=1`)
para a transição já ter a próxima composição pronta. Isso significa que
`useFrame` roda em cenas invisíveis. Adicionei uma guarda em cada cena: ela só
dirige a câmera compartilhada quando a cadeia de ancestrais está visível
(`chainVisible(rootRef.current)`). Sem isso, duas cenas brigariam pela câmera.

## 9. CONFORME — ids e pastas de assets

A fundação usa `04-veias` / `05-cerebro`. Meus assets estão em
`public/assets/01-terra|02-cogumelo|03-mao-boca`, alinhados com os ids. A pasta
antiga `public/assets/03-limiar/` não existe mais na fundação nova — nada a fazer.
