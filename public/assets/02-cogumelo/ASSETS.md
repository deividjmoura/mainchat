# Cena 02 — CICLO DO COGUMELO · assets

> ## O que você precisa gerar ou baixar: **nada.**
>
> A cena 02 está completa e roda 100% procedural. Não há pendência de asset.
> As seções abaixo explicam por que não usamos frames/vídeo e, se você exigir
> fotorrealismo absoluto, exatamente o GLB que precisaria encomendar.

## O que é procedural

| elemento | como é feito |
|---|---|
| corpo frutífero (caule, chapéu, lamelas) | plano paramétrico deformado no vertex shader; o perfil é função de `uStemLen` / `uCapR` / `uCapH` / `uOpen`. Ver `mushroom.ts` |
| micélio | 420 filamentos mesclados + shader de pulso |
| esporos | 1.400 pontos, movimento inteiro no vertex shader |
| bokeh de fundo | 90 sprites aditivos grandes (desfoque óptico simulado) |
| substrato | húmus reaproveitado da cena 01 |
| DOF / grain / vinheta | pós-processamento da fundação (`EffectComposer` no `App.tsx`), desligado em qualidade baixa |

## Por que não usar sequência de frames ou vídeo

Decisão completa em `src/scenes/02-cogumelo/README.md`. Resumo:

- **frames scrubbed** dariam mais fotorrealismo, mas um ciclo de 6 s em 1080p/30fps
  exige ~180 frames → 40–400 MB de download e ~2,3 GB de VRAM decodificada se
  todos forem para `ImageBitmap` de uma vez;
- com 3D paramétrico, `progresso → geometria` é função pura: **scrub reverso
  nunca trava** e o peso de asset é **0 kB**;
- o que se perde em realismo é recuperado em shading: SSS falso, lamelas
  procedurais, DOF e grain.

## Se você exigir um GLB de cogumelo fotografado (opcional)

Só vale a pena se o fotorrealismo do corpo frutífero for requisito de contrato.
Requisitos, porque um GLB comum **quebra** esta cena:

- **formato**: `.glb` (glTF 2.0 binário), Draco comprimido
- **resolução**: ≤ 40k triângulos; texturas em `.ktx2` (Basis)
- **UV**: um conjunto, sem sobreposição
- **não pode ter morph targets nem rig prontos** — a animação é dirigida por
  `progress`. Um GLB com 5 morph targets × 40k vértices não dá scrub contínuo e
  custa VRAM. O que você quer é a **malha em repouso**, madura.
- **duração/escala**: 1 unidade = 1 metro; chapéu maduro ≈ 4,7 cm de diâmetro
- **orçamento**: ≤ 3 MB
- **licença**: CC0 ou comercial explícita

Para plugar, mantenha `applyGrowth()` como adaptador: ela escreve em uniforms;
passaria a escrever em `morphTargetInfluences`. As outras duas cenas não mudam.
