# Contrato de cenas

A cena recebe exclusivamente `progress: MotionValue<number>` (0–1). Derive a animação desse valor; não introduza estado global adicional. Exporte uma definição `SceneDefinition` com `id`, `scrollLength` em vh, `textBlocks` e `Component`. O registro atual fica em `stubs.tsx`.

Para preservar a continuidade cinematográfica, a pose final da cena anterior e a pose inicial da próxima devem compartilhar enquadramento, direção de luz e cor dominante. O canvas é fixo; o scroll é medido pelos elementos de seção no DOM.

Assets externos devem ficar em `public/assets/<id-da-cena>/`. Cada pasta de cena deve conter um README informando origem/licença dos assets, dimensões, formato e quais elementos são procedurais. Prefira GLB otimizado, texturas comprimidas e sequências de frames com fallback estático. Faça lazy-load de recursos grandes e mostre fallback enquanto carregam.