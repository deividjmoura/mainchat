# ASSETS.md — Guia de Assets das Cenas 04 (`04-veias`) e 05 (`05-cerebro`)

Este documento descreve **o que já está gerado, comprimido e versionado** para as Cenas 04 e 05, e **como baixar, regerar ou substituir** qualquer asset externo (como o modelo anatômico 3D do cérebro `brain.glb`). Consulte [`src/scenes/05-cerebro/SOURCES.md`](src/scenes/05-cerebro/SOURCES.md) para as fontes científicas completas.

---

## 1. Preciso baixar algo manualmente agora para rodar o projeto?

**Não.** Todos os 4 arquivos necessários em `public/assets/04-veias/` e `public/assets/05-cerebro/` **já foram gerados, comprimidos e commitados neste PR**, somando **`0.94 MB` (`959 KB`)** no total:

| Cena | Caminho em `public/` | Tamanho | Compressão / Formato | Origem & Licença |
|---|---|---:|---|---|
| `04-veias` | `public/assets/04-veias/endothelium-map.png` | `250 KB` | PNG RGBA `256×256` tileable | Procedural determinístico (Voronoi celular + FBM) — **CC0 1.0** |
| `04-veias` | `public/assets/04-veias/fallback-veins.svg` | `1.2 KB` | SVG vetorial estático | Ilustração própria para fallback sem WebGL2 — **CC0 1.0** |
| `05-cerebro` | `public/assets/05-cerebro/brain.glb` | `707 KB` | glTF 2.0 + **`EXT_meshopt_compression`** | Template MNI152 FreeSurfer `fsaverage5` (`lhpialparc.mz3`) + atlas subcortical AAL (`aal.mz3`) via NiiVue — **BSD-2-Clause** |
| `05-cerebro` | `public/assets/05-cerebro/fallback-brain.svg` | `1.1 KB` | SVG vetorial estático | Ilustração própria para fallback sem WebGL2 — **CC0 1.0** |

Além disso, caso `brain.glb` ainda esteja baixando em conexões lentas (ou seja removido temporariamente), `AnatomicalBrain.tsx` exibe imediatamente um **cérebro 3D procedural de fallback** no primeiro frame e faz hot-swap suave assim que o `.glb` termina de decodificar.

---

## 2. Especificação Técnica do Modelo do Cérebro (`public/assets/05-cerebro/brain.glb`)

Caso deseje **substituir** `brain.glb` por outro modelo anatômico de maior resolução (ex.: exportado do **FreeSurfer**, **Allen Human Brain Atlas** ou **BodyParts3D / Database Center for Life Science — CC BY-SA 2.1 JP**) ou **regerar** o modelo atual, siga esta especificação:

### 2.1 Nós / Malhas Esperados pelo Loader (`src/scenes/05-cerebro/AnatomicalBrain.tsx`)
O loader procura malhas (`THREE.Mesh`) com os seguintes nomes:
1. **`CerebralCortex`** *(obrigatório)* — superfície pial bilateral (~20k–60k vértices recomendados).
2. **`Thalamus`** *(opcional; usa fallback se ausente)* — tálamo dorsal bilateral.
3. **`Hippocampus`** *(opcional)* — formação hipocampal / giro para-hipocampal bilateral.
4. **`Cerebellum`** *(opcional)* — hemisférios cerebelares + vérmis.
5. **`Brainstem`** *(opcional)* — ponte / bulbo / mesencéfalo.

### 2.2 Escala e Sistema de Coordenadas (MNI152 → Three.js Y-up)
As âncoras de câmera (`cameraKeyframes.ts`), os rótulos 3D (`BrainLabels3D.tsx`) e os 25 hubs do conectoma (`ConnectomeArcs.tsx`) usam a conversão estereotáxica MNI152 (em milímetros) para unidades Three.js:
```ts
X_three = -x_mni * 0.018;
Y_three = (z_mni - 8.0) * 0.018;
Z_three = (y_mni + 16.0) * 0.018;
```
Isso posiciona o córtex dentro da bounding box aproximada `[-1.17, -0.86, -1.55]` a `[+1.17, +1.13, +1.49]`, olhando para `+Z` (polo frontal em `+Z`, polo occipital em `-Z`, topo parietal em `+Y`).

### 2.3 Atributo de Cor por Vértice (`COLOR_0` em `CerebralCortex`)
O shader cortical (`src/scenes/05-cerebro/shaders.ts`) lê `attribute vec4 color` (`COLOR_0` RGBA `0..1`):
- **`R` (`sulcalDepth`)**: profundidade sulcal (`0` = giro, `1` = fundo do sulco) — controla os pulsos emissivos nos sulcos.
- **`G` (`pfcMask`)**: máscara suave `[0..1]` do Córtex Pré-Frontal (mPFC / dlPFC / OFC).
- **`B` (`dmnMask`)**: máscara suave `[0..1]` da Rede de Modo Padrão (mPFC + PCC/Precuneus + Giro Angular).
- **`A` (`ht2aDensity`)**: densidade relativa `[0..1]` de receptores 5-HT2A em áreas associativas.

---

## 3. Como Comprimir um Novo `brain.glb` (Meshopt ou Draco)

`AnatomicalBrain.tsx` suporta nativamente **ambos** os padrões de compressão glTF:

### Opção A — Recomendada: `EXT_meshopt_compression` via `gltfpack` (usada no asset atual)
Não requer arquivos `.wasm` externos em `public/`, pois usa `MeshoptDecoder` já empacotado em `three/examples/jsm/libs/meshopt_decoder.module.js`. Use `-noq -kn` para preservar coordenadas MNI exatas (`Float32Array`) e nomes das 5 malhas:
```bash
npx --yes gltfpack \
  -i caminho/para/brain-raw.glb \
  -o public/assets/05-cerebro/brain.glb \
  -c -noq -kn
```

### Opção B — Alternativa: `KHR_draco_mesh_compression`
Caso prefira comprimir com Draco:
```bash
npx --yes @gltf-transform/cli draco \
  caminho/para/brain-raw.glb \
  public/assets/05-cerebro/brain.glb
```
Se usar Draco, copie também os decoders de `node_modules/three/examples/jsm/libs/draco/gltf/` para `public/draco/` (`draco_decoder.wasm`, `draco_wasm_wrapper.js`), pois o `DRACOLoader` em `AnatomicalBrain.tsx` já está configurado com `draco.setDecoderPath('/draco/')`.

---

## 4. Elementos 100% Procedurais (Não exigem download)

- **Cena 04 (`04-veias`)**: geometria endotelial em `CatmullRomCurve3`, hemácias bicôncavas instanciadas (equação de Evans & Fung, 1972), leucócitos, filamentos de plasma, partículas de psilocibina/psilocina, membrana da BHE e mini-silhueta corporal SVG.
- **Cena 05 (`05-cerebro`)**: neurônio piramidal da Camada V, espinhas dendríticas, receptor GPCR 5-HT2A de 7 hélices transmembrana, molécula 3D de psilocina (`4-HO-DMT`), arcos Bezier 3D do conectoma global e rótulos 3D + leader lines SVG.
