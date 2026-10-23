# Playbook do @radar.gta6br (12/10)

Lido pela tarefa agendada "Radar GTA: 3 Reels por dia", que roda na nuvem, na conversa principal do projeto, às 11h50, 17h50 e 20h50 (escolha do Pedro em 12/10; a tarefa do PC foi apagada). Este arquivo substitui as regras antigas: se algo aqui contradizer `aprendizado.md`, a skill ou um chat antigo, vale este arquivo.

## Pastas no PC
- Repositório (branch `radar-gta6-midia` de opradopedro/claude-skills): `C:\Users\pedro\radar_gta6`
- Banco de b-roll completo (476 clipes): `C:\Users\pedro\radar_broll\fabrica-de-paginas\radar-gta6\broll` (`index.json`, `tags.json`, `clips/`)
- ffmpeg/ffprobe: instalados pelo winget. Se não estiverem no PATH, recarregar o PATH de usuário e de máquina.

## Pastas na nuvem (tarefa atual)
- Repositório: `/home/claude/radar-midia` (mesmo branch).
- Banco de b-roll: clone parcial do repositório privado `opradopedro/fabrica-de-paginas` em `/home/claude/fabrica-de-paginas`, só com `index.json` e `tags.json`. Se faltar: `git clone --filter=blob:none --sparse https://github.com/opradopedro/fabrica-de-paginas /home/claude/fabrica-de-paginas` e `git -C /home/claude/fabrica-de-paginas sparse-checkout set --no-cone radar-gta6/broll/index.json radar-gta6/broll/tags.json`. O `auto_short.py` baixa sozinho só os clipes que o vídeo usar. No `spec.json`, `index` = `/home/claude/fabrica-de-paginas/radar-gta6/broll/index.json`.
- Comandos com `python3` e caminhos com `/`.

## Regras do Pedro (valem acima de tudo)
1. **Postar direto, sem pedir aprovação.** Se ele não gostar, ele reclama depois.
2. **Repetir só quando acabar tema novo.** Antes de escolher, confira em `agenda.json` tudo o que já foi `postado` (tema e assunto, não só o arquivo). Se não houver assunto novo e for preciso repetir, o Reel abre com o selo "RELEMBRANDO" na imagem e a legenda começa com "Relembrando:". Fora isso, **nunca repetir conteúdo** (mesmo arquivo, mesma primeira linha de legenda) e nunca dois Reels com menos de 90 min de diferença.
3. **Voz:** a do vidIQ é a aprovada (voz `TX3LPaxmHKxFdv7VOQHJ`), mas o plano pago ficou caro; com menos de 14 créditos, usar o Gemini (`pipeline/tts_gemini.py`) com a voz **Orus** (`GEMINI_TTS_VOICE=Orus`), escolhida pelo Pedro em 12/10. **Piper proibido** (robótico). Sem voz disponível: não produzir vídeo novo, só publicar o que já estiver `pendente`.
4. **Formato único:** tela cheia 9:16, legenda amarela de 2 a 3 palavras, @radar.gta6br. Visual de b-roll **em movimento**, como o vídeo do Jason aprovado (`aprovados/jason_extended_look_APROVADO.mp4`): abre com um clipe forte e segue com cortes de 1,3 a 2,2 s.
   - Use clipes do Extended Look (`tJbzMqJGH4k_*`), Trailer 1 (`QdBZY2fkU-0_*`) e teasers. **Não use clipes do Trailer 2 (`VQRLujxTm3c_*`)**: eles têm faixas pretas de cinema que aparecem no Reel.
   - Fotos de `assets/` só como complemento; quando aparecerem, deslizam devagar e entram empurrando a anterior (nada de uma imagem se transformando na outra). Nunca `cover.jpg`.
   - Formatos proibidos: o "demo" faixa/tela cheia alternando (`demo_short/demo_estilo_corte.mp4`) e o "painel".
   - **Imagens de todos os trailers (Pedro 20/10):** misture Extended Look, Trailer 1, teasers, trailer de lançamento, fotos oficiais da Rockstar (Newswire, site) e imagens oficiais repostadas em fóruns. Só material oficial, nunca vazamento. "Só o trailer novo" vale apenas para vídeo que anuncia o trailer novo. Modelo de mistura: `producao/2026-10-20_2100/montar.py`.
   - **Enquadramento no detalhe (Pedro 20/10):** o corte 9:16 mostra o que a fala aponta (o rosto do Jason, a máquina encerando o carro), nunca só lataria ou mão cortada pela metade. `pipeline/enquadrar.py` (`cx_auto`) acha rosto ou detalhe e já é usado pelo `auto_short.py`; em `montar.py` próprio, chame `cx_auto(src, ss, dur)` em cada cena. Na folha de quadros, confira se nenhum rosto ou mão ficou cortado.
5. Vazamento só como notícia não confirmada, sem imagem do vazamento. Toda informação com fonte. Português do Brasil, linguagem gamer, sem travessão. Lançamento: 19/11/2026 (PS5 e Xbox Series).

