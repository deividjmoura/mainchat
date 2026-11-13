# Integração das cinco cenas

## Estado atual

As cinco cenas reais estão registradas em `src/scenes/stubs.tsx` (o arquivo mantém esse nome por compatibilidade com os imports existentes, mas agora funciona como catálogo):

1. `01-terra` — solo, serapilheira, raízes, micélio e feixes de luz.
2. `02-cogumelo` — crescimento, maturação e senescência do corpo frutífero.
3. `03-mao-boca` — transição conceitual não-instrucional.
4. `04-veias` — percurso vascular e conversão/distribuição da psilocina.
5. `05-cerebro` — córtex, receptores, redes neurais e conectoma.

O catálogo importa as definições exportadas por cada pasta. Não contém mais os componentes geométricos de demonstração que existiam na fundação.

## Estrutura

```
src/scenes/
├── _shared/            câmera, shaders utilitários, texturas, matemática e reduced motion
├── 01-terra/           Terra.tsx, ground.tsx, LightShafts.tsx
├── 02-cogumelo/        Cogumelo.tsx, mushroom.ts, timeline.ts
├── 03-mao-boca/        MaoBoca.tsx, hand.ts, timeline.ts
├── 04-veias/           VesselTunnel.tsx, BloodCells.tsx, BodyMiniMap.tsx
└── 05-cerebro/         AnatomicalBrain.tsx, NeuronReceptorMicro.tsx,
                       ConnectomeArcs.tsx, BrainLabels3D.tsx
```

As cenas 01–03 compartilham utilitários em `_shared/`. As cenas 04–05 têm módulos próprios e documentação dentro das respectivas pastas. O modelo `public/assets/05-cerebro/brain.glb` acompanha fallback procedural caso o carregamento falhe.

## Contrato e registro

Cada cena exporta uma definição compatível com `SceneDefinition`:

- `id` igual ao ID oficial;
- `scrollLength` em unidades de viewport;
- `textBlocks` ordenados por `at` entre 0 e 1;
- `Component` que recebe o `MotionValue<number>` de progresso.

O catálogo central mantém a ordem narrativa e é consumido pelo `App`, pelo `SceneManager` e pelo cálculo de transições. Nenhuma cena deve criar outra instância de Lenis, ScrollTrigger ou loop de RAF.

## Modo de depuração

Inicie o projeto e abra:

```bash
pnpm dev
# http://localhost:5173/?debug=1
```

O painel da fundação oferece seletor de cena, slider de progresso (0..1), FPS do ticker e nível de qualidade. O teste automatizado `check:structure` também confirma que as cinco cenas estão efetivamente registradas no catálogo.

## Verificações automatizadas

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm check:structure
pnpm check:glsl
pnpm check:geometry
pnpm check:logic
pnpm build
```

O workflow do GitHub Actions executa todos esses gates em cada push à branch de integração e em PRs para `main`.

- `check:structure`: contrato das cenas, ordenação dos blocos, IDs e registro no catálogo.
- `check:glsl`: sintaxe dos shaders e consistência de uniforms.
- `check:geometry`: enquadramento, keyframes e continuidade entre cenas.
- `check:logic`: monotonicidade/continuidade das timelines e invariantes geométricas.
- `build`: TypeScript e bundle de produção.

A validação automatizada passou no run [#43449152060](https://github.com/deividjmoura/mainchat/actions/runs/43449152060). Isso não substitui a validação manual com `pnpm dev`, inspeção do console e teste do painel em navegador real; esses passos continuam pendentes e estão listados em [VALIDATION.md](./VALIDATION.md).

## Continuidade visual

As quatro transições oficiais são:

| Transição | Modo |
|---|---|
| 01-terra → 02-cogumelo | dissolve |
| 02-cogumelo → 03-mao-boca | fade-through-black |
| 03-mao-boca → 04-veias | crossfade |
| 04-veias → 05-cerebro | dissolve |

Os testes de geometria e continuidade são executados automaticamente pelo CI. A inspeção perceptiva das transições em desktop e mobile ainda requer navegador/hardware real.
