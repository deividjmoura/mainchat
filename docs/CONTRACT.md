# Contrato de integração das cenas

**Versão 1.0 — contrato de API congelado em 2026-11-13.**

Este documento congela a interface pública das cenas, o fluxo de integração e a divisão de responsabilidades. A implementação visual ainda está em fase de fundação: congelar o contrato **não significa** que os gates de qualidade ou o runtime já foram aprovados. Não iniciar a integração definitiva das cenas até o relatório em [VALIDATION.md](./VALIDATION.md) estar atualizado com evidências verdes.

## 1. Tipos públicos (não alterar sem revisão de contrato)

Localização: `src/scenes/types.ts`.

```ts
import type { MotionValue } from 'motion';
import type { ComponentType } from 'react';

export type TextBlock = {
  at: number;          // ponto de entrada no progresso local, entre 0 e 1
  title: string;
  body: string;
  eyebrow?: string;
};

export type SceneProps = {
  progress: MotionValue<number>; // progresso local da cena, sempre 0..1
};

export type SceneDefinition = {
  id: string;           // slug estável, ex.: "01-terra"
  scrollLength: number; // extensão da seção em vh
  textBlocks: TextBlock[];
  Component: ComponentType<SceneProps>;
};
```

Regras obrigatórias:
- Cada cena recebe somente `progress` como entrada temporal. Não criar listeners de scroll, RAF ou timelines independentes.
- `progress` e `TextBlock.at` são valores normalizados entre 0 e 1.
- `textBlocks` devem estar em ordem crescente por `at`.
- `scrollLength` deve ser um número positivo em unidades de viewport height.
- A cena não cria nem altera estado global. Estado visual interno pode ser local ao componente.
- Não renomear propriedades, mudar tipos ou alterar a semântica sem PR específico de contrato aprovado pelo responsável do projeto.

## 2. Estado global

Localização: `src/store/useJourneyStore.ts`.

Estado público:
- `sceneId: string`
- `progress: number`
- `setJourney(sceneId, progress)`

O Zustand contém somente a posição narrativa global. Não adicionar câmera, geometria, assets, loading ou estado de animação de uma cena. O progresso animável da cena é fornecido pelo `MotionValue<number>` mantido pelo motor.

## 3. Estrutura de pastas

```text
src/
  App.tsx                    # composição da experiência
  components/                # NarrativeText, ProgressRail, StaticFallback
  core/                      # SceneManager, transições e métricas do ticker
  design/tokens.ts           # paleta, tipografia, layout e easing
  hooks/                     # hooks de qualidade/capacidade do dispositivo
  scenes/
    types.ts                 # API pública congelada
    stubs.tsx                # catálogo atual e componentes provisórios
    README.md                # orientações gerais das cenas
    <id>/
      index.tsx              # export público Component da cena
      README.md              # descrição, assets e instruções da cena
  store/useJourneyStore.ts   # estado global mínimo
  ui/                        # DebugPanel e UI transversal
  styles.css                 # estilos globais
public/
  assets/
    <id>/                     # modelos, texturas, frames e fallbacks da cena
      README.md
docs/
  CONTRACT.md
  VALIDATION.md
```

IDs fixos desta narrativa:
- `01-terra`
- `02-cogumelo`
- `03-mao-boca`
- `04-veias`
- `05-cerebro`

Cada cena deve manter seus arquivos e assets dentro da pasta de seu ID. Não reutilizar IDs para outra cena.

## 4. Donos de cada pasta/arquivo

| Área | Responsável | Pode alterar |
|---|---|---|
| `src/core/**` | Agente base / motor | Lenis, ScrollTrigger, SceneManager, transições e ticker |
| `src/design/**` | Agente base / direção visual | tokens compartilhados; mudanças coordenadas com todas as cenas |
| `src/ui/**` | Agente base / UI transversal | painel debug e controles globais |
| `src/components/**` | Agente base / composição | NarrativeText, ProgressRail e fallback |
| `src/hooks/**` | Agente base / plataforma | detecção de qualidade/capacidade e hooks compartilhados |
| `src/store/**` | Agente base / estado | store global mínimo |
| `src/App.tsx`, `src/styles.css` | Agente base / integração | montagem, layout global e integração entre cenas |
| `src/scenes/types.ts`, `src/scenes/stubs.tsx` | Agente base / integração | contrato e catálogo/registro central |
| `src/scenes/01-terra/**`, `02-cogumelo/**`, `03-mao-boca/**` | Agente de cenas A | implementação e README dessas três cenas |
| `src/scenes/04-veias/**`, `05-cerebro/**` | Agente de cenas B | implementação e README dessas duas cenas |
| `public/assets/01-terra/**`, `02-cogumelo/**`, `03-mao-boca/**` | Agente de cenas A | assets dessas cenas e seus READMEs |
| `public/assets/04-veias/**`, `05-cerebro/**` | Agente de cenas B | assets dessas cenas e seus READMEs |
| `docs/**` | Agente base / responsável do projeto | documentação e relatório de validação |

