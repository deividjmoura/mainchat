# Mudanças necessárias fora das pastas de cena (Agente 2)

O briefing pede que eu **não** altere `src/core`, `src/design`, `src/ui`,
`src/content` e que registre aqui o que for necessário. A fundação real não tem
essas pastas (tem `src/components`, `src/scroll`, `src/store`, `src/hooks`,
`src/design`), então usei o critério: tudo o que **não** for
`src/scenes/**` + `public/assets/**` é "fora de escopo" e está listado aqui.

## 1. CORRIGIDO (bloqueava a entrega) — crash ao trocar de cena

**Arquivo**: `src/components/NarrativeText.tsx`
**Severidade**: alta — a página quebrava (tela em branco) na cena 03.

`index` de bloco sobrevivia à troca de cena. A cena 02 tem 5 blocos, a 03 tem 2;
ao entrar na 03 com `index = 2`, o componente crashava em `blocks[index].eyebrow`.
Reproduzido sem nenhum código meu: navegação normal 01 → 02 → 03.

Correção aplicada (uma linha, no render — não em efeito, que roda tarde demais):

```diff
- const b=blocks[index];
+ const b=blocks[Math.min(index,blocks.length-1)];
```

**Sugestão para o Agente 1**: subir para o arquivo original; o `key={b.title}`
no `<div>` já remonta o bloco, então o clamp é suficiente.

## 2. ADICIONADO — `lint` não existia

**Arquivo**: `package.json`, `eslint.config.js` (novo), devDependencies

A fundação só tinha `dev`, `build`, `preview`, `typecheck`. O briefing exige
rodar `lint`. Adicionei `eslint` 9 + `typescript-eslint` + `eslint-plugin-react-hooks`
e o script `lint`. Configuração mínima e sem ruído (não impõe estilo).

Também adicionei: `check:glsl`, `check:geometry`, `check:logic`,
`measure:weight` e `verify` (roda tudo em sequência).

## 3. ALTERADO — `vite.config.ts`: preview do sandbox dava 403

**Severidade**: bloqueava ver a aplicação no preview.

O Vite respondia `403 Blocked request` para o host do preview
(`<porta>-<id>.e2b.app`). Adicionei `server.allowedHosts` / `preview.allowedHosts`
com `.e2b.app`. **Não** é mudança de app, é configuração de ambiente de preview;
se o projeto não usa esse preview, o diff pode ser descartado.

## 4. NECESSÁRIO — `?debug=1` não existe na fundação

**Arquivo desejado**: `src/App.tsx` (leitura do parâmetro) — hoje o harness vive
em `src/scenes/_shared/SceneDebug.tsx` e cada cena o invoca.

O briefing pede integração via `?debug=1`. A fundação não tinha nada disso.
Implementei **sem tocar no App** (regra do briefing), mas por isso o painel só
aparece quando uma cena é montada, e o salto para uma cena específica precisou
de um boot no nível do módulo (funciona, mas é feio).

**Pedido**: no `App.tsx`, ler `?debug=1` e renderizar o painel no nível da
aplicação (draw calls, triângulos, FPS, MB da cena ativa), além de aceitar
`cena` e `p` para congelar o progresso. O componente já existe e é reutilizável —
só precisa ser montado uma vez, fora das cenas.

## 5. NECESSÁRIO — `onEnter` não dispara ao abrir a página no meio de uma seção

**Arquivo**: `src/scroll/SceneManager.ts` (não alterei; ver abaixo)

Se a página abre já dentro de uma seção (recarregar com scroll salvo, ou um link
âncora), o `ScrollTrigger` não dispara `onEnter` — o texto e o canvas ficam na
cena 01 com o scroll na 02 ou 03.

**Workaround que usei** (dentro de `src/scenes/_shared/SceneDebug.tsx`): depois
de rolar, forço um deslocamento de +160 px para obrigar o recálculo.

**Correção recomendada** (uma linha no `SceneManager`):

```diff
 onEnter:()=>onSceneChange(scene),onEnterBack:()=>onSceneChange(scene),
+onToggle:self=>{if(self.isActive)onSceneChange(scene)},
```

Testei a linha e ela funciona — mas a **reverti** para não violar a regra de
escopo. O arquivo `src/scroll/SceneManager.ts` está **intacto**.

Com o workaround do item 5, o comportamento observado é: 01→02→03→04→05 trocam
de cena corretamente ao rolar; o único caso que ainda depende da correção é
abrir a página parado no meio de uma seção (ex.: F5 com scroll restaurado), em
que o texto pode ficar na cena anterior até o primeiro scroll.

## 6. OBSERVAÇÃO — nomenclatura da cena 03

A fundação registra `03-limiar`; o briefing pede `03-mao-boca`. **Substituí o
slot 3** por `03-mao-boca`. As cenas 04 e 05 continuam intocadas.

A pasta `public/assets/03-limiar/` ficou órfã (só tem o README original). A
decisão sobre apagar ou reaproveitar o README é do Agente 1 — não removi nada
fora do escopo.

## 7. OBSERVAÇÃO — peso do vendor-3d

`vendor-3d` = 275 kB gzip, 65% do total. O `EffectComposer` só é usado em
qualidade ≥ média: separá-lo em chunk carregado sob demanda deve cortar
~30–60 kB do caminho crítico. Precisa mexer no `App.tsx` (import dinâmico +
`Suspense`), por isso não fiz.
