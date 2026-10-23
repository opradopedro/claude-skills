# Painel dos canais

Página única onde o Pedro escolhe a conta (Hora Muerta, Radar GTA VI, So You Built It) e vê os vídeos a postar,
os já postados, vota, pede mudanças e manda ideias de vídeo como num chat (link de Reel/Shorts/TikTok, texto ou print).

**URL:** https://claude.ai/artifact/2SptRCzSbXHuKHPzct4Tu2 (fonte: `index.html` desta pasta)

As páginas antigas "Vídeos do Hora Muerta" e "Vídeos do Radar GTA" foram substituídas por esta. Não publique mais nelas.

## Banco do painel

| Coleção | Documento | Quem escreve |
|---|---|---|
| `canais` | `hm`, `gta`, `yb`: `{canal, atualizado, itens: [...]}` | a rotina de cada canal (passo 3 abaixo) |
| `pedidos` | `{canal, codigo, texto, status: "aberto"\|"feito"\|"recusado", resposta, criado}` | o Pedro cria; a rotina fecha |
| `avaliacoes` | id `<canal>_<codigo>_<autor>`: `{canal, codigo, nota: "sim"\|"nao"}` | o Pedro |
| `ideias` | `{canal, texto, links: [], imagens: [{id, url}], status: "nova"\|"anotada"\|"usada"\|"descartada", resposta, claude}` | o Pedro cria; a rotina responde |

Item de `itens`: `{codigo, titulo, estado: "roteiro"|"pronto"|"agendado"|"postado", quando (ISO), links: [{nome, url}],
video, capa, video_sha, roteiro?: [frases], legenda?, serie?, serie_titulo?, parte?, partes?, numeros?: {views, curtidas, pulos}}`.
`agendado` com `quando` no passado aparece como "no ar".

## Passo a passo da rotina (todo canal)

`P` = `https://claude.ai/artifact/2SptRCzSbXHuKHPzct4Tu2`, `C` = `hm`, `gta` ou `yb`.

1. **Antes de produzir:** ArtifactData `query` em `pedidos` com `where [["canal","==",C],["status","==","aberto"]]` e em
   `ideias` com `where [["canal","==",C],["status","==","nova"]]` (url `P`). Aplique os pedidos (roteiro ainda não subido:
   edite antes; vídeo agendado: refaça se der tempo; senão aplique nos próximos) e marque com `update`
   `{status: "feito" ou "recusado", resposta: "uma frase do que mudou"}`. Ideias: se der para usar, use como tema
   (links de Reel/Shorts dá para ler com o vidIQ; prints vêm em `imagens[].url`, baixe com Artifact `read` `path` = o id)
   e marque `{status: "usada", resposta}`; se for para depois, `{status: "anotada", resposta}`; se não serve, `descartada` com o motivo.
   Votos (`avaliacoes`) guiam o estilo. Sempre passe `if_version` da leitura.
2. **Produza e suba** como a skill do canal manda.
3. **Atualize o painel:**
   1. ArtifactData `get` em `canais`, doc `C`, com `out_dir /tmp/painel/atual` (guarde a `version`; na primeira vez o doc pode não existir).
   2. Rode o script (de dentro do repo claude-skills, branch main):
      - Hora Muerta: `python3 skills/painel/painel.py --canal hm --stories skills/canal-terror/stories --videos /mnt/project-files/canal-terror/videos --atual /tmp/painel/atual/canais/hm.json --saida /tmp/painel/hm`
      - So You Built It: `python3 skills/painel/painel.py --canal yb --stories skills/canal-engenharia/stories --videos /mnt/project-files/canal-engenharia/videos --atual /tmp/painel/atual/canais/yb.json --saida /tmp/painel/yb`
      - Radar GTA VI: `python3 <claude-skills>/skills/painel/painel.py --canal gta --radar <raiz do branch radar-gta6-midia> --atual /tmp/painel/atual/canais/gta.json --saida /tmp/painel/gta`
   3. Se imprimir `SUBIR`: envie os arquivos de `subir.json` com o Artifact tool (`url` P, `asset: true`, `file_paths` = a lista;
      até 25 por chamada), grave `/tmp/painel/<C>/urls.json` como `{"caminho local": "url do resultado"}` e rode o
      mesmo comando de novo com `--urls /tmp/painel/<C>/urls.json`. Repita até imprimir `PRONTO`.
   4. ArtifactData `set` em `canais`, doc `C`, `file_path /tmp/painel/<C>/doc.json`, `if_version` = a version do passo 1
      (sem if_version se o doc não existia). Se der conflito, volte ao passo 3.1.
   Não republique a página (`index.html`) na rotina: ela só muda quando alguém mexe no layout.

Vídeos só são reenviados quando o MP4 muda (o script compara o `video_sha`). Hora Muerta e So You Built It vão em 720p
(prévia leve); Radar GTA VI vai em 1080p para o Pedro baixar pelo botão do card.
