# Cena 03 — MÃO E BOCA · assets

> ## O que você precisa gerar ou baixar: **a mão.**
>
> **Esta é a única pendência de asset das três cenas.** Hoje existe um
> placeholder procedural com anatomia correta, mas sem realismo fotográfico.
> Abaixo: duas opções (GLB com rig, ou vídeo com alfa) e um prompt de IA pronto.
> O rosto é **opcional** — a cena funciona sem ele.

## Por que falta

Mão humana é a forma mais difícil de modelar proceduralmente: articulações,
unha, pregas de pele, translucidez, e o cérebro humano detecta erro de imediato.
O que está no repositório é um **manequim** — proporções de falange corretas,
polegar em oposição, e uma pinça que de fato fecha (validado em
`scripts/check-timelines.ts`: pontas a 0,2 mm) — mas sem realismo fotográfico.

## O que está no lugar hoje

| elemento | origem |
|---|---|
| mão e antebraço | procedural: cápsulas aninhadas, 4 dedos × 3 falanges + polegar com 3 segmentos |
| pele | procedural: `makeSkinMaps()` — melanina irregular, poros, vincos |
| cogumelo na mão | procedural, simplificado |
| rosto | procedural: só o maxilar e o lábio inferior entram na luz |
| esporos no ar | procedural |

---

## OPÇÃO A (recomendada) — GLB estático com rig

Mais flexível: a cena anima a pinça sozinha a partir do `progress`, então o
movimento acompanha o scroll em vez de ser fixo.

- **formato**: `.glb` (glTF 2.0), Draco comprimido
- **resolução**: 1 malha, ≤ 60k triângulos
- **rig**: esqueleto humano padrão, com **polegar de 3 segmentos**, nome de ossos
  legível (`index_01`, `thumb_03`…)
- **texturas**: `baseColor` 4096² + `normal` 4096² + `roughness`; pele **sem**
  SSS pré-assado (o shader faz)
- **pose de repouso**: mão aberta, palma para a câmera, dedos levemente
  afastados — a cena fecha a pinça
- **escala**: 1 unidade = 1 metro; palma ≈ 0,09 m
- **orçamento**: ≤ 8 MB
- **licença**: comercial explícita. Sketchfab e Mixamo têm opções; confirme que
  permite uso comercial, não apenas "personal use".

## OPÇÃO B — vídeo com canal alfa

Mais rápido de produzir, menos flexível (o movimento não responde ao scroll).

- **formato**: `.webm` VP9 com alfa (ou HEVC com alfa), 1920×1080, 24–30 fps
- **duração**: 6–8 s, 1 tomada contínua, sem corte
- **frames**: ≈ 150–240
- **enquadramento**: macro, mão entrando por baixo, luz quente lateral esquerda
  (mesma direção da cena 02)
- **fundo**: transparente (alfa), **sem** cogumelo no vídeo — o objeto é 3D
- **orçamento**: ≤ 12 MB
- **licença**: própria ou comercial explícita

### Prompt sugerido para geração por IA

> *"Extreme close-up, macro cinematography. A human hand slowly enters frame from
> below and gently pinches a small brown mushroom, lifting it toward the camera.
> Warm tungsten side light from the left, deep shadows elsewhere, shallow depth
> of field, 85mm macro lens, film grain, 24fps. No face visible, hands only.
> Slow, hesitant, reverent motion."*

**Dica de produção**: gere primeiro **sem** alfa para acertar o movimento, depois
refaça com "transparent background". Modelos de vídeo erram muito o alfa na
primeira tentativa.

**Adicione à negativa** (evita que o modelo entregue conteúdo que a cena não
pode mostrar): *"no eating, no swallowing, no pills, no powder, no measuring,
no scales, no text."*

---

## ASSET OPCIONAL — rosto / boca

A cena foi construída para funcionar **sem** rosto em quadro: a imagem se
dissolve antes de qualquer ação. Se você quiser o rosto:

- close de maxilar + lábio inferior, `.jpg` / `.webp` 2048×1024, fundo preto
- ou vídeo de 3 s, mesmo enquadramento e luz da Opção B
- **não** é necessário boca aberta, nem qualquer imagem de ingestão

## Como plugar quando o asset chegar

1. copie o arquivo para `public/assets/03-mao-boca/hand.glb`
2. em `src/scenes/03-mao-boca/index.tsx`, troque `<Hand />` por
   `<HandGLB url="/assets/03-mao-boca/hand.glb" />`, dentro de `<Suspense>`
3. `HandGLB` deve aplicar `HandPose { curl, pinch, thumbIn }` sobre os ossos —
   a interface já existe em `hand.ts` e é o que a timeline consome
4. mantenha o placeholder como fallback se o `fetch` falhar
