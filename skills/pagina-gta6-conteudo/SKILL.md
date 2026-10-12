---
name: pagina-gta6-conteudo
description: 'Gera a pauta, os roteiros e os vídeos da página de GTA 6 no Instagram (@radar.gta6br): notícias de última hora, posts gringos traduzidos, Reels, memes e achados Shopee, com 3 publicações por dia. Use sempre que o assunto for a página de GTA 6, o Radar GTA VI BR ou conteúdo de GTA 6 para Instagram.'
---

# Página GTA 6: conteúdo do @radar.gta6br

Objetivo: manter a página @radar.gta6br (Radar GTA VI BR), monetizada com Shopee Afiliados, com 3 Reels por dia que prendam a atenção. A produção e a publicação automática seguem a skill `radar-da-gringa`; esta skill guarda a linha editorial e o padrão visual da página.

## Linha editorial (o que o Pedro quer)
Referência de estilo: Flow Games (notícia rápida, quente, com opinião e gancho forte). Conteúdo de última hora que prenda a atenção.

Três fontes de pauta:
1. **Radar da gringa:** o post de GTA 6 que mais bombou nas páginas hypadas dos EUA nos últimos 1 a 3 dias, traduzido e refeito com a nossa identidade. O Pedro aceita traduzir o conteúdo de lá, mesmo que o Instagram reduza um pouco o alcance.
2. **Última hora autoral:** o que saiu nas últimas 48 h (Rockstar, Take-Two, revistas, vazamentos reportados pela imprensa, classificação, entrevistas, o que a comunidade comenta).
3. **Atemporal:** Ultimate x Padrão, bônus de pré-venda, riscos da caixa física, golpes, comparações com jogos antigos, teorias, curiosidades, contagem regressiva.

Evitar notícia velha contada como novidade. Fato antigo só entra dentro de um conteúdo atemporal. Se a gringa espalhou algo falso, o vídeo vira "é mentira".

Vazamentos: pode noticiar o que a imprensa reporta, sempre marcado como não confirmado. Nunca usar imagem ou trecho do vazamento (a Rockstar derruba) e nunca dar spoiler de história.

## Regras fixas
- Português do Brasil, linguagem de gamer brasileiro, sem travessão (em dash).
- Traduzir e adaptar post gringo é liberado; todo vídeo sai com a nossa narração, legenda e identidade visual.
- Nunca publicar o mesmo vídeo ou a mesma legenda duas vezes. Três posts no mesmo dia é o ritmo esperado.
- Toda notícia com fonte com link; rumor e vazamento marcados como não confirmados.
- GTA 6 lança em 19/11/2026 (PS5 e Xbox Series, sem PC). Antes: notícias, vazamentos, mecânicas, teorias, contagem. Depois: dicas, segredos, mapas, "onde achar".

## Formato "corte" (um dos dois formatos testados; o outro é o "painel" do v8)
Referência: cortes de podcast do Flow Games/GameplayRJ no YouTube Shorts, mas sem apresentador. Opinião rápida sobre o assunto quente de GTA 6 (vazamento comentado como notícia, polêmica, teoria, "vai ter ou não vai ter?"), falada como conversa ("mano", "gente", "pensa comigo"), 30 a 40 s.
- Visual: b-roll em movimento tela cheia (clipes dos trailers oficiais, banco no branch `radar-gta6-broll`, montado no PC do Pedro com `montar_broll.py`), alternando faixa central com fundo desfocado e tela cheia, corte a cada 1,3 a 2,2 s. Sem clipe, imagens oficiais com zoom lento.
- Legenda amarela de 2 a 3 palavras no centro, números em roxo, palavras sensíveis censuradas (P3L@D0), @RADAR.GTA6BR pequeno embaixo.
- Scripts: `auto_short.py` e `make_short.py` (skill `radar-da-gringa`).
- Nunca usar imagem ou vídeo de vazamento; só material oficial.