## Rotina a partir de 16/10 (pedido do Pedro em 13/10)
- 3 vídeos por dia: 12h, 18h e 21h. A execução das 20h50 publica o das 21h e já deixa PRONTO (pendente, na galeria) o vídeo das 12h do dia seguinte, para o Pedro avaliar antes das 11h50. A das 11h50 publica e procura tema novo (e produz o das 18h se não houver). A das 17h50 publica o das 18h e produz o das 21h se faltar.
- Qualidade (Pedro 13/10): make_short.py usa lanczos + nitidez e saída ~10 Mbps; auto_short.py evita clipes com menos de 2 Mbps e o Trailer 2. Legendas pela skill instagram-skills do repositório claude-skills (gancho nos primeiros 125 caracteres, 3 a 5 hashtags).
- Trailer de lançamento oficial (15/10) em /home/claude/trailer/launch_crop.mp4 quando existir; senão /mnt/project-files/radar-gta6/trailer-lancamento/launch.mp4 (cortar `crop=1920:960:0:60`; pular logos em 0-2, 15-17, 22-24 e 76-90 s). Para vídeo em que a imagem precisa bater com a fala, use o modelo producao/2026-10-15_trailer/montar.py.
- Comparação GTA V x GTA VI fica para quando o trailer do GTA V puder ser baixado (PC do Pedro). Narração já pronta em /mnt/project-files/radar-gta6/comparacao/.

## Crescimento de seguidores (pesquisa de 18/10, vale para todo vídeo novo)
- Roteiro: notícia no primeiro segundo, pergunta de sim/não ou 1/2 no fim e, por último, o bordão fixo: "Manda pra quem vai jogar GTA 6 com você e segue o Radar." O Instagram pesa envios por DM mais que curtidas para quem não segue.
- Legenda: começa com "GTA 6" (os posts aparecem no Google e na busca do Instagram), gancho nos primeiros 125 caracteres, pede envio ("manda pra quem vai jogar com você"), 3 a 5 hashtags (limite do Instagram é 5).
- Sempre narração e análise próprias por cima das imagens oficiais. Nunca repost puro: desde abr/2026 conta que reposta perde recomendação para quem não segue.
- Notícia com polêmica ou enquete performa melhor (Game Awards 1.778 views, Rockstar ainda mexendo 1.446). Marketing/curiosidade de Miami foi o pior (318 views, 53% pularam).
- Trial Reels só liberam com 200 seguidores; ao chegar lá, testar um gancho por vez.
- Nada de robô de seguir ou curtir: Instagram trata como atividade inautêntica (bloqueio de ações, perda de alcance).

## Pedidos do Pedro pela página de vídeos
A página https://claude.ai/artifact/7niMPUBm3tULBMW37X8rJb guarda no banco dela: `avaliacoes/<id>` (voto bom/ruim e comentário) e `pedidos/<id>` (texto com o que trocar, motivo ou inspiração; `status` aberto/feito/recusado; `resposta`). Toda execução lê os pedidos `aberto` primeiro: refaz o vídeo da fila pedido (ou troca o assunto), atualiza o pedido para `feito` com uma `resposta` curta do que mudou, ou `recusado` explicando por quê. Pedido vale mais que o aprendizado automático.

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
   - **Legenda x voz (Pedro, 23/10, vale para TODO vídeo):** antes de fechar o vídeo, rodar `python3 pipeline/checar_sync.py producao/<pasta>`. Se sair ATENÇÃO, a legenda pode estar fora do áudio: ajuste a pontuação do roteiro (vírgula onde a voz pausa), escreva números grandes por extenso do jeito falado ou regrave a voz, e rode de novo até dar OK. Nunca suba vídeo com ATENÇÃO sem conferir.
   - **Capa (Pedro, 22/10):** gravar no item do `agenda.json` o campo `capa` (2 a 5 palavras de impacto, sem repetir "GTA 6", que já vai num selo; ex.: "Vai chegar sem online", "Bad Bunny na rádio") e `capa_t` (segundo de um quadro com rosto ou cena forte, sem tela preta nem overlay de live). Rodar `python pipeline/capa.py <arquivo> --embutir` na raiz: cria `capas/<video>.jpg` e grava a capa nos 3 primeiros quadros do mp4 (o Instagram usa o quadro 0 como capa). Marcar `capa_embutida: true`. Conferir a capa olhando o jpg.
5. Antes de publicar um item `pendente` sem `capa_embutida: true`, fazer o passo da capa acima. Publicar: copiar o mp4 para a raiz do repositório, commit e push no branch; `vidiq_video_upload` com a URL `https://raw.githubusercontent.com/opradopedro/claude-skills/radar-gta6-midia/<arquivo>`; `vidiq_instagram_publish_reel` (Reel normal, sem Trial) com a legenda, repetindo com o `containerId` até PUBLISHED.
6. Registrar em `agenda.json`: `status: "postado"`, `link`, `legenda`, `ficha` (`formato: "corte"`, `tema`, `gancho`, `origem`). Commit e push de `agenda.json`, `metricas.json`, `aprendizado.md` e `capas/` (a rotina do YouTube usa `capas/<video>.jpg` como thumbnail do Short).
7. Terminar com um resumo curto: o que foi publicado (link) ou por que nada saiu.

## Área segura do Reels
Nada de texto acima de y=170, abaixo de y=1690 nem à direita de x=930 a partir de y=1090. O `make_short.py` já respeita isso.
