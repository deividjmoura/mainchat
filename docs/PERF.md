# Performance — três cenas (Agente 2)

Todos os números abaixo foram **medidos**, não estimados. Onde não foi possível
medir, está declarado como tal.

## Ambiente de medição (e sua limitação)

| | |
|---|---|
| Chromium | 153.0.8010.0 (headless, sandbox de desenvolvimento) |
| GPU | **nenhuma — SwiftShader não expõe WebGL neste sandbox** |
| Como os números de GPU foram obtidos | contagem de draw calls/triângulos e orçamento de custo por frame |

**Limitação declarada**: o sandbox não tem WebGL disponível (`webgl2` retorna
`null` com qualquer combinação de flags `--use-angle`). Portanto **não há FPS
medido de GPU neste relatório** — inventar esse número seria pior do que não
tê-lo. O que está medido: (1) todo o custo de CPU por frame, que é o que a cena
controla de fato; (2) a carga geométrica real; (3) o peso de download por cena.
A tabela final dá a estimativa de FPS com a base de cálculo explícita.

## Custo de CPU por frame (medido no navegador)

Laço de 100.000 iterações por função, `performance.now()`:

| operação | µs/chamada | chamadas/frame | µs/frame |
|---|---|---|---|
| `cycleAt()` (cena 02) | 0,151 | 4 | 0,6 |
| `gestureAt()` (cena 03) | 0,074 | 1 | 0,07 |
| `applyHandPose()` (cena 03) | 2,145 | 1 | 2,1 |
| `applyGrowth()` (cena 02) | 0,550 | 1 | 0,6 |
| **total JS de animação** | | | **≈ 3,4 µs** |

**3,4 µs de 16.666 µs (um frame a 60 fps) = 0,02% do orçamento.**
A animação das três cenas é essencialmente gratuita em CPU: toda a deformação
acontece no vertex shader, e as partículas calculam posição na GPU.

## Carga geométrica (medida na geometria real)

| cena | draw calls (malhas + pontos) | triângulos | partículas |
|---|---|---|---|
| 01-terra (high) | 9 (8 malhas + 1 pontos) | 111,5k | 700 (poeira) |
| 02-cogumelo (high) | 8 (6 malhas + 2 pontos) | 20,4k | 1.490 (esporos + bokeh) |
| 03-mao-boca (high) | 11 (9 malhas + 1 pontos + overlay) | ~13k | 320 |

Contagem derivada da árvore de elementos (não de um frame capturado, porque o
sandbox não tem WebGL): cada `<mesh>`/`<points>`/`<instancedMesh>` é 1 draw
call; `<primitive>` conta como a subárvore que carrega (raízes = 9, mão = ~18
segmentos, ambos mesclados ou com material compartilhado). O pós-processamento
da fundação acrescenta 3–4 passes quando ativo.

Composição da cena 01 (medida, `high`): solo 200×200 = 80.000 tris; folhas
instanciadas 80 × 72 = 5.760; raízes 9 × 1.008 = 9.072; micélio 260 filamentos
= 16.640. A cena 01 é a mais pesada em geometria **e** a mais barata em shader —
o solo é um `MeshStandardMaterial` comum. Em `medium` o solo cai para 28.800
tris (−64%) e em `low` para 8.192 (−90%), que é a alavanca certa para mobile.

`mushroom` detalhado: chapéu 9.216 tris, caule 11.136, lamelas 96 (disco com
estrias no fragment shader, não em geometria).

Nenhuma cena usa shadow map (custo de profundidade e resolução) — a sombra de
contato é um quad com gradiente radial. O `Environment preset="warehouse"` da
fundação é o único IBL, compartilhado pelas três cenas.

## Peso de download por cena (medido no build de produção)

Build com `manualChunks` isolando cada cena (`npm run measure:weight`):

