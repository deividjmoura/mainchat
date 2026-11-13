# Cena 02 — CICLO DO COGUMELO (cena principal)

Cinco estágios em 220 vh de scroll: micélio se adensa → primórdio → nascimento →
crescimento (caule alonga, chapéu abre, lamelas aparecem, esporos caem) →
secagem e colapso.

## Decisão técnica: (a) 3D paramétrico + shader de SSS falso

A escolha é entre três caminhos. Avaliei os três com números do próprio projeto:

| critério | (a) 3D + shader | (b) sequência de frames | (c) híbrido |
|---|---|---|---|
| peso do download | **0 kB** | 40–400 MB | 40–400 MB + 3D |
| VRAM decodificada | **~0,3 MB** (20k tris) | ~2,3 GB se todos os `ImageBitmap` ficarem residentes | idem + cena |
| scrub reverso | **exato** (função pura) | trava e "escorrega" para frente; precisa de cache bidirecional | trava |
| custo de produção | shader (feito) | precisa de captura/time-lapse real ou geração IA de 180+ frames | ambos |
| fotorrealismo do cogumelo | bom, não fotorreal | **fotorreal** | fotorreal |
| tempo até o 1º frame | imediato | depende de preload progressivo | depende |
| muda de forma com a viewport | sim (é geometria) | não (é vídeo) | parcial |

**(b) foi descartado** por três motivos concretos:
1. o *scrub* reverso é requisito de UX do scrollytelling; frames em `ImageBitmap`
   consomem memória demais para manter os dois sentidos em cache, e o resultado
   visível é engasgo ao rolar para cima;
2. 2,3 GB de VRAM decodificada estoura o orçamento de qualquer celular — o
   caminho (b) obrigaria a servir vídeo em qualidade baixa para **todo** o
   público mobile, não só como fallback;
3. a cena é macro: a 1080p, o cogumelo ocupa ~600 px de altura. O ganho de
   realismo de frames sobre um shader com SSS + DOF + grain é real, mas não é o
   que sustenta a cena — a leitura de *crescimento* é.

**(c) híbrido** foi descartado porque soma os dois custos sem resolver o scrub,
e o que ele acrescentaria (esporos em partículas) **já é 3D aqui**.

## Como a animação funciona

`progress → cycleAt(progress)` (`timeline.ts`) produz 8 canais contínuos. Nenhum
estado é acumulado: cada frame recalcula a pose inteira a partir de `progress`.
Isso é o que torna o scrub reverso exato.

```
0.00–0.10  network        micélio se adensa
0.08–0.24  primordium     nó branco aparece e desaparece
0.16–0.62  growth         caule alonga (turgor)
0.42–0.72  open           chapéu abre, calota achata, lamelas se separam
0.62–0.88  spores         esporos caem
0.78–0.94  dry            escurece, enruga, perde brilho
0.90–1.00  wilt           caule dobra e o corpo colapsa
```

Geometria (em `mushroom.ts`), com as proporções validadas por
`scripts/check-timelines.ts`:

- `stemLen = 0.034 · min(1, growth·1.15)^0.78` → caule maduro ≈ 3,4 cm
- `capR = 0.0235 · capGrow^0.62 · (0.9 + open·0.14)`
- `capH = capR · (0.95 − 0.42·open)` → calota/raio 0,95 (botão) → 0,53 (maduro)
- chapéu Ø / caule Ø ≈ 6,5 na maturidade (faixa real de Agaricales: 5–8)

## Realismo sem fotografia

- **SSS falso**: difusa com *wrap* (a luz contorna o volume) + translucidez de
  contraluz (a luz atravessa a carne e sai âmbar).
- **Molhado → seco**: o especular nasce largo e forte (úmido) e desaparece
  conforme `dry` sobe.
- **Lamelas**: estrias radiais que se adensam na periferia, com oclusão nas
  frestas. Aparecem só quando o chapéu abre.
- **Profundidade**: bokeh aditivo no fundo + `EffectComposer` da fundação
  (Bloom/Noise/Vignette) em qualidade ≥ média.
- **Sombra de contato** sem shadow map: quad com gradiente radial.

## Qualidade e fallback

`useQuality()` da fundação já rebaixa para `low` com `prefers-reduced-motion`,
mobile ou ≤4 núcleos. A cena respeita isso reduzindo contagem de partículas,
resolução das malhas e desligando o bokeh. Com movimento reduzido, a amplitude
da câmera cai a 10% (`gain`), então o scroll não empurra a câmera por todo o
trajeto — o cogumelo **ainda nasce, cresce e morre**, mas com a câmera quase
parada.

## Arquivos

- `mushroom.ts` — shaders, materiais, geometria, `applyGrowth`
- `timeline.ts` — os 8 canais do ciclo
- `index.tsx` — cena, câmera, luz, partículas, registro `SceneDefinition`
