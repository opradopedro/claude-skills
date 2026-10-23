---
name: canal-terror
description: Produz e agenda no YouTube os Shorts de terror do canal Hora Muerta (espanhol), com cenas animadas em código, narração Gemini grátis e upload automático às 21h de Brasília.
---

# Canal de terror Hora Muerta

Canal faceless de Shorts de terror em espanhol latino neutro: lendas latino-americanas e histórias de
regra ou reviravolta. Sem sangue nem gore, público 16+, **nunca** marcado como feito para crianças.
Custo zero: as cenas são desenhadas em código (canvas renderizado no Chromium), a voz é o Gemini TTS
no plano grátis e o upload usa a YouTube Data API.

- Canal: Hora Muerta (@HoraMuertaRelatos). Versão em inglês (Dead Hour Tales) fica para depois.
- Publicação: 1 Short por dia às 21h de Brasília (00h UTC), agendado como privado com `publishAt`.
  O Pedro pode vetar no YouTube Studio antes do horário.

## Padrão de qualidade (esforço alto, pedido do Pedro em 23/10)

O Pedro quer vídeos bonitos de ver e temas criativos e pouco batidos. Pesquisa de tema e motor gráfico são as
duas partes onde **não se economiza raciocínio nem tempo**:

- **Pesquisa de tema:** antes de escrever, use WebSearch para achar lendas, casos e creepypastas latino-americanos pouco explorados em Shorts
  (Reddit r/Paranormal, r/LetsNotMeet, r/latinoamerica, fóruns e folclore regional, Shorts virais de terror em
  espanhol para ver o que já está saturado). Liste pelo menos 8 candidatos com nota de 1 a 5 em
  originalidade (pouco contado em Shorts), gancho nos 2 primeiros segundos, potencial visual nas cenas em
  código e se rende uma série de 2 partes ou mais. Fuja do que já foi muito usado por outros canais e do que já está em `stories/`; anote os bons que
  sobrarem no backlog (`references/temas.md`). Confira os fatos que o roteiro afirma.
- **Motor gráfico:** cada cena precisa ser bonita sozinha: composição, luz e sombra, textura, profundidade, movimento
  com intenção e leitura clara do que está acontecendo. Melhore o motor quando um tema pedir. Renderize quadros de
  teste em vários pontos, **olhe cada JPG** e faça pelo menos duas rodadas de ajuste antes do render final. Se um
  quadro estiver feio, vazio, confuso ou repetido, conserte antes de subir.
- O Pedro não precisa aprovar antes de subir ("Nunca espere minha aprovação pra subir"), então a conferência dos
  quadros é a única revisão: trate-a como a de um editor exigente.

## Rodar (rotina diária)

```bash
pip install -q numpy soundfile playwright sherpa-onnx
cd skills/canal-terror
python3 scripts/produce.py --proximo --subir --saida /tmp/hm
```

As histórias são **séries de 2 partes ou mais** (pedido do Pedro: prender o público e levar a mais vídeos).
`--proximo` consulta o canal, pega a primeira série de `stories/` com parte ainda não subida e agenda
**todas as partes de uma vez**, em dias seguidos às 21h (a parte 1 promete a 2 para "mañana" com o dia da semana, então
elas não podem se separar). Cada parte sai com a tag do código (`HM009`) e entra na playlist da série;
a descrição da parte 2 ganha o link da parte 1. A saída tem uma linha `AGENDADO HMxxx https://youtu.be/...`
por parte.

- `FILA CHEIA`: já há 2 ou mais vídeos agendados no futuro; não faz nada hoje (normal, dia sim dia não).
- `SEM ROTEIRO`: escreva a próxima série (seção abaixo), confira os quadros com `--teste` e rode de novo.
  Nunca suba sem ter olhado os quadros de um roteiro novo.

