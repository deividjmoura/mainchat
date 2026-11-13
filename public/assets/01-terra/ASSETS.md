# Cena 01 — TERRA · assets

> ## O que você precisa gerar ou baixar: **nada.**
>
> A cena 01 está completa e roda 100% procedural. Não há pendência de asset.
> As seções abaixo explicam o que existe hoje e, se algum dia você quiser trocar
> por fotografia real, exatamente o que pedir.

## O que é procedural

| elemento | como é feito | por que |
|---|---|---|
| húmus (albedo, normal, roughness) | `makeHumusMaps()` em `src/scenes/_shared/textures.ts`: FBM de 3 escalas + 90 folhas decompostas pintadas em canvas | uma textura de solo 4K realista custaria 8–20 MB; o FBM lê igual a 30 cm de distância |
| folhas caídas | folha desenhada em canvas (`makeLeafCanvas`), instanciada 80× com rotação e escala determinísticas | 80 malhas separadas = 80 draw calls; instancing = 1 |
| raízes | `TubeGeometry` sobre `CatmullRomCurve3`, 9 raízes | cada raiz tem curvatura própria; um GLB não economizaria nada |
| casca | `makeBarkMaps()`: estrias verticais + rachaduras profundas | — |
| micélio | 260 filamentos em `TubeGeometry` mesclada (1 draw call) + shader de fibra óptica com pulso | o pulso precisa ser animado; textura estática não pulsaria |
| poeira em suspensão | 700 pontos, posição 100% no vertex shader | custo de CPU ≈ zero |
| feixes de luz | 7 planos aditivos billboard com ruído animado | volumetria real (raymarch) custaria ~4 ms/frame |

Custo medido de geração, no navegador: húmus 1024² ≈ 110 ms, casca 512² ≈ 113 ms.
Roda no primeiro frame da cena, nunca durante o scroll.

## Se você quiser trocar por fotografia real (opcional)

Não é recomendado — o procedural já está no orçamento e não tem risco de licença.
Mas se o cliente exigir foto de solo real, é isto que precisa ser baixado:

- **albedo**: `.webp` ou `.jpg`, 2048×2048, **tileável**, 2–6 MB
- **normal**: `.png` (não perde precisão no canal azul), 2048×2048, 3–8 MB
- **roughness**: `.jpg` grayscale, 1024×1024, 0,5–2 MB
- **licença**: CC0 (Poly Haven, ambientCG). Evite texturas sem licença explícita.

Para plugar, substitua `makeHumusMaps()` por `useTexture()` em `ground.tsx`.
Nada mais muda: o material já consome `map` / `normalMap` / `roughnessMap`.
