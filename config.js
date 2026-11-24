/* ==========================================================================
   Caca.exe · config.js — TUDO o que você pode editar sem mexer no código
   --------------------------------------------------------------------------
   Como funciona:
   · Mude só o que está entre aspas. Pode apagar e escrever de novo.
   · Emoticons estilo dela:  :3   C:   u.u   — use com moderação :3
   · Se um campo estiver vazio (''), ele simplesmente some da página
     (exemplo: playlistUrl vazio esconde o link da playlist).
   · NÃO mexa nos pedaços com <span class="tok-...">...</span> se você
     não conhecer HTML — eles só pintam o código de cores.
   · Depois de editar, salve o arquivo e atualize a página (F5).
   ========================================================================== */

const CONFIG = {

  /* nome dela (só o apelido — nunca use outro nome dela) */
  apelido: 'Caca',

  /* ---------- janela e barra de status ---------- */
  janela: {
    /* título que aparece na "barra de título" da janela fake */
    sufixo: 'Caca.exe',
    /* nome do repositório na raiz do explorador (em maiúsculas) */
    repo: 'MAINCHAT',
  },
  statusBar: {
    esquerda: 'main*',
    centro: 'Caca.exe · modo carinho',
    /* itens da direita, da esquerda pra direita */
    direita: ['UTF-8', 'LF', 'JavaScript', ':3'],
    /* aparece no lugar do centro quando ela termina os desafios */
    buildPronto: 'Build concluído ✔',
  },

  /* ---------- tela 0 · boas-vindas.js ---------- */
  boasVindas: {
    /* o "código" exibido no editor. cada linha é um array de HTML */
    linhas: [
      '<span class="tok-c">// --------------------------------------------</span>',
      '<span class="tok-c">// oi, Caca! esse código só roda se você</span>',
      '<span class="tok-c">// resolver alguns bugs :3</span>',
      '<span class="tok-c">// --------------------------------------------</span>',
      '<span class="tok-c">// sem cronômetro, sem nota e sem pressão.</span>',
      '<span class="tok-c">// errar aqui é permitido (o compilador entende).</span>',
      '',
      '<span class="tok-k">import</span> { coragem } <span class="tok-k">from</span> <span class="tok-s">\'./coracao\'</span>',
      '<span class="tok-k">import</span> { caca } <span class="tok-k">from</span> <span class="tok-s">\'./pessoa-mais-legal\'</span>',
      '',
      '<span class="tok-v">caca</span>.<span class="tok-f">executar</span>()',
    ],
    botaoExecutar: 'Executar',
    comando: 'node boas-vindas.js',
    /* linhas impressas no terminal, uma por uma, depois do ▶ Executar */
    saida: [
      'carregando desafios... ok',
      'carregando caretas... ok (5 encontradas)',
      'oi, Caca! :3',
    ],
    /* o que aparece no terminal se ela clicar Executar de novo */
    jaExecutado: 'já tá rodando, uai. vai pros desafios :3',
  },

  /* ---------- barra lateral (explorador) ---------- */
  explorador: {
    titulo: 'Explorador',
    rodape: 'somente leitura :3',
    /* decorativo — não precisa mexer */
    arquivosAssets: ['certificado-caca.pdf', 'fotos/'],
  },

  /* ---------- mensagens de erro (foto + dica) ---------- */
  erros: {
    /* fotos de careta sorteadas sem repetir a anterior */
    fotos: [
      { src: 'assets/fotos/careta-1.jpg', alt: 'foto 1', legenda: 'errar faz parte, tenta de novo :3' },
      { src: 'assets/fotos/careta-2.jpg', alt: 'foto 2', legenda: 'bugiou? respira e vai de novo' },
      { src: 'assets/fotos/careta-3.jpg', alt: 'foto 3', legenda: 'quase! mais uma tentativa C:' },
      { src: 'assets/fotos/careta-4.jpg', alt: 'foto 4', legenda: 'cara de quem vai acertar na próxima' },
      { src: 'assets/fotos/careta-5.jpg', alt: 'foto 5', legenda: 'o bug se assustou com esse sorriso' },
    ],
    /* frases que aparecem no terminal a cada erro (sorteadas) */
    frasesTerminal: [
      'bug encontrado... mas não foi dessa vez :3',
      'o compilador discorda, mas acredita em você',
      'quase lá! espia a dica com carinho',
    ],
    botaoFechar: 'Tentar de novo C:',
    /* a partir da 2ª tentativa errada, a resposta certa começa a brilhar */
    brilhoNaResposta: 'ó, a resposta certa tá brilhando. vai sem culpa!',
    /* na 3ª tentativa errada, o depurador resolve sozinho e segue o jogo */
    depuradorAjuda: 'o depurador colou pra você :3 (acontece nas melhores famílias)',
  },

  /* ---------- desafios ---------- */
  /* não mude "id" nem a ordem — o resto é todo seu.                */
  desafios: [
    {
      id: 'd1',
      rotulo: 'bug #1 · variáveis',
      dica1: 'texto precisa de aspas :3',
      sucesso: 'desafio 1 concluído — variáveis dominadas',
      codigo: [
        '<span class="tok-c">// bug #1: a variável tá vazia</span>',
        '<span class="tok-k">let</span> <span class="tok-v">nome</span> <span class="tok-p">=</span> <span class="blank" data-blank="d1">______</span><span class="tok-p">;</span>',
      ],
      pergunta: 'qual valor fecha a variável?',
      opcoes: [
        '<span class="tok-s">"Caca"</span>',
        '<span class="tok-v">Caca</span>',
        '<span class="tok-n">42</span>',
      ],
      correta: 0,
    },
    {
      id: 'd2',
      rotulo: 'bug #2 · condicional',
      dica1: '== compara os dois lados; um = sozinho só guarda o valor',
      sucesso: 'desafio 2 concluído — jantar desbloqueado',
      codigo: [
        '<span class="tok-c">// bug #2: isso decide o jantar</span>',
        '<span class="tok-k">let</span> <span class="tok-v">fome</span> <span class="tok-p">=</span> <span class="tok-n">true</span>',
        '',
        '<span class="tok-k">if</span> (<span class="blank" data-blank="d2">______</span>) {',
        '  <span class="tok-v">console</span>.<span class="tok-f">log</span>(<span class="tok-s">"arroz, feijão, repolho e linguiça"</span>)',
        '}',
      ],
      pergunta: 'qual condição tá certa?',
      opcoes: [
        '<span class="tok-v">fome</span> <span class="tok-p">==</span> <span class="tok-n">true</span>',
        '<span class="tok-v">fome</span> <span class="tok-p">=</span> <span class="tok-n">true</span>',
        '<span class="tok-v">fome</span>',
      ],
      correta: 0,
    },
    {
      id: 'd3',
      rotulo: 'bug #3 · lista',
      dica1: 'se não é anime, praia nem música, não passa no teste C:',
      sucesso: 'desafio 3 concluído — lista limpa',
      codigo: [
        '<span class="tok-c">// bug #3: um impostor se infiltrou na lista</span>',
        '<span class="tok-k">const</span> <span class="tok-v">gostos</span> <span class="tok-p">=</span> [',
        '  <span class="tok-s">"Death Note"</span>,',
        '  <span class="tok-s">"praia"</span>,',
        '  <span class="tok-s">"playlist"</span>,',
        '  <span class="tok-s">"segunda-feira"</span>,',
        ']',
        '',
        '<span class="tok-k">for</span> (<span class="tok-k">const</span> <span class="tok-v">item</span> <span class="tok-k">of</span> <span class="tok-v">gostos</span>) {',
        '  <span class="tok-v">console</span>.<span class="tok-f">log</span>(<span class="tok-v">item</span>)',
        '}',
      ],
      pergunta: 'toque no item que não pertence à lista:',
      opcoes: ['Death Note', 'praia', 'playlist', 'segunda-feira'],
      correta: 3,
    },
    {
      id: 'd4',
      rotulo: 'bug #4 · o clássico',
      dica1: 'um = sozinho atribui; pra comparar são dois ==',
      sucesso: 'desafio 4 concluído — bug desmascarado',
      codigo: [
        '<span class="tok-c">// bug #4: ache a linha com defeito</span>',
        '<span class="bug-line" data-line="0" role="button" tabindex="0"><span class="ln">1</span> <span class="tok-k">let</span> <span class="tok-v">fomeDeDesign</span> <span class="tok-p">=</span> <span class="tok-n">true</span></span>',
        '<span class="bug-line" data-line="1" role="button" tabindex="0"><span class="ln">2</span> <span class="tok-k">if</span> (<span class="tok-v">fomeDeDesign</span> <span class="tok-p">=</span> <span class="tok-n">true</span>) {</span>',
        '<span class="bug-line" data-line="2" role="button" tabindex="0"><span class="ln">3</span>   <span class="tok-v">console</span>.<span class="tok-f">log</span>(<span class="tok-s">"arroz, feijão, repolho e linguiça"</span>)</span>',
        '<span class="bug-line" data-line="3" role="button" tabindex="0"><span class="ln">4</span> }</span>',
      ],
      pergunta: 'toque na linha com o bug:',
      opcoes: [],
      correta: 1,
    },
  ],

  /* ---------- terminal ---------- */
  terminal: {
    comandoBuild: 'node desafios.js',
    buildConcluido: 'Build concluído ✔',
    linhaExtra: '0 erros encontrados. 1 coração encontrado.',
    progresso: 'bugs corrigidos',
  },

  /* ---------- tela final (final.js) ---------- */
  final: {
    codigoLiberado: [
      '<span class="tok-c">// você chegou até aqui, Caca.</span>',
      '<span class="tok-c">// o certificado tá em PDF,</span>',
      '<span class="tok-c">// porque conquista se guarda :3</span>',
    ],
    codigoTrancado: [
      '<span class="tok-c">// calma, jovem: esse arquivo ainda tá trancado</span>',
      '<span class="tok-c">// termine os 4 bugs e o final.js se abre</span>',
    ],
    tituloTrancado: 'final.js tá trancado :3',
    textoTrancado: 'volte aqui quando corrigir os 4 bugs.',
    tituloLiberado: 'PRONTO. VOCÊ ZEROU. :3',
    textoLiberado: 'o seu certificado ficou assim ó:',
    previewAlt: 'prévia do certificado de aprovação',
    botaoDownload: 'Baixar certificado (PDF)',
    /* mantenha esta frase — ela é a garantia de que você não cobra resposta */
    validade: 'Validade indefinida · só vale mediante o seu aceite · sem pressa nenhuma C:',
    assinatura: '— Deivid',
    /* cole aqui o link da playlist do YouTube quando ela estiver pronta.
       deixe vazio ('') que o botão some da página. */
    playlistUrl: 'https://www.youtube.com/watch?v=UrIiLvg58SY&list=PLpOehZ0r85ixl-tdCfLqH7JmZe7BwxM2L',
    playlistTexto: 'a playlist que eu te prometi :3',
    playlistRotulo: 'ouvir a playlist',
  },

  /* ---------- certificado (PDF) ---------- */
  certificado: {
    pdf: 'assets/certificado-caca.pdf',
    preview: 'assets/certificado-caca-preview.jpg',
    nomeDownload: 'certificado-caca.pdf',
  },
};

window.CONFIG = CONFIG;
