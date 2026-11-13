# Relatório de validação da integração

**Estado: integração das cinco cenas concluída; validação automatizada aprovada; runtime local/navegador ainda pendente.**  
Atualizado em 2026-11-13.

## Integração concluída

- [x] Corrigido o acesso narrativo com `blocks[Math.min(index, blocks.length - 1)] ?? blocks[0]`, incluindo guarda para lista vazia.
- [x] Corrigidas as quatro chaves de transição:
  - `01-terra->02-cogumelo`
  - `02-cogumelo->03-mao-boca`
  - `03-mao-boca->04-veias`
  - `04-veias->05-cerebro`
- [x] Integrada a PR [#2 — Agente 3](https://github.com/deividjmoura/mainchat/pull/2): cenas 04-veias e 05-cerebro.
- [x] Integrada a PR [#1 — Agente 2](https://github.com/deividjmoura/mainchat/pull/1): cenas 01-terra, 02-cogumelo e 03-mao-boca. O rebase deixou a branch sem divergência antes do merge.
- [x] Atualizado `src/scenes/stubs.tsx` para registrar as cinco definições reais, na ordem narrativa. Os stubs visuais antigos foram removidos do catálogo.
- [x] Atualizado o workflow para executar typecheck, lint, estrutura, shaders, geometria/transições, timelines e build.

## CI — validação automatizada

**GitHub Actions**

- [Run #43449020382 — registro das cinco cenas](https://github.com/deividjmoura/mainchat/actions/runs/43449020382): install, typecheck, lint e build passaram.
- [Run #43449152060 — gates completos](https://github.com/deividjmoura/mainchat/actions/runs/43449152060): install, typecheck, lint, check:structure, check:glsl, check:geometry, check:logic e build passaram.

O workflow expandido foi executado no commit `c38f683`. O registro das cenas foi validado no commit `da6d6f1`. Os testes automatizados não substituem a inspeção visual e interativa no navegador.

## Lockfile

A árvore GitHub da branch `feat/scrollytelling-foundation` não contém `pnpm-lock.yaml` nem outro lockfile no momento da verificação. A instalação do CI usa `pnpm install --no-frozen-lockfile`, portanto consegue instalar, mas não garante instalação reproduzível por lockfile.

Se o lockfile já existe no checkout local do projeto, ele precisa ser commitado e enviado para esta branch antes do merge final. Não foi criado um lockfile artificial.

## Runtime e navegador — pendente

| Verificação | Estado |
|---|---|
| Instalação no GitHub Actions | **Passou** |
| TypeScript | **Passou** |
| ESLint | **Passou** |
| Estrutura/registro das cinco cenas | **Passou** |
| Parser e validação dos shaders | **Passou** |
| Geometria, enquadramento e continuidade | **Passou** |
| Timelines | **Passou** |
| Build de produção | **Passou** |
| `pnpm dev` no ambiente local | Pendente |
| `/?debug=1` no navegador real | Pendente |
| Console sem erros durante 01→05 e retorno | Não confirmado |
| Seletor de cena, slider e FPS no painel | Não testados interativamente |
| FPS real, pior 1%, jank, layout shift e memória WebGL | Não medidos |
| `pnpm-lock.yaml` commitado | Não encontrado na branch remota |

## Próximos passos

1. Confirmar o lockfile local e enviá-lo à branch, se ainda não estiver commitado.
2. Rodar `pnpm dev` no CachyOS e abrir `http://localhost:5173/?debug=1`.
3. Testar seletor, slider, rolagem 01→05 e retorno 05→01.
4. Inspecionar o console e reportar erros; medir FPS em hardware real.
5. Atualizar este documento com as evidências locais antes do merge para `main`.

**Não declarar runtime validado, console limpo ou 60 FPS estáveis sem executar os testes correspondentes.**
