# Assets — Cena `05-cerebro`

| Arquivo | Formato / Compressão | Tamanho | Origem & Licença | Papel na Cena |
| --- | --- | --- | --- | --- |
| `brain.glb` | glTF 2.0 binário comprimido com **`EXT_meshopt_compression`** (`gltfpack -c -noq -kn`) | **`707 KB`** (reduzido de `1.14 MB`, `-39.6%`) | Derivado das superfícies neuroanatômicas abertas em espaço estereotáxico **MNI152**: FreeSurfer `fsaverage5` com parcelamento Desikan-Killiany (`lhpialparc.mz3`) + atlas subcortical/cerebelar AAL (`aal.mz3`), distribuídos pelo projeto **NiiVue** (`https://github.com/niivue/niivue`, licença **BSD-2-Clause**). | Contém 5 submalhas nomeadas (`CerebralCortex` com 20.484 vértices e atributo `COLOR_0` codificando profundidade sulcal + máscaras de PFC, DMN e densidade 5-HT2A; `Thalamus`; `Hippocampus`; `Cerebellum`; `Brainstem`). Carregado via lazy-load (`GLTFLoader` + `MeshoptDecoder` + suporte `DRACOLoader`) sobre fallback procedural imediato. |
| `fallback-brain.svg` | SVG vetorial `960×540` | `1.1 KB` | Autoral (CC0) | Fallback visual estático/scrubbed quando WebGL2 está indisponível. |
