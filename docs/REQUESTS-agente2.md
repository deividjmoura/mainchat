# Mudanças necessárias fora das pastas de cena (Agente 2)

Regra que segui nesta entrega: **só** `src/scenes/01-terra`, `src/scenes/02-cogumelo`,
`src/scenes/03-mao-boca` e `public/assets/01-terra|02-cogumelo|03-mao-boca`
podem ser alterados. `src/core`, `src/design`, `src/ui` e `src/content` **não
existem** nesta fundação (ela tem `src/components`, `src/scroll`, `src/store`,
`src/hooks`, `src/design`). Adotei o critério conservador: qualquer arquivo fora
das três pastas de cena é "fora de escopo" e está listado aqui.

Nos casos em que precisei mexer em um arquivo compartilhado, deixei um
**workaround dentro do meu escopo** e registrei a correção recomendada. Onde o
workaround é impossível, o item está marcado como **BLOQUEADOR**.

---

## 1. **BLOQUEADOR** — a página quebra ao entrar na cena 03

**Arquivo**: `src/components/NarrativeText.tsx`
**Status**: **arquivo intacto** (revertido). O patch está em `docs/patches/apply-0001.sh`.

O `index` do bloco de texto sobrevive à troca de cena. A cena 02 tem 5 blocos, a
03 tem 2: ao entrar na 03 com `index = 2`, o componente crasha em
`blocks[index].eyebrow` e a página fica em branco.

**Reprodução** (sem nenhum código meu, medido neste repositório):

```
01-terra      -> rail:01  texto:"SERAPILHEIRA"   ok
02-cogumelo   -> rail:02  texto:"PRIMÓRDIO"      ok
03-mao-boca   -> rail:null texto:""              ERRO: Cannot read properties of
                                                  undefined (reading 'eyebrow')
```

Não é bug da minha cena: qualquer cena com menos blocos que a anterior dispara.
Minha cena 03 é apenas a primeira a ter 2 blocos depois de uma com 5.

**Correção** (uma linha, e precisa ser **no render** — em `useEffect` roda
depois, quando a exceção já estourou):

```diff
- const b=blocks[index];
+ const b=blocks[Math.min(index,blocks.length-1)];
```

Aplicar: `sh docs/patches/apply-0001.sh` (idempotente, testado).
Com o patch aplicado, a jornada 01→05 e a volta passam sem nenhum erro de página.

**Enquanto não for aplicado**, a cena 03 é inalcançável pela navegação normal.
Para inspecioná-la, use `?debug=1&cena=03-mao-boca` — o painel monta a cena, mas
o texto narrativo continua quebrado.

---

## 2. **BLOQUEADOR** — o registro de cenas é `src/scenes/stubs.tsx`

**Arquivo**: `src/scenes/stubs.tsx` (e o `README.md` ao lado)

Substituí os três stubs por imports das cenas reais *dentro do próprio arquivo*
de registro. Não há como registrar uma cena sem tocar nele: `App.tsx` importa
`./scenes/stubs` e `ProgressRail.tsx` importa `../scenes/stubs`. Renomear o
arquivo (por exemplo, para `src/scenes/index.ts`) quebraria os dois — testei e
o build falha.

O diff é mínimo e não altera as cenas 04/05:

```diff
+import {scene as terraScene} from './01-terra';
+import {scene as cogumeloScene} from './02-cogumelo';
+import {scene as maoBocaScene} from './03-mao-boca';
 ...
-{id:'01-terra', ...stub...},
-{id:'02-cogumelo', ...stub...},
-{id:'03-limiar', ...stub...},
+terraScene,
+cogumeloScene,
+maoBocaScene,
 {id:'04-circulacao', ...},
 {id:'05-cerebro', ...},
```

**Pedido para o Agente 1**: mover o array `scenes` para `src/scenes/index.ts`
(ou para `src/content`, quando existir) e deixar `stubs.tsx` apenas como
catálogo de stubs. Aí a integração deixa de tocar em arquivo compartilhado.

