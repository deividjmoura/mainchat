# Entre Mundos — scrollytelling científico

Experiência educativa em português sobre biologia dos fungos, farmacologia da psilocibina e neurociência. Não é material de incentivo ao uso nem orientação de consumo.

## Stack
Vite, React, TypeScript, GSAP/ScrollTrigger, Lenis, Three.js, React Three Fiber, Drei, postprocessing, Motion Values e Zustand.

## Rodar
```bash
pnpm install
pnpm dev
```
Node 20.19+ ou 22.12+ recomendado (Vite 7).

## Estrutura e contrato de cena
- `src/scenes/types.ts`: contrato `SceneDefinition` e `SceneProps`.
- `src/scenes/stubs.tsx`: cinco cenas provisórias.
- `src/App.tsx`: motor Lenis + ScrollTrigger, canvas fixo e registro de cenas.
- `src/components/NarrativeText.tsx`: texto sincronizado com progress.
- `src/design/tokens.ts`: paleta e tipografia.
- `src/store/useJourneyStore.ts`: estado global mínimo `sceneId/progress`.

Cada cena deve implementar `Component({progress}: {progress: MotionValue<number>})` e exportar uma definição com `id`, `scrollLength`, `textBlocks` e `Component`. Em `textBlocks`, `at` varia de 0 a 1. Use `progress.get()` em `useFrame` para derivar animação. Não crie stores adicionais.

Para adicionar uma cena: crie o componente, acrescente sua definição ao array em `src/scenes/stubs.tsx`, coloque assets em `public/assets/<cena>/` e documente no README da cena o que é procedural e o que veio de fora (GLB, textura ou sequência de frames). Use lazy loading para assets pesados e fallback estático. A pose final deve combinar com a inicial da próxima cena (cor, luz, câmera e enquadramento).

## Performance
Qualidade alta/média/baixa estimada por capacidade do dispositivo, tela e preferência por movimento reduzido. Em baixa qualidade, reduz DPR e desliga pós-processamento. Em cenas pesadas, prefira imagem estática ou sequência de frames como fallback. `prefers-reduced-motion` desativa a suavização do Lenis e reduz transições.

## Ciência
Consenso: a psilocibina é convertida em psilocina; a psilocina atua principalmente como agonista parcial de receptores serotoninérgicos 5-HT2A. Há evidências de alterações em circuitos envolvendo córtex pré-frontal e tálamo. A relação causal entre mudanças na rede de modo padrão (DMN), experiência subjetiva e efeitos clínicos permanece em investigação; o texto identifica isso como hipótese.
