---
name: canal-dark-shorts
description: 'Planeja, produz e automatiza canais dark (sem rosto) de YouTube Shorts no estilo Peter Jordan: valida nicho, modela canais que já explodiram, cria identidade, pesquisa temas nos Shorts virais, escreve roteiros com gancho forte, gera narração e prompts de imagem, define título e capa e agenda a postagem. Use sempre que o Pedro falar em canal dark, Shorts, YouTube, canal sem aparecer ou em levar a fábrica de páginas para o YouTube.'
---

# Canal dark de Shorts

Versão para YouTube da `fabrica-de-paginas`. Mesma ideia (nicho, identidade, pauta, vídeo narrado, automação), mas com as regras do YouTube: o algoritmo de Shorts, a monetização pelo YPP e a política de conteúdo inautêntico, que é o que derruba canal dark feito com IA. Montagem e narração reaproveitam os scripts da `radar-da-gringa`. Antes de decidir qualquer coisa de alcance, leia `references/algoritmo-shorts.md`.

## O método em uma frase
Não inventar do zero: achar um canal pequeno que explodiu recentemente com Shorts sem rosto, entender por que o formato funciona (tema, gancho, ritmo, estética, duração) e modelar esse formato com roteiro, voz e identidade próprios, em português, postando todo dia. Esse é o núcleo do que o Peter Jordan ensina sobre canal dark (modelagem, nicho com público grande, consistência e IA na produção). Os detalhes que vierem do material do curso que o Pedro compartilhar têm prioridade sobre esta skill; se ele mandar, atualizar aqui.

Modelar não é copiar: nunca reenviar o vídeo de outro canal, nem traduzir roteiro palavra por palavra sem acrescentar nada. Isso cai em reupload ou conteúdo inautêntico, e o canal perde a monetização ou é removido.

## Parâmetros (perguntar se faltar)
- Nicho e público (idade, país, interesse). Padrão: público brasileiro, em português.
- Ritmo. Padrão: 2 Shorts por dia no começo (12h e 19h, America/Sao_Paulo), subir para 3 quando a produção estiver estável.
- 3 a 5 canais de referência (gringos ou brasileiros) que o Pedro gosta.
- Monetização além do YPP: afiliados no comentário fixado ou na descrição, produto próprio, canal longo depois.

## Regras fixas
- Português do Brasil, sem travessão (em dash).
- Todo vídeo tem roteiro próprio, narração própria e montagem própria. Variar estrutura, imagens e abertura entre vídeos para o canal não parecer produção em massa (ver "Conteúdo inautêntico" na referência).
- Toda informação factual tem fonte checada (WebSearch); rumor marcado como não confirmado. Curiosidade falsa derruba retenção nos comentários e a confiança do canal.
- Marcar "conteúdo alterado ou sintético" no upload quando imagem ou voz de IA mostrar algo realista que não aconteceu (pessoa real dizendo algo, evento falso). Imagem ilustrativa óbvia e narração de IA lendo o roteiro não precisam.
- Sem música com direitos autorais fora da biblioteca do YouTube; trilha da Biblioteca de Áudio ou gerada (`vidiq_generate_music`).
- Nunca publicar o mesmo vídeo ou título duas vezes no canal. Cada canal tem nicho e identidade próprios; não subir o mesmo vídeo em dois canais.
- Publicação automática só depois que o Pedro aprovar o canal, o formato e os 3 primeiros vídeos.

## Modo 1: validar o nicho
1. Achar o que explode agora: `vidiq_outliers` com `contentType: "short"`, `keyword` do nicho e `publishedWithin: "thisMonth"` (5 créditos; Shorts só funciona com títulos em inglês, então é a busca da gringa). Para o Brasil, `vidiq_trending_videos` com `videoFormat: "short"`, `titleQuery` do nicho e `videoTitleLanguage: "pt"` (5 créditos). Guardar o resultado em `pesquisa/AAAA-MM-DD.json` para não pagar de novo.
2. Responder com dados:
   - Tem canal pequeno (menos de 50 mil inscritos) com Shorts de 1 milhão de views nos últimos 30 dias? Isso prova que o formato distribui sem depender de base.
   - Tem assunto novo para 60 vídeos sem repetir? Listar 20 temas na hora; se travar, o nicho é estreito.
   - Dá para produzir sem rosto, sem filmar e sem material com direitos (imagem gerada, banco livre, imagem oficial de divulgação)?
   - A concorrência em português é fraca ou só tem tradução ruim?
   - O público vale dinheiro? Shorts paga pouco por mil views (RPM de centavos a poucos reais), então o nicho ganha pontos se tiver afiliado, produto ou caminho para vídeo longo.
3. Nota de 0 a 10 e recomendação. Nichos que costumam funcionar em dark: curiosidades e "você sabia", história e mistérios, finanças e dinheiro, motivação e estoicismo, ciência e espaço, animais, true crime leve, futebol e games, relatos e histórias narradas. Validar sempre com o passo 1, nunca só pela lista.

