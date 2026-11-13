# Contrato de cenas

A cena recebe exclusivamente `progress: MotionValue<number>` (0–1). Derive a animação desse valor; não introduza estado global adicional. Exporte uma definição `SceneDefinition` com `id`, `scrollLength` em vh, `textBlocks` e `Component`. O registro atual fica em `stubs.tsx`.

Para preservar a continuidade cinematográfica, a pose final da cena anterior e a pose inicial da próxima devem compartilhar enquadramento, direção de luz e cor dominante. O canvas é fixo; o scroll é medido pelos elementos de seção no DOM.

Assets externos devem ficar em `public/assets/<id-da-cena>/`. Cada pasta de cena deve conter um README informando origem/licença dos assets, dimensões, formato e quais elementos são procedurais. Prefira GLB otimizado, texturas comprimidas e sequências de frames com fallback estático. Faça lazy-load de recursos grandes e mostre fallback enquanto carregam.

## Cenas implementadas (Agente 2)

`01-terra`, `02-cogumelo` e `03-mao-boca` estão implementadas; `04-circulacao` e
`05-cerebro` seguem como stubs. Cada pasta tem um `README.md` com as decisões
técnicas (a da 02 justifica a escolha entre frames e 3D) e
`public/assets/<id>/ASSETS.md` com o que precisa ser produzido externamente.

- `_shared/` concentra o que é comum: rig de câmera, texturas procedurais,
  partículas, harness de `?debug=1`. **Não é uma cena** — não registrar nada
  dela em `stubs.tsx`.
- Comum às três: `progress` é a única entrada. Nada de store, nada de estado
  acumulado — cada frame recalcula a pose inteira, para o scrub reverso ser
  exato.
- Verificação: `npm run verify` (typecheck, lint, glsl, geometria, lógica, build).
- Detalhes de integração e o modo de depuração: `docs/INTEGRATION.md`.
- O que precisou mudar fora das pastas de cena: `docs/REQUESTS-agente2.md`.
- Performance medida: `docs/PERF.md`.
