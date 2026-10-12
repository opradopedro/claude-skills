---
name: radar-da-gringa
description: 'Automação de Reels que traduz e refaz em português os posts que mais bombaram em páginas gringas de um nicho (começou com GTA 6 no @radar.gta6br) e publica sozinha até 3 vezes por dia sem repetir conteúdo. Use sempre que o Pedro pedir conteúdo "da gringa", "traduzir post viral", "copiar o que bombou lá fora", automatizar a página, publicar 3 vídeos por dia, ou quando uma tarefa agendada de publicação mandar produzir um Reel.'
---

# Radar da gringa: post gringo viral, refeito em português, publicado no automático

O Pedro quer conteúdo de última hora que prenda a atenção. A estratégia: se um post explodiu nas páginas hypadas dos EUA, a chance de dar certo aqui é alta. Ele aceita pegar o conteúdo de lá e traduzir, mesmo que o Instagram reduza um pouco o alcance por ser ideia de terceiros. O nosso trabalho é escolher bem, traduzir com cara de Brasil, refazer com a nossa identidade visual e publicar sem repetir nada.

Para a página de GTA 6, leia também a skill `pagina-gta6-conteudo` (linha editorial, voz, legendas). Para outros nichos, a `fabrica-de-paginas`.

## Onde fica cada coisa (página de GTA 6)
- Repositório `opradopedro/claude-skills`, branch `radar-gta6-midia`: `agenda.json` (fila de posts com data, hora, status, legenda, link e `fonte_gringa`), `PLAYBOOK.md` (regras da tarefa agendada), `assets/` (imagens oficiais em 3840 px, logo, fonte Anton), `pipeline/` (scripts de montagem) e os mp4. A URL raw de cada mp4 é o que o vidIQ usa para publicar.
- Tarefa agendada "Radar GTA: publicação diária": roda às 11h50, 17h50 e 20h50 (America/Sao_Paulo), uma publicação por execução.
- Conta: platformAccountId 39284372604541437 no conector vidIQ.

## Fluxo de cada Reel
### 1. Achar o post gringo
Escolha a rota pelo que a sessão tem:
- **Com navegador (Claude no PC, navegador do app ou Claude in Chrome, logado no Instagram da página):** abrir instagram.com, ver os perfis gringos de referência e as buscas #gta6, e escolher o post com mais engajamento (views, curtidas, comentários) dos últimos 1 a 3 dias. Copiar o link. Assistir no próprio navegador e tirar prints dos quadros que importam. Só usar site de download de vídeo do Instagram se não der para ver o post e extrair as imagens de outro jeito.
- **Sem navegador (sessão na nuvem, tarefa agendada):** o Instagram e o TikTok ficam bloqueados para download. Usar `vidiq_instagram_tiktok_outlier_search` (5 créditos) com público "Culture/Region: United States/American; Global: false; Demographics: gamers 16-30, fans of the niche;", posts dos últimos 3 dias, 50 mil views ou mais, 10 resultados por plataforma. Ele devolve legenda, gancho, formato e views. As imagens saem do nosso banco de imagens oficiais (`assets/`). Fazer no máximo uma busca dessas por dia e salvar o resultado (`pesquisa/AAAA-MM-DD.json` no branch) para os outros slots; sem crédito, achar o assunto do momento por WebSearch (Reddit r/GTA6, sites gringos de games das últimas 48 h). `vidiq_watch_shortform_content` (10 créditos) descreve o vídeo cena por cena quando o texto do post não basta.

### 2. Filtrar
- Só entra post do nicho com o fato checado na imprensa (WebSearch). Se a gringa espalhou algo falso ou já desmentido, o post vira "é mentira", que prende ainda mais.
- **Sem repetição:** comparar com `agenda.json` (`fonte_gringa`, temas e primeiras linhas de legenda já postados) e com os Reels recentes (`vidiq_instagram_owner_insights`). Mesmo assunto só volta se tiver fato novo.
- Nunca usar imagem ou trecho de vazamento, nem spoiler de história.