## Modo 2: modelar e montar a identidade
1. Escolher 1 ou 2 canais modelo do passo anterior. Para cada um, `vidiq_channel_videos` e `vidiq_video_transcript` dos 5 Shorts que mais explodiram (`vidiq_watch_shortform_content`, 10 créditos, quando precisar ver cena por cena). Anotar numa ficha de formato:
   - duração média, tipo de gancho, quantos cortes por segundo, estilo de imagem, tipo de voz, legenda (cor, posição, palavra a palavra), final (loop, pergunta, cliffhanger), padrão de título.
2. Dar a nossa versão: o que manter (o que prende) e o que mudar (voz, paleta, enquadramento, abertura, tema do Brasil).
3. Identidade:
   - 10 opções de nome e @ (curto, fácil de falar, que diga o nicho). Conferir se o @ está livre.
   - Foto de perfil e banner no Canva (conector) ou `vidiq_generate_thumbnail`; 2 cores e 1 fonte grossa (Anton, Bebas, Montserrat Black).
   - Descrição do canal com a promessa em uma frase e palavras do nicho que as pessoas buscam (`vidiq_keyword_research`).
   - Voz fixa do canal (sempre a mesma) e um bordão curto opcional no fim.
4. Conectar o canal ao vidIQ (`vidiq_connect_youtube_channel`) para métricas e para editar título, descrição e agendamento.

## Modo 3: pauta
- Lista viva em `pauta.json` no branch do canal: tema, ângulo, fonte, referência viral (link), status ("ideia", "roteiro", "pronto", "agendado", "postado").
- Fontes, em ordem: Shorts virais da semana na gringa (outliers), temas que já explodiram no próprio canal (fazer parte 2, variação ou o oposto), busca do YouTube (`vidiq_keyword_research` e `vidiq_youtube_search`), notícia do nicho das últimas 48 h.
- Regra do 80/20: 80% dos vídeos em temas e formatos já provados (no canal modelo ou no nosso), 20% em testes novos.
- Séries ajudam: "Parte 1, 2, 3" e quadros fixos ("Coisas que ninguém te conta sobre...") fazem o espectador ir ao canal ver o resto.

## Modo 4: roteiro
Tamanho: 20 a 45 s (cerca de 300 a 650 caracteres narrados). Shorts aceitam até 3 minutos, mas canal novo distribui melhor curto, porque o que pesa é a porcentagem assistida e quem não desliza. Só alongar quando a retenção do canal mostrar que aguenta.

Estrutura:
1. **Gancho (0 a 2 s):** a primeira frase já é a promessa ou o choque. Sem "olá", sem apresentar o canal, sem contexto antes do gancho. Fórmulas que funcionam:
   - Afirmação que contraria o senso comum: "Os faraós não foram enterrados nas pirâmides."
   - Pergunta com lacuna: "Por que nenhum avião passa por cima do Tibete?"
   - Número e promessa: "3 coisas que o banco não quer que você saiba."
   - Começo no meio da ação: "Ele tinha 4 minutos de oxigênio quando a porta travou."
   - Aviso direto: "Para de jogar fora a água do arroz."
   O texto na tela nos 2 primeiros segundos reforça o gancho em até 6 palavras.
2. **Reforço (2 a 5 s):** uma frase que aumenta a curiosidade sem entregar ("e o motivo é mais estranho do que parece").
3. **Corpo:** frases curtas, uma ideia por frase, uma imagem nova a cada 1,5 a 3 s. Abrir um novo "por quê" no meio para segurar quem ia sair.
4. **Fim:** entregar a resposta no último segundo e fechar em loop (a última frase emenda com a primeira) ou com pergunta que puxa comentário. Nada de "se inscreve" longo; no máximo 1 s.

Entrega do roteiro: `roteiro.txt` (só o que é narrado), mais a tabela de cenas (tempo aproximado, frase, prompt de imagem, texto na tela).

## Modo 5: imagens, narração e montagem
- **Prompts de imagem:** um por cena, em inglês (os geradores entendem melhor), com o mesmo bloco de estilo no fim de todos para o canal ter cara própria. Modelo:
  `[assunto da cena], [ação], [enquadramento: close-up / wide shot / low angle], [luz], vertical 9:16, cinematic, high detail, [estilo fixo do canal: ex. dark moody, teal and orange, film grain]`.
  Evitar texto dentro da imagem, rostos de pessoas reais e marcas. Gerar no Canva (`generate-image`), `vidiq_generate_broll` (vídeo curto) ou no gerador que o Pedro tiver; salvar em `assets/AAAA-MM-DD-tema/`.
- **Narração:** mesma ordem da `radar-da-gringa`: `tts_gemini.py` se existir GEMINI_API_KEY, `tts_google.py` se existir GOOGLE_TTS_API_KEY, senão `vidiq_voiceover_generate` (cerca de 14 créditos por 1.000 caracteres; conferir `vidiq_balance`). Sempre a mesma voz no canal. Nunca pedir chave no chat nem gravar no repositório.
- **Montagem:** `auto_short.py` e `make_short.py` da `radar-da-gringa` (legenda palavra a palavra, cortes rápidos, zoom lento nas fotos) ou `auto_config.py` + `make_reel.py` para o formato com título fixo. Trocar fonte, cores e @ pelos do canal. Conferir 2 ou 3 quadros com ffmpeg antes de subir.
- **Área segura do Shorts:** nada de texto importante acima de y=200, abaixo de y=1500 (título, @ e legenda do Shorts ficam ali) ou à direita de x=900 a partir de y=1000 (botões). Legenda centralizada perto de y=1000. É mais apertada embaixo que a do Reels; ao mudar o layout, conferir com print de um Short publicado.

