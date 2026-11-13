# Relatório de validação da integração

**Estado: integração parcial — cenas 04–05 registradas; cenas 01–03 aguardam rebase do Agente 2.**  
Atualizado em 2026-11-13.

## Alterações integradas

- [x] Corrigido o acesso ao bloco narrativo com `blocks[Math.min(index, blocks.length - 1)] ?? blocks[0]`, incluindo guarda para lista vazia.
- [x] Corrigidas as chaves de transição para os IDs oficiais:
  - `01-terra->02-cogumelo`
  - `02-cogumelo->03-mao-boca`
  - `03-mao-boca->04-veias`
  - `04-veias->05-cerebro`
- [x] Integrada a PR [#2 — Agente 3](https://github.com/deividjmoura/mainchat/pull/2), com as cenas 04-veias e 05-cerebro, assets, fallbacks e documentação.
- [x] Registradas `scene04Veias` e `scene05Cerebro` no catálogo `src/scenes/stubs.tsx`.
- [x] Preservados os IDs e a ordem narrativa no catálogo.

## CI

As execuções abaixo foram observadas no GitHub Actions:

| Commit | Run | Install | Typecheck | Lint | Build |
|---|---|---|---|---|---|
| `55a673b` — NarrativeText clamp | [#37](https://github.com/deividjmoura/mainchat/actions/runs/43443768802) | Passou | Passou | Passou | Passou |
| `c380f44` — transições | [#38](https://github.com/deividjmoura/mainchat/actions/runs/43443776943) | Passou | Passou | Passou | Passou |
| `657d004` — registro das cenas 04–05 | [#39](https://github.com/deividjmoura/mainchat/actions/runs/43443781367) | Passou | Passou | Passou | Passou |

Esses resultados validam os commits indicados no CI; não equivalem a teste interativo em navegador.

## Agente 2 — cenas 01–03

A PR [#1 — cenas 01–03](https://github.com/deividjmoura/mainchat/pull/1) ainda está aberta e não está pronta para integração:
- branch: `arena/d5315b2f-mainchat`;
- comparação com a fundação: divergente, 2 commits à frente e 44 atrás;
- GitHub informa `mergeable: false`.

**Aguardar o rebase do Agente 2 sobre o head atual da `feat/scrollytelling-foundation`.** Depois do rebase, revisar a comparação/PR, integrar os exports reais das cenas 01–03 no catálogo e rodar novamente os gates. Não fazer merge da branch atual enquanto estiver divergente.

## Lockfile

A consulta ao conteúdo remoto do GitHub não encontrou `pnpm-lock.yaml` na branch de integração nem nas branches Arena dos Agentes 2 e 3 (API 404). Se o lockfile já existe no ambiente local, ele ainda não está commitado/pushado nesses refs. Confirmar e versionar antes de considerar a instalação reproduzível.

## Validação local / navegador

| Verificação | Estado |
|---|---|
| `pnpm install` local neste ambiente | Bloqueado por falha de rede ao baixar pnpm do npm |
| Install no GitHub Actions | Passou |
| Typecheck / lint / build | Passaram nos runs listados acima |
| `pnpm dev` | Pendente — não foi possível iniciar neste ambiente |
| `/?debug=1` em navegador real | Pendente |
| Console sem erros | Não confirmado |
| Seletor de cena / slider / FPS interativo | Pendente |
| FPS real, jank, layout shift e memória WebGL | Pendente |

## Próximos passos

1. Aguardar o rebase do Agente 2 e confirmar que a PR #1 fica sem divergência/conflitos.
2. Integrar e registrar as cenas 01–03 conforme o contrato congelado.
3. Confirmar/commitar o `pnpm-lock.yaml` que esteja disponível localmente.
4. Reexecutar install, typecheck, lint e build após integração completa.
5. Rodar `pnpm dev`, abrir `/?debug=1`, exercitar seletor e slider e inspecionar o console do navegador.
6. Atualizar este relatório com os resultados reais e abrir o PR final para `main`, listando explicitamente o que passou e o que ainda estiver pendente.

**Não declarar console limpo, 60 FPS ou runtime validado sem executar os testes correspondentes.**
