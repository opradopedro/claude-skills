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
   - Tema "Radar da gringa": vidiq_instagram_tiktok_outlier_search (público EUA, últimos 3 dias, 50 mil views ou mais). Escolher o post de GTA 6 com mais views que ainda não foi usado (conferir `fonte_gringa` em agenda.json). Checar o fato na imprensa (WebSearch). Traduzir e adaptar o texto.
   - Tema "Autoral": notícia de GTA 6 das últimas 48 h, no estilo Flow Games.
   - Sem notícia nova nem post gringo inédito: Reel atemporal ou lembrete (contagem regressiva para 19/11, edições, golpes, curiosidades) que não repita tema já postado.
   - Roteiro de 550 a 650 caracteres, narração no vidIQ (voz TX3LPaxmHKxFdv7VOQHJ, cerca de 14 créditos), montagem com `pipeline/auto_config.py` (com `text` e `merge` no spec, sem Whisper) e `pipeline/make_reel.py` (layout já dentro da área segura do Reels), imagens de `assets/`, variando as imagens e o `cx` entre vídeos.
   - Subir o mp4 neste branch, publicar e registrar em agenda.json (`arquivo`, `legenda`, `fonte_gringa` quando houver).
   - **Sem crédito para narração (vidiq_balance abaixo de 14):** não publicar e avisar o Pedro uma vez por dia.
5. Sem item para o slot de agora: não publicar nada.
6. Depois de publicar: marcar "postado" com o link em agenda.json (commit neste branch) e avisar o Pedro com o link.

## Layout (área segura do Reels)
Nada de texto acima de y=170 (cabeçalho do Instagram), abaixo de y=1690 (nome e legenda) nem à direita de x=930 a partir de y=1090 (ícones). O make_reel.py já respeita isso.

## Linha editorial
- Notícia de última hora, post gringo traduzido ou conteúdo atemporal. Nada de notícia velha contada como novidade.
- Vazamento só como notícia, marcado como não confirmado; nunca usar imagem do vazamento e nunca dar spoiler de história.
- Toda informação com fonte; português do Brasil, linguagem gamer, sem travessão.
- Lançamento: 19/11/2026 (PS5 e Xbox Series).
