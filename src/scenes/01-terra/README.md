# Cena 01 — TERRA

Solo de floresta úmida em macro extremo: húmus, folhas em decomposição, raízes,
filamentos de micélio, esporos em suspensão e luz coada pela copa.

## Movimento da câmera

Quatro keyframes, Catmull-Rom, função pura do progresso:

| p | altura | distância | fov | leitura |
|---|---|---|---|---|
| 0.00 | 10,5 cm | 46 cm | 32° | plano aberto do chão |
| 0.33 | 8,5 cm | 36 cm | 33° | descida, entra na serapilheira |
| 0.66 | 6,2 cm | 26 cm | 35° | detalhe das folhas e hifas |
| 1.00 | 4,8 cm | 17 cm | 38° | micélio em foco, micélio "acorda" |

O tremor de mão (soma de três senos incomensuráveis, amplitude 1,6 mm) é o que
vende a escala macro: sem ele a cena parece um modelo 3D.

## Continuidade

- **Entrada** `#0b0907`, **saída** `#0d0a06` = entrada da cena 02.
- A câmera termina baixa, olhando o ponto onde o micélio se acumula — que é
  exatamente o centro do quadro em que a cena 02 começa.
- Direção de luz: quente, alta, à direita (`[1.2, 2, 0.8]`). A cena 02 mantém a
  mesma direção com intensidade menor.

## O que é procedural

Tudo. Ver `public/assets/01-terra/ASSETS.md`.

## Arquivos

- `ground.tsx` — terreno, folhas, raízes, micélio, sombra de contato
- `LightShafts.tsx` — volumetria falsa (planos aditivos)
- `index.tsx` — cena, câmera, poeira, registro `SceneDefinition`
