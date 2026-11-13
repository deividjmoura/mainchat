# Contrato de integração das cenas

**Status: proposta em validação — ainda NÃO congelado.** O contrato só passa a ser considerado congelado quando o gate de CI estiver verde, o motor de transições/debug estiver validado e a revisão do responsável pelo projeto for concluída. Até lá, os agentes não devem integrar cenas definitivas.

## 1. Tipos públicos

Localização atual: `src/scenes/types.ts`.

```ts
import type { MotionValue } from 'motion';
import type { ComponentType } from 'react';

export type TextBlock = {
  at: number;          // ponto de entrada entre 0 e 1
  title: string;
  body: string;
  eyebrow?: string;
};

export type SceneProps = {
  progress: MotionValue<number>; // progresso local da cena, 0..1
};

export type SceneDefinition = {
  id: string;           // slug estável, ex.: "01-terra"
  scrollLength: number; // extensão da cena em vh
  textBlocks: TextBlock[];
  Component: ComponentType<SceneProps>;
};
```

Regras:
- `progress` é a única entrada temporal da cena; não criar scroll listeners próprios.
- `textBlocks.at` deve estar entre 0 e 1, em ordem crescente.
- Componentes devem derivar animação de `progress`, não criar store global.
- Não alterar nomes, tipos, semântica de progress ou assinatura de Component sem issue + PR de contrato.

## 2. Store

Store global mínimo em `src/store/useJourneyStore.ts`:
- Estado público: `sceneId: string`, `progress: number`.
- Ação técnica: `setJourney(sceneId, progress)`.
- Não adicionar estado de cena, câmera, assets, loading ou animação ao Zustand. Estado local pertence à própria cena.

## 3. Pastas por cena

Cada cena terá:
- `src/scenes/<id>/index.tsx`: componente e export da definição.
- `src/scenes/<id>/README.md`: descrição, assets, licença/origem e instruções.
- `public/assets/<id>/`: GLB, texturas, sequências de frames e fallback estático.

IDs fixos nesta narrativa:
- `01-terra`
- `02-cogumelo`
- `03-mao-boca`
- `04-veias`
- `05-cerebro`

Assets devem ter origem/licença documentadas. Dizer explicitamente no README se cada elemento é procedural ou asset externo. Não commitar arquivos temporários ou assets sem licença clara.

## 4. Donos dos arquivos

| Responsável | Área |
|---|---|
| Agente base / motor | `src/core/*`, `src/design/*`, `src/ui/*`, `src/content/*`, `docs/*` |
| Agente 2 | `src/scenes/01-terra/*`, `02-cogumelo/*`, `03-mao-boca/*` |
| Agente 3 | `src/scenes/04-veias/*`, `05-cerebro/*` |

Não editar arquivos fora da sua área. Não modificar contrato, scroll engine, design tokens, transições, debug panel ou conteúdo editorial sem coordenar com o dono da base. Qualquer alteração de contrato exige issue + PR próprio e aviso ao responsável pelo projeto.

## 5. Registrar uma cena nova (5 passos)

1. Criar `src/scenes/<id>/index.tsx` e implementar `Component({ progress })`.
2. Exportar uma definição com `id`, `scrollLength`, `textBlocks` e `Component`.
3. Criar `public/assets/<id>/` e adicionar apenas assets otimizados/licenciados.
4. Documentar no README da cena o que é procedural e o que é externo.
5. Registrar a definição no catálogo central, sem alterar o SceneManager nem os tipos.

## 6. Transições e continuidade

O motor é dono das transições entre cenas. A cena não deve implementar fade de navegação, controlar o Lenis ou modificar ScrollTrigger. O corte deve respeitar a configuração do par anterior/próximo. A última composição da cena N deve combinar com a primeira composição da cena N+1 em câmera, luz, escala e cor.

## 7. Performance e acessibilidade

- Respeitar `prefers-reduced-motion`.
- Lazy-load de assets pesados e fallback visual.
- Liberar recursos Three.js de propriedade da cena quando forem criados fora do ciclo normal do reconciler.
- Não criar RAF próprio nem listeners globais de scroll dentro das cenas.
- Validar desktop e mobile; não prometer 60 FPS sem medição documentada no dispositivo alvo.

## 8. Branches e commits

- Branch compartilhada de integração: `feat/scrollytelling-foundation`.
- Cenas devem trabalhar em branches próprias, por exemplo `feat/scene-01-terra`, e abrir PR direcionado à branch de integração.
- Não fazer push direto na branch compartilhada durante integração paralela.
- Conventional Commits em inglês: `feat(scene-01): add soil composition`, `fix(core): synchronize scroll progress`, `docs(contract): clarify scene registration`.
- Não fazer merge de PR de cena com conflitos em arquivos pertencentes a outro agente sem resolução conjunta.

## 9. Arquivos protegidos

Assinaturas de `src/scenes/types.ts`, estado público do store, semântica de progress 0..1, ordem/IDs do catálogo e API do SceneManager são superfícies protegidas. Mudança somente via issue + PR de contrato, com aviso explícito ao responsável.
