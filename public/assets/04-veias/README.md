# Assets — Cena `04-veias`

| Arquivo | Formato / Dimensões | Tamanho | Origem & Licença | Papel na Cena |
| --- | --- | --- | --- | --- |
| `endothelium-map.png` | PNG RGBA tileable `256×256` | `250 KB` | Gerado proceduralmente neste projeto (CC0 / Domínio Público) | Canal `R`: relevo endotelial pavimentoso; `G`: junções oclusivas (*tight junctions* da BHE); `B`: estrias elásticas circunferenciais; `A`: máscara de espessura translúcida (SSS). Carregado de forma assíncrona com fallback `DataTexture` imediato. |
| `fallback-veins.svg` | SVG vetorial `960×540` | `1.2 KB` | Autoral (CC0) | Fallback visual estático/scrubbed caso WebGL2 não esteja disponível. |

## Elementos Procedurais (sem peso de download)
- Curva vascular 3D (`CatmullRomCurve3`): sistema digestivo → sistema porta/fígado → coração → artéria carótida → capilar cerebral / barreira hematoencefálica.
- Geometria analítica bicôncava das hemácias (equação fisiológica de Evans & Fung, 1972) via `THREE.InstancedMesh` (`480` a `2.400` instâncias em 1 *draw call*).
- Leucócitos rugosos em marginação periférica, plasma coloidal em fluxo e moléculas luminosas de psilocibina → psilocina (`4-HO-DMT`).
- Mini-silhueta anatômica do corpo em SVG sincronizada ao `progress`.
