# Playbook do @radar.gta6br (versão PC, 12/10)

Lido pela tarefa agendada "Radar GTA: publicação diária (PC)", que roda no PC de casa do Pedro às 11h50, 17h50 e 20h50. Este arquivo substitui as regras antigas: se algo aqui contradizer `aprendizado.md`, a skill ou um chat antigo, vale este arquivo.

## Pastas no PC
- Repositório (branch `radar-gta6-midia` de opradopedro/claude-skills): `C:\Users\pedro\radar_gta6`
- Banco de b-roll completo (476 clipes): `C:\Users\pedro\radar_broll\fabrica-de-paginas\radar-gta6\broll` (`index.json`, `tags.json`, `clips/`)
- ffmpeg/ffprobe: instalados pelo winget. Se não estiverem no PATH, recarregar o PATH de usuário e de máquina.

## Regras do Pedro (valem acima de tudo)
1. **Postar direto, sem pedir aprovação.** Se ele não gostar, ele reclama depois.
2. **Nunca repetir conteúdo** (mesmo arquivo, mesma primeira linha de legenda) e nunca dois Reels com menos de 90 min de diferença.
3. **Voz:** a do vidIQ é a aprovada (voz `TX3LPaxmHKxFdv7VOQHJ`). O Gemini (`pipeline/tts_gemini.py`) só se existir `GEMINI_API_KEY`. **Piper proibido** (robótico). Sem voz disponível: não produzir vídeo novo, só publicar o que já estiver `pendente`.
4. **Formato único:** tela cheia 9:16, legenda amarela de 2 a 3 palavras, @radar.gta6br. Visual de b-roll **em movimento**, como o vídeo do Jason aprovado (`aprovados/jason_extended_look_APROVADO.mp4`): abre com um clipe forte e segue com cortes de 1,3 a 2,2 s.
   - Use clipes do Extended Look (`tJbzMqJGH4k_*`), Trailer 1 (`QdBZY2fkU-0_*`) e teasers. **Não use clipes do Trailer 2 (`VQRLujxTm3c_*`)**: eles têm faixas pretas de cinema que aparecem no Reel.
   - Fotos de `assets/` só como complemento; quando aparecerem, deslizam devagar e entram empurrando a anterior (nada de uma imagem se transformando na outra). Nunca `cover.jpg`.
   - Formatos proibidos: o "demo" faixa/tela cheia alternando (`demo_short/demo_estilo_corte.mp4`) e o "painel".
5. Vazamento só como notícia não confirmada, sem imagem do vazamento. Toda informação com fonte. Português do Brasil, linguagem gamer, sem travessão. Lançamento: 19/11/2026 (PS5 e Xbox Series).

## Cada execução publica UM Reel
1. `git pull` no repositório. Ler `agenda.json`. Slot de agora = 12:00, 18:00 ou 21:00 (o mais próximo da hora atual). Se o slot de hoje já estiver `postado`, parar.
2. Puxar os Reels recentes com `vidiq_instagram_owner_insights` (platformAccountId `39284372604541437`), salvar a resposta em `%TEMP%\insights.json` e rodar `python pipeline/aprendizado.py coletar <arquivo>`. Conferir a regra 2 (sem repetição, 90 min).
3. Item `pendente` com `arquivo`: publicar esse arquivo.
4. Item `produzir` ou slot sem item: produzir um Reel novo:
   - Assunto: notícia de GTA 6 das últimas 48 h (WebSearch, com fonte) ou post gringo viral traduzido (só o assunto, nunca o vídeo de outra página). Sem novidade: atemporal ou lembrete (contagem para 19/11, edições, golpes, curiosidades) que não repita tema já postado. `python pipeline/aprendizado.py sugerir AAAA-MM-DD HH:MM` ajuda a escolher tema e gancho.
   - Roteiro de 450 a 650 caracteres, falado ("mano", "pensa comigo"), fechando com uma pergunta.
   - Voz (regra 3): `vidiq_balance`; se tiver 14 créditos ou mais, `vidiq_voiceover_generate` (voz acima), `vidiq_job_poll` até concluir e baixar o MP3 para `voz.mp3`. Senão, Gemini se houver chave. Senão, parar e só registrar.
   - Montagem numa pasta nova `producao/AAAA-MM-DD_HHMM/`: `spec.json` com `audio`, `out`, `text`, `index` (caminho absoluto do `index.json` do banco), `tags`, `seed` e `font` (`../../assets/fonts/Anton.ttf`); rodar `python ../../pipeline/auto_short.py spec.json` e `python ../../pipeline/make_short.py config.json` de dentro da pasta. Se o `auto_short.py` escolher clipe do Trailer 2, troque por `broll` explícito.
   - **Checagem obrigatória:** extrair um frame do meio de cada cena e conferir que não há faixa preta, tela preta, cartela ou logo. Se houver, trocar o clipe e montar de novo.
5. Publicar: copiar o mp4 para a raiz do repositório, commit e push no branch; `vidiq_video_upload` com a URL `https://raw.githubusercontent.com/opradopedro/claude-skills/radar-gta6-midia/<arquivo>`; `vidiq_instagram_publish_reel` (Reel normal, sem Trial) com a legenda, repetindo com o `containerId` até PUBLISHED.
6. Registrar em `agenda.json`: `status: "postado"`, `link`, `legenda`, `ficha` (`formato: "corte"`, `tema`, `gancho`, `origem`). Commit e push de `agenda.json`, `metricas.json` e `aprendizado.md`.
7. Terminar com um resumo curto: o que foi publicado (link) ou por que nada saiu.

## Área segura do Reels
Nada de texto acima de y=170, abaixo de y=1690 nem à direita de x=930 a partir de y=1090. O `make_short.py` já respeita isso.