---

## 3. ADICIONADO — `src/scenes/_shared/` (arquivos novos, não da fundação)

Câmera, texturas procedurais, partículas e o harness de debug vivem em
`src/scenes/_shared/`. Tecnicamente não é uma das três pastas de cena, mas
**nenhum arquivo da fundação foi alterado ali** — são todos arquivos novos, e
ficam dentro de `src/scenes/`.

Motivo: as três cenas usam o mesmo rig de câmera responsivo e o mesmo material
de micélio. Copiar isso para dentro de cada pasta duplicaria ~1.300 linhas e
garantiria divergência entre as cenas.

**Se o critério for "só dentro das três pastas"**, a opção é mover
`_shared/` para `src/scenes/01-terra/_internal/` e importar de lá nas outras
duas — funciona, mas cria um acoplamento pior. Prefiro deixar a decisão com o
Agente 1.

## 4. ADICIONADO — `lint` não existia

**Arquivos**: `package.json`, `eslint.config.js` (novo)

A fundação só tinha `dev`, `build`, `preview` e `typecheck` — sem `eslint` nas
devDependencies. O briefing exige rodar `lint`, então adicionei `eslint` 9 +
`typescript-eslint` + `eslint-plugin-react-hooks`, com configuração mínima (sem
regras de estilo).

Também adicionei `check:glsl`, `check:geometry`, `check:logic`,
`measure:weight` e `verify` (roda tudo em sequência).

## 5. ALTERADO — `vite.config.ts`: preview respondia 403

O Vite bloqueava o host do preview do sandbox (`<porta>-<id>.e2b.app`) com
`403 Blocked request`. Adicionei `server.allowedHosts` / `preview.allowedHosts`
com `.e2b.app`. É configuração de ambiente, não de aplicação — se o projeto não
usa esse preview, o diff pode ser descartado sem efeito.

## 6. NECESSÁRIO — `?debug=1` não existe na fundação

O harness vive em `src/scenes/_shared/SceneDebug.tsx` e cada cena o invoca.
Por isso o painel só aparece quando uma cena está montada, e o salto para uma
cena específica precisou de um boot no nível do módulo (funciona, mas é feio).

**Pedido**: ler `?debug=1` no `App.tsx` e montar o painel uma única vez, no
nível da aplicação, aceitando `cena` e `p` para congelar o progresso.

## 7. NECESSÁRIO — `onEnter` não dispara ao abrir a página no meio de uma seção

**Arquivo**: `src/scroll/SceneManager.ts` — **intacto**.

Se a página abre já dentro de uma seção (F5 com scroll restaurado, link âncora),
o `ScrollTrigger` não dispara `onEnter` e o texto fica na cena anterior até o
primeiro scroll. Testei a correção e ela funciona:

```diff
 onEnter:()=>onSceneChange(scene),onEnterBack:()=>onSceneChange(scene),
+onToggle:self=>{if(self.isActive)onSceneChange(scene)},
```

**Revertido** para respeitar o escopo. A navegação rolando normalmente está
correta; só o caso de abrir parado no meio falha.

## 8. OBSERVAÇÃO — nomenclatura da cena 03

A fundação registra `03-limiar`; o briefing pede `03-mao-boca`. **Substituí o
slot 3**. As cenas 04 e 05 continuam intocadas. A pasta
`public/assets/03-limiar/` ficou órfã (só tem o README original) — não removi
nada fora do escopo.

## 9. OBSERVAÇÃO — peso do vendor-3d

`vendor-3d` = 275 kB gzip, 65% do total. O `EffectComposer` só é usado em
qualidade ≥ média; separá-lo em chunk sob demanda deve cortar 30–60 kB do
caminho crítico. Exige import dinâmico no `App.tsx`, por isso não fiz.