## Formato "painel" (o anterior, ainda disponível)
- Reels de 35 a 40 s, 1080x1920, narração em português pelo Google Cloud TTS (`tts_google.py`, quando houver a chave GOOGLE_TTS_API_KEY no ambiente) ou pela voz "Liam - Energetic, Social Media Creator" do vidIQ (id TX3LPaxmHKxFdv7VOQHJ).
- Visual: imagens oficiais da Rockstar em HD (branch `radar-gta6-midia`, pasta `assets/`), trocando a cada 2 a 3 s com zoom e flash, imagens e enquadramentos diferentes de um vídeo para o outro. Título no topo, legenda grande sincronizada com a fala (fonte Anton, números e destaques em laranja), fontes e @radar.gta6br com logo embaixo do painel.
- Tudo dentro da área segura do Reels: nada acima de y=170, abaixo de y=1690 ou à direita de x=930 a partir de y=1090. O `make_reel.py` atual já faz isso, com todos os textos centralizados em x=540 e fontes menores.
- Legenda cronometrada pelo roteiro com `align2.py` (sem Whisper). Conferir quadros antes de publicar.
- Preferir movimento: quando houver trecho oficial em boa resolução ou animação por IA de imagem oficial (marcada como IA), usar. Os cortes do vidIQ a partir do YouTube saem em baixa resolução e não servem.
- Gancho nos 2 primeiros segundos e pergunta no final para puxar comentário.

## Legenda do post
Gancho na primeira linha (é o que a tarefa usa para não repetir), 2 a 3 linhas com o fato, CTA (comentar, salvar ou mandar pro amigo), "Segue o @radar.gta6br pra não perder nada até 19/11" quando couber, e 5 a 8 hashtags (#gta6 #gtavi #gta6brasil #rockstargames mais as do tema).

## Pauta semanal (quando o Pedro pedir)
Tabela com dia, hora (12h, 18h, 21h), fonte de pauta (gringa, autoral ou atemporal), tema, gancho, inspiração gringa (perfil e views) e fonte. Os itens vão para `agenda.json` com status "pendente" (vídeo pronto) ou "produzir" (a tarefa agendada faz).

## Memes, carrosséis e achados Shopee
- Carrossel: texto slide a slide (máx. 8 slides, até 25 palavras por slide), capa com promessa clara.
- Memes gringos traduzidos (texto + imagem, áudio em alta escolhido no app) para quando o Pedro postar à mão.
- Achados: produtos de GTA que viralizaram na gringa (ex.: abajur de dinheiro que levita, projetor temático) e 3 temáticos por semana para os stories, com texto. O Pedro cola o link de afiliado.

## Aprendizado por engajamento (pedido do Pedro em 12/10/2026)
A página se adapta sozinha ao que engaja. Cada Reel publicado leva uma `ficha` (formato painel ou corte, tema, gancho, origem). Toda execução salva a resposta do vidiq_instagram_owner_insights (grátis) e roda `scripts/aprendizado.py coletar`, que guarda as métricas com 24 h e 72 h no ar e dá uma nota de 0 a 100 (35% quem não pulou, 25% % assistido, 30% interação por view com salvamento e compartilhamento valendo 3x, 10% alcance). `aprendizado.py sugerir` escolhe formato, tema e gancho do próximo Reel: 70% repete o melhor (média ajustada para poucos posts), 30% testa o menos testado; opção com 3+ posts e 8 pontos abaixo da média fica pausada. O tema sugerido só vale se houver fato real com fonte.

## Pesquisa da gringa pelo Apify (12/10/2026)
`scripts/gringa_apify.py` (skill radar-da-gringa) substitui a busca de outliers do vidIQ: `virais` traz os posts de GTA 6 com 50 mil+ views dos últimos 3 dias no TikTok e no Instagram, `concorrentes @a @b` traz os Reels recentes dessas páginas e `checar` testa o acesso. Chave APIFY_TOKEN no ambiente da nuvem (nunca no chat). Os atores cobram por resultado, por isso as buscas são pequenas e uma vez por dia. Cada post ganha um `tema`, e o aprendizado.md soma as views por tema na seção "Em alta lá fora". Do post gringo sai só o assunto; vídeo e imagem de outras páginas nunca são baixados nem republicados.

## Revisão semanal
Toda segunda, 3 a 5 linhas do `aprendizado.md` para o Pedro: o que está indo melhor, o que foi pausado e o que será testado.
