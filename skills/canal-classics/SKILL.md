---
name: canal-classics
description: Produz e agenda no YouTube os Shorts do canal Old Tales Retold (ingles) — historias classicas que já existem (Shakespeare, Odisseia, Poe, mitos) narradas e animadas, ao meio-dia de Nova York. Reaproveita o motor do canal-terror.
---

# Canal Old Tales Retold (classicos narrados, ingles)

Canal faceless de Shorts em ingles que conta **historias que ja existem**: tragedias de Shakespeare,
cantos da Odisseia, contos de Poe, mitos gregos e nordicos, lendas arturianas. A historia nao e
inventada — o trabalho e **cortar ao essencial, narrar bem e animar a cena**.

- Publicacao: **2 partes por dia**, ao **meio-dia** e as **19h de Nova York** (o motor acerta o horario
  de verao sozinho). Uma obra em 4 partes sai em 2 dias.
- Vantagem sobre inventar historia: o roteiro e **adaptacao**, nao criacao. Sai mais rapido, erra menos
  e os temas nunca acabam. Obra em dominio publico: sem problema de direito autoral.
- Nunca marcado como feito para criancas. Categoria 24, idioma `en`.

## Como rodar

```bash
python3 motor-en/produce.py skills/canal-classics --teste --saida /tmp/cl              # so os JPG
python3 motor-en/produce.py skills/canal-classics --saida /tmp/cl                      # MP4 sem subir
python3 motor-en/produce.py skills/canal-classics --proximo --subir --saida /tmp/cl    # agenda a serie
python3 motor-en/yt_upload.py canal --canal skills/canal-classics                      # de quem e o token?
```

Variaveis de ambiente: `GEMINI_API_KEY`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_CLASSICS`.
As mensagens de erro e a trava de canal sao as mesmas do `canal-survival` (ver o SKILL.md dele).
Codigo dos roteiros: `CLNNN`.

## IMPORTANTE: por onde comecar (decisao de custo)

O motor de cenas que estamos reaproveitando foi feito para **terror gotico**: corredor, vela e retrato,
porta, janela, olhos no escuro, agua ao luar, estrada a noite. Peca de cena nova e a coisa **mais caro**
de produzir no pipeline inteiro.

Por isso a ordem de trabalho e:

1. **Primeiro, os classicos escuros** — eles cabem nas pecas que ja existem, com zero codigo novo:
   Macbeth (vela e retrato, corredor do castelo, punhal), Hamlet (vulto na muralha, o fantasma do pai),
   Poe (O Coracao Delator, O Gato Preto, A Queda da Casa de Usher), Frankenstein, Dracula, Fausto,
   A Pata de Macaco, O Corvo.
2. **Depois, se o canal responder bem**, vale investir em pecas novas para antiguidade e mar aberto:
   navio, vela de barco, caverna, templo, falesia. So entao entram Odisseia, Iliada e mitos gregos.

Nao comece pela Odisseia: ela e a que exige mais codigo novo. Comece por Macbeth e Poe.

## Escrever um roteiro novo

Mesmo formato do `canal-survival` (ver o SKILL.md dele para os campos, as pecas de cena, os efeitos e
o marcador `{when_next}` — use sempre ele, nunca escreva "tomorrow" na mao, porque com duas
publicacoes por dia a parte seguinte pode sair no mesmo dia). Diferencas deste canal:

- **Serie de 2 a 4 partes** por obra. Uma tragedia inteira nao cabe em 50 s: corte em atos.
  Ex.: Macbeth em 3 partes (a profecia / o assassinato / a queda).
- **Primeira frase = o gancho da historia, nao o nome da obra.** Errado: "Today, Macbeth."
  Certo: "Three witches told him he would be king. So he killed to make it true."
  O nome da obra entra no titulo e na descricao, nao na narracao.
- **Narre como quem conta um caso**, nao como aula de literatura. Sem data, sem nome de autor na
  narracao, sem "nesta obra o autor explora". Presente ou passado simples, frases curtas.
- **Fidelidade:** a reviravolta tem que ser a da obra. Confira os fatos antes de escrever — este canal
  perde a confianca do publico se errar a historia.
- Na descricao, credite a obra e o autor: `Based on "Macbeth" by William Shakespeare (public domain).`
- Feche com uma pergunta que puxa comentario ("Was it the witches, or was it always him?").

## Virar video longo depois (planejado)

Igual ao `canal-survival`: as partes de uma obra sao pensadas para grudar em ordem e virar um video
unico da tragedia inteira. Aqui isso e ainda mais valioso, porque "Macbeth em 4 minutos" e um formato
que funciona bem em video longo.
