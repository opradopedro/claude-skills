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

## Rodar (rotina diária)

```bash
pip install -q numpy soundfile playwright sherpa-onnx
cd skills/canal-terror
python3 scripts/produce.py --proximo --subir --saida /tmp/hm
```

`--proximo` consulta o canal, pega o primeiro `stories/*.json` cujo código (ex. `HM008`) ainda não
foi subido e agenda no próximo horário livre das 21h. A saída termina com
`AGENDADO HM008 https://youtu.be/... publica em ...`.

Se a saída for `SEM ROTEIRO`, escreva um roteiro novo (seção abaixo), confira os quadros com
`--teste` e rode de novo. Nunca suba sem ter olhado os quadros de um roteiro novo.

Variáveis de ambiente (só no ambiente, nunca imprimir, nunca pedir no chat):
`GEMINI_API_KEY`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_ES`.
Sem `GEMINI_API_KEY` a voz cai para o Kokoro local (grátis, mais robótica).

Erros comuns:
- `YT_REFRESH_TOKEN_ES vencido`: token revogado ou gerado quando o app ainda estava em teste (vence em 7 dias).
  Avise o Pedro para gerar outro no OAuth Playground e atualizar a variável do ambiente.
- Gemini 429: o plano grátis dá 10 narrações por dia por modelo. O script tenta outros modelos TTS
  e, se nada der, usa o Kokoro.
- Cota do YouTube: cada upload gasta 1.600 de 10.000 unidades por dia (no máximo 6 vídeos/dia).

## Peças

| Script | Faz |
|---|---|
| `scripts/produce.py` | Orquestra: voz, vídeo, trilha, MP4 final (CRF 26) e upload agendado |
| `scripts/tts.py` | Gemini TTS numa chamada só, corte nas pausas, tempos por linha; reserva Kokoro |
| `scripts/engine.html` | Biblioteca de cenas em canvas 1080x1920, legenda palavra a palavra |
| `scripts/render.py` | Chromium (Playwright) quadro a quadro para FFmpeg, 30 fps; `--teste` salva JPGs |
| `scripts/mix.py` | Voz com eco, drone grave e efeitos sintetizados nos eventos, -15 LUFS |
| `scripts/yt_upload.py` | `subir video.json` e `publicados` (códigos HMxxx já no canal, pela tag) |
| `scripts/comum.py` | Converte cenas e eventos do roteiro em segundos |

## Escrever um roteiro novo

Arquivo `stories/NNN-slug.json`, com o próximo código livre. Use o backlog de
[references/temas.md](references/temas.md) e as regras de lá. Formato:

```json
{
  "codigo": "HM008", "formato": "Leyenda",
  "titulo": "Gancho curto com emoji 😨 #terror #shorts",
  "descripcion": "1 frase de gancho\n\nPergunta para comentarios\n\nHistoria de ficción narrada. Nueva historia todos los días a las 9 pm.\n#terror #historiasdeterror ...",
  "tags": ["historias de terror", "..."],
  "lineas": [{"texto": "Frase falada", "pausa": 0.6, "vel": 0.9}],
  "cenas": [{"linea": 0, "comp": "camino", "p": {"dist": [1, 0.6]}}],
  "eventos": [{"tipo": "susto", "linea": 5, "en": "fin", "mas": 0.1}],
  "destaque": ["palavras", "em vermelho"],
  "gancho": {"cena": 3, "evento": "susto", "mas": 0.4, "dur": 0.8}
}
```

- `lineas`: 7 a 11 frases, 35 a 55 s no total. `pausa` é o silêncio depois da linha; `vel` só vale no Kokoro.
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
| `bano` | reflexo atrasado no espelho | `atraso` | `levanta`, `reflejo`, `sonrisa` |
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
python3 scripts/produce.py stories/008-x.json --saida /tmp/hm --teste   # JPGs em /tmp/hm/HM008_*.jpg
```

Olhe os JPGs: o susto aparece na tela? O primeiro quadro (gancho) assusta? A legenda não cobre o
essencial? Só então rode sem `--teste`.

## Regras do canal

- O susto tem que **aparecer na tela**, não só ser contado. O primeiro quadro tem que ser forte.
- Sem sangue, sem violência gráfica, sem suicídio, sem crianças em perigo de forma explícita.
- Tudo narrado como ficção ("Historia de ficción narrada" na descrição). `containsSyntheticMedia` fica
  `false` porque a animação não é realista; a voz sintética não exige o selo.
- `selfDeclaredMadeForKids` sempre `false`. Categoria 24 (Entretenimento), idioma `es`.
- Final com loop ou frase que puxa comentário; pergunta na descrição.
- Cada vídeo é uma história completa: a reviravolta do final tem que ficar clara para quem assiste uma vez só
  (diga o que ela significa, não só insinue).
- Ideia futura (não fazer ainda): histórias em partes com "Parte 2 mañana a las 9 pm".
