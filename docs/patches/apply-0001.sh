#!/bin/sh
# Aplica a correção do crash do NarrativeText (ver docs/REQUESTS-agente2.md, item 1).
# Uso:  sh docs/patches/apply-0001.sh
set -e
FILE="src/components/NarrativeText.tsx"
[ -f "$FILE" ] || { echo "rode a partir da raiz do repositório"; exit 1; }
grep -q 'blocks\[Math.min(index,blocks.length-1)\]' "$FILE" && { echo "já aplicado"; exit 0; }
# sed -i portátil (GNU e BSD)
sed -i.bak 's/const b=blocks\[index\];/const b=blocks[Math.min(index,blocks.length-1)];/' "$FILE"
rm -f "$FILE.bak"
grep -q 'blocks\[Math.min(index,blocks.length-1)\]' "$FILE" \
  && echo "OK: NarrativeText corrigido (clamp no render)" \
  || { echo "FALHOU: padrão não encontrado"; exit 1; }
