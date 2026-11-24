# Caca.exe 💻

Página surpresa para a Caca: um editor de código (tema escuro do VS Code) com 4 bugs para corrigir no toque. Ao zerar, ela desbloqueia o **certificado em PDF** — o único convite romântico da página. Sem cronômetro, sem nota, sem pressão.

**Sem build. Sem framework. Sem dependência.** É HTML + CSS + JS puro.

## Publicar de graça na Vercel (recomendado)

1. Faça o merge deste PR na `main`.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório `mainchat` do GitHub.
3. **Framework Preset**: `Other` — **Build Command**: vazio · **Output Directory**: vazio (raiz) · **Install Command**: vazio. Não precisa de variável de ambiente.
4. Clique **Deploy**. Em ~1 minuto sai a URL `https://SEU-PROJETO.vercel.app`.
5. Sugestão: no campo de nome do projeto, use algo impossível de adivinhar (ex.: `cert-caca-x7k2`) — o nome do projeto vira o subdomínio.

> Alternativa: GitHub Pages (Settings → Pages → Deploy from a branch → `main`, pasta `/ (root)`).

> 🔒 **Privacidade:** a página já tem `noindex,nofollow`, sem analytics e sem formulários.
> Mesmo assim um link público é público — use um nome de projeto difícil de adivinhar
> e mande o link só para ela. 😉

Testar no seu PC antes:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Editar textos, fotos e links (só o `config.js`)

Abra `config.js`, mude o que está entre aspas e salve. Não precisa mexer em mais nada:

| O quê | Onde no config.js |
|---|---|
| Apelido | `apelido` |
| Comentário da boas-vindas, texto do botão Executar | `boasVindas` |
| Fotos de careta dos erros + legendas | `erros.fotos` (arquivos em `assets/fotos/`) |
| Dicas e mensagens de sucesso de cada bug | `desafios[i].dica1` / `.sucesso` |
| Texto do terminal no fim do build | `terminal.buildConcluido` / `.linhaExtra` |
| Tela final (título, botão, validade, assinatura) | `final` |
| Link da playlist do YouTube | `final.playlistUrl` — cole o link entre aspas. **Vazio = o botão some da página** |

Regras das fotos: só as que ela curte ver (são as selfies dela que você escolheu), até 8,
redimensionadas para ~1200px e comprimidas para carregar rápido no 4G/5G.
Alt sempre neutro (`foto 1`, `foto 2`…). **Nada de dados pessoais na página.**

## Certificado (PDF)

O arquivo pronto está em `assets/certificado-caca.pdf` (emitido em **24 de novembro de 2026**).
É download direto no botão final — a página **não** tem formulário interativo de aceite,
como você pediu ("só o PDF"). O texto do certificado é o mesmo que está no código, pixel a pixel.

Quer regerar (mudou textos/cores/data)?

```bash
python3 -m venv .venv
.venv/bin/pip install reportlab pymupdf
.venv/bin/python tools/generate-cert.py
```

As fontes (Cormorant Garamond, Allura, JetBrains Mono — todas da Open Font License, via pacotes
`@fontsource/*`) ficam em `tools/fonts/` para regerar offline.

## Estrutura

```
index.html        página inteira (markup + CSS + JS vanilla)
config.js         TODOS os textos, fotos e links editáveis
assets/
  certificado-caca.pdf          o certificado (gerado)
  certificado-caca-preview.jpg  prévia mostrada na tela final
  fotos/careta-1..5.jpg         careta nos erros (1200px, ~80KB cada)
tools/
  generate-cert.py              regera o PDF
  fonts/                        TTFs para regerar offline
```

## Comportamento garantido

- ✅ Mobile-first 360px, alvos de toque ≥ 44px, sem rolagem horizontal, `dvh`, também funciona no desktop
- ✅ Sem cronômetro, sem nota, sem "game over": 1º erro = foto + dica carinhosa, 2º = resposta brilha, 3º = o depurador resolve sozinho e o jogo segue
- ✅ Cada acerto imprime `✔ desafio N concluído` verde no terminal; no fim, `Build concluído ✔`
- ✅ Nenhuma foto repete a mesma duas vezes seguidas; nenhuma legenda zomba dela
- ✅ `prefers-reduced-motion` respeitado; alt neutro; contraste legível; dicas em ≥ 16px
- ✅ `<meta name="robots" content="noindex,nofollow">`, zero rastreador, zero analytics
- ✅ Tudo funciona offline depois que carrega; a página inteira tem **< 1 MB**
- ✅ Progresso salvo no `localStorage` do aparelho dela (se ela sair e voltar, continua de onde parou)

Feito com carinho e um bug ou dois. :3