## Modo 6: título, descrição e capa
- **Título:** até 60 caracteres, a mesma promessa do gancho com outras palavras, palavra-chave que as pessoas buscam no começo. Sem clickbait que o vídeo não entrega (derruba "visto vs deslizado"). Gerar 5 opções com `vidiq_generate_titles` ou na mão e escolher com `vidiq_score_title`.
- **Descrição:** 1 ou 2 linhas com a palavra-chave, fonte do fato, 2 ou 3 hashtags do nicho (`#shorts` é opcional). Link de afiliado vai no comentário fixado.
- **Capa:** no feed de Shorts o que aparece é o primeiro quadro do vídeo, por isso o primeiro quadro precisa ser forte (imagem de impacto e texto do gancho). A capa escolhida conta no perfil do canal, na busca e nas sugestões: escolher o quadro na hora do upload pelo app do YouTube, ou gerar com `vidiq_generate_thumbnail` e trocar com `vidiq_update_video_thumbnail` quando o YouTube aceitar capa personalizada para aquele Short. Padrão de capa do canal: mesma fonte, 3 a 5 palavras, rosto ou objeto grande, contraste alto.

## Modo 7: postagem e automação
Ponto importante: o vidIQ edita, agenda e muda a capa de vídeos que já estão no YouTube, mas não sobe vídeo novo para o YouTube. O upload tem 3 caminhos:
1. **Pedro sobe pelo YouTube Studio** em lote (10 a 20 vídeos de uma vez, como privado). A automação depois coloca título, descrição e horário com `vidiq_update_video` (`privacyStatus: "private"` e `publishAt` em UTC, 5 créditos) seguindo o `pauta.json`. Mais simples e sem risco.
2. **Script `scripts/yt_upload.py`** (YouTube Data API, `videos.insert`), que roda na nuvem porque googleapis é liberado. Precisa de YT_CLIENT_ID, YT_CLIENT_SECRET e YT_REFRESH_TOKEN como variáveis de ambiente do Pedro, de um projeto no Google Cloud com a YouTube Data API ativada. Projeto de API não auditado pelo Google só consegue subir vídeo como privado; para publicar pela API é preciso pedir a auditoria do projeto. Até lá, o script sobe privado e o Pedro (ou o caminho 1) publica. Cada upload gasta 1.600 da cota diária de 10.000 unidades da API, o que dá uns 6 vídeos por dia.
3. **Navegador do Pedro** (Claude in Chrome ou app no PC): subir pelo Studio com a conta logada.

Organização por canal, como no @radar.gta6br: um branch no `opradopedro/claude-skills` com `pauta.json`, `PLAYBOOK.md`, `assets/`, `pipeline/` e os mp4. Uma Routine com os conectores vidIQ e GitHub roda uma vez por dia (por exemplo 9h), produz os vídeos do dia que estiverem em "roteiro", deixa em "pronto" e agenda os que já estão no YouTube. Checagens antes de agendar: título ou tema já postado, dois vídeos no mesmo horário, vídeo sem a marcação de conteúdo sintético quando precisa.

## Modo 8: métricas e ajuste
1. Dados pelo vidIQ: `vidiq_channel_analytics` com `report: "top_videos"`, `"traffic_sources"` e `"audience_retention"` (5 créditos cada), `vidiq_video_stats` por vídeo; ou prints do Pedro do YouTube Studio.
2. O número que mais importa em Shorts é **visto vs. deslizado** (aparece na aba de alcance de cada Short no Studio). Acima de 70% está ótimo, entre 50% e 70% dá para trabalhar, abaixo de 50% o gancho ou o primeiro quadro falharam. Depois vem a porcentagem assistida (acima de 80% em vídeo de 30 s é bom; acima de 100% indica loop), compartilhamentos e inscritos por mil views.
3. Ranquear tema, tipo de gancho, duração e horário. Fazer mais do que deu certo (parte 2, variação) e cortar o que ficou abaixo de 50% de visto em 3 testes seguidos.
4. Avaliar o canal só depois de uns 30 vídeos: os primeiros dias costumam ter distribuição baixa e oscilante. Se depois de 30 a 50 vídeos nenhum passou de 10 mil views, trocar de formato ou de nicho em vez de insistir.

## Custos de referência (vidIQ)
Outliers e trending 5 créditos; ver Short cena por cena 10; narração cerca de 14 por 1.000 caracteres; analytics 5; editar ou agendar vídeo 5; trocar capa 5; montagem local grátis; plano grátis 150 créditos por mês. Com 2 Shorts por dia o plano grátis não fecha o mês: narrar pelo Gemini ou Google Cloud TTS e agendar pelo próprio YouTube Studio quando faltar crédito.