### 3. Traduzir e refazer
- Traduzir o texto e adaptar o gancho para o português do Brasil, linguagem gamer, sem travessão. Pode mudar uma coisa ou outra (gancho, pergunta final, piada brasileira).
- Roteiro de 550 a 650 caracteres (35 a 40 s), gancho nos 2 primeiros segundos, pergunta no fim para puxar comentário.
- Imagens: as do post gringo (prints) quando vieram pelo navegador; senão, as oficiais de `assets/`. Variar as imagens e o enquadramento (`cx`) entre um vídeo e outro para a página não parecer repetida.
- Narração: se a variável de ambiente GEMINI_API_KEY existir, `python3 tts_gemini.py roteiro.txt voz.mp3` (Google AI Studio, cota grátis sem cartão, tom de youtuber gamer). Se existir GOOGLE_TTS_API_KEY, `python3 tts_google.py roteiro.txt voz.mp3` (Google Cloud TTS, voz pt-BR, grátis até a cota mensal). Sem a chave, vidIQ com a voz Liam (TX3LPaxmHKxFdv7VOQHJ), cerca de 14 créditos; conferir `vidiq_balance` antes. Nunca pedir a chave no chat nem gravar no repositório.
- Montagem com os scripts da pasta `pipeline/` do branch `radar-gta6-midia` (as mesmas cópias ficam em `skills/radar-da-gringa/scripts/` no branch main):
  1. `spec.json` com `audio`, `out`, `headline`, `source`, `images` ([arquivo, cx]), `text` (o roteiro exato narrado) e `merge` (trecho falado por extenso para o que aparece na tela, por exemplo `{"quatorze ponto dez": "14.10"}`).
  2. `python3 auto_config.py spec.json` gera o `config.json`. O `align2.py` cronometra a legenda pelas pausas reais da fala, sem Whisper (que fica bloqueado na nuvem).
  3. `python3 make_reel.py config.json` monta o 1080x1920. Rode uma montagem por vez por pasta e espere o processo terminar antes de copiar o arquivo.
  4. Conferir 2 ou 3 quadros (ffmpeg) antes de publicar.
- Formato "corte" (o padrão desde 12/10/2026, veja `pagina-gta6-conteudo`): `auto_short.py spec.json` (com `text`, `merge`, `broll` ou `tags`, `headline`) e `make_short.py config.json`. O banco de b-roll em movimento sai do `montar_broll.py`, que roda no PC do Pedro (a nuvem não alcança o YouTube) e baixa só vídeos oficiais da Rockstar.

### 4. Área segura do Reels (o layout já respeita)
Nada de texto acima de y=170 (cabeçalho do Instagram), abaixo de y=1690 (nome e legenda do post) ou à direita de x=930 a partir de y=1090 (ícones de curtir, comentar, compartilhar). Todos os textos ficam centralizados na tela (x=540), com a legenda queimada em no máximo 740 px de largura e fontes menores (título 72, legenda 84 e destaque 100, fontes 28, @ 42) para não brigar com o texto do Instagram. Ao mudar o layout, conferir com um print de Reel publicado.

### 5. Publicar
- `vidiq_video_upload` com a URL raw do mp4 no branch, depois `vidiq_instagram_publish_reel` (Reel normal) até PUBLISHED.
- Até 3 Reels por dia, um por slot (12h, 18h, 21h). Antes de publicar, conferir que o slot ainda não foi usado, que nenhum Reel saiu nos últimos 90 minutos e que o mesmo arquivo ou legenda nunca foi publicado.
- Atualizar `agenda.json` (status "postado", link, `fonte_gringa`) com commit no branch e avisar o Pedro com o link.

## Quando não houver post gringo inédito
Em ordem: notícia de última hora autoral no estilo Flow Games (fatos das últimas 48 h); conteúdo atemporal que ainda não saiu (guia, comparação, golpe, curiosidade); lembrete que viraliza (contagem regressiva para o lançamento, "salva pra não esquecer"). Nunca repetir um vídeo já postado. Se a agenda acabar, a tarefa cria sozinha os itens do dia seguindo a mistura abaixo.

## Mistura do dia (3 slots)
- 12h: radar da gringa (post viral traduzido).
- 18h: autoral, notícia de última hora no estilo Flow Games.
- 21h: radar da gringa, atemporal ou lembrete.

## Limites que importam
- vidIQ grátis: 150 créditos por mês, renova no dia 10. Narração gasta 14, pesquisa 5. Três Reels narrados por dia pedem uns 1.300 créditos por mês: sem plano pago ou outra voz (Google Cloud TTS com chave de API, que a nuvem alcança), a automação publica só o que já está pronto e avisa o Pedro quando faltar crédito.
- Na nuvem ficam bloqueados: Instagram, TikTok, YouTube, rockstargames.com, HuggingFace e a voz grátis da Microsoft. Funcionam: raw.githubusercontent.com, S3 do vidIQ e googleapis.
