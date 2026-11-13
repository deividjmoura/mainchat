# Cena 02 — CICLO DO COGUMELO · assets

## Estado atual: **tudo procedural. Nenhum download necessário.**

| elemento | origem | como é feito |
|---|---|---|
| corpo frutífero (caule, chapéu, lamelas) | **procedural** | plano paramétrico deformado no vertex shader; o perfil é uma função de `uStemLen/uCapR/uCapH/uOpen`. Ver `mushroom.ts` |
| micélio | **procedural** | 420 filamentos mesclados + shader de pulso |
| esporos | **procedural** | 1400 pontos, movimento inteiro no vertex shader |
| bokeh de fundo | **procedural** | 90 sprites aditivos grandes (desfoque óptico simulado) |
| substrato | **procedural** | húmus reaproveitado da cena 01 |
| DOF / grain / vinheta | **pós-processamento da fundação** | `EffectComposer` no `App.tsx` (desligado em qualidade baixa) |

## Por que não usar sequência de frames ou vídeo

Decisão registrada no `README.md` desta cena. Resumo:

- **frames scrubbed** dariam mais fotorrealismo, mas um ciclo de 6 s a 1080p/30fps
  exige ~180 frames → ~150–400 MB (ou ~40 MB em AVIF agressivo) e ~2,3 GB de
  VRAM decodificada se tudo for para `ImageBitmap` de uma vez.
- Com 3D paramétrico, `progresso → geometria` é função pura: **scrub reverso
  nunca trava** e o peso é **0 kB de asset**.
- O que se perde em realismo é recuperado em shading: SSS falso, lamelas
  procedurais, DOF e grain.

## Se quiser um GLB de cogumelo fotografado

Só se o cliente exigir fotorrealismo absoluto. Requisitos:

- **formato**: `.glb` (glTF 2.0 binário), Draco comprimido
- **orçamento**: ≤ 3 MB, ≤ 40k triângulos
- **UV**: um conjunto, sem sobreposição; texturas em `.ktx2` (Basis)
- **não pode** ter rig ou morph targets prontos — a animação é dirigida por
  `progress`, e um GLB com 5 morph targets × 40k vértices custa VRAM e não dá
  scrub contínuo.
- licença: CC0 ou comercial explícita

Ao trocar, mantenha `applyGrowth()` como adaptador: ela escreve em uniforms;
passaria a escrever em `morphTargetInfluences`. As três cenas não mudam.
