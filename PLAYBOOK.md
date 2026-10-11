# Playbook da publicação diária (@radar.gta6br)

Lido pela tarefa agendada "Radar GTA: publicação diária". Tudo que a tarefa precisa está neste branch.

## Regra de cada dia
1. Ler agenda.json e achar o item com a data de hoje (fuso America/Sao_Paulo).
2. Antes de publicar, conferir com vidiq_instagram_owner_insights (platformAccountId 39284372604541437) se já existe Reel de hoje com a mesma legenda. Se existir, não publicar de novo.
3. status "pendente": vidiq_video_upload com url https://raw.githubusercontent.com/opradopedro/claude-skills/radar-gta6-midia/<arquivo>, depois vidiq_instagram_publish_reel com a legenda do item, acompanhando até PUBLISHED.
4. status "produzir": conferir saldo (vidiq_balance; narração custa cerca de 14 créditos). Pesquisar as notícias, escrever roteiro de 35 a 45 s seguindo a linha editorial abaixo, gerar narração no vidIQ (voz TX3LPaxmHKxFdv7VOQHJ), montar com pipeline/auto_config.py + pipeline/make_reel.py (assets/ tem imagens oficiais, logo e fonte; precisa de pip install faster-whisper pillow e ffmpeg), subir o mp4 neste branch, publicar e atualizar agenda.json. Se faltar crédito, não publicar e avisar o Pedro.
5. Sem item para hoje: não publicar nada.
6. Depois de publicar: marcar o item como "postado" com o link em agenda.json (commit neste branch) e avisar o Pedro com o link.

## Linha editorial
- Só notícia de última hora ou conteúdo atemporal (guias, comparações, riscos, curiosidades). Nada de notícia velha contada como novidade.
- Vazamento só como notícia, marcado como não confirmado; nunca usar imagem do vazamento e nunca dar spoiler de história.
- Toda informação com fonte; português do Brasil, linguagem gamer, sem travessão.
- Lançamento: 19/11/2026 (PS5 e Xbox Series).
