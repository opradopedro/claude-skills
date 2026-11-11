# Notas do Pedro para esta skill (cartoon-3d-short)

Skill de terceiro (github.com/mromidev/claude-animated-shorts, licença MIT), copiada sem mudanças em
`SKILL.md`, `templates/` e `references/`. Conferida em 11/11/2026: o código só roda local (three.js +
Remotion + Python/numpy). Não chama API paga, não manda dados para fora e não precisa de gerador de vídeo por IA.

## O que vale por cima do SKILL.md original

As regras dos canais do Pedro ganham das regras do autor quando as duas brigam:

- **Legenda:** o SKILL.md diz "No captions". Nos canais do Pedro a legenda é obrigatória e colada na voz:
  tempo de cada palavra pelo alinhamento forçado (`canais-dark/motor-en/sincronia.py alinhar`), a palavra
  entra 1 quadro antes da voz.
- **Nenhum som depois da narração:** o vídeo e a trilha terminam junto com a última palavra. O Gemini TTS às vezes
  solta um estalo de ruído no fim: cortar o áudio logo depois da última palavra (medir o RMS do fim).
- **Voz:** Gemini TTS de graça (Old Tales: voz `Algieba`, estilo `[warm] [vivid] [storyteller]`), não gravação.
- **Esforço padrão**, sem "Opus max" para conferir cada quadro (economia de tokens).
- **Nada de publicar** vídeo de teste.

## Como rodar na nuvem (sem GPU), testado em 11/11/2026

- `npm i remotion@4.0.542 @remotion/three @remotion/bundler @remotion/renderer react@18 react-dom@18 three@0.169.0 @react-three/fiber@8 @react-three/postprocessing@2 postprocessing@6`
- Chromium do container: `browserExecutable: /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`,
  `chromiumOptions: { gl: "swangle" }` (WebGL por software).
- Velocidade: ~3 s por quadro em 1080x1920 com `concurrency: 4` (vídeo de 38 s ≈ 55 min). Prévias (`renderStill`, scale 0.4): 10-17 s cada.
- Os modelos Kenney da ponte (`public/bridge/kenney/*.glb`) NÃO vêm no repositório; o kenney.nl bloqueia a nuvem.
  O exemplo do Wukong (`templates/wukong/`) não usa nenhum: tudo é feito em código (rochas com ruído, pinheiros, palácio).

## Exemplo pronto: Wukong (teste de 11/11/2026, Old Tales)

`templates/wukong/` = cena completa de 38 s (pedra na montanha sobre o mar de nuvens, a pedra racha, o macaco nasce,
raios dourados dos olhos até o céu, Palácio de Jade, salto pela cachoeira, reino escondido, Rei Macaco).
Reaproveita do original `ink.ts`, `lensblur.ts`, `grade.ts`, `shade.ts`, `lights.ts`, `cardshade.ts`, `paint.ts`,
`toon.ts` (só exporta `faceFront` e `taper`). Arquivos novos: `story.ts` (planos e câmeras), `world.ts` (mundo),
`monkey.ts` (macaco desenhado: pelo marrom, máscara clara em coração, orelhas redondas, cauda, mãos claras),
`Wukong.tsx` (pós-processamento + legenda), `audio/score.py` (trilha e efeitos em numpy), `stills.mjs`/`render.mjs`.
Defeitos do Wukong 3D antigo que este evita: a pedra é um ovo de pedra liso (nada de madeira), o macaco é bicho
(não humano), câmera só desliza (um tranco de 6 quadros só no racho), nada de objeto solto.
