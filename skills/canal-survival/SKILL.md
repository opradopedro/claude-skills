---
name: canal-survival
description: Produz e agenda no YouTube os Shorts de terror realista de sobrevivencia do canal Signal Lost (ingles), em series de 3 a 4 partes, as 19h de Nova York. Reaproveita o motor do canal-terror sem alterar nada dele.
---

# Canal Signal Lost (terror realista de sobrevivencia, ingles)

Canal faceless de Shorts em ingles. **Nao** e terror sobrenatural de lenda: e terror de
**situacao real levada ao extremo** — a pessoa esta presa, isolada ou cercada, e a ameaca e
plausivel. Cada historia e uma **serie de 3 a 4 partes** contada em primeira pessoa por um
sobrevivente, como se fosse um relato gravado.

- Publicacao: 1 parte por dia as **19h de Nova York** (o motor converte para UTC e acerta sozinho
  no horario de verao). Agendado como privado com `publishAt`: o Pedro pode vetar no YouTube Studio antes da hora.
- Nunca marcado como feito para criancas. Publico 16+. Sem sangue, sem gore.
- Custo zero de ferramenta: cenas desenhadas em codigo, voz Gemini TTS no plano gratis, YouTube Data API.

## Como rodar

```bash
# so os quadros de conferencia (JPG), sem produzir video
python3 motor-en/produce.py skills/canal-survival --teste --saida /tmp/sv

# produz o MP4 completo, sem subir
python3 motor-en/produce.py skills/canal-survival --saida /tmp/sv

# produz e agenda a serie inteira (uso diario)
python3 motor-en/produce.py skills/canal-survival --proximo --subir --saida /tmp/sv
```

`--proximo` pega a primeira serie de `stories/` com parte ainda nao subida e agenda **todas as
partes de uma vez**, em dias seguidos. As partes nao podem se separar, porque a parte 1 promete a
parte 2 para "tomorrow" com o nome do dia.

Mensagens que o programa pode imprimir:

| Mensagem | O que significa |
|---|---|
| `FILA CHEIA` | Ja ha 2 ou mais videos agendados no futuro. Normal, nada a fazer hoje. |
| `SEM ROTEIRO` | Todas as series ja foram subidas. Escreva uma nova (secao abaixo). |
| `CANAL ERRADO` | O token e de outro canal. **Nada foi enviado.** Confira a variavel de ambiente. |
| `CODIGO ERRADO` | Roteiro com codigo que nao comeca com `SV` (arquivo na pasta errada). |
| `LEGENDA FORA DA VOZ` / `NAO SUBIU` | A legenda escorregou do audio. Conserte e rode de novo. |
| `VOZ FALHOU` | O Gemini nao respondeu. Nao publica com a voz de reserva. Tente mais tarde. |
| `FUSO NAO ENCONTRADO` | No Windows falta a tabela de fusos: `pip install tzdata`. |