**Regra de propriedade:** não editar arquivos de outra área. Se a implementação precisar alterar um arquivo compartilhado, abrir PR de integração e solicitar ao dono da área; não fazer commits diretos na branch compartilhada.

## 5. Como implementar e registrar uma cena

O contrato de API é estável. O catálogo atual fica em `src/scenes/stubs.tsx`; os `index.tsx` individuais são os pontos públicos de exportação da implementação. O responsável pelo catálogo faz o registro central para evitar conflitos entre agentes.

1. Criar/editar somente `src/scenes/<id>/index.tsx` e implementar um componente React que receba `SceneProps`.
2. Exportar o componente como `Component` pelo `index.tsx`. O componente deve derivar toda animação temporal do `progress` recebido.
3. Criar `src/scenes/<id>/README.md`, documentando objetivo narrativo, técnica, assets, origem/licença e o que é procedural versus externo.
4. Colocar assets em `public/assets/<id>/`; otimizar modelos e texturas e não incluir arquivos temporários ou materiais sem licença clara. Adicionar um README nessa pasta.
5. Abrir PR para a branch de integração. O responsável pelo motor atualiza `src/scenes/stubs.tsx`/catálogo com o componente e sua definição (`id`, `scrollLength`, `textBlocks`, `Component`) e verifica a ordem narrativa. O agente da cena não altera o catálogo compartilhado.

Validação mínima de cada cena: componente renderiza sem scroll próprio, progresso cobre 0..1, textos estão ordenados, assets têm origem/licença, cleanup não deixa recursos externos vivos e o README está completo.

## 6. Scroll, transições e continuidade

- O motor em `src/core/SceneManager.ts` é o único dono de Lenis e ScrollTrigger.
- A cena não deve chamar `window.scrollTo`, criar RAF, criar ScrollTrigger ou controlar navegação.
- A última composição da cena N deve combinar com a primeira composição da cena N+1 em câmera, escala, luz e cor.
- Configuração de transição é responsabilidade de `src/core/transitions.ts`. A implementação atual usa uma camada visual de transição; não assumir que ela já é um crossfade real entre duas renderizações.
- A montagem de cenas e a gestão de recursos Three.js pertencem ao motor/composição, não a cada agente de cena.

## 7. Modo de depuração

Ativar com `?debug=1`, por exemplo `http://localhost:5173/?debug=1`.

O painel em `src/ui/DebugPanel.tsx` deve oferecer:
- seletor para navegar entre as cenas cadastradas;
- slider de progresso local de 0 a 1, com precisão de 0.001;
- leitura de FPS do ticker;
- indicação do nível de qualidade gráfico atual.

O painel é ferramenta de desenvolvimento, não conteúdo da experiência pública. Não remover nem alterar sua API sem coordenação com o agente base. A leitura atual de FPS é baseada no ticker; não equivale a benchmark de GPU ou garantia de 60 FPS.

## 8. Performance e acessibilidade

- Respeitar `prefers-reduced-motion`.
- Prever fallback quando WebGL não estiver disponível.
- Lazy-load de assets pesados quando forem adicionados.
- Liberar recursos criados fora do ciclo normal do reconciler.
- Não criar RAF próprio nem listeners globais de scroll dentro das cenas.
- Validar desktop e mobile. Nunca prometer 60 FPS sem medição documentada no dispositivo/browser alvo.

## 9. Branches, PRs e commits

- Branch de integração: `feat/scrollytelling-foundation`.
- Trabalho de cena em branch própria, por exemplo `feat/scene-01-terra`.
- Abrir PR da branch de cena para `feat/scrollytelling-foundation`; não fazer push direto na branch compartilhada.
- Conventional Commits em inglês, por exemplo `feat(scene-01): add soil composition`, `fix(core): synchronize scroll progress`, `docs(contract): clarify scene registration`.
- Mudança no contrato exige PR próprio, justificativa de compatibilidade e aprovação do responsável do projeto.

## 10. Superfícies protegidas

São superfícies protegidas: os tipos deste documento, `SceneProps.progress` normalizado, estado público do Zustand, IDs e ordem da narrativa, catálogo central, API do SceneManager e contrato do painel debug. Mudanças incompatíveis exigem revisão explícita antes de qualquer agente atualizar sua cena.