| chunk | cru | gzip |
|---|---|---|
| vendor-3d (three + r3f + postprocessing) | 1.000,9 kB | 275,3 kB |
| vendor-react | 219,8 kB | 68,5 kB |
| vendor-motion (gsap + lenis + motion) | 134,7 kB | 51,0 kB |
| index + css | 7,5 kB | 3,6 kB |
| **scenes-shared** (comum às três) | 15,9 kB | **6,8 kB** |
| **01-terra** | 9,0 kB | **4,1 kB** |
| **02-cogumelo** | 18,2 kB | **6,7 kB** |
| **03-mao-boca** | 9,2 kB | **4,0 kB** |
| **total** | 1.859 kB | **420,0 kB** |

**MB carregados por cena: 0,00 MB de assets.** Nenhum binário — nada em
`public/assets/*/` além dos `README.md`/`ASSETS.md`. A única transferência é
código: 4,1 kB / 6,7 kB / 4,0 kB (gzip) por cena + 6,8 kB compartilhados.

Consequência prática: as três cenas **não podem** falhar por asset ausente, não
têm preload, e não precisam de fallback de imagem — o fallback que existe é o da
fundação (`StaticFallback`, quando não há WebGL) e o nível de qualidade baixa.

### O que domina o peso

`vendor-3d` (275 kB gzip) é 65% do total e vem inteiro da fundação. Se o peso
total for uma preocupação, a alavanca é code-splitting do `EffectComposer` (só
é usado em qualidade ≥ média) — está em `docs/REQUESTS-agente2.md`, porque
exige mexer no `App.tsx`.

## Qualidade baixa e `prefers-reduced-motion`

`useQuality()` da fundação já força `low` com movimento reduzido, mobile ou
≤4 núcleos. As três cenas reagem:

| | high | medium | low |
|---|---|---|---|
| DPR (fundação) | até 2 | até 1,5 | 1 |
| pós-processamento | ligado | ligado | **desligado** |
| textura do solo | 1024² | 1024² | 512² |
| malha do solo | 200² | 120² | 64² |
| filamentos de micélio | 260 | 150 | 70 |
| esporos (cena 02) | 1.400 | 700 | 280 |

**Movimento reduzido**: além do que a fundação faz (desliga o smooth do Lenis),
as cenas reduzem a **amplitude** da câmera a 10–15% (`gain` em `sampleCamera`).
Sem isso a câmera percorreria o mesmo trajeto longo, só que aos saltos — o que é
pior para quem tem sensibilidade vestibular do que ficar parado. Com `gain`, o
cogumelo ainda nasce, cresce e morre; a câmera quase não se move.

## Estimativa de FPS (base de cálculo explícita)

Não há FPS medido. A estimativa abaixo assume que o gargalo é o fragment shader
dos planos de volumetria (cena 01) e do bokeh (cena 02), não a geometria:

- 20k–112k triângulos é desprezível para qualquer GPU dos últimos 10 anos
  (celular intermediário processa 1–3 M triângulos/frame a 60 fps — a cena 01 usa 4–10% disso).
- 9–12 draw calls está bem abaixo do limite prático (~100).
- O custo real é *overdraw*: 7 quads de volumetria em tela cheia (cena 01) e 90
  discos grandes aditivos (cena 02).

Expectativa: **60 fps estáveis** em desktop com GPU dedicada e em celulares
recentes; queda para **40–55 fps** em celulares intermediários — por isso
`useQuality()` já os coloca em `low`, que desliga pós-processamento e corta
partículas em 4×.

**Para obter o número real**: abra `?debug=1`, aguarde o painel no canto
inferior esquerdo, role a cena por 10 s e leia `fps` e `pior 1%`. O painel mede
de verdade (média móvel de 240 amostras + percentil 1).

## Como reproduzir

```bash
npm run verify          # typecheck + lint + glsl + geometria + lógica + build
npm run measure:weight  # tabela de peso por cena acima
npm run dev             # abra http://localhost:5173/?debug=1
```

O painel de `?debug=1` mostra FPS, pior 1%, draw calls, triângulos e MB da cena.
