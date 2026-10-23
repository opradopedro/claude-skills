---
name: canal-engenharia
description: Produz e agenda no YouTube os Shorts do canal So You Built It (@SoYouBuiltIt, inglês), dois por dia, com animação 3D semirrealista em código, narração Gemini e upload automático.
---

# Canal So You Built It

Canal faceless de Shorts em inglês, **nunca** marcado como feito para crianças. Dois formatos, um vídeo de cada por dia:

- **Evolucao** ("You built a septic tank"): o espectador "constrói" algo do jeito errado, dá problema, e cada cena
  resolve um problema até chegar no sistema de verdade. Sai às 23h UTC (19h de Nova York), 2 h depois da Curiosidade.
- **Curiosidade** ("How does an eraser actually erase?"): como uma coisa do dia a dia funciona por dentro.
  Sai às 21h UTC (17h de Nova York), pico do público de língua inglesa.

Estilo (referência do Pedro, 23/10): 3D semirrealista em corte (terra com textura, camadas, lençol freático),
sobrado e quintal ao fundo, câmera que passeia, **uma palavra de legenda por vez no centro**, sem música de fundo (só voz e efeitos; o Pedro não gostou da marimba).
Custo zero: Three.js no Chromium, voz Gemini TTS grátis, YouTube Data API.

## Rodar (rotina diária)

```bash
pip install -q numpy soundfile playwright sherpa-onnx
cd skills/canal-engenharia
python3 scripts/produce.py --proximo --subir --saida /tmp/yb
```

`--proximo` consulta o canal e pega o primeiro roteiro ainda não subido de cada formato em `stories/`.

- **Trava de aprovação**: `--subir` só funciona se existir o arquivo `APROVADO` na pasta da skill. O Pedro pediu
  para aprovar o primeiro vídeo antes de qualquer postagem. Sem ele, rode sem `--subir`, mande o MP4 (fica em
  `/mnt/project-files/canal-engenharia/videos/`) e espere. Crie `APROVADO` só depois da aprovação escrita dele.
- Antes do primeiro upload, rode `python3 scripts/yt_upload.py canal` e confira que o token é de
  **So You Built It** (o canal fica na mesma conta do Radar GTA VI: um token do canal errado postaria lá).
- `FILA CHEIA`: já há 4 ou mais vídeos agendados; nada a fazer hoje.
- `SEM ROTEIRO <formato>`: escreva o próximo (seção abaixo), confira os quadros com `--teste` e rode de novo.
  Nunca suba roteiro ou mundo novo sem ter olhado os quadros.