Variaveis de ambiente (so no ambiente, nunca no repositorio, nunca no chat):
`GEMINI_API_KEY`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_SURVIVAL`.

Conferir de quem e o token antes do primeiro upload:

```bash
python3 motor-en/yt_upload.py canal --canal skills/canal-survival
```

## Trava de canal (importante)

Os dois canais novos ficam na **mesma conta Google**, com o mesmo cliente OAuth. Um token trocado
publicaria no canal errado. Por isso o `canal.json` tem o campo `canal_titulo`: preencha com o nome
**exato** do canal no YouTube. O programa confere antes de produzir qualquer coisa e se recusa a
subir se nao bater.

## Padrao de qualidade

- **Pesquisa de tema:** procure situacoes de confinamento e isolamento que o publico de lingua
  inglesa comenta de verdade (r/nosleep, r/LetsNotMeet, r/TrueOffMyChest, relatos de desastre,
  "liminal survival"). Liste pelo menos 8 candidatos com nota de 1 a 5 em: plausibilidade
  (da arrepio porque podia acontecer), gancho nos 2 primeiros segundos, se as cenas cabem nas pecas
  que ja existem e se rende 3 ou 4 partes. Fuja do que ja esta em `stories/` e do que esta saturado.
- **Conferencia visual:** rode com `--teste` e **olhe cada JPG** antes do render final. O primeiro
  quadro (gancho) precisa assustar. A legenda fica em 62% da altura: confira que nao cobre o essencial.
- A legenda e o audio ja tem conferencia automatica (o motor ouve o MP4 final com o Whisper e
  compara com a legenda; 85% das palavras reconhecidas, nenhuma fora mais de 0,3 s).

## Regras do canal

- A ameaca **nunca e explicada por completo**. O medo vem do que a pessoa decide fazer, nao do monstro.
- Toda serie termina com uma **regra** — uma frase que o espectador leva para a vida ("real rescuers
  never ask"). E o que gera comentario e salvamento.
- A reviravolta do final tem que ficar **clara para quem assiste uma vez so**: diga o que ela
  significa, nao apenas insinue.
- Sem sangue, sem violencia grafica, sem suicidio, sem crianca em perigo de forma explicita.
- Tudo narrado como ficcao ("Narrated fiction" na descricao). `containsSyntheticMedia` fica `false`
  porque a animacao nao e realista. `selfDeclaredMadeForKids` sempre `false`. Categoria 24, idioma `en`.

## Escrever uma serie nova

Um arquivo por parte: `stories/NNN-slug-P.json` (NNN = numero seguido, P = parte). Codigo `SVNNN`.
Modelo completo e testado: a serie `elevator` (`001` a `004`).

- **Parte 1** (40 a 55 s): gancho forte na primeira frase, a situacao cresce e **para no pior momento**.
  A ultima frase e sempre `"Part two, tomorrow, {next_day}."` com a cena
  `{"comp": "texto", "p": {"lineas": ["PART 2", "Tomorrow \u00b7 {next_date}"]}}`.
  Na descricao: `> Part 2: tomorrow, {next_date}.`
  O motor troca `{next_day}` ("Thursday") e `{next_date}` ("Thursday, October 29") pelo dia em que a
  proxima parte sai. **Nunca falar horario** (o publico esta em vários fusos).
- **Partes 2 em diante:** comecam com `"Part two."` + uma frase que relembra onde parou.
  A ultima parte fecha com a reviravolta explicada e a regra.
- Campos de serie em todas as partes: `"serie"`, `"serie_titulo"` (vira playlist), `"parte"`,
  `"partes"`; da parte 2 em diante, `"anterior": "SV001"` (codigo da parte anterior).
- `"capa"`: 2 a 5 palavras em maiusculas, **diferentes em cada parte**, sobre o conteudo daquela parte.
- `lineas`: 7 a 9 frases curtas, no maximo 58 s (a voz do Gemini e lenta, ~5 s por frase).
  `pausa` e o silencio depois da frase; `vel` so vale na voz de reserva.
- `destaque`: palavras que aparecem em vermelho na legenda. Use as de maior impacto.
- `gancho`: os primeiros 0,8 s mostram o quadro do susto antes da historia comecar. **Use sempre.**

### Pecas de cena disponiveis (nao precisa escrever codigo novo)

Vem do motor do canal-terror. Para este canal, as mais uteis:

| comp | cena | p | eventos proprios |
|---|---|---|---|
| `puerta` | porta (serve de porta de elevador, abrigo, quarto) | `abre` [ini, fim], `luz`, `garras` | `abre`, `mano` (dedos na borda), `susto` (olhos), `garras` |
| `telefono` | celular no escuro — **ideal para alerta do governo** | `hora`, `de`, `msg` [linhas] | `mensaje`, `vibra` |
| `texto` | cartela de regra (titulo vermelho + subtitulo) | `lineas` [titulo, subtitulo] | |
| `reloj` | relogio digital vermelho (marcar a passagem do tempo) | `hora`, `parpadeo` | |
| `pasillo` | corredor com vulto (escada, corredor de predio) | `dist` [ini, fim] 1 longe a 0 perto, `figura`, `marco`, `parpadeo` | `acerca` |
| `ojos` | olhos vermelhos no escuro | `n`, `cerca` [ini, fim], `color` | `acerca` |
| `ventana` | janela vista de dentro | `cara` | `cara` (rosto e maos no vidro) |
| `camino` | estrada de terra a noite, lua, figura | `dist`, `figura`, `ojos` | `acerca` |
| `autobus` | onibus vazio a noite | `figura`, `lado` | `aparece`, `voltea` |
| `rio` | agua ao luar | `dist` | `grito` |

Todas aceitam `zoom` (aproximacao lenta, padrao 0.06), `fy` (centro do zoom, 0 a 1), `niebla`, `temblor`.

Efeitos globais: `susto` (flash vermelho + estrondo), `golpe` (batida), `flash`, `negro` (tela preta
por `dur`), `apagon` (luz piscando). So som: `grito`, `vibra`, `silbido`, `apaga`, `cadenas`, `aullido`.

**So crie peca nova se a historia realmente nao couber nas de cima** — peca nova e a parte mais caro
de produzir. Se criar, faca em `skills/canal-survival/engine-extra.js` e nunca editando o
`engine.html` do canal-terror (quebraria o Hora Muerta, que esta funcionando).

## Virar video longo depois (planejado)

As partes de uma serie sao feitas para **grudar uma na outra**: mesma serie, mesma playlist, ordem por
`parte`. Para montar o video longo, junte os MP4 das partes na ordem, cortando a ultima frase
("Part two, tomorrow...") e a cartela `PART N` de cada parte, menos a ultima. O corte e sempre a
ultima cena do roteiro, entao da para fazer isso sem reescrever nada. Nao esta implementado ainda —
e o proximo passo depois de os dois canais estarem publicando sozinhos.
