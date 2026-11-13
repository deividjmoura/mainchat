# Cena 03 — MÃO E BOCA · assets

## Estado atual: **placeholder procedural.** Precisa de asset real.

Esta é a única cena que **não** está no nível de realismo pretendido, e isso é
deliberado e documentado: mão humana é a forma mais difícil de modelar
proceduralmente (articulações, pele, unha, translucidez). O que está no
repositório é um **manequim** com anatomia correta — proporções de falange,
polegar em oposição, pinça que de fato fecha (validado em
`scripts/check-timelines.ts`: as pontas se encontram a 0,2 mm) — mas sem
realismo fotográfico.

### O que está no lugar hoje

| elemento | origem |
|---|---|
| mão | procedural: cápsulas aninhadas, 4 dedos × 3 falanges + polegar com 3 segmentos |
| pele | procedural: `makeSkinMaps()` — melanina irregular, poros, vincos |
| cogumelo na mão | procedural, simplificado |
| rosto | procedural: só o maxilar e o lábio inferior entram na luz |
| esporos no ar | procedural |

## ASSET NECESSÁRIO: mão (e antebraço) fotorrealista

**Opção A — GLB estático com rig (recomendado)**

- formato: `.glb` (glTF 2.0), Draco
- resolução: 1 malha, ≤ 60k triângulos
- rig: esqueleto humano padrão, com **polegar de 3 segmentos** e nome de ossos
  legível (`index_01`, `thumb_03`…)
- textura: `baseColor` 4096² + `normal` 4096² + `roughness`; pele sem SSS
  pré-assado (o shader faz)
- pose de repouso: **mão aberta, palma para a câmera, dedos levemente
  afastados** (a cena anima a pinça sozinha)
- escala: 1 unidade = 1 metro; palma ~0,09 m
- orçamento: ≤ 8 MB
- licença: **comercial explícita**. Sketchfab/Mixamo têm opções; confira se a
  licença permite uso comercial, não só "personal".

**Opção B — vídeo com alfa (mais rápido de produzir, menos flexível)**

- `.webm` VP9 com canal alfa (ou HEVC alfa), 1920×1080, 24–30 fps
- duração: 6–8 s, 1 tomada contínua
- enquadramento: macro, mão entrando por baixo, luz quente lateral esquerda
  (mesma direção da cena 02)
- fundo: transparente (alfa), **sem** cogumelo no vídeo — o objeto é 3D
- orçamento: ≤ 12 MB
- prompt sugerido para geração por IA:
  > *"Extreme close-up, macro cinematography, a human hand slowly enters frame
  > from below and gently pinches a small brown mushroom, lifting it toward the
  > camera. Warm tungsten side light from the left, deep shadows elsewhere,
  > shallow depth of field, 85mm macro lens, film grain, 24fps, transparent
  > background, no face visible, hands only. Slow, hesitant, reverent motion."*

  (Gere **sem** alfa primeiro para acertar o movimento, depois refaça com
  "transparent background" — modelos de vídeo erram muito o alfa na primeira
  tentativa.)

## ASSET NECESSÁRIO: rosto / boca

Opcional. A cena foi construída para funcionar **sem** rosto em quadro: a
imagem se dissolve antes de qualquer ação. Se o cliente quiser o rosto:

- close de maxilar + lábio inferior, `.jpg`/`.webp` 2048×1024, fundo preto
- ou vídeo 3 s, mesmo enquadramento e luz da opção B
- **não** é necessária boca aberta nem qualquer imagem de ingestão.

## Como plugar (quando o asset chegar)

1. copie o arquivo para `public/assets/03-mao-boca/hand.glb`
2. em `src/scenes/03-mao-boca/index.tsx`, troque `<Hand />` por
   `<HandGLB url="/assets/03-mao-boca/hand.glb" />` dentro de `<Suspense>`
3. `HandGLB` deve chamar `applyHandPose()` equivalente sobre os ossos —
   a assinatura `HandPose {curl, pinch, thumbIn}` já existe em `hand.ts` e é o
   que a timeline consome.
4. mantenha o placeholder como fallback se o `fetch` falhar.
