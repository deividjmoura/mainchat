# Integração das três cenas (Agente 2)

## O que foi feito

As cenas `01-terra`, `02-cogumelo` e `03-mao-boca` substituíram os stubs de
mesmo índice em `src/scenes/stubs.tsx`. As cenas `04-circulacao` e `05-cerebro`
continuam exatamente como estavam.

```
src/scenes/
├── _shared/            ← comum às três (não é cena)
│   ├── math.ts         interpolação pura + RNG determinístico
│   ├── camera.ts       rig por keyframes, FOV responsivo, roll, tremor de mão
│   ├── textures.ts     húmus, folhas, casca, pele (canvas 2D)
│   ├── gl.ts           partículas, filamentos, material do micélio, merge
│   └── useReducedMotion.ts
├── 01-terra/           index.tsx (porta) · Terra.tsx · ground.tsx · LightShafts.tsx · README.md
├── 02-cogumelo/        index.tsx (porta) · Cogumelo.tsx · mushroom.ts · timeline.ts · README.md
└── 03-mao-boca/        index.tsx (porta) · MaoBoca.tsx · hand.ts · timeline.ts · README.md
```

Contrato respeitado (v1.0, `docs/CONTRACT.md`): cada pasta exporta `Component`
pelo `index.tsx` e uma definição `scene` com `id`, `scrollLength` e `textBlocks`.
**Nenhuma cena cria store, RAF, Lenis ou ScrollTrigger.** Todo estado de animação
é derivado de `progress.get()` dentro de `useFrame`.

O `App` monta a cena ativa e as adjacentes; cada cena verifica a cadeia de
ancestrais e só dirige a câmera quando está visível, para não disputar o canvas
com a vizinha.

## Como ver

```bash
npm install
npm run dev
# http://localhost:5173/
```

### Modo de depuração

O painel agora é o **da fundação** (`src/ui/DebugPanel.tsx`, contrato §7):

```
?debug=1
```

Dá seletor de cena, slider de progresso (0..1, passo 0,001), FPS do ticker e
nível de qualidade. **Não usei mais painel próprio:** o `SceneDebug.tsx` que eu
tinha (com `?cena=` e `?qualidade=`) foi removido — ele chamava `window.scrollTo`,
o que o contrato §6 proíbe dentro de uma cena.

Para inspecionar uma batida específica: abra `?debug=1`, escolha a cena no
seletor e arraste o slider (`p=0.1` primórdio, `0.45` caule alongando, `0.7`
chapéu aberto, `0.92` secagem, `1` colapso).

> **Estado atual:** com o catálogo central ainda apontando para os stubs, o
> seletor mostra os placeholders, não estas cenas. Ver
> `docs/REQUESTS-agente2.md` item 1.

## Continuidade entre cenas

Verificado automaticamente por `npm run check:geometry`:

| transição | cor | estado |
|---|---|---|
| 01 → 02 | `#0d0a06` nas duas pontas | ✓ |
| 02 → 03 | `#120d08` nas duas pontas | ✓ |
| 03 → 04 | 03 fecha em `#0a0403` (primeira cor da 04) | ✓ |

Direção de luz mantida (quente, lateral, vinda da esquerda/alta). A cena 02
termina no escuro com o corpo seco; a 03 entra no mesmo escuro e a primeira
coisa que aparece é a sombra da mão.

## Enquadramento responsivo

O `fov` do three é vertical. Em retrato o campo horizontal encolhe ~4× e o
assunto vaza do quadro — foi o bug mais caro na primeira versão. `_shared/camera.ts`
mantém o **campo horizontal** constante (limitado a +20° de alargamento) e
acrescenta um recuo de até 4 cm.

Validado por `check:geometry` em 16:9, 21:9, 4:3, 9:16 e 20:9. O pior
enquadramento da cena 02 fica em **0,70 do meio-quadro** (1,00 = fora), o que
deixa ~30% de margem em todas as proporções.

## Verificação

```bash
npm run verify
```

Roda, em ordem: `typecheck` → `lint` → `check:glsl` (19 shaders) →
`check:geometry` (1.481 asserções) → `check:logic` (34 asserções) → `build`.

| script | o que garante |
|---|---|
| `check:glsl` | cada shader tem sintaxe válida (parser real), `#include` correto, uniform declarado = uniform fornecido |
| `check:structure` | contrato §1/§5/§6/§8: `Component` exportado, nada de `scrollTo`/RAF/ScrollTrigger, `textBlocks` ordenados em 0..1, `scrollLength` positivo — **e se a cena foi realmente registrada no catálogo** |
| `check:geometry` | keyframes lidos do código-fonte; assunto dentro do quadro nas 5 proporções; câmera não atravessa o modelo; cores de corte batem |
| `check:logic` | timeline é monótona e contínua (sem "estalo" no scrub), geometria do cogumelo dentro das proporções reais de Agaricales, e a mão **realmente pinça** (pontas a 0,2 mm) sem acumular pose no scroll reverso |
| `measure:weight` | peso gzip por cena, medido em build de produção |
