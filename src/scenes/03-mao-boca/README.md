# Cena 03 — MÃO E BOCA

Hand enters frame, picks the mushroom, raises it toward the mouth, camera
follows — e a imagem se dissolve **antes** de qualquer ação.

## Regra de conteúdo (não negociável)

Esta cena é **explicitamente não-instrucional**. Ela não mostra:

- preparo, secagem, maceração, infusão
- dose, quantidade, peso, contagem
- método, via de administração, tempo de efeito
- ingestão (a boca nunca recebe o objeto em quadro)

O que ela faz é acompanhar um **gesto humano** — pegar, erguer, hesitar — e
fechar a imagem. A hesitação (`hold`, entre p 0.68–0.92) é dramaturgia, não
tutorial: o gesto não é mecânico, e a cena termina antes que ele se complete.
O bloco de texto em `at: 0.46` diz isso explicitamente ao público.

Isso está alinhado com o README da fundação
("não é material de incentivo ao uso nem orientação de consumo").

## Beats

| p | beat | o que se vê |
|---|---|---|
| 0.00–0.20 | `enter` | mão sobe pela borda inferior do quadro |
| 0.20–0.34 | `pinch` | polegar e indicador fecham no cogumelo |
| 0.34–0.56 | `lift` | o cogumelo sai do substrato |
| 0.50–0.78 | `raise` | mão e objeto sobem; o rosto entra na luz |
| 0.58–0.82 | `dissolve` | esporos e fundo se desfazem |
| 0.68–0.92 | `hold` | hesitação |
| 0.78–1.00 | `close` | vinheta radial fecha "para dentro" |

## Continuidade

- **Entrada** `#120d08` = saída da cena 02 (escuro morno, corpo seco).
- **Saída** `#0a0403` = **primeira cor da cena 04** (exigência do contrato).
- Luz na mesma direção da cena 02, mais quente e mais baixa.

## A mão

Placeholder procedural **documentado** — ver `hand.ts` e
`public/assets/03-mao-boca/ASSETS.md`, que traz o asset exato a produzir.

O rig tem uma armadilha resolvida: dobrar um dedo em **Z** cisalha (os dedos
"tesouram" lateralmente), porque a falange herda o eixo local do pai. A flexão
vai em **X**, e cada articulação acumula sobre a anterior.

A pinça foi resolvida por busca numérica, não a olho: com `curl: 0.6, pinch: 1`
as pontas do polegar e do indicador ficam a **0,2 mm** uma da outra, e a mão
aberta tem vão de **12,6 cm**. Os ângulos respeitam a anatomia (MCP 87°,
PIP 61°, DIP 24°; polegar CMP 26°, IP 23°). Tudo verificado em
`scripts/check-timelines.ts`.

## Arquivos

- `hand.ts` — rig, `TUNING`, `applyHandPose` (função pura da pose)
- `timeline.ts` — `gestureAt(progress)`
- `index.tsx` — cena, câmera, rosto, dissolução, registro `SceneDefinition`
