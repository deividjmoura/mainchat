# Cena 01 — TERRA · assets

## Estado atual: **tudo procedural. Nenhum download necessário.**

Esta cena não tem nenhum binário. Solo, folhas, raízes, micélio, poeira e luz
são gerados em runtime (canvas 2D para texturas, geometria paramétrica para o
resto). Custo de geração medido no navegador: húmus 1024² ≈ 110 ms, casca 512²
≈ 113 ms — roda no primeiro frame da cena, nunca durante o scroll.

| elemento | origem | como é feito | por que |
|---|---|---|---|
| húmus (albedo, normal, roughness) | **procedural** | `makeHumusMaps()` em `src/scenes/_shared/textures.ts`: FBM de 3 escalas + 90 folhas decompostas pintadas | uma textura de solo 4K realista custaria 8–20 MB; o FBM lê igual a 30 cm de distância |
| folhas caídas | **procedural** | folha desenhada em canvas (`makeLeafCanvas`), instanciada 80× com rotação/escala aleatórias determinísticas | 80 malhas individuais = 80 draw calls; instancing = 1 |
| raízes | **procedural** | `TubeGeometry` sobre `CatmullRomCurve3`, 9 raízes | cada raiz tem curvatura própria; um GLB de raiz não economizaria nada |
| casca | **procedural** | `makeBarkMaps()`, estrias + rachaduras | — |
| micélio | **procedural** | 260 filamentos em `TubeGeometry` mesclada (1 draw call), shader de fibra óptica com pulso | o pulso precisa ser animado; textura estática não pulsaria |
| poeira em suspensão | **procedural** | 700 pontos, posição 100% no vertex shader (0 custo de CPU) | — |
| feixes de luz | **procedural** | 7 planos aditivos billboard com ruído animado | volumetria real (raymarch) custaria ~4 ms/frame |

## Se quiser trocar por fotografia real

Opcional, não recomendado. Caso o cliente exija foto real do solo:

- **albedo**: `.webp` ou `.jpg`, 2048×2048, tileável, 6–12 MB de orçamento
- **normal**: `.png` (não perde precisão no azul), 2048×2048
- **roughness**: `.jpg` grayscale, 1024×1024
- licença: CC0 (Poly Haven, ambientCG) — **evite** texturas sem licença clara

Basta substituir `makeHumusMaps()` por `useTexture()` em `ground.tsx`.
Nada mais muda: o material já consome `map`/`normalMap`/`roughnessMap`.
