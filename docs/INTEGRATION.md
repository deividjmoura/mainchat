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
│   ├── useReducedMotion.ts
│   └── SceneDebug.tsx  harness de ?debug=1
├── 01-terra/           index.tsx · ground.tsx · LightShafts.tsx · README.md
├── 02-cogumelo/        index.tsx · mushroom.ts · timeline.ts · README.md
└── 03-mao-boca/        index.tsx · hand.ts · timeline.ts · README.md
```

Contrato respeitado: cada cena exporta `scene: SceneDefinition` com `id`,
`scrollLength`, `textBlocks` e `Component({progress})`. **Nenhuma cena cria
store.** Todo estado de animação é derivado de `progress.get()` dentro de
`useFrame`, como manda `src/scenes/README.md`.

## Como ver

```bash
npm install
npm run dev
# http://localhost:5173/
```

### Modo de depuração

```
?debug=1                          painel: fps, pior 1%, draw calls, tris, MB da cena
?debug=1&cena=02-cogumelo         pula para a cena
?debug=1&cena=02-cogumelo&p=0.42  congela o progresso em 0.42 (inspecionar um beat)
?debug=1&qualidade=low            força qualidade baixa (testar o fallback)
```

O congelamento com `&p=` é a forma mais rápida de revisar cada batida da
timeline: `p=0.1` primórdio, `p=0.45` caule alongando, `p=0.7` chapéu aberto,
`p=0.92` secagem, `p=1` colapso.

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
| `check:geometry` | keyframes lidos do código-fonte; assunto dentro do quadro nas 5 proporções; câmera não atravessa o modelo; cores de corte batem |
| `check:logic` | timeline é monótona e contínua (sem "estalo" no scrub), geometria do cogumelo dentro das proporções reais de Agaricales, e a mão **realmente pinça** (pontas a 0,2 mm) sem acumular pose no scroll reverso |
| `measure:weight` | peso gzip por cena, medido em build de produção |
