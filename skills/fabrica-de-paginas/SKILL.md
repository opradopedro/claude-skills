---
name: fabrica-de-paginas
description: 'Planeja, produz e automatiza páginas de nicho no Instagram/TikTok/Shorts: valida nicho, cria identidade, pauta, Reels com narração, tradução de posts virais gringos e publicação automática de até 3 vídeos por dia, para qualquer tema. Use sempre que o Pedro falar em abrir ou tocar uma página de nicho, monetizar com afiliados ou automatizar postagens.'
---

# Fábrica de páginas de nicho

Versão genérica do fluxo da página de GTA 6. Serve para abrir e tocar páginas de qualquer nicho, monetizadas com afiliados (Shopee e similares). Se o nicho for GTA 6, use a skill `pagina-gta6-conteudo`. A produção e publicação automática segue o modelo da skill `radar-da-gringa`.

## Parâmetros (perguntar se faltar)
- Nicho e público (idade, região, interesse)
- Plataformas (Instagram, TikTok, YouTube Shorts)
- Ritmo (padrão: 3 vídeos por dia, 12h, 18h e 21h)
- Produtos de afiliado que combinam com o público
- Uma página de referência de estilo no nicho (como o Flow Games é para games) e 3 a 5 páginas gringas hypadas do nicho

## Linha editorial padrão
1. **Radar da gringa:** o post do nicho que mais bombou nos EUA nos últimos 1 a 3 dias, traduzido e refeito com a identidade da página. Se deu certo lá, tem chance de dar certo aqui.
2. **Última hora autoral:** o que saiu nas últimas 48 h no nicho.
3. **Atemporal:** guias, comparações, "vale a pena?", riscos, curiosidades, teorias, lembretes.

Não contar notícia velha como novidade. Fato antigo só entra dentro de um conteúdo atemporal.

## Regras fixas
- Português do Brasil, sem travessão (em dash).
- Traduzir post gringo é liberado; todo vídeo sai com narração própria em português, legenda e identidade da página.
- Nunca usar material vazado. Toda informação factual tem fonte; rumor marcado como não confirmado.
- Cada página tem nicho, identidade e pauta próprios. Nunca postar o mesmo vídeo em duas páginas do Instagram (o mesmo vídeo em Instagram, TikTok e Shorts da mesma página pode).
- Nunca publicar o mesmo vídeo ou legenda duas vezes na mesma página.
- Publicação automática só depois que o Pedro aprovar a página e o formato; a partir daí a tarefa agendada publica sozinha.

## Modo 1: validar um nicho novo
1. Pesquisar (WebSearch e vidIQ outlier search no Instagram/TikTok, 5 créditos) o que viraliza no nicho nos últimos 30 dias, em português e na gringa.
2. Responder 4 perguntas com dados: o público compra alguma coisa? Tem produto de afiliado com comissão decente? Tem assunto novo toda semana? A concorrência em português é fraca? Bônus: as páginas gringas do nicho têm posts virais toda semana para traduzir?
3. Dar nota de 0 a 10 e recomendar abrir ou não.

## Modo 2: abrir a página
1. 10 opções de nome e @.
2. Identidade no Canva (conector): foto de perfil, capa de Reels, modelo de carrossel, 2 cores e 1 fonte.
3. Bio com promessa clara e espaço para link de achados.
4. Conectar o Instagram ao vidIQ (para métricas e publicação).

## Modo 3: máquina de vídeos
- Montagem local com os scripts da skill `radar-da-gringa` (`make_reel.py`, `auto_config.py`, `align2.py`): Reel 1080x1920, imagens trocando a cada 2 a 3 s, legenda sincronizada pelas pausas da fala, título, fontes e @ da página.
- **Área segura do Reels:** nada de texto acima de y=170, abaixo de y=1690 ou à direita de x=930 a partir de y=1090, porque a interface do Instagram cobre essas partes. Trocar cores, logo e fonte por página, sem mexer nessas margens.
- Banco de imagens oficiais ou próprias em alta resolução, variando imagem e enquadramento entre vídeos.

## Modo 4: automação de publicação
Modelo usado no @radar.gta6br, replicável por página:
1. Um branch no repositório `opradopedro/claude-skills` por página, com `agenda.json` (data, hora, arquivo, status "pendente"/"produzir"/"postado", legenda, link, fonte_gringa), `PLAYBOOK.md`, `assets/`, `pipeline/` e os mp4.
2. Uma tarefa agendada (Routine) com os conectores vidIQ e GitHub, rodando 10 minutos antes de cada slot, que publica um Reel por execução: upload pela URL raw do GitHub, `vidiq_instagram_publish_reel`, commit do status e aviso ao Pedro com o link.
3. Itens "produzir" são feitos pela própria tarefa seguindo a `radar-da-gringa`.
4. Checagens anti-repetição antes de publicar: arquivo já postado, mesma primeira linha de legenda, Reel nos últimos 90 minutos.

## Modo 5: métricas
1. Puxar as métricas pelo vidIQ (vidiq_instagram_connected_accounts e vidiq_instagram_owner_insights, sem custo) ou pelos prints do Pedro.
2. Ranquear fonte de pauta (gringa, autoral, atemporal), formato, gancho e horário por alcance em não seguidores, salvamentos, compartilhamentos e % assistido.
3. Ajustar a mistura dos 3 slots e a pauta seguinte.

## Custos de referência (vidIQ)
Narração 14 créditos por 1.000 caracteres; pesquisa de outliers 5; ver um Reel cena por cena 10; montagem local grátis; upload, publicação e métricas grátis; plano grátis = 150 créditos por mês. Com 3 Reels narrados por dia o plano grátis não fecha o mês: usar plano pago ou outra voz (Google Cloud TTS com chave de API).