Variáveis de ambiente (só no ambiente, nunca imprimir, nunca pedir no chat):
`GEMINI_API_KEY`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_ES`.
Sem Gemini a voz cai para o Kokoro local, que o Pedro reprovou (robótica, sotaque americano): serve só para
teste. Com `--subir`, se o Gemini falhar o script para com `VOZ FALHOU` e não publica nada; tente de novo mais tarde.

Erros comuns:
- `YT_REFRESH_TOKEN_ES vencido`: token revogado ou gerado quando o app ainda estava em teste (vence em 7 dias).
  Avise o Pedro para gerar outro no OAuth Playground e atualizar a variável do ambiente.
- Gemini 429: o plano grátis dá 10 narrações por dia por modelo. O script tenta outros modelos TTS
  e, se nada der, usa o Kokoro.
- Cota do YouTube: cada upload gasta 1.600 de 10.000 unidades por dia (no máximo 6 vídeos/dia).

## Painel dos canais (antes e depois de cada execução)

O Pedro assiste, vota, pede mudanças e manda ideias no **Painel dos canais**
(https://claude.ai/artifact/2SptRCzSbXHuKHPzct4Tu2), conta `hm`. A página antiga "Vídeos do Hora Muerta" não é mais usada.
Siga o passo a passo de [../painel/README.md](../painel/README.md) com `C = hm`:

1. **Antes de produzir**: pedidos abertos e ideias novas do canal `hm`. Ideia boa vira o próximo roteiro novo
   (quando a saída disser SEM ROTEIRO), seguindo a regra de 2 partes.
2. **Depois de subir**: o `produce.py` já copia MP4, capa e `HMxxx.json` para `/mnt/project-files/canal-terror/videos/`
   (`HM_VIDEOS` muda a pasta). Atualize o documento `canais/hm` com `skills/painel/painel.py` como o README explica.

## Peças

| Script | Faz |
|---|---|
| `scripts/produce.py` | Orquestra: voz, vídeo, trilha, MP4 final (CRF 26) e upload agendado |
| `scripts/tts.py` | Gemini TTS numa chamada só, corte nas pausas (tempo de voz por linha + marcas do Gemini texto), tempo de cada palavra para a legenda; reserva Kokoro |
| `scripts/engine.html` | Biblioteca de cenas em canvas 1080x1920, legenda palavra a palavra |
| `scripts/render.py` | Chromium (Playwright) quadro a quadro para FFmpeg, 30 fps; `--teste` salva JPGs |
| `scripts/mix.py` | Voz limpa (sem eco), piano grave com reverb, drone e efeitos nos eventos, -15 LUFS |
| `scripts/yt_upload.py` | `subir video.json` e `publicados` (códigos HMxxx já no canal, pela tag) |
| `scripts/pagina.py` | (antigo) dados da página de revisão anterior; use `skills/painel/painel.py` |
| `scripts/capa.py` | Thumbnail 1080x1920: quadro do gancho + texto do campo `capa` + selo da parte (enviada no upload) |
| `scripts/marca.py` | Foto de perfil e banner do canal (relógio 3:33); o Pedro sobe no Studio, a API não troca a foto |
| `scripts/conferir_voz.py` | Corta a narração e transcreve cada pedaço (Gemini texto) para provar que cada linha caiu no lugar certo |
| `scripts/comum.py` | Converte cenas e eventos do roteiro em segundos |

## Escrever uma série nova

Um arquivo por parte: `stories/NNN-slug-P.json` (NNN = número do código, P = parte), códigos seguidos.
Use o backlog de [references/temas.md](references/temas.md) e as regras de lá.

- Parte 1 (40 a 55 s): gancho forte, a história cresce e **para no pior momento**. Penúltima frase é o
  cliffhanger; a última é sempre `"Parte dos, mañana, {dia_siguiente}."` com a cena
  `{"comp": "texto", "p": {"lineas": ["PARTE 2", "Mañana · {fecha_siguiente}"]}}`. Na descrição: `▶ Parte 2: mañana, {fecha_siguiente}.`
  O `produce.py` troca `{dia_siguiente}` ("jueves") e `{fecha_siguiente}` ("jueves 22") pelo dia em que a próxima parte
  sai. **Nunca falar horário**: o público hispano está em vários fusos.
- Parte 2 (e seguintes): começa com `"Parte dos."` + uma frase que relembra onde parou, e o `gancho` mostra
  o susto da própria parte. A última parte fecha a história com uma reviravolta **explicada** (quem assiste
  só uma vez tem que entender) e uma frase de regra ou loop no fim.
- Campos de série em todas as partes: `"serie": "slug"`, `"serie_titulo": "Nome | Hora Muerta"` (vira playlist),
  `"parte": 1`, `"partes": 2`; da parte 2 em diante, `"anterior": "HM009"` (código da parte anterior).
- Título com `Parte 1` / `Parte 2`.
- `"capa"`: 2 a 5 palavras da thumbnail, próprias do conteúdo de **cada** parte (pedido do Pedro), em maiúsculas,
  ex. `"NUNCA CONTESTES A LAS 3:33"`. A última linha sai em vermelho. Confira o JPG `HMxxx_capa.jpg` no `--teste`.

Formato de cada parte:

```json
{
  "codigo": "HM009", "formato": "Leyenda",
  "serie": "sayona", "serie_titulo": "La Sayona | Hora Muerta", "parte": 1, "partes": 2,
  "titulo": "Gancho curto com emoji 😨 Parte 1 #terror #shorts",
  "capa": "TEXTO DA THUMBNAIL",
  "descripcion": "1 frase de gancho\n\nPergunta para comentarios\n\nHistoria de ficción narrada. Nueva historia todos los días.\n#terror #historiasdeterror ...",
  "tags": ["historias de terror", "..."],
  "lineas": [{"texto": "Frase falada", "pausa": 0.6, "vel": 0.9}],
  "cenas": [{"linea": 0, "comp": "camino", "p": {"dist": [1, 0.6]}}],
  "eventos": [{"tipo": "susto", "linea": 5, "en": "fin", "mas": 0.1}],
  "destaque": ["palavras", "em vermelho"],
  "gancho": {"cena": 3, "evento": "susto", "mas": 0.4, "dur": 0.8}
}
```

- `lineas`: 7 a 9 frases curtas, no máximo 58 s (a voz do Gemini é lenta: ~5 s por frase). `pausa` é o silêncio depois da linha (o `tts.py` multiplica por 1,4 e deixa a voz 10% mais lenta: fala calma e pausada, pedido do Pedro); `vel` só vale no Kokoro. `"piano": 0` no roteiro desliga o piano.
- `cenas`: cada cena começa 0,25 s antes da linha indicada e vai até a próxima cena.
  `p.zoom` (aproximação lenta, padrão 0.06), `p.fy` (centro do zoom, 0 a 1), `p.niebla`, `p.temblor`.
- `eventos`: momento = linha + `en` (`inicio`, `fin` ou fração 0 a 1) + `mas` segundos. `dur` opcional.
- `gancho`: os primeiros 0,8 s mostram o quadro do susto antes da história começar. Use sempre.

Eventos globais: `susto` (flash vermelho, tranco de câmera, estrondo), `golpe` (batida, tremida),
`flash`, `negro` (tela preta por `dur`), `apagon` (luz piscando com zumbido).
Só som: `silbido` (assobio subindo notas), `grito` (lamento), `vibra` (celular), `apaga` (sopro).

Componentes (`comp`) e o que cada um aceita:

| comp | cena | p | eventos próprios |
|---|---|---|---|
| `reloj` | despertador digital vermelho | `hora` "3:33", `parpadeo` | |
| `vela` | vela e retrato antigo | `foto` true/false | `foto` (rosto no retrato), `apaga` |
| `pasillo` | corredor com vulto | `dist` [ini, fim] 1 longe a 0 perto, `parpadeo`, `figura`, `marco` | `acerca` |
| `telefono` | celular no escuro | `hora`, `de`, `msg` [linhas] | `mensaje`, `vibra` |
| `tela` | espelho coberto por pano | `mano` (marca de mão 0 a 1) | `golpe`, `revela` (olho e sorriso) |
| `tres_espejos` | três espelhos cobertos e vela | | `descubre` |
| `bano` | reflexo atrasado no espelho | `atraso` | `levanta`, `reflejo`, `sonrisa`, `raja` (vidro racha) |
| `camino` | estrada de terra, lua, figura de chapéu | `dist`, `sombrero`, `ojos`, `figura` | `acerca` |
| `autobus` | ônibus vazio à noite | `figura` (passageiro no fundo), `lado` | `aparece`, `voltea` |
| `ojos` | mata com olhos vermelhos | `n`, `cerca` [ini, fim], `perro`, `blanco`, `color` "r,g,b" | `acerca` |
| `ventana` | janela vista de dentro | `cara` | `cara` (rosto e mãos no vidro) |
| `rio` | rio ao luar, mulher de branco | `dist` | `grito` (avança e grita) |
| `puerta` | porta abrindo | `abre` [ini, fim], `luz` | `abre`, `mano` (dedos na borda), `susto` (olhos) |
| `texto` | cartela de regra | `lineas` [título vermelho, subtítulo] | |

Precisa de uma cena que não existe? Crie um `COMP.nome = (t, lt, p) => {...}` no `engine.html`
seguindo os outros (`lt` vai de 0 a 1 na cena; `E.since(t, 'evento')` dá os segundos desde o evento,
ou -1). Confira com `--teste` e mande a mudança por PR.

Conferir antes de subir:

```bash
python3 scripts/produce.py stories/009-x-1.json stories/010-x-2.json --saida /tmp/hm --teste   # JPGs em /tmp/hm/HM009_*.jpg
```

Se a voz parecer fora da legenda, rode `python3 scripts/conferir_voz.py historia.json /tmp/hm/HMxxx_voz_bruto.wav`
(todas as linhas devem sair com nota >= 0,6).

Olhe os JPGs: o susto aparece na tela? O primeiro quadro (gancho) assusta? A legenda não cobre o
essencial? (Ela fica em 62% da altura, puxada para a esquerda: abaixo de ~72% e na coluna da direita a interface do Shorts cobre tudo.) Só então rode sem `--teste`.

## Regras do canal

- O susto tem que **aparecer na tela**, não só ser contado. O primeiro quadro tem que ser forte.
- Sem sangue, sem violência gráfica, sem suicídio, sem crianças em perigo de forma explícita.
- Tudo narrado como ficção ("Historia de ficción narrada" na descrição). `containsSyntheticMedia` fica
  `false` porque a animação não é realista; a voz sintética não exige o selo.
- `selfDeclaredMadeForKids` sempre `false`. Categoria 24 (Entretenimento), idioma `es`.
- Final com loop ou frase que puxa comentário; pergunta na descrição.
- Cada vídeo é uma história completa: a reviravolta do final tem que ficar clara para quem assiste uma vez só
  (diga o que ela significa, não só insinue).
