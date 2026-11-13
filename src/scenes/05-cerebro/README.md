# Cena 05 — Cérebro Anatômico & Receptores 5-HT2A (`05-cerebro`)

Revelação anatômica 3D e exploração multiescala do encéfalo humano guiada exclusivamente por `progress: MotionValue<number>` (`0..1`), cobrindo:
1. **Emergência do capilar pial & visão geral cortical (`0.00 – 0.25`)**: pulsos de atividade ao longo dos sulcos corticais via shader emissivo.
2. **Destaque regional com luz, rótulos ancorados em 3D (`drei <Html>`) e leader lines (`0.25 – 0.58`)**: **Córtex Pré-Frontal (PFC)**, **Tálamo** subcortical (com projeções tálamo-corticais) e **Rede de Modo Padrão (DMN: mPFC, PCC/Precuneus, Giro Angular)**.
3. **Micro-zoom sináptico (`0.58 – 0.81`)**: neurônios piramidais da Camada V com receptores GPCR **5-HT2A** (7 hélices transmembrana) — a molécula de psilocina liga-se ao bolso ortostérico, o sinal intracelular dispara e ondas de ativação espalham-se pela coluna cortical.
4. **Pull-back de conectoma global (`0.81 – 1.00`)**: arcos luminosos curvos revelando conectividade funcional transitória ampliada entre regiões habitualmente segregadas.

Consulte **[SOURCES.md](./SOURCES.md)** para a bibliografia científica completa separando **CONSENSO** de **HIPÓTESE EM ESTUDO**.

## Arquitetura de Arquivos (`src/scenes/05-cerebro/`)

| Arquivo | Responsabilidade |
|---|---|
| `index.tsx` | Exporta `Component({ progress })`, `scene05Cerebro: SceneDefinition` (`scrollLength: 420` vh, 6 `textBlocks` rotulados com `CONSENSO` vs. `HIPÓTESE`) e interpola a câmera por keyframes suaves ligados ao `progress`. |
| `cameraKeyframes.ts` | Tabela de 12 keyframes de câmera (`position`, `target`, `fov`), conversão estereotáxica MNI152 -> Three.js (`mniToBrainSpace`) e utilitários de interpolação. |
| `shaders.ts` | `corticalSurfaceShader` (lê `COLOR_0` `[sulcalDepth, pfcMask, dmnMask, ht2aDensity]` com iluminação translúcida e emissão HDR nos sulcos/regiões) e `connectomeArcShader` (pulsos fotônicos bidirecionais nos feixes inter-redes). |
| `AnatomicalBrain.tsx` | Faz lazy-loading de `/assets/05-cerebro/brain.glb` (`707 KB`, comprimido com `EXT_meshopt_compression`) via `GLTFLoader` + `MeshoptDecoder` (+ suporte a `DRACOLoader`), mantendo fallback 3D procedural imediato até a malha MNI152 decodificar. |
| `NeuronReceptorMicro.tsx` | Cena microscópica 3D da Camada V cortical: soma e dendritos piramidais, receptor 5-HT2A de 7 hélices, molécula de psilocina (`4-HO-DMT`), anéis de ativação e coluna neuronal vizinha. |
| `ConnectomeArcs.tsx` | Feixes Bezier 3D conectando 25 coordenadas MNI de redes funcionais distintas (DMN, FPN, Visual, Somatomotora, Auditiva, Saliência, Subcortical e Límbica). |
| `BrainLabels3D.tsx` | Rótulos `@react-three/drei <Html>` ancorados em coordenadas MNI 3D com linhas guia SVG (`leader lines`) e selos `CONSENSO` / `HIPÓTESE`, mais fallback estático `/assets/05-cerebro/fallback-brain.svg` sem WebGL2. |
| `sceneQuality.ts` | Escala arcos do conectoma (`56` / `36` / `20`) e partículas conforme `high` / `medium` / `low`, respeita `prefers-reduced-motion` e detecta suporte real a WebGL2. |
| `SOURCES.md` | Revisão bibliográfica peer-reviewed distinguindo consenso científico de hipóteses em investigação. |

## Inventário: O que é Procedural vs. Asset Externo/Comprimido

| Elemento | Origem | Caminho / Tamanho | Licença |
|---|---|---|---|
| **Modelo anatômico MNI152 (`brain.glb`)** | **Asset externo processado e comprimido com Meshopt (`EXT_meshopt_compression`)** a partir do template cortical FreeSurfer `fsaverage5` (`lhpialparc.mz3`) + atlas subcortical AAL (`aal.mz3`) via `niivue` | `public/assets/05-cerebro/brain.glb` (`707 KB`, 5 malhas: `CerebralCortex`, `Thalamus`, `Hippocampus`, `Cerebellum`, `Brainstem`) | **BSD-2-Clause** (NiiVue / FreeSurfer `fsaverage` / AAL MNI152) |
| **Cérebro 3D inicial de carregamento** | **Procedural** (hemisférios sulcados + subcórtex gerados em memória até o `.glb` resolver) | `src/scenes/05-cerebro/AnatomicalBrain.tsx` | Código próprio do repositório |
| **Neurônio piramidal Camada V, receptor 5-HT2A e molécula de psilocina** | **Procedural** (`TubeGeometry` + primitivas 3D animadas por `progress`) | `src/scenes/05-cerebro/NeuronReceptorMicro.tsx` | Código próprio do repositório |
| **Arcos do conectoma inter-regional** | **Procedural** (`QuadraticBezierCurve3` entre 25 coordenadas MNI152 + GLSL) | `src/scenes/05-cerebro/ConnectomeArcs.tsx` | Código próprio do repositório |
| **Rótulos 3D e leader lines** | **Procedural** (`@react-three/drei <Html>` + SVG) | `src/scenes/05-cerebro/BrainLabels3D.tsx` | Código próprio do repositório |
| **Fallback estático sem WebGL2 (`fallback-brain.svg`)** | **Asset vetorial estático** | `public/assets/05-cerebro/fallback-brain.svg` (`1.1 KB`) | **CC0 1.0** |

## Níveis de Qualidade e Orçamento de Performance

| Nível | Malha `brain.glb` (lazy Meshopt) | Arcos do Conectoma | Partículas Neurais | Peso de Assets |
|---|---:|---:|---:|---:|
| `high` | 30.958 vértices / 61.820 triângulos (`707 KB`) | 56 | 280 | `0.69 MB` |
| `medium` | 30.958 vértices / 61.820 triângulos (`707 KB`) | 36 | 180 | `0.69 MB` |
| `low` | 30.958 vértices / 61.820 triângulos (`707 KB`) | 20 | 90 | `0.69 MB` |
| Sem WebGL2 | Fallback estático SVG | — | — | `0.001 MB` |