Variáveis de ambiente (só no ambiente, nunca imprimir, nunca pedir no chat):
`GEMINI_API_KEY`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN_EN` (mesmo cliente OAuth do Hora Muerta).
Voz: Gemini `Charon`, ritmo normal. Sem Gemini cai no Kokoro inglês (am_michael), só para teste;
com `--subir` o script para com `VOZ FALHOU`. Sessão ligada ao computador do Pedro não alcança as APIs do Google:
produza e suba numa sessão sem dispositivo (a rotina).

Tempo: o render em CPU leva uns 15 a 25 min por vídeo de 40 s. Cota do YouTube: 1.600 unidades por upload.

## Painel dos canais (antes e depois de cada execução)

O Pedro acompanha, vota, pede mudanças e manda ideias em **https://claude.ai/artifact/2SptRCzSbXHuKHPzct4Tu2**
(conta `yb`). Siga o passo a passo de `skills/painel/README.md` (branch main):

1. **Antes de produzir:** leia `pedidos` abertos e `ideias` novas com `canal == "yb"`, aplique e responda cada um
   (ideia boa vira roteiro no backlog ou o próximo vídeo).
2. **Depois de subir:** `python3 skills/painel/painel.py --canal yb --stories skills/canal-engenharia/stories
   --videos /mnt/project-files/canal-engenharia/videos --atual /tmp/painel/atual/canais/yb.json --saida /tmp/painel/yb`
   e grave o doc `canais/yb`, como o README explica.

## Peças

| Script | Faz |
|---|---|
| `scripts/produce.py` | Orquestra: voz, vídeo, trilha, MP4 final e upload agendado |
| `scripts/engine3d.html` | Motor: Three.js, luz, texturas por código, quintal com sobrado, legenda, câmera |
| `scripts/mundos/<nome>.js` | Um mundo 3D por tema (`fossa`, `borracha`); o roteiro escolhe com `"mundo"` |
| `scripts/render.py` | Chromium (swiftshader) quadro a quadro para FFmpeg, 30 fps; `--teste 1,5,9` salva JPGs |
| `scripts/tts.py` | Gemini TTS com tempo de cada palavra; reserva Kokoro (`KOKORO_LANG=en`) |
| `scripts/mix.py` | Voz sem música (`YB_MUSICA=1` volta a marimba), whoosh nas trocas de cena, efeitos `erro`, `certo`, `tada`, -14 LUFS |
| `scripts/yt_upload.py` | `subir`, `publicados` (códigos YBxxx pela tag) e `canal` (de quem é o token) |
| `scripts/comum.py` | Converte cenas e eventos do roteiro em segundos |

Marca (logo B, calculadora com capacete, escolhida pelo Pedro): `/mnt/project-files/canal-engenharia/marca/`.

## Escrever um roteiro novo

Escolha o tema em [references/temas.md](references/temas.md) e marque `[x]`. Arquivo `stories/NNN-slug.json`,
código `YBNNN` seguido. Exemplos completos: `stories/001-septic.json` e `stories/002-eraser.json`.

```json
{
  "codigo": "YB003", "mundo": "poco", "formato": "Evolucao",
  "titulo": "You built a water well 💧 #engineering #shorts",
  "capa": "YOU BUILT A WELL",
  "descripcion": "1 frase\n\nWhat should we build next?\n\n#engineering #howitworks #shorts",
  "tags": ["engineering", "how it works", "..."],
  "lineas": [{"texto": "So you dug a hole for water.", "pausa": 0.3}],
  "cenas": [{"linea": 0, "comp": "poco", "p": {"etapa": "buraco"}}],
  "eventos": [{"tipo": "erro", "linea": 1, "en": "fin"}],
  "destaque": []
}
```

- 9 a 11 frases curtas, 35 a 50 s. Evolucao: abre com "So you ...", alterna problema (`erro`) e solução (`certo`),
  fecha com o sistema completo (`tada`) e uma pergunta para comentários. Curiosidade: abre com a pergunta,
  derruba um mito, mostra o mecanismo por dentro e fecha com "Now you know".
- Uma cena por frase, cada uma com `p.etapa`. O mundo decide o que aparece em cada etapa.
- Nada de conteúdo infantil: tom de documentário curto, humor leve, sem personagens fofos.

## Escrever um mundo novo

Quase todo tema pede um mundo: `scripts/mundos/<nome>.js`, uma IIFE que termina em
`MUNDO = { monta, atualiza, camera, overlay }`.

- `monta(h)`: monta a cena uma vez. Use os helpers do motor: `quintal()` (céu, grama, sobrado, cerca, árvores),
  `tmat('terra'|'concreto'|'madeira'|...)` (texturas por código), `uvMundo`, `box`, `solid`, `cyl`, `grupo`, `mat`.
- `atualiza(t, ctx)`: **sem estado**, tudo em função de `t` e da etapa (`ctx.p.etapa`, `ctx.lt` de 0 a 1 na cena).
  Isso deixa o `--teste` pular para qualquer segundo.
- `camera(t, ctx)`: `cameraPadrao(t, ctx, {x, y, d, a, h}, p => CAM[p.etapa])`.
- `overlay(t, ctx)`: rótulos 2D com `pill` e `proj` (posição 3D na tela).

Use `fossa.js` (corte de terreno) ou `borracha.js` (vários lugares na mesma cena com corte e zoom) de modelo.
Confira sempre com `python3 scripts/render.py stories/X.json tempos.json /tmp/x.mp4 --teste 2,8,14,20,26,32`
(com `YB_SEM_LEGENDA=1` para quadros limpos) e olhe cada JPG antes de renderizar o vídeo inteiro.
