# claude-skills
Este repositório serve especificamente para disponibilizar skills para o claude.

## Skills
- `skills/radar-da-gringa`: traduz e refaz em português os posts gringos que mais bombaram e publica até 3 Reels por dia sem repetir (`radar-da-gringa.skill`).
- `skills/pagina-gta6-conteudo`: linha editorial e padrão visual da página @radar.gta6br (`pagina-gta6-conteudo.skill`).
- `skills/fabrica-de-paginas`: abrir, produzir e automatizar páginas de nicho de qualquer tema (`fabrica-de-paginas.skill`).
- `skills/find-skills`: procura e recomenda skills prontas do ecossistema aberto (skills.sh) quando surge uma tarefa nova. Cópia da skill da Vercel ([vercel-labs/skills](https://github.com/vercel-labs/skills/tree/main/skills/find-skills)), licença MIT (`find-skills.skill`).
- `skills/apify-ultimate-scraper`: coleta posts, métricas e links de mídia de Instagram, TikTok, YouTube e outras redes pela Apify (precisa de `APIFY_TOKEN` no ambiente). Cópia da skill da Apify ([apify/agent-skills](https://github.com/apify/agent-skills/tree/main/skills/apify-ultimate-scraper)), licença Apache-2.0 (`apify-ultimate-scraper.skill`).
- `skills/instagram-skills`: pacote de 9 skills de Instagram (legenda com gancho nos primeiros 125 caracteres, carrossel slide a slide, extrair o gancho de Reels virais, hashtags, humanizar texto de IA, pauta semanal, reaproveitar conteúdo de outras redes, otimizar perfil e ler dados do nicho). Funciona só em rascunho sem configurar nada; publicar exige `PUBLORA_API_KEY`. Cópia da skill de Sergey Bulaev ([sergebulaev/instagram-skills](https://github.com/sergebulaev/instagram-skills)), licença MIT (`instagram-skills.skill`).

O branch `radar-gta6-midia` guarda os vídeos, a agenda e o playbook da publicação automática do @radar.gta6br.
