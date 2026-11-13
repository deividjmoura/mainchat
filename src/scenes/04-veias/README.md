# Cena 04 — Jornada pelas Veias (`04-veias`)

Viagem vascular em primeira pessoa guiada exclusivamente por `progress: MotionValue<number>` (`0..1`), partindo da escuridão interna ao final da Cena 03 (`03-mao-boca`) através do trato digestivo, sistema porta-hepático (conversão metabólica `psilocibina -> psilocina`), câmaras cardíacas, artéria carótida interna e travessia luminosa da **Barreira Hematoencefálica (BHE)** rumo à Cena 05 (`05-cerebro`).

## Arquitetura de Arquivos (`src/scenes/04-veias/`)

| Arquivo | Responsabilidade |
|---|---|
| `index.tsx` | Exporta `Component({ progress })`, `scene04Veias: SceneDefinition` (`scrollLength: 340` vh, 6 `textBlocks`) e controla a câmera 1ª pessoa com `CatmullRomCurve3`, neblina volumétrica (`FogExp2`) e restauração limpa de câmera/fog ao sair da cena. |
| `splineData.ts` | Pontos de controle da `CatmullRomCurve3` vascular (`[0, 0, 5.5]` -> saída alinhada em `-Z` na BHE), marcos anatômicos e marcos 2D da mini-silhueta corporal. |
| `shaders.ts` | Shaders GLSL ES 3.00 (seguros contra `NaN` em WebGL2/ANGLE): endotélio orgânico com Fresnel + fake SSS + pulsação cardíaca, hemácias instanciadas com DOF óptico no shader + motion blur axial de velocidade, e membrana endotelial da BHE. |
| `VesselTunnel.tsx` | Túnel endotelial translúcido, filamentos longitudinais de plasma e portal de junções oclusivas da Barreira Hematoencefálica em `t = 0.895`. |
| `BloodCells.tsx` | Geometria eritrocitária bicôncava paramétrica (Evans & Fung, 1972) via `InstancedMesh`, leucócitos granulares ao fundo, partículas de plasma e conversão cromática `psilocibina` (violeta-âmbar) -> `psilocina` (ciano-turquesa bioluminescente, com emissão HDR `> 0.72` integrada ao `Bloom` global). |
| `BodyMiniMap.tsx` | Mini-silhueta corporal SVG posicionada no canto superior esquerdo (`top: 74px; left: 5vw`), sem colisão com `.topbar`, `.narrative`, `.progress-rail` ou `.debug-panel`, além do fallback estático `/assets/04-veias/fallback-veins.svg` quando WebGL2 não está disponível. |
| `sceneQuality.ts` | Adapta contagens de instâncias e geometria aos níveis `high` / `medium` / `low`, respeita `prefers-reduced-motion` e detecta suporte real a WebGL2 (`?quality=` e `?webgl2=0` suportados para teste). |

## Inventário: O que é Procedural vs. Asset Externo/Gerado

| Elemento | Origem | Caminho / Tamanho | Licença |
|---|---|---|---|
| **Túnel vascular (`TubeGeometry` em `CatmullRomCurve3`)** | **Procedural** (Three.js em runtime) | `src/scenes/04-veias/VesselTunnel.tsx` | Código próprio do repositório |
| **Hemácias bicôncavas (`InstancedMesh`: 2400 / 1350 / 520)** | **Procedural** (equação de Evans & Fung, 1972) | `src/scenes/04-veias/BloodCells.tsx` | Código próprio do repositório |
| **Leucócitos, plasma, moléculas psilocibina/psilocina e portal BHE** | **Procedural** (`InstancedMesh` + GLSL) | `src/scenes/04-veias/BloodCells.tsx`, `VesselTunnel.tsx` | Código próprio do repositório |
| **Mini-silhueta corporal HUD** | **Procedural** (SVG inline sincronizado via `useFrame`) | `src/scenes/04-veias/BodyMiniMap.tsx` | Código próprio do repositório |
| **Textura celular endotelial (`endothelium-map.png`)** | **Asset gerado deterministicamente** (Voronoi + FBM tileable `256x256` RGBA) | `public/assets/04-veias/endothelium-map.png` (`250 KB`) | **CC0 1.0** (domínio público, gerado no projeto) |
| **Fallback estático sem WebGL2 (`fallback-veins.svg`)** | **Asset vetorial estático** | `public/assets/04-veias/fallback-veins.svg` (`1.2 KB`) | **CC0 1.0** |

## Continuidade Entre Cenas (Match-Cut)
- **Entrada (`progress = 0.00`)**: Câmera em `[0, 0, 5.5]`, olhando para `[0, 0, 0]`, `FOV 44°` (próximo aos `42°` padrão do `Canvas`), imersa em fundo escuro `#2a0d12` (`palette.blood.background`), casando com o fim da Cena 03 (`03-mao-boca`).
- **Saída (`progress = 1.00`)**: Travessia luminosa da BHE alinhada ao eixo `-Z` com transição cromática para tons ciano/índigo (`#10101f`), conectando-se diretamente à emergência do capilar pial em `progress = 0.00` da Cena 05 (`05-cerebro`).

## Níveis de Qualidade e Orçamento de Performance

| Nível | Hemácias (`InstancedMesh`) | Leucócitos | Moléculas | Plasma | Segmentos do Tubo | Peso de Assets |
|---|---:|---:|---:|---:|---:|---:|
| `high` | 2.400 | 34 | 130 | 720 | `240 × 32` | `0.25 MB` |
| `medium` | 1.350 | 22 | 90 | 420 | `180 × 24` | `0.25 MB` |
| `low` | 520 | 12 | 50 | 200 | `120 × 18` | `0.25 MB` |
| Sem WebGL2 | — | — | — | — | Fallback SVG | `0.001 MB` |
