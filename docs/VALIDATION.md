# Relatório de validação da fundação

**Estado: BLOQUEADO — não abrir PR de integração nem liberar as cenas definitivas ainda.**  
Atualizado em 2026-11-13.

## Evidências executadas

### Execução local neste ambiente

```text
$ node --version
v22.16.0

$ corepack --version
0.32.0

$ corepack prepare pnpm@10.34.5 --activate
Preparing pnpm@10.34.5 for immediate activation...
Internal Error: Error when performing the request to
https://registry.npmjs.org/pnpm/-/pnpm-10.34.5.tgz
```

A instalação local não iniciou: o ambiente isolado não conseguiu baixar pnpm do npm. O clone via Git também não estava disponível por falha de DNS/rede. Por isso, não foi possível abrir `pnpm dev` nem um navegador local para verificar o console.

### GitHub Actions

Workflow: `.github/workflows/quality.yml`  
Execução observada: [run #32](https://github.com/deividjmoura/mainchat/actions/runs/43437617280), commit `f911be6d9d00e397652a8889983779e79639100f`.

| Etapa | Resultado | Evidência |
|---|---|---|
| Setup pnpm 10.34.5 | Passou | Action instalou pnpm 10.34.5 |
| `pnpm install --no-frozen-lockfile` | Passou | 240 pacotes adicionados |
| `pnpm typecheck` | Falhou | `src/core/SceneManager.ts(30,30): TS6133 'index' is declared but its value is never read` |
| `pnpm lint` | Não executado | Etapa pulada após falha do typecheck |
| `pnpm build` | Não executado | Etapa pulada após falha do typecheck |

A falha de typecheck foi corrigida em `9a8652ec0001da36c300141ab4f40296d54e57e3`, removendo o parâmetro `index` não utilizado do `forEach`. A execução [run #33](https://github.com/deividjmoura/mainchat/actions/runs/43441555283), nesse commit, concluiu com sucesso: install, typecheck, lint e build passaram. A execução do commit seguinte, que atualiza este relatório, ainda estava em andamento no momento desta edição.

A instalação do CI também reportou:
- aviso de depreciação da versão de ESLint resolvida;
- script de build de `esbuild` ignorado pelo pnpm 10.34.5;
- não existe `pnpm-lock.yaml` versionado. A workflow usa `--no-frozen-lockfile`, então a resolução não é reprodutível até adicionar o lockfile.

## Matriz de validação

| Verificação | Estado |
|---|---|
| Instalação de dependências | Passou no GitHub Actions; falhou localmente por rede |
| Typecheck | Passou no GitHub Actions run #33 |
| Lint | Passou no GitHub Actions run #33 |
| Build de produção | Passou no GitHub Actions run #33 |
| `pnpm dev` | Pendente |
| Console do navegador sem erros | Pendente — navegador não foi aberto |
| Seletor, slider e FPS em `?debug=1` | Implementação inspecionada no código; teste interativo real pendente |
| FPS real / 60 FPS | Pendente; leitura do painel é ticker FPS, não benchmark de GPU |
| Jank / layout shift | Pendente |
| Memory leak / dispose | Pendente |
| Lenis + ScrollTrigger / RAF | Implementado, não validado em runtime |
| Transições | Parcial: overlay configurável, ainda não é crossfade real entre duas cenas |

## Próximos gates obrigatórios

1. Gerar e commitar `pnpm-lock.yaml`; ajustar avisos de dependências/build scripts quando necessário.
2. Confirmar que a execução de CI do último commit também concluiu verde (run #33 já validou o código no commit imediatamente anterior).
3. Rodar `pnpm dev`, abrir `/?debug=1` e verificar console sem erros.
4. Testar seletor, slider e leitura de FPS em navegador real.
5. Medir FPS, jank e layout shift em hardware/navegador identificados.
6. Repetir montagem/desmontagem e inspecionar memória/recursos WebGL.
7. Atualizar este relatório com as evidências e só então abrir o PR de integração.

**Não afirmar 60 FPS nem console limpo sem medição. Não iniciar integração paralela definitiva até esses gates passarem.**
