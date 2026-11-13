# Relatório de validação da fundação

**Estado: BLOQUEADO / INCOMPLETO — não liberar integração paralela.**

| Verificação | Estado | Evidência |
|---|---|---|
| `pnpm install` | Não executado neste ambiente | Ambiente de execução sem pnpm e sem resolução DNS para github.com ao tentar clonar |
| `pnpm typecheck` | Pendente | Nenhuma execução de CI observada |
| `pnpm lint` | Configurado, não executado | Script e configuração ESLint adicionados |
| `pnpm build` | Pendente | Nenhuma execução de CI observada |
| Dev server / console browser | Pendente | Não foi possível iniciar o app nem abrir Chrome neste ambiente |
| FPS real / 60 FPS | Pendente | O painel mostra FPS estimado pelo delta do GSAP ticker, mas nenhum número de execução foi coletado |
| Jank / layout shift | Pendente | Sem gravação Performance/trace |
| Memory leak / dispose | Pendente | R3F controla o ciclo de vida dos objetos reconciliados; ainda falta teste repetido de montagem/desmontagem e revisão de recursos externos/customizados |
| Lenis + ScrollTrigger / RAF | Implementado, não validado em runtime | Lenis é avançado pelo GSAP ticker; ScrollTrigger recebe atualização pelo evento de scroll do Lenis |
| Janela de montagem ±1 cena | Implementação inicial | App mantém montadas apenas cena ativa e vizinhas imediatas; vizinhas ficam invisíveis no grupo R3F |
| Transições configuráveis | Parcial | Mapa por par e camada visual configurável existem; ainda não é crossfade real entre duas renderizações nem dissolve por composição de buffers |
| Painel `?debug=1` | Implementação inicial | Seletor, slider, qualidade e FPS pelo ticker adicionados |
| Contrato | Documentado como proposta | Não congelar até todos os gates passarem |

## Limitação de execução desta rodada

O ambiente de execução não contém pnpm e a tentativa de clonar o repositório falhou por indisponibilidade de DNS/rede. O GitHub connector permite inspecionar e editar arquivos, mas não executa comandos shell nem abre o Chrome local do usuário. A consulta ao GitHub Actions não retornou workflow runs para o commit mais recente. Portanto, nenhum comando é apresentado como se tivesse passado.

Foi adicionado `.github/workflows/quality.yml` para executar instalação, typecheck, lint e build no GitHub Actions. A branch ainda não tem um resultado de execução verificável. Também não há `pnpm-lock.yaml` versionado; a instalação ainda não é reprodutível por lockfile.

## Critério para liberar os agentes

1. Obter workflow verde para install/typecheck/lint/build e commitar `pnpm-lock.yaml`.
2. Executar dev server e validar console sem erros ou warnings.
3. Medir FPS, jank e layout shift em navegador real, identificando hardware e navegador.
4. Repetir montagem/desmontagem e inspecionar memória/recursos WebGL.
5. Completar transições com o efeito visual acordado e testar o painel debug.
6. Atualizar este relatório com evidências e então marcar o contrato como congelado.

**Até cumprir esses itens, os agentes devem aguardar ou trabalhar somente em protótipos isolados, sem integrar suas cenas na branch compartilhada.**
