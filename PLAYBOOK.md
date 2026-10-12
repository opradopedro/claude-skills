# Playbook da publicação automática (@radar.gta6br)

Lido pela tarefa agendada "Radar GTA: publicação diária", que roda 3 vezes por dia (11h50, 17h50 e 20h50, America/Sao_Paulo). Tudo que a tarefa precisa está neste branch.

## Regra de cada execução: publicar UM Reel
1. Ler agenda.json. Pegar o item com a data de hoje cuja `hora` é a mais próxima da hora atual e que ainda não está "postado" (o horário da execução é 10 minutos antes do slot). Se o slot de agora já estiver "postado", não fazer nada.
2. **Sem repetição.** Antes de publicar, puxar os Reels recentes com vidiq_instagram_owner_insights (platformAccountId 39284372604541437). Não publicar se:
   - o mesmo arquivo já estiver "postado" em agenda.json, ou
   - já existir um Reel (de qualquer dia) com a mesma primeira linha de legenda, ou
   - já tiver saído um Reel nos últimos 90 minutos (evita disparo duplicado do mesmo slot).
   Postar 3 vezes no mesmo dia é o esperado; o que nunca pode é o mesmo conteúdo duas vezes.
3. status "pendente": vidiq_video_upload com url `https://raw.githubusercontent.com/opradopedro/claude-skills/radar-gta6-midia/<arquivo>`, depois vidiq_instagram_publish_reel com a legenda do item (Reel normal, sem Trial), acompanhando até PUBLISHED.
4. status "produzir": seguir a skill `pagina-gta6-conteudo` (seção "Produção automática") neste resumo:
   - Tema "Radar da gringa": no máximo UMA vidiq_instagram_tiktok_outlier_search por dia (5 créditos; público EUA, últimos 3 dias, 50 mil views ou mais), salvando os resultados em `pesquisa/AAAA-MM-DD.json` neste branch para os outros slots do dia reaproveitarem. Se já houver o arquivo de hoje, usar ele. Sem crédito para a busca: achar o assunto que está bombando na gringa por WebSearch (Reddit r/GTA6, GTA6 trending, sites gringos de games das últimas 48 h). Escolher o post de GTA 6 com mais views que ainda não foi usado (conferir `fonte_gringa` em agenda.json). Checar o fato na imprensa (WebSearch). Traduzir e adaptar o texto.
   - Tema "Autoral": notícia de GTA 6 das últimas 48 h, no estilo Flow Games.
   - Vazamento: pode comentar o que a imprensa noticiou, sempre como não confirmado, mas nunca usar imagem ou vídeo do vazamento; o b-roll é só material oficial.
   - Sem notícia nova nem post gringo inédito: Reel atemporal ou lembrete (contagem regressiva para 19/11, edições, golpes, curiosidades) que não repita tema já postado.
   - **Formato padrão: "corte"** (estilo corte de podcast do Flow Games/GameplayRJ, sem apresentador): opinião rápida sobre o assunto quente, linguagem falada ("mano", "gente", "pensa comigo"), b-roll em movimento tela cheia com cortes a cada 1,3 a 2,2 s e legenda amarela de 2 a 3 palavras no centro. Palavras sensíveis saem censuradas na legenda (P3L@D0, M0RT3...), o auto_short.py já faz isso. Se o item já tiver `roteiro`, usar ele (conferindo se o fato continua valendo) com `headline`, `fontes` e `tags`.
   - B-roll: o banco de clipes em movimento fica no repositório privado `opradopedro/fabrica-de-paginas`, pasta `radar-gta6/broll/` (`clips/` e `index.json` com tags). Anexar com add_repo (owner opradopedro, repo fabrica-de-paginas, access read), clonar (`git clone --depth 1 https://github.com/opradopedro/fabrica-de-paginas /home/claude/fabrica`, timeout generoso) e passar no spec `"index": "/home/claude/fabrica/radar-gta6/broll/index.json"` e `tags` (o auto_short.py escolhe os clipes). Os mp4 finais continuam neste branch (a URL raw pública é o que o vidIQ usa). Senão, usar as imagens de `assets/` no spec `broll` (ganham zoom lento). Montagem: `pipeline/auto_short.py spec.json` e `pipeline/make_short.py config.json`. O formato antigo (`auto_config.py` + `make_reel.py`) fica para quando o item pedir `"formato": "painel"`.
   - Roteiro de 450 a 650 caracteres. Narração: se a variável GOOGLE_TTS_API_KEY existir, `python3 pipeline/tts_google.py roteiro.txt voz.mp3` (grátis); senão, vidIQ (voz TX3LPaxmHKxFdv7VOQHJ, cerca de 14 créditos). Depois, montagem com `pipeline/auto_config.py` (com `text` e `merge` no spec, sem Whisper) e `pipeline/make_reel.py` (layout já dentro da área segura do Reels), imagens de `assets/`, variando as imagens e o `cx` entre vídeos.
   - Subir o mp4 neste branch, publicar e registrar em agenda.json (`arquivo`, `legenda`, `fonte_gringa` quando houver).
   - **Sem Google TTS e sem crédito no vidIQ (vidiq_balance abaixo de 14):** não publicar e avisar o Pedro uma vez por dia.
5. Sem item para o slot de agora em agenda.json (a agenda acabou): criar o item "produzir" do slot seguindo a mistura do dia (12h radar da gringa, 18h autoral estilo Flow Games, 21h gringa, atemporal ou lembrete), produzir e publicar como no passo 4. A página nunca fica parada por falta de agenda.
6. Depois de publicar: marcar "postado" com o link em agenda.json (commit neste branch) e avisar o Pedro com o link.

## Layout (área segura do Reels)
Nada de texto acima de y=170 (cabeçalho do Instagram), abaixo de y=1690 (nome e legenda) nem à direita de x=930 a partir de y=1090 (ícones). O make_reel.py já respeita isso: todos os textos centralizados em x=540, com largura máxima de 740 px na legenda e fontes menores (título 72, legenda 84 e destaque 100, fontes 28, @ 42).

## Linha editorial
- Notícia de última hora, post gringo traduzido ou conteúdo atemporal. Nada de notícia velha contada como novidade.
- Vazamento só como notícia, marcado como não confirmado; nunca usar imagem do vazamento e nunca dar spoiler de história.
- Toda informação com fonte; português do Brasil, linguagem gamer, sem travessão.
- Lançamento: 19/11/2026 (PS5 e Xbox Series).
